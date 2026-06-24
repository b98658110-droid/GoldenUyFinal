// db.js
// Модуль подключения к PostgreSQL через пул соединений (pool).
// Пул эффективнее одного соединения — Express будет переиспользовать
// свободные подключения для разных запросов вместо открытия нового каждый раз.

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

// Проверка подключения при старте сервера — если БД не настроена,
// мы увидим понятную ошибку в консоли, а не молчаливый сбой при первом запросе.
pool.connect()
  .then((client) => {
    console.log('✅ Подключение к PostgreSQL установлено (база: ' + process.env.PGDATABASE + ')');
    client.release();
  })
  .catch((err) => {
    console.error('❌ Не удалось подключиться к PostgreSQL:', err.message);
    console.error('   Проверь данные в .env (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)');
  });

module.exports = pool;
