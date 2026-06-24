// routes/property.js
// Маршруты для работы с недвижимостью: главная страница со списком и фильтрами,
// страница отдельного объекта, избранное и корзина.
// Избранное/корзина хранятся в БД (таблицы favorites и cart), привязаны к user_id,
// поэтому работают только у авторизованных пользователей.

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

// Получает массив id объектов, добавленных пользователем в избранное.
// Если пользователь не авторизован — возвращает пустой массив (плейсхолдер,
// чтобы EJS-шаблоны могли безопасно проверять includes() без доп. условий).
async function getFavoriteIds(userId) {
  if (!userId) return [];
  const result = await pool.query('SELECT property_id FROM favorites WHERE user_id = $1', [userId]);
  return result.rows.map((row) => row.property_id);
}

// Аналогично для корзины.
async function getCartIds(userId) {
  if (!userId) return [];
  const result = await pool.query('SELECT property_id FROM cart WHERE user_id = $1', [userId]);
  return result.rows.map((row) => row.property_id);
}

// === GET / — главная страница со списком объектов и фильтрами ===
router.get('/', async (req, res) => {
  try {
    const { city, district, type, minPrice, maxPrice } = req.query;

    // Собираем SQL динамически в зависимости от того, какие фильтры заданы.
    // Используем параметризованные запросы ($1, $2...) для защиты от SQL-инъекций —
    // никогда не подставляем значения из req.query прямо в строку запроса.
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (city) {
      conditions.push(`city ILIKE $${paramIndex}`);
      values.push(`%${city}%`);
      paramIndex++;
    }
    if (district) {
      conditions.push(`district ILIKE $${paramIndex}`);
      values.push(`%${district}%`);
      paramIndex++;
    }
    if (type) {
      conditions.push(`type = $${paramIndex}`);
      values.push(type);
      paramIndex++;
    }
    if (minPrice) {
      conditions.push(`price >= $${paramIndex}`);
      values.push(minPrice);
      paramIndex++;
    }
    if (maxPrice) {
      conditions.push(`price <= $${paramIndex}`);
      values.push(maxPrice);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT * FROM properties ${whereClause} ORDER BY created_at DESC`;

    const result = await pool.query(query, values);
    const favoriteIds = await getFavoriteIds(req.session.userId);
    const cartIds = await getCartIds(req.session.userId);

    res.render('index', {
      properties: result.rows,
      favoriteIds,
      cartIds,
      filters: { city, district, type, minPrice, maxPrice },
    });
  } catch (err) {
    console.error('Ошибка загрузки главной страницы:', err);
    res.status(500).send('Произошла ошибка при загрузке объектов недвижимости.');
  }
});

// === GET /property/:id — страница отдельного объекта ===
router.get('/property/:id', async (req, res) => {
  try {
    const propertyId = req.params.id;
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);

    if (result.rows.length === 0) {
      return res.status(404).send('Объект недвижимости не найден.');
    }

    const property = result.rows[0];
    const favoriteIds = await getFavoriteIds(req.session.userId);
    const cartIds = await getCartIds(req.session.userId);

    res.render('property', {
      property,
      isLiked: favoriteIds.includes(property.id),
      isInCart: cartIds.includes(property.id),
    });
  } catch (err) {
    console.error('Ошибка загрузки объекта:', err);
    res.status(500).send('Произошла ошибка при загрузке объекта недвижимости.');
  }
});

// === GET /favorites — страница избранного (требует авторизации) ===
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT properties.* FROM properties
       JOIN favorites ON favorites.property_id = properties.id
       WHERE favorites.user_id = $1
       ORDER BY favorites.id DESC`,
      [req.session.userId]
    );

    const cartIds = await getCartIds(req.session.userId);

    res.render('favorites', {
      properties: result.rows,
      favoriteIds: result.rows.map((p) => p.id),
      cartIds,
    });
  } catch (err) {
    console.error('Ошибка загрузки избранного:', err);
    res.status(500).send('Произошла ошибка при загрузке избранного.');
  }
});

// === POST /favorites/toggle/:id — добавить/убрать объект из избранного (AJAX) ===
router.post('/favorites/toggle/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Войдите в систему, чтобы добавлять в избранное.' });
  }

  try {
    const propertyId = req.params.id;
    const userId = req.session.userId;

    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2',
      [userId, propertyId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [userId, propertyId]);
      return res.json({ liked: false });
    } else {
      await pool.query('INSERT INTO favorites (user_id, property_id) VALUES ($1, $2)', [userId, propertyId]);
      return res.json({ liked: true });
    }
  } catch (err) {
    console.error('Ошибка обновления избранного:', err);
    res.status(500).json({ error: 'Произошла ошибка.' });
  }
});

// === GET /cart — страница корзины (требует авторизации) ===
router.get('/cart', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT properties.* FROM properties
       JOIN cart ON cart.property_id = properties.id
       WHERE cart.user_id = $1
       ORDER BY cart.id DESC`,
      [req.session.userId]
    );

    const favoriteIds = await getFavoriteIds(req.session.userId);

    res.render('cart', {
      properties: result.rows,
      favoriteIds,
      cartIds: result.rows.map((p) => p.id),
    });
  } catch (err) {
    console.error('Ошибка загрузки корзины:', err);
    res.status(500).send('Произошла ошибка при загрузке корзины.');
  }
});

// === POST /cart/toggle/:id — добавить/убрать объект из корзины (AJAX) ===
router.post('/cart/toggle/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Войдите в систему, чтобы добавлять в корзину.' });
  }

  try {
    const propertyId = req.params.id;
    const userId = req.session.userId;

    const existing = await pool.query(
      'SELECT id FROM cart WHERE user_id = $1 AND property_id = $2',
      [userId, propertyId]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM cart WHERE user_id = $1 AND property_id = $2', [userId, propertyId]);
      return res.json({ inCart: false });
    } else {
      await pool.query('INSERT INTO cart (user_id, property_id) VALUES ($1, $2)', [userId, propertyId]);
      return res.json({ inCart: true });
    }
  } catch (err) {
    console.error('Ошибка обновления корзины:', err);
    res.status(500).json({ error: 'Произошла ошибка.' });
  }
});

module.exports = router;
