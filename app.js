// app.js
// Точка входа приложения GoldenUy.
// Здесь настраивается Express: статика, EJS, сессии (хранятся в PostgreSQL),
// middleware и подключение всех маршрутов.

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');
const { attachUser } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/property');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Настройка шаблонизатора EJS ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- Статические файлы ---
// public/ содержит css, images, js
// uploads/ содержит фотографии недвижимости, загруженные через Multer
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Парсинг данных форм ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Сессии ---
// Сессии хранятся в таблице PostgreSQL (а не в памяти процесса), поэтому
// пользователи не разлогиниваются при перезапуске сервера, и это решение
// корректно работает даже при нескольких процессах/инстансах сервера.
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'fallback_secret_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // неделя
    httpOnly: true,
  },
}));

// Делает currentUser доступным во всех EJS-шаблонах без передачи вручную
app.use(attachUser);

// --- Маршруты ---
app.use('/', authRoutes);
app.use('/', propertyRoutes);
app.use('/admin', adminRoutes);

// --- Статичная страница "О нас" (без логики БД) ---
app.get('/about', (req, res) => {
  res.render('about');
});

// --- Обработка 404 ---
app.use((req, res) => {
  res.status(404).send('Страница не найдена.');
});

// --- Обработка ошибок Multer и прочих неперехваченных ошибок ---
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).send('Что-то пошло не так на сервере. Попробуйте позже.');
});

app.listen(PORT, () => {
  console.log(`🚀 GoldenUy запущен на http://localhost:${PORT}`);
});
