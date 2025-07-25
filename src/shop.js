import { db } from './database.js';

export const SHOP_CATEGORIES = {
    CARS: 'Машины',
    ACCESSORIES: 'Аксессуары',
    SKINS: 'Скины',
    OTHER: 'Прочее',
    ASK: 'Аск',
    AZ: 'АЗРубли'
};

export async function getShopCategories() {
    const [rows] = await db.query('SELECT DISTINCT category FROM shop_items');
    return rows.map(row => row.category);
}

export async function getItemsByCategory(category, page = 1, limit = 5) {
    const offset = (page - 1) * limit;
    const [items] = await db.query('SELECT * FROM shop_items WHERE category = ? LIMIT ? OFFSET ?', [category, limit, offset]);
    const [[{ total }]] = await db.query('SELECT COUNT(*) as total FROM shop_items WHERE category = ?', [category]);
    return { items, total, page, limit };
}

export async function getItemById(id) {
    const [[item]] = await db.query('SELECT * FROM shop_items WHERE id = ?', [id]);
    return item;
}
