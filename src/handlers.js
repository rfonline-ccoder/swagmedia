import * as user from './user.js';
import * as keyboards from './keyboards.js';
import * as shop from './shop.js';
import config, { admin_ids, report_peer_id } from './config.js';
import { db } from './database.js';

export async function handleMessage(context, vk) {
    const userId = context.senderId;
    let currentUser;
    try {
        currentUser = await user.getUser(userId);
    } catch (e) {
        return context.send('Ошибка. Вы не зарегистрированы как медиа. Подайте заявку на сотрудничество.', { keyboard: keyboards.startKeyboard });
    }
    const text = context.text.toLowerCase();

    // Универсальная обработка кнопки 'Начать'
    const cleanText = text.trim().toLowerCase().replace(/[^а-яa-zё]/gi, '');
    if (cleanText === 'начать') {
        if (currentUser.is_approved) {
            return context.send('👑 Добро пожаловать в главное меню!', { keyboard: keyboards.mainMenuKeyboard });
        } else if (currentUser.state === 'waiting_verifing') {
            return context.send('Ваша заявка на сотрудничество уже на рассмотрении. Ожидайте решения.', { keyboard: keyboards.startKeyboard });
        } else {
            return context.send('📝 Для сотрудничества нажмите кнопку ниже и заполните заявку!', { keyboard: keyboards.startKeyboard });
        }
    }
    if (!currentUser.is_approved && ['платное', 'бесплатное', 'семьи'].includes(text)) {
        let type = text === 'семьи' ? 'Семьи' : text === 'платное' ? 'Платное' : 'Бесплатное';
        if (type === 'Семьи') {
            await user.setUserState(userId, 'awaiting_family_name', { type });
            return context.send('📝 Введите название вашей семьи:', { keyboard: keyboards.backToMainMenu() });
        } else {
            await user.setUserState(userId, 'awaiting_nickname', { type });
            return context.send(`📝 Вы выбрали: ${type}.\n\nВведите ваш игровой ник:`, { keyboard: keyboards.backToMainMenu() });
        }
    }
    // Обработка только в ЛС, кроме /peerid и /help
    if (context.peerId >= 2_000_000_000) {
        if (text.startsWith('/peerid') || text.startsWith('/help')) {
            return handleCommand(context, currentUser, vk);
        }
        return; // Игнорировать всё остальное в беседе
    }
    if (text.startsWith('/peerid')) return context.send(`peer_id этого чата: ${context.peerId}`);
    if (text.startsWith('/')) return handleCommand(context, currentUser, vk);
    if (currentUser.state && currentUser.state !== 'default') return handleState(context, currentUser, vk);
    return context.send('Я вас не понимаю. Воспользуйтесь кнопками.', {
        keyboard: currentUser.is_approved ? keyboards.mainMenuKeyboard : keyboards.startKeyboard
    });
}

export async function handlePayload(context, vk) {
    // payload нужен только для меню, магазина, профиля, отчета
    const userId = context.senderId;
    const payload = context.messagePayload;
    const currentUser = await user.getUser(userId);
    if (!payload) return;
    try { await context.editMessage({ keyboard: [] }); } catch (e) {}
    switch (payload.command) {
        case 'start_application_from_restart':
        case 'start_application': {
            const criteriaMsg =
                '📋 Критерии для медиа:\n\n' +
                '🔹 Бесплатное:\n' +
                '• 300+ подписчиков\n' +
                '• 20+ лайков на постах\n' +
                '• 500+ просмотров на видео\n\n' +
                '🔹 Платное:\n' +
                '• 1000+ подписчиков\n' +
                '• 50+ лайков на постах\n' +
                '• 800+ просмотров на видео\n\n' +
                'Выберите тип заявки ниже 👇';
            await context.send(criteriaMsg, { keyboard: keyboards.applicationTypeKeyboard });
            return;
        }
        case 'paid_application':
            await user.setUserState(userId, 'awaiting_nickname', { type: 'Платное' });
            return context.send('📝 Вы выбрали: Платное.\n\nВведите ваш игровой ник:', { keyboard: keyboards.backToMainMenu() });
        case 'free_application':
            await user.setUserState(userId, 'awaiting_nickname', { type: 'Бесплатное' });
            return context.send('📝 Вы выбрали: Бесплатное.\n\nВведите ваш игровой ник:', { keyboard: keyboards.backToMainMenu() });
        case 'family_application':
            await user.setUserState(userId, 'awaiting_family_name', { type: 'Семьи' });
            return context.send('📝 Введите название вашей семьи:', { keyboard: keyboards.backToMainMenu() });
        case 'back_to_start':
            await user.resetUserState(userId);
            return context.send('Ошибка. Вы не зарегистрированы как медиа. Подайте заявку на сотрудничество.', { keyboard: keyboards.startKeyboard });
        case 'main_menu':
            await user.resetUserState(userId);
            return context.send('👑 Главное меню', { keyboard: keyboards.mainMenuKeyboard });
        case 'admin_menu':
            return handleAdminMenu(context, currentUser, vk);
        case 'shop_menu':
            return handleShopMenu(context, currentUser, vk);
        case 'shop_category':
            return handleShopCategory(context, currentUser, vk, payload.category, 1);
        case 'shop_page':
            return handleShopCategory(context, currentUser, vk, currentUser.state_data.category, payload.page);
        case 'shop_buy_item':
            await user.setUserState(userId, 'awaiting_shop_item_number', { ...currentUser.state_data });
            return context.send('Введите номер товара, который хотите купить:', { keyboard: keyboards.backToCategories() });
        case 'report_menu':
            return handleReportMenu(context, currentUser, vk);
        case 'my_profile':
            return handleProfile(context, currentUser);
        default:
            return context.send('Неизвестная команда.');
    }
}

async function handleState(context, currentUser, vk) {
    const userId = context.senderId;
    const text = context.text;
    switch (currentUser.state) {
        case 'awaiting_family_name':
            await user.updateUserStateData(userId, { family_name: text });
            await user.setUserState(userId, 'awaiting_leader_nickname', { ...currentUser.state_data, family_name: text });
            return context.send('👑 Введите ник лидера семьи:', { keyboard: keyboards.backToMainMenu() });
        case 'awaiting_leader_nickname':
            await user.updateUserStateData(userId, { leader_nickname: text });
            await user.setUserState(userId, 'awaiting_channel_link', { ...currentUser.state_data, leader_nickname: text });
            return context.send('🔗 Введите ссылку на канал:', { keyboard: keyboards.backToMainMenu() });
        case 'awaiting_nickname':
            await user.updateUserStateData(userId, { nickname: text });
            await user.setUserState(userId, 'awaiting_channel_link', { ...currentUser.state_data, nickname: text });
            return context.send('🔗 Введите ссылку на канал:', { keyboard: keyboards.backToMainMenu() });
        case 'awaiting_channel_link':
            await user.updateUserStateData(userId, { channel_link: text });
            await submitCooperationApplication(context, vk);
            await db.query('UPDATE users SET state = ? WHERE vk_id = ?', ['waiting_verifing', userId]);
            await user.resetUserState(userId);
            return context.send('✅ Ваша заявка отправлена на рассмотрение. Ожидайте, пожалуйста.', { keyboard: keyboards.startKeyboard });
        case 'awaiting_report':
            await db.query('INSERT INTO reports (user_vk_id, text) VALUES (?, ?)', [userId, text]);
            const [[lastReport]] = await db.query('SELECT id FROM reports WHERE user_vk_id = ? ORDER BY id DESC LIMIT 1', [userId]);
            const reportId = lastReport ? lastReport.id : '?';
            const msg = `📝 Новый отчет 🆔 #${reportId}
👤 vk.com/id${userId}
💬 Текст:
${text}
Баланс: ${currentUser.balance} MC | Админка: ${currentUser.admin_level} ⭐

Для подтверждения: /acceptreport ${reportId} 500 👍 Хорош!`;
            console.log('[REPORT][NEW]', msg);
            await vk.api.messages.send({ peer_id: report_peer_id, message: msg, random_id: Date.now() });
            await user.resetUserState(userId);
            return context.send('Ваш отчет отправлен!', { keyboard: keyboards.mainMenuKeyboard });
        case 'awaiting_shop_item_number': {
            const itemId = parseInt(text, 10);
            if (isNaN(itemId)) return context.send('Введите корректный номер товара.', { keyboard: keyboards.backToCategories() });
            const item = await shop.getItemById(itemId);
            if (!item) return context.send('Товар не найден.', { keyboard: keyboards.backToCategories() });
            await user.setUserState(userId, 'awaiting_shop_confirm', { ...currentUser.state_data, itemId });
            return context.send(`Вы хотите купить: ${item.name} за ${item.price} MC?\nПодтвердите "Да" или "Нет".`, { keyboard: keyboards.backToCategories() });
        }
        case 'awaiting_shop_confirm': {
            if (text.toLowerCase() === 'да') {
                const item = await shop.getItemById(currentUser.state_data.itemId);
                if (!item) return context.send('Товар не найден.', { keyboard: keyboards.backToCategories() });
                if (currentUser.balance < item.price) return context.send('Недостаточно средств.', { keyboard: keyboards.backToCategories() });
                await db.query('INSERT INTO shop_orders (user_vk_id, item_id, status) VALUES (?, ?, ?)', [userId, item.id, 'pending']);
                await user.changeBalance(userId, -item.price);
                await user.resetUserState(userId);
                const [[lastOrder]] = await db.query('SELECT id FROM shop_orders WHERE user_vk_id = ? ORDER BY id DESC LIMIT 1', [userId]);
                const orderId = lastOrder ? lastOrder.id : '?';
                const msg = `🛒 Заявка на магазин 🆔 #${orderId}
👤 vk.com/id${userId}
Товар: ${item.name} (${item.id})
Для подтверждения: /acceptshop ${orderId}`;
                console.log('[SHOP][NEW]', msg);
                await vk.api.messages.send({ peer_id: report_peer_id, message: msg, random_id: Date.now() });
                return context.send('Заявка на покупку отправлена на рассмотрение!', { keyboard: keyboards.mainMenuKeyboard });
            } else if (text.toLowerCase() === 'нет') {
                await user.resetUserState(userId);
                return context.send('Покупка отменена.', { keyboard: keyboards.mainMenuKeyboard });
            } else {
                return context.send('Введите "Да" или "Нет".', { keyboard: keyboards.backToCategories() });
            }
        }
        default:
            await user.resetUserState(userId);
            return context.send('Возвращаю в главное меню.', { keyboard: keyboards.mainMenuKeyboard });
    }
}

async function handleShopMenu(context, currentUser, vk) {
    const categories = await shop.getShopCategories();
    await user.setUserState(currentUser.vk_id, 'shop_menu');
    return context.send('Выберите категорию:', { keyboard: keyboards.shopCategoriesKeyboard(categories) });
}
async function handleShopCategory(context, currentUser, vk, category, page = 1) {
    const { items, total, limit } = await shop.getItemsByCategory(category, page, 5);
    const totalPages = Math.ceil(total / 5);
    await user.setUserState(currentUser.vk_id, 'shop_category', { category, page });
    let msg = `Категория: ${category}\nСтраница ${page}/${totalPages}\n`;
    items.forEach(item => {
        msg += `#${item.id} ${item.name} — ${item.price} MC\n${item.description}\n`;
    });
    msg += '\nДля покупки нажмите "Купить товар" и введите номер.';
    return context.send(msg, { keyboard: keyboards.shopItemsKeyboard(page, totalPages) });
}

async function handleProfile(context, currentUser) {
    const profileMessage = `👤 Ваш профиль:\n- Баланс: ${currentUser.balance} MC 💰\n- Уровень админки: ${currentUser.admin_level} ⭐`;
    return context.send(profileMessage, { keyboard: keyboards.backToMainMenu() });
}

async function handleReportMenu(context, currentUser, vk) {
    await user.setUserState(currentUser.vk_id, 'awaiting_report');
    return context.send('Введите все видео ссылки для отчёта:', { keyboard: keyboards.backToMainMenu() });
}

async function handleAdminMenu(context, currentUser, vk) {
    // Новая логика ценников:
    const adminPrices = {
        1: 0,
        2: 125,
        3: 155,
        4: 215,
        5: 265,
        6: 310,
        7: 385,
        8: 450
    };
    if (currentUser.admin_level < 1) {
        // 1 лвл бесплатно
        let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [currentUser.vk_id]);
        const [result] = await db.query('INSERT INTO admin_applications (user_vk_id, requested_level, status) VALUES (?, 1, ?)', [currentUser.vk_id, 'pending']);
        const applicationId = result.insertId;
        const msg = `👑 Заявка на админку 🆔 #${applicationId}\n👤 vk.com/id${currentUser.vk_id}\nНик: ${userInfo?.nickname || '—'}\nУровень: 1 (бесплатно)\nТекущий уровень: ${userInfo?.admin_level || 0}\nБаланс: ${userInfo?.balance || 0} MC\nVK: vk.com/id${userInfo?.vk_id}\nДля подтверждения: /acceptadmin ${applicationId}`;
        await vk.api.messages.send({ peer_id: report_peer_id, message: msg, random_id: Date.now() });
        return context.send('Ваша заявка на админку отправлена на рассмотрение.', { keyboard: keyboards.mainMenuKeyboard });
    } else if (currentUser.admin_level >= 1 && currentUser.admin_level < 8) {
        const nextLevel = currentUser.admin_level + 1;
        const price = adminPrices[nextLevel];
        if (currentUser.balance < price) {
            return context.send(`Для повышения до ${nextLevel} лвл нужно ${price} MediaCoins.`, { keyboard: keyboards.mainMenuKeyboard });
        }
        let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [currentUser.vk_id]);
        const [result] = await db.query('INSERT INTO admin_applications (user_vk_id, requested_level, status) VALUES (?, ?, ?)', [currentUser.vk_id, nextLevel, 'pending']);
        const applicationId = result.insertId;
        const msg = `👑 Заявка на админку 🆔 #${applicationId}\n👤 vk.com/id${currentUser.vk_id}\nНик: ${userInfo?.nickname || '—'}\nУровень: ${nextLevel} (${price} MC)\nТекущий уровень: ${userInfo?.admin_level || 0}\nБаланс: ${userInfo?.balance || 0} MC\nVK: vk.com/id${userInfo?.vk_id}\nДля подтверждения: /acceptadmin ${applicationId}`;
        await vk.api.messages.send({ peer_id: report_peer_id, message: msg, random_id: Date.now() });
        return context.send('Ваша заявка на повышение отправлена на рассмотрение.', { keyboard: keyboards.mainMenuKeyboard });
    } else {
        return context.send('У вас максимальный уровень админки.', { keyboard: keyboards.mainMenuKeyboard });
    }
}

async function handleCommand(context, currentUser, vk) {
    const [command, ...args] = context.text.slice(1).split(' ');
    const isAdmin = admin_ids.includes(currentUser.vk_id);
    if ([
        "acceptmedia", "acceptshop", "acceptadmin",
        "declinemedia", "declineshop", "declineadmin",
        "acceptreport"
    ].includes(command) && !isAdmin) {
        return context.send('У вас нет прав для использования этой команды.');
    }
    switch (command) {
        case 'acceptmedia': {
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /acceptmedia [id]');
            await handleApplicationDecision(id, currentUser.vk_id, 'approved', vk, 'coop');
            return;
        }
        case 'declinemedia': {
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /declinemedia [id]');
            await handleApplicationDecision(id, currentUser.vk_id, 'rejected', vk, 'coop');
            return;
        }
        case 'acceptadmin': {
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /acceptadmin [id]');
            await handleApplicationDecision(id, currentUser.vk_id, 'approved', vk, 'admin');
            return;
        }
        case 'declineadmin': {
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /declineadmin [id]');
            await handleApplicationDecision(id, currentUser.vk_id, 'rejected', vk, 'admin');
            return;
        }
        case 'acceptshop': {
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /acceptshop [id]');
            await handleShopOrderDecision(id, currentUser.vk_id, 'approved', vk);
            return;
        }
        case 'declineshop': {
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /declineshop [id]');
            await handleShopOrderDecision(id, currentUser.vk_id, 'rejected', vk);
            return;
        }
        case 'givemc':
        case 'takemc': {
            let targetArg = args[0];
            const amount = parseInt(args[1], 10);
            if (!targetArg || isNaN(amount)) {
                return context.send('Использование: /givemc [@username, id или vk_id] [сумма] или /takemc [@username, id или vk_id] [сумма]');
            }
            let targetUser = null;
            // Если это число — ищем по id из БД
            if (/^\d+$/.test(targetArg)) {
                let [[userById]] = await db.query('SELECT * FROM users WHERE id = ?', [parseInt(targetArg, 10)]);
                if (!userById) {
                    return context.send('Пользователь с таким id не найден.');
                }
                targetUser = userById;
            } else if (targetArg.startsWith('@')) {
                const username = targetArg.replace('@', '').trim();
                try {
                    const userInfo = await vk.api.users.get({ user_ids: username });
                    if (userInfo && userInfo[0] && userInfo[0].id) {
                        let [[userByVkId]] = await db.query('SELECT * FROM users WHERE vk_id = ?', [userInfo[0].id]);
                        if (!userByVkId) {
                            return context.send('Пользователь по тегу не найден в базе бота.');
                        }
                        targetUser = userByVkId;
                    } else {
                        return context.send('Пользователь по тегу не найден в VK.');
                    }
                } catch (e) {
                    console.log('[givemc/takemc][ERROR VK API]', e);
                    return context.send('Ошибка VK API при поиске пользователя по тегу.');
                }
            } else {
                // Попытка как vk_id
                let vkIdToUse = parseInt(targetArg, 10);
                if (isNaN(vkIdToUse)) {
                    return context.send('Некорректный vk_id.');
                }
                let [[userByVkId]] = await db.query('SELECT * FROM users WHERE vk_id = ?', [vkIdToUse]);
                if (!userByVkId) {
                    return context.send('Пользователь не найден в базе бота.');
                }
                targetUser = userByVkId;
            }
            await user.changeBalance(targetUser.vk_id, command === 'givemc' ? amount : -amount);
            await vk.api.messages.send({
                user_id: targetUser.vk_id,
                message: `${command === 'givemc' ? '💸 Вам начислено' : '💸 У вас списано'} ${amount} MC администратором!`,
                random_id: Date.now()
            });
            return context.send(`Баланс пользователя 🆔 ${targetUser.id} (vk.com/id${targetUser.vk_id}) изменён на ${command === 'givemc' ? '+' : '-'}${amount} MC.`);
        }
        case 'media': {
            const [users] = await db.query('SELECT id, vk_id, nickname, balance FROM users WHERE is_approved = 1');
            if (!users.length) return context.send('Нет медиа в базе.');
            let msg = '📋 Список медиа:\n';
            for (const u of users) {
                msg += `🆔 ${u.id} | vk.com/id${u.vk_id} | Ник: ${u.nickname || '—'} | Баланс: ${u.balance} MC\n`;
            }
            console.log('[MEDIA][LIST]', msg);
            return context.send(msg);
        }
        case 'givemc_id':
        case 'takemc_id': {
            const id = parseInt(args[0], 10);
            const amount = parseInt(args[1], 10);
            if (isNaN(id) || isNaN(amount)) {
                return context.send('Использование: /givemc_id [id] [сумма] или /takemc_id [id] [сумма]');
            }
            let [[targetUser]] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
            if (!targetUser) {
                return context.send('Пользователь с таким id не найден.');
            }
            await user.changeBalance(targetUser.vk_id, command === 'givemc_id' ? amount : -amount);
            await vk.api.messages.send({
                user_id: targetUser.vk_id,
                message: `${command === 'givemc_id' ? '💸 Вам начислено' : '💸 У вас списано'} ${amount} MC администратором!`,
                random_id: Date.now()
            });
            console.log(`[givemc_id/takemc_id] Баланс пользователя 🆔 ${targetUser.id} (vk.com/id${targetUser.vk_id}) изменён на ${command === 'givemc_id' ? '+' : '-'}${amount} MC.`);
            return context.send(`Баланс пользователя 🆔 ${targetUser.id} (vk.com/id${targetUser.vk_id}) изменён на ${command === 'givemc_id' ? '+' : '-'}${amount} MC.`);
        }
        case 'reports': {
            const [reports] = await db.query('SELECT * FROM reports WHERE status = "pending"');
            if (!reports.length) return context.send('Нет активных заявок на отчёты.');
            let msg = '📝 Активные заявки на отчёты:\n';
            for (const r of reports) {
                let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [r.user_vk_id]);
                msg += `🆔 #${r.id} | vk.com/id${r.user_vk_id} | Ник: ${userInfo?.nickname || '—'} | Уровень админки: ${userInfo?.admin_level || 0} | Баланс: ${userInfo?.balance || 0} MC | VK: vk.com/id${userInfo?.vk_id} | Текст: ${(r.text || '').slice(0, 40)}...\n`;
            }
            return context.send(msg);
        }
        case 'medias': {
            const [apps] = await db.query('SELECT * FROM cooperation_applications WHERE status = "pending"');
            if (!apps.length) return context.send('Нет активных заявок на медиа.');
            let msg = '📥 Активные заявки на медиа:\n';
            for (const a of apps) {
                let data = {};
                try { data = JSON.parse(a.data); } catch {}
                let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [a.user_vk_id]);
                msg += `🆔 #${a.id} | vk.com/id${a.user_vk_id} | Ник: ${userInfo?.nickname || '—'} | Уровень админки: ${userInfo?.admin_level || 0} | Баланс: ${userInfo?.balance || 0} MC | VK: vk.com/id${userInfo?.vk_id}\n`;
            }
            return context.send(msg);
        }
        case 'magaz': {
            const [orders] = await db.query('SELECT * FROM shop_orders WHERE status = "pending"');
            if (!orders.length) return context.send('Нет активных заявок на магазин.');
            let msg = '🛒 Активные заявки на магазин:\n';
            for (const o of orders) {
                let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [o.user_vk_id]);
                msg += `🆔 #${o.id} | vk.com/id${o.user_vk_id} | Ник: ${userInfo?.nickname || '—'} | Уровень админки: ${userInfo?.admin_level || 0} | Баланс: ${userInfo?.balance || 0} MC | VK: vk.com/id${userInfo?.vk_id} | item_id: ${o.item_id}\n`;
            }
            return context.send(msg);
        }
        case 'vidal': {
            const orderId = parseInt(args[0], 10);
            if (isNaN(orderId)) return context.send('Использование: /vidal [id заявки]');
            await db.query('UPDATE shop_orders SET status = "completed" WHERE id = ?', [orderId]);
            return context.send(`Заявка #${orderId} помечена как выданная.`);
        }
        case 'acceptreport': {
            const id = parseInt(args[0], 10);
            const amount = parseInt(args[1], 10);
            const comment = args.slice(2).join(' ').trim();
            if (isNaN(id) || isNaN(amount) || !comment) {
                return context.send('Использование: /acceptreport [id] [кол-во_коинов] [комментарий]');
            }
            await handleAcceptReport(id, amount, comment, vk, currentUser.vk_id);
            return;
        }
        case 'delmedia': {
            const id = parseInt(args[0], 10);
            const reason = args.slice(1).join(' ').trim();
            if (isNaN(id) || !reason) {
                return context.send('Использование: /delmedia [id] [причина]');
            }
            let [[targetUser]] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
            if (!targetUser) {
                return context.send('Пользователь с таким id не найден.');
            }
            await db.query('DELETE FROM users WHERE id = ?', [id]);
            await vk.api.messages.send({
                user_id: targetUser.vk_id,
                message: `❌ Вы были сняты с поста медиа.\nПричина: ${reason}\n\nЧтобы вернуться, подайте заявку снова!`,
                keyboard: keyboards.startKeyboard,
                random_id: Date.now()
            });
            await vk.api.messages.send({
                peer_id: report_peer_id,
                message: `❌ Медиа удалён из базы!\n🆔 ${targetUser.id} | vk.com/id${targetUser.vk_id} | Ник: ${targetUser.nickname || '—'}\nПричина: ${reason}`,
                random_id: Date.now()
            });
            console.log(`[delmedia] Медиа id=${targetUser.id} vk_id=${targetUser.vk_id} удалён из базы. Причина: ${reason}`);
            return context.send(`Медиа 🆔 ${targetUser.id} удалён из базы.`);
        }
        case 'help': {
            // Работает только в беседе
            if (context.peerId < 2_000_000_000) return;
            let msg = '📖 Доступные команды:\n\n';
            msg += '👤 Пользовательские:\n';
            msg += '— /media — список медиа\n';
            msg += '— /profile — ваш профиль\n';
            msg += '— /shop — магазин\n';
            msg += '— /report — отправить отчет\n';
            msg += '— /peerid — узнать peer_id чата\n';
            msg += '— /reports — активные заявки на отчёты\n';
            msg += '— /medias — активные заявки на медиа\n';
            msg += '— /magaz — активные заявки магазина\n';
            msg += '\n';
            msg += '🛡️ Админские:\n';
            msg += '— /givemc id/вк/id @ник сумма — выдать коины\n';
            msg += '— /takemc id/вк/id @ник сумма — забрать коины\n';
            msg += '— /givemc_id id сумма — выдать коины по id\n';
            msg += '— /takemc_id id сумма — забрать коины по id\n';
            msg += '— /acceptmedia id — одобрить заявку на медиа\n';
            msg += '— /declinemedia id — отклонить заявку на медиа\n';
            msg += '— /acceptadmin id — одобрить заявку на админку\n';
            msg += '— /declineadmin id — отклонить заявку на админку\n';
            msg += '— /acceptshop id — одобрить заказ магазина\n';
            msg += '— /declineshop id — отклонить заказ магазина\n';
            msg += '— /acceptreport id сумма комментарий — одобрить отчет\n';
            msg += '— /magaz — список заказов магазина\n';
            msg += '— /vidal id — отметить заказ как выданный\n';
            msg += '— /delmedia id причина — снять медиа с должности\n';
            msg += '\n';
            msg += 'ℹ️ Для подробностей — обращайтесь к администрации.';
            return context.send(msg);
        }
        case 'setplatka': {
            if (!isAdmin) return context.send('Нет прав.');
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /setplatka [idmedia]');
            let [[targetUser]] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
            if (!targetUser) return context.send('Медиа с таким id не найден.');
            await db.query('UPDATE users SET media_type = 1 WHERE id = ?', [id]);
            await vk.api.messages.send({ user_id: targetUser.vk_id, message: 'Ваша медиа переведена в платные!', random_id: Date.now() });
            return context.send('Медиа переведена в платные.');
        }
        case 'setbesplatka': {
            if (!isAdmin) return context.send('Нет прав.');
            const id = parseInt(args[0], 10);
            if (isNaN(id)) return context.send('Использование: /setbesplatka [idmedia]');
            let [[targetUser]] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
            if (!targetUser) return context.send('Медиа с таким id не найден.');
            await db.query('UPDATE users SET media_type = 0 WHERE id = ?', [id]);
            await vk.api.messages.send({ user_id: targetUser.vk_id, message: 'Ваша медиа переведена в бесплатные!', random_id: Date.now() });
            return context.send('Медиа переведена в бесплатные.');
        }
        case 'msgmedia': {
            if (!isAdmin) return context.send('Нет прав.');
            const text = args.join(' ').trim();
            if (!text) return context.send('Использование: /msgmedia [текст]');
            await vk.api.messages.send({ peer_id: 2000000002, message: text, random_id: Date.now() });
            return context.send('Сообщение отправлено в чат.');
        }
        case 'startbot': {
            if (!isAdmin) return context.send('Нет прав.');
            const text = args.join(' ').trim();
            if (!text) return context.send('Использование: /startbot [текст]');
            const [users] = await db.query('SELECT vk_id FROM users');
            for (const u of users) {
                try {
                    await vk.api.messages.send({ user_id: u.vk_id, message: text, random_id: Date.now() });
                } catch (e) {}
            }
            return context.send('Рассылка завершена.');
        }
        default:
            return context.send('Неизвестная команда.');
    }
}

async function submitCooperationApplication(context, vk) {
    const userId = context.senderId;
    const currentUser = await user.getUser(userId);
    const { type, ...data } = currentUser.state_data;
    if (!type) {
        await user.resetUserState(userId);
        return context.send('Произошла ошибка. Тип заявки не найден. Пожалуйста, начните заново.');
    }
    const [result] = await db.query(
        'INSERT INTO cooperation_applications (user_vk_id, type, data, status) VALUES (?, ?, ?, ?)',
        [userId, type, JSON.stringify(data), 'pending']
    );
    await db.query('UPDATE users SET state = ? WHERE vk_id = ?', ['waiting_verifing', userId]);
    const applicationId = result.insertId;
    let details = Object.entries(data).map(([key, value]) => ` - ${key.replace(/_/g, ' ')}: ${value}`).join('\n');
    let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [userId]);
    const adminMessage = `📥 Новая заявка на медиа 🆔 #${applicationId}\n👤 vk.com/id${userId}\nНик: ${userInfo?.nickname || '—'}\nУровень админки: ${userInfo?.admin_level || 0}\nБаланс: ${userInfo?.balance || 0} MC\nVK: vk.com/id${userInfo?.vk_id}\nТип: ${type}\nДанные:\n${details}\n\nДля подтверждения: /acceptmedia ${applicationId}`;
    console.log('[MEDIA][NEW]', adminMessage);
    await vk.api.messages.send({
        peer_id: report_peer_id,
        message: adminMessage,
        random_id: Date.now()
    });
    await user.resetUserState(userId);
    return context.send('✅ Ваша заявка отправлена на рассмотрение. Ожидайте, пожалуйста.');
}

async function handleApplicationDecision(applicationId, adminId, decision, vk, type) {
    try {
        let application, applicantId;
        if (type === 'admin') {
            let [[app]] = await db.query('SELECT * FROM admin_applications WHERE id = ?', [applicationId]);
            application = app;
            if (!application || application.status !== 'pending') {
                await vk.api.messages.send({ peer_id: report_peer_id, message: `Заявка #${applicationId} не найдена или уже обработана.`, random_id: Date.now() });
                return;
            }
            applicantId = application.user_vk_id;
            const newStatus = decision === 'approved' ? 'approved' : 'rejected';
            await db.query('UPDATE admin_applications SET status = ? WHERE id = ?', [newStatus, applicationId]);
            if (decision === 'approved') {
                if (application.requested_level === 1) {
                    await db.query('UPDATE users SET admin_level = 1 WHERE vk_id = ?', [applicantId]);
                } else if (application.requested_level === 2) {
                    await db.query('UPDATE users SET admin_level = 2, balance = balance - 345 WHERE vk_id = ?', [applicantId]);
                }
                await vk.api.messages.send({ user_id: applicantId, message: '🎉 Ваша заявка на админку одобрена!', random_id: Date.now() });
                await vk.api.messages.send({ peer_id: report_peer_id, message: `✅ Заявка #${applicationId} на админку одобрена!`, random_id: Date.now() });
            } else {
                await db.query('UPDATE users SET admin_level = 0 WHERE vk_id = ?', [applicantId]);
                await vk.api.messages.send({ user_id: applicantId, message: '😔 Ваша заявка на админку отклонена.', random_id: Date.now() });
                await vk.api.messages.send({ peer_id: report_peer_id, message: `❌ Заявка #${applicationId} на админку отклонена!`, random_id: Date.now() });
            }
        } else {
            let [[app]] = await db.query('SELECT * FROM cooperation_applications WHERE id = ?', [applicationId]);
            application = app;
            if (!application || application.status !== 'pending') {
                await vk.api.messages.send({ peer_id: report_peer_id, message: `Заявка #${applicationId} не найдена или уже обработана.`, random_id: Date.now() });
                return;
            }
            applicantId = application.user_vk_id;
            const newStatus = decision === 'approved' ? 'approved' : 'rejected';
            await db.query('UPDATE cooperation_applications SET status = ? WHERE id = ?', [newStatus, applicationId]);
            if (decision === 'approved') {
                await db.query('UPDATE users SET is_approved = 1, state = "verified" WHERE vk_id = ?', [applicantId]);
                // --- Копируем данные анкеты из cooperation_applications.data в users ---
                let [[coopApp]] = await db.query('SELECT * FROM cooperation_applications WHERE id = ?', [applicationId]);
                if (coopApp && coopApp.data) {
                    let data;
                    try { data = JSON.parse(coopApp.data); } catch { data = {}; }
                    if (data.nickname) {
                        await db.query('UPDATE users SET nickname = ? WHERE vk_id = ?', [data.nickname, applicantId]);
                    }
                    if (data.channel_link) {
                        await db.query('UPDATE users SET channel_link = ? WHERE vk_id = ?', [data.channel_link, applicantId]);
                    }
                    if (data.family_name) {
                        await db.query('UPDATE users SET family_name = ? WHERE vk_id = ?', [data.family_name, applicantId]);
                    }
                    if (data.leader_nickname) {
                        await db.query('UPDATE users SET leader_nickname = ? WHERE vk_id = ?', [data.leader_nickname, applicantId]);
                    }
                }
                // В функции handleApplicationDecision, в блоке coopApp.type === 'Семьи', выставить media_type = 2 для пользователя
                if (coopApp && coopApp.type) {
                    let typeLower = coopApp.type.toLowerCase();
                    if (typeLower === 'семьи') {
                        await db.query('UPDATE users SET media_type = 2 WHERE vk_id = ?', [applicantId]);
                    } else if (typeLower === 'платное') {
                        await db.query('UPDATE users SET media_type = 1 WHERE vk_id = ?', [applicantId]);
                    } else if (typeLower === 'бесплатное') {
                        await db.query('UPDATE users SET media_type = 0 WHERE vk_id = ?', [applicantId]);
                    }
                }
                await vk.api.messages.send({
                    user_id: applicantId,
                    message: '🎉 Ваша заявка на сотрудничество одобрена! Теперь вам доступно главное меню.',
                    keyboard: keyboards.mainMenuKeyboard,
                    random_id: Date.now()
                });
                await vk.api.messages.send({
                    peer_id: report_peer_id,
                    message: `✅ Заявка #${applicationId} на сотрудничество одобрена! Пользователь vk.com/id${applicantId} теперь медиа.`,
                    random_id: Date.now()
                });
                let mediaType = coopApp && coopApp.type ? coopApp.type.toLowerCase() : '';
                let chatLink = '';
                let chatText = '';
                if (mediaType === 'платное') {
                    chatLink = 'https://vk.me/join/VmzL2qIbmbsqCWdg963ZSyEi7IV3Xv_v6Yo=';
                    chatText = 'Для завершения вступите в чат: [Платные медиа](https://vk.me/join/VmzL2qIbmbsqCWdg963ZSyEi7IV3Xv_v6Yo=)\nили напишите @unclehesus для подтверждения.';
                } else if (mediaType === 'бесплатное') {
                    chatLink = 'https://vk.me/join/2uT0meu04IPFZOqNrf_HTWZWP5sEoX2dfUU=';
                    chatText = 'Для завершения вступите в чат: [Бесплатные медиа](https://vk.me/join/2uT0meu04IPFZOqNrf_HTWZWP5sEoX2dfUU=)\nили напишите @unclehesus для подтверждения.';
                }
                await vk.api.messages.send({
                    user_id: applicantId,
                    message: `✅ Ваша заявка на ${mediaType} медиа одобрена!\n\n${chatText}`,
                    random_id: Date.now(),
                    dont_parse_links: 0
                });
            } else {
                await db.query('UPDATE users SET is_approved = 0, state = "default" WHERE vk_id = ?', [applicantId]);
                await vk.api.messages.send({ user_id: applicantId, message: '😔 Ваша заявка на сотрудничество отклонена.', random_id: Date.now() });
                await vk.api.messages.send({ peer_id: report_peer_id, message: `❌ Заявка #${applicationId} на сотрудничество отклонена!`, random_id: Date.now() });
            }
        }
    } catch (e) {
        await vk.api.messages.send({ peer_id: report_peer_id, message: `❌ Ошибка в handleApplicationDecision: ${e.message}`, random_id: Date.now() });
    }
}

async function handleShopOrderDecision(orderId, adminId, decision, vk) {
    try {
        let [[order]] = await db.query('SELECT * FROM shop_orders WHERE id = ?', [orderId]);
        if (!order || order.status !== 'pending') {
            await vk.api.messages.send({ peer_id: report_peer_id, message: `❗️ Заявка 🆔 #${orderId} на магазин не найдена или уже обработана.`, random_id: Date.now() });
            return;
        }
        const applicantId = order.user_vk_id;
        const newStatus = decision === 'approved' ? 'approved' : 'rejected';
        await db.query('UPDATE shop_orders SET status = ? WHERE id = ?', [newStatus, orderId]);
        if (decision === 'approved') {
            let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [applicantId]);
            await vk.api.messages.send({ user_id: applicantId, message: `✅ Ваша заявка на покупку в магазине 🆔 #${orderId} одобрена!`, random_id: Date.now() });
            await vk.api.messages.send({ peer_id: report_peer_id, message: `✅ Заявка на магазин 🆔 #${orderId} одобрена!\nПользователь: vk.com/id${applicantId}\nНик: ${userInfo?.nickname || '—'}\nУровень админки: ${userInfo?.admin_level || 0}\nБаланс: ${userInfo?.balance || 0} MC\nVK: vk.com/id${userInfo?.vk_id}`, random_id: Date.now() });
        } else {
            let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [applicantId]);
            await vk.api.messages.send({ user_id: applicantId, message: `❌ Ваша заявка на покупку в магазине 🆔 #${orderId} отклонена.`, random_id: Date.now() });
            await vk.api.messages.send({ peer_id: report_peer_id, message: `❌ Заявка на магазин 🆔 #${orderId} отклонена.\nПользователь: vk.com/id${applicantId}\nНик: ${userInfo?.nickname || '—'}\nУровень админки: ${userInfo?.admin_level || 0}\nБаланс: ${userInfo?.balance || 0} MC\nVK: vk.com/id${userInfo?.vk_id}`, random_id: Date.now() });
        }
        console.log(`[handleShopOrderDecision] orderId: ${orderId}, decision: ${decision}, applicantId: ${applicantId}`);
    } catch (e) {
        console.error('[handleShopOrderDecision][ERROR]', e);
        await vk.api.messages.send({ peer_id: report_peer_id, message: `❌ Ошибка в handleShopOrderDecision: ${e.message}`, random_id: Date.now() });
    }
}

async function handleAcceptReport(reportId, amount, comment, vk, adminId) {
    try {
        let [[report]] = await db.query('SELECT * FROM reports WHERE id = ?', [reportId]);
        if (!report) {
            await vk.api.messages.send({ peer_id: report_peer_id, message: `Отчет #${reportId} не найден.`, random_id: Date.now() });
            return;
        }
        const userId = report.user_vk_id;
        // Проверить, есть ли пользователь в базе
        let [[targetUser]] = await db.query('SELECT * FROM users WHERE vk_id = ?', [userId]);
        if (!targetUser) {
            // Если нет — создать пользователя
            await db.query('INSERT INTO users (vk_id, state_data) VALUES (?, ?)', [userId, '{}']);
            [[targetUser]] = await db.query('SELECT * FROM users WHERE vk_id = ?', [userId]);
            console.log(`[acceptreport] Пользователь vk.com/id${userId} был создан в базе.`);
        }
        await db.query('UPDATE reports SET status = ? WHERE id = ?', ['approved', reportId]);
        await user.changeBalance(userId, amount);
        let [[userInfo]] = await db.query('SELECT nickname, balance, admin_level, vk_id FROM users WHERE vk_id = ?', [userId]);
        await vk.api.messages.send({
            user_id: userId,
            message: `✅ Ваш отчет #${reportId} одобрен!\nВам начислено ${amount} MC.\nКомментарий: ${comment}`,
            random_id: Date.now()
        });
        await vk.api.messages.send({
            peer_id: report_peer_id,
            message: `✅ Отчет #${reportId} одобрен.\nПользователь vk.com/id${userId}\nНик: ${userInfo?.nickname || '—'}\nУровень админки: ${userInfo?.admin_level || 0}\nБаланс: ${userInfo?.balance || 0} MC\nVK: vk.com/id${userInfo?.vk_id}\nПользователь vk.com/id${userId} получил ${amount} MC.\nКомментарий: ${comment}`,
            random_id: Date.now()
        });
        console.log(`[acceptreport] Баланс пользователя vk.com/id${userId} увеличен на ${amount} MC.`);
    } catch (e) {
        await vk.api.messages.send({ peer_id: report_peer_id, message: `❌ Ошибка в handleAcceptReport: ${e.message}`, random_id: Date.now() });
    }
}
