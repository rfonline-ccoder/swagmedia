import { VK } from 'vk-io';
import config from './config.js';
import { db } from './database.js';
import { handleMessage, handlePayload } from './handlers.js';
import * as keyboards from './keyboards.js';

const vk = new VK({
    token: config.vk_token,
    apiMode: 'sequential',
});

// async function notifyUsersOnRestart() {
//     try {
//         const [users] = await db.query('SELECT vk_id, is_approved FROM users');
//         if (users.length === 0) return;
//         for (const user of users) {
//             try {
//                 if (user.is_approved) {
//                     await vk.api.messages.send({
//                         user_id: user.vk_id,
//                         message: 'Бот был перезапущен. Добавлены предметы в магазин.',
//                         keyboard: keyboards.mainMenuKeyboard,
//                         random_id: Date.now()
//                     });
//                 } else {
//                     await vk.api.messages.send({
//                         user_id: user.vk_id,
//                         message: 'Бот был перезапущен. Добавлены предметы в магазин.',
//                         keyboard: keyboards.startKeyboard,
//                         random_id: Date.now()
//                     });
//                 }
//             } catch (e) {
//                 console.error(`Не удалось отправить уведомление пользователю ${user.vk_id}:`, e);
//             }
//         }
//         console.log(`Попытка отправки уведомлений о перезапуске ${users.length} пользователям завершена.`);
//     } catch (error) {
//         console.error('Ошибка при отправке уведомлений о перезапуске:', error);
//     }
// }

vk.updates.on('message_new', async (context) => {
    if (context.isOutbox || !context.isUser)
        return;
    if (context.hasMessagePayload) {
        await handlePayload(context, vk);
    } else {
        await handleMessage(context, vk);
    }
});

// const originalStart = vk.updates.start.bind(vk.updates);
// vk.updates.start = async () => {
//     await originalStart();
//     await notifyUsersOnRestart();
// };

export const bot = vk;
