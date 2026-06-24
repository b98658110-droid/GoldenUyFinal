// routes/auth.js
// Маршруты авторизации: регистрация, вход, выход.
// Пароли хранятся в БД только в виде bcrypt-хэша — это важно для безопасности,
// чтобы при утечке базы пароли пользователей не были раскрыты в чистом виде.

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');

const BCRYPT_ROUNDS = 10;

// === GET /register — страница регистрации ===
router.get('/register', (req, res) => {
  // Если пользователь уже вошёл — отправляем на главную, незачем регистрироваться повторно.
  if (req.session.userId) return res.redirect('/');
  res.render('register', { error: null });
});

// === POST /register — обработка регистрации ===
router.post('/register', async (req, res) => {
  const { name, email, password, passwordConfirm } = req.body;

  try {
    // Базовая валидация на сервере (нельзя доверять только клиентской валидации браузера)
    if (!name || !email || !password || !passwordConfirm) {
      return res.render('register', {
        error: 'Заполните все поля формы.',
        oldName: name,
        oldEmail: email,
      });
    }

    if (password.length < 6) {
      return res.render('register', {
        error: 'Пароль должен содержать минимум 6 символов.',
        oldName: name,
        oldEmail: email,
      });
    }

    if (password !== passwordConfirm) {
      return res.render('register', {
        error: 'Пароли не совпадают.',
        oldName: name,
        oldEmail: email,
      });
    }

    // Проверяем, не занят ли email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.render('register', {
        error: 'Пользователь с таким email уже зарегистрирован.',
        oldName: name,
        oldEmail: email,
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, name, role`,
      [name, email, hashedPassword]
    );

    const newUser = result.rows[0];

    // Сразу авторизуем пользователя после регистрации, чтобы не заставлять
    // его повторно вводить email/пароль на странице входа.
    req.session.userId = newUser.id;
    req.session.userName = newUser.name;
    req.session.role = newUser.role;

    res.redirect('/');
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    res.render('register', {
      error: 'Произошла ошибка при регистрации. Попробуйте ещё раз.',
      oldName: name,
      oldEmail: email,
    });
  }
});

// === GET /login — страница входа ===
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null });
});

// === POST /login — обработка входа ===
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.render('login', { error: 'Введите email и пароль.', oldEmail: email });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.render('login', { error: 'Неверный email или пароль.', oldEmail: email });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.render('login', { error: 'Неверный email или пароль.', oldEmail: email });
    }

    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.role = user.role;

    // Администратора после входа удобнее сразу направить в админ-панель.
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }

    res.redirect('/');
  } catch (err) {
    console.error('Ошибка входа:', err);
    res.render('login', { error: 'Произошла ошибка при входе. Попробуйте ещё раз.', oldEmail: email });
  }
});

// === POST /logout — выход из системы ===
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Ошибка при завершении сессии:', err);
    res.redirect('/login');
  });
});

module.exports = router;
