import { bot } from './src/bot.js';

async function start() {
  try {
    await bot.updates.start();
    console.log('Бот успешно запущен');
  } catch (error) {
    console.error('Ошибка при запуске бота:', error);
  }
}

start();
