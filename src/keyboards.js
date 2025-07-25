import { Keyboard } from 'vk-io';

export const startKeyboard = Keyboard.builder()
    .textButton({
        label: '📝 Подать заявку',
        payload: { command: 'start_application' },
        color: 'primary'
    })
    .oneTime();

export const applicationTypeKeyboard = Keyboard.builder()
    .textButton({ label: '👨‍👩‍👧‍👦 Семьи', payload: { command: 'family_application' }, color: 'secondary' })
    .textButton({ label: '💸 Платное', payload: { command: 'paid_application' }, color: 'primary' })
    .row()
    .textButton({ label: '🎁 Бесплатное', payload: { command: 'free_application' }, color: 'primary' })
    .textButton({ label: '🔙 Назад', payload: { command: 'back_to_start' }, color: 'negative' })
    .oneTime();

export const adminDecisionKeyboard = (applicationId, type) => Keyboard.builder()
    .textButton({ 
        label: 'Принять', 
        payload: { command: 'approve_application', id: applicationId, type }, 
        color: 'positive' 
    })
    .textButton({ 
        label: 'Отклонить', 
        payload: { command: 'reject_application', id: applicationId, type }, 
        color: 'negative' 
    })
    .inline();

export const mainMenuKeyboard = Keyboard.builder()
    .textButton({ label: '🛒 Магазин', payload: { command: 'shop_menu' }, color: 'primary' })
    .textButton({ label: '📝 Отчет', payload: { command: 'report_menu' }, color: 'secondary' })
    .row()
    .textButton({ label: '👑 Админка', payload: { command: 'admin_menu' }, color: 'primary' })
    .textButton({ label: '👤 Профиль', payload: { command: 'my_profile' }, color: 'secondary' });

export const backToMainMenu = () => Keyboard.builder()
    .textButton({ label: '🏠 В меню', payload: { command: 'main_menu' }, color: 'secondary' });

export const backToShop = () => Keyboard.builder()
    .textButton({ label: '🛒 В магазин', payload: { command: 'shop_menu' }, color: 'secondary' });

export const backToCategories = () => Keyboard.builder()
    .textButton({ label: '📦 В категории', payload: { command: 'shop_menu' }, color: 'secondary' });

export const backToReport = () => Keyboard.builder()
    .textButton({ label: '📝 В отчет', payload: { command: 'report_menu' }, color: 'secondary' });

export const backToProfile = () => Keyboard.builder()
    .textButton({ label: '👤 В профиль', payload: { command: 'my_profile' }, color: 'secondary' });

export const shopCategoriesKeyboard = (categories) => {
    const builder = Keyboard.builder();
    let row = 0;
    categories.forEach((cat, i) => {
        builder.textButton({ label: `📦 ${cat}`, payload: { command: 'shop_category', category: cat } });
        if (i % 2 === 1) builder.row();
    });
    builder.textButton({ label: '🔙 Назад', payload: { command: 'main_menu' }, color: 'negative' });
    return builder;
};

export const shopItemsKeyboard = (page, totalPages) => {
    const builder = Keyboard.builder();
    builder.textButton({ label: '🛍️ Купить', payload: { command: 'shop_buy_item' }, color: 'positive' });
    if (totalPages > 1) {
        builder.textButton({ label: '⬅️', payload: { command: 'shop_page', page: page - 1 } });
        builder.textButton({ label: '➡️', payload: { command: 'shop_page', page: page + 1 } });
    }
    builder.row().textButton({ label: '📦 В категории', payload: { command: 'shop_menu' }, color: 'negative' });
    return builder;
};
