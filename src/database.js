import mysql from 'mysql2/promise';
import config from './config.js';

async function initDatabase() {
    try {
        const pool = await mysql.createPool(config.database);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vk_id BIGINT UNIQUE NOT NULL,
                nickname VARCHAR(255) NULL,
                channel_link VARCHAR(255) NULL,
                family_name VARCHAR(255) NULL,
                leader_nickname VARCHAR(255) NULL,
                is_approved BOOLEAN DEFAULT FALSE,
                balance INT DEFAULT 0,
                admin_level INT DEFAULT 0,
                state VARCHAR(255) DEFAULT 'default',
                state_data JSON,
                media_type INT DEFAULT 0
            );
        `);
        // --- Добавить новые поля, если их нет (для старых БД) ---
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_link VARCHAR(255) NULL;`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS family_name VARCHAR(255) NULL;`).catch(() => {});
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS leader_nickname VARCHAR(255) NULL;`).catch(() => {});
        // --- Добавить media_type (0 — бесплатное, 1 — платное, 2 — семьи) ---
        const [columns] = await pool.query("SHOW COLUMNS FROM users LIKE 'media_type'");
        if (columns.length === 0) {
            await pool.query("ALTER TABLE users ADD COLUMN media_type INT DEFAULT 0");
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS cooperation_applications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_vk_id BIGINT NOT NULL,
                type VARCHAR(255) NOT NULL,
                data JSON,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_applications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_vk_id BIGINT NOT NULL,
                requested_level INT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                price INT NOT NULL,
                category VARCHAR(255) NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS shop_orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_vk_id BIGINT NOT NULL,
                item_id INT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_vk_id BIGINT NOT NULL,
                text TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // --- Добавить поле status в reports, если его нет (для старых БД) ---
        await pool.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';`).catch(() => {});

        console.log('База данных успешно инициализирована');

        await seedShopItems(pool);

        return pool;
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
        process.exit(1);
    }
}

async function seedShopItems(pool) {
    // Удаляем все старые товары
    await pool.query('DELETE FROM shop_items');
    // Новый список товаров
    const items = [
        // Скины
        { name: 'Пауэр', category: 'Скины', price: 225, description: 'Эксклюзивный предмет категории Скины (ID: 906)' },
        { name: 'Хоумлендер', category: 'Скины', price: 200, description: 'Эксклюзивный предмет категории Скины (ID: 841)' },
        { name: 'Веном', category: 'Скины', price: 150, description: 'Эксклюзивный предмет категории Скины (ID: 379)' },
        { name: 'Мистер Бист', category: 'Скины', price: 110, description: 'Эксклюзивный предмет категории Скины (ID: 836)' },
        { name: 'Крик', category: 'Скины', price: 150, description: 'Эксклюзивный предмет категории Скины (ID: 641)' },
        { name: 'Колян', category: 'Скины', price: 110, description: 'Эксклюзивный предмет категории Скины (ID: 892)' },
        { name: 'Хикка', category: 'Скины', price: 175, description: 'Эксклюзивный предмет категории Скины (ID: 708)' },
        { name: 'Мидас', category: 'Скины', price: 200, description: 'Эксклюзивный предмет категории Скины (ID: 808)' },
        { name: 'Оксана Челмонки', category: 'Скины', price: 300, description: 'Эксклюзивный предмет категории Скины (ID: 972)' },
        { name: 'Джек Роппер', category: 'Скины', price: 300, description: 'Эксклюзивный предмет категории Скины (ID: 971)' },
        { name: 'ПП Робо-пипец', category: 'Скины', price: 250, description: 'Эксклюзивный предмет категории Скины (ID: 984)' },
        { name: 'ПП Робо-кошка', category: 'Скины', price: 250, description: 'Эксклюзивный предмет категории Скины (ID: 983)' },
        { name: 'ПП Парень в панаме', category: 'Скины', price: 250, description: 'Эксклюзивный предмет категории Скины (ID: 982)' },
        { name: 'Скин квадратная курица', category: 'Скины', price: 275, description: 'Эксклюзивный предмет категории Скины (ID: 969)' },
        { name: 'Федерал Агент', category: 'Скины', price: 110, description: 'Эксклюзивный предмет категории Скины (ID: 286)' },
        { name: 'Ларт Вейдер', category: 'Скины', price: 150, description: 'Эксклюзивный предмет категории Скины (ID: 694)' },
        { name: 'Анита Лидер (Анищ)', category: 'Скины', price: 150, description: 'Эксклюзивный предмет категории Скины (ID: 642)' },
        { name: 'Хиллбил', category: 'Скины', price: 125, description: 'Эксклюзивный предмет категории Скины (ID: 537)' },
        { name: 'Денди', category: 'Скины', price: 225, description: 'Эксклюзивный предмет категории Скины (ID: 382)' },
        { name: 'Бамблби', category: 'Скины', price: 175, description: 'Эксклюзивный предмет категории Скины (ID: 756)' },
        { name: 'Иосиф Сталин', category: 'Скины', price: 125, description: 'Эксклюзивный предмет категории Скины (ID: 682)' },
        { name: 'Хасбулла', category: 'Скины', price: 150, description: 'Эксклюзивный предмет категории Скины (ID: 441)' },
        { name: 'Йода', category: 'Скины', price: 175, description: 'Эксклюзивный предмет категории Скины (ID: 351)' },
        { name: 'Тёмный эльф', category: 'Скины', price: 150, description: 'Эксклюзивный предмет категории Скины (ID: 626)' },
        { name: 'SWAT (X)', category: 'Скины', price: 175, description: 'Эксклюзивный предмет категории Скины (ID: 767)' },
        // Аксессуары
        { name: 'Магмовый топ', category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Генеральский бронежилет', category: 'Аксессуары', price: 225, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Энергетический возбудитель щар', category: 'Аксессуары', price: 200, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Омелин ярка', category: 'Аксессуары', price: 175, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Зимняя персональная лавка', category: 'Аксессуары', price: 175, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Рука бесконечности', category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Прототип текучая цена', category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Анниморванная пчелка', category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Голова тыква', category: 'Аксессуары', price: 110, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Анниморванные очки Netrunner', category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Маска-невидимка', category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Плащ-пузырь', category: 'Аксессуары', price: 125, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Бронежилет Унесенные призраками', category: 'Аксессуары', price: 125, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Дьявольский чемодан', category: 'Аксессуары', price: 110, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Чемодан железного человека', category: 'Аксессуары', price: 110, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: "Рюкзак 'Игра в кальмара'", category: 'Аксессуары', price: 125, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Тактический шлем', category: 'Аксессуары', price: 175, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: 'Рюкзак Bentley Bentayga Mansory', category: 'Аксессуары', price: 175, description: 'Эксклюзивный предмет категории Аксессуары' },
        { name: "RGB 'Чемодан'", category: 'Аксессуары', price: 150, description: 'Эксклюзивный предмет категории Аксессуары' },
        // Авто
        { name: 'Сертификат Mercedes E63s AMG', category: 'Авто', price: 125, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат BMW M5 CS', category: 'Авто', price: 125, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Toyota Land Cruiser 200 FBI', category: 'Авто', price: 110, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат BMW X5 E70', category: 'Авто', price: 110, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Mercedes-Benz GLE 63', category: 'Авто', price: 110, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Tesla Semi', category: 'Авто', price: 200, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Lamborghini Huracan', category: 'Авто', price: 200, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Devel Sixteen', category: 'Авто', price: 250, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат F1 Bolide 23', category: 'Авто', price: 175, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Rolls-Royce Cullinan Mansory', category: 'Авто', price: 175, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Apollo Intensa Emozione', category: 'Авто', price: 225, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Naran Hyper Coupe', category: 'Авто', price: 225, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат LP Urus', category: 'Авто', price: 200, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат LP G-wagen детский', category: 'Авто', price: 200, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Cadillac Escalade IQ', category: 'Авто', price: 175, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Tesla Cybertruck Mansory', category: 'Авто', price: 200, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Bentley Bentayga Mansory', category: 'Авто', price: 175, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Urus Mansory (БРОНИРОВАННЫЙ)', category: 'Авто', price: 175, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Brabus 700', category: 'Авто', price: 150, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Brabus GLS 2020', category: 'Авто', price: 125, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Mercedes GT63 Brabus', category: 'Авто', price: 125, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Peterbilt 359', category: 'Авто', price: 300, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Daewoo Lanos 6x6', category: 'Авто', price: 150, description: 'Эксклюзивный предмет категории Авто' },
        { name: 'Сертификат Mercedes-AMG G63 6x6', category: 'Авто', price: 150, description: 'Эксклюзивный предмет категории Авто' },
    ];
    for (const item of items) {
        await pool.query('INSERT INTO shop_items (name, category, price, description) VALUES (?, ?, ?, ?)', 
            [item.name, item.category, item.price, item.description]);
    }
    console.log('Магазин наполнен новыми товарами.');
}

export const db = await initDatabase();
