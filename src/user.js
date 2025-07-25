import { db } from './database.js';

// Получить пользователя или создать нового
async function getUser(vk_id) {
    let [[user]] = await db.query('SELECT * FROM users WHERE vk_id = ?', [vk_id]);
    if (!user) {
        await db.query('INSERT INTO users (vk_id, state_data) VALUES (?, ?)', [vk_id, '{}']);
        [[user]] = await db.query('SELECT * FROM users WHERE vk_id = ?', [vk_id]);
    }
    if (typeof user.state_data === 'string') {
        try {
            user.state_data = JSON.parse(user.state_data) || {};
        } catch (e) {
            user.state_data = {};
        }
    } else if (user.state_data === null) {
        user.state_data = {};
    }
    return user;
}

// Установить новое состояние и данные
async function setUserState(vk_id, state, data = {}) {
    await db.query('UPDATE users SET state = ?, state_data = ? WHERE vk_id = ?', [state, JSON.stringify(data), vk_id]);
}

// Обновить state_data (не меняя state)
async function updateUserStateData(vk_id, newData) {
    const user = await getUser(vk_id);
    const finalData = { ...user.state_data, ...newData };
    await db.query('UPDATE users SET state_data = ? WHERE vk_id = ?', [JSON.stringify(finalData), vk_id]);
}

// Сбросить состояние пользователя
async function resetUserState(vk_id) {
    await db.query(`UPDATE users SET state = 'default', state_data = '{}' WHERE vk_id = ?`, [vk_id]);
}

// Изменить баланс
async function changeBalance(vk_id, amount) {
    await db.query('UPDATE users SET balance = balance + ? WHERE vk_id = ?', [amount, vk_id]);
}

// Изменить уровень админки
async function setAdminLevel(vk_id, level) {
    await db.query('UPDATE users SET admin_level = ? WHERE vk_id = ?', [level, vk_id]);
}

export { 
    getUser, 
    setUserState, 
    updateUserStateData,
    resetUserState, 
    changeBalance, 
    setAdminLevel 
};
