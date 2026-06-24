// routes/admin.js
// Маршруты административной панели: список объявлений, добавление,
// редактирование и удаление объектов недвижимости. Все маршруты защищены
// middleware requireAdmin — попасть сюда может только пользователь с role = 'admin'.

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

// --- Настройка Multer для загрузки фотографий ---
// Файлы сохраняются на диск в папку uploads/ (она же отдаётся как статика в app.js).
// В базе данных хранится только относительный путь к файлу, например "uploads/169..._house.jpg".
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    // Добавляем временную метку к имени файла, чтобы избежать конфликтов
    // при загрузке двух файлов с одинаковым исходным именем.
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

function fileFilter(req, file, cb) {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isAllowed = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Разрешены только изображения форматов JPG, PNG или WEBP.'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // максимум 8 МБ на файл
});

// Применяем requireAdmin сразу ко всем маршрутам этого роутера —
// это надёжнее, чем добавлять проверку в каждый обработчик отдельно.
router.use(requireAdmin);

// === GET /admin/dashboard — список объявлений + статистика ===
router.get('/dashboard', async (req, res) => {
  try {
    const propertiesResult = await pool.query('SELECT * FROM properties ORDER BY created_at DESC');
    const properties = propertiesResult.rows;

    const usersCountResult = await pool.query('SELECT COUNT(*) FROM users');

    const stats = {
      total: properties.length,
      apartments: properties.filter((p) => p.type === 'квартира').length,
      houses: properties.filter((p) => p.type === 'дом').length,
      users: usersCountResult.rows[0].count,
    };

    res.render('admin/dashboard', { properties, stats, flashSuccess: req.query.success || null });
  } catch (err) {
    console.error('Ошибка загрузки админ-панели:', err);
    res.status(500).send('Произошла ошибка при загрузке панели управления.');
  }
});

// === GET /admin/properties/add — форма добавления ===
router.get('/properties/add', (req, res) => {
  res.render('admin/add-property', { error: null });
});

// === POST /admin/properties/add — сохранение нового объекта ===
router.post('/properties/add', upload.single('image'), async (req, res) => {
  const { title, description, price, city, district, type, rooms, area } = req.body;

  try {
    if (!title || !price || !city || !type) {
      return res.render('admin/add-property', {
        error: 'Заполните обязательные поля: название, цена, город, тип.',
        old: req.body,
      });
    }

    const imagePath = req.file ? 'uploads/' + req.file.filename : null;

    await pool.query(
      `INSERT INTO properties (title, description, price, city, district, type, rooms, area, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        title,
        description || null,
        price,
        city,
        district || null,
        type,
        rooms || null,
        area || null,
        imagePath,
      ]
    );

    res.redirect('/admin/dashboard?success=' + encodeURIComponent('Объект успешно добавлен.'));
  } catch (err) {
    console.error('Ошибка добавления объекта:', err);
    res.render('admin/add-property', {
      error: 'Произошла ошибка при сохранении объекта. Попробуйте ещё раз.',
      old: req.body,
    });
  }
});

// === GET /admin/properties/edit/:id — форма редактирования ===
router.get('/properties/edit/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).send('Объект не найден.');
    }

    res.render('admin/edit-property', { property: result.rows[0], error: null });
  } catch (err) {
    console.error('Ошибка загрузки формы редактирования:', err);
    res.status(500).send('Произошла ошибка при загрузке объекта.');
  }
});

// === POST /admin/properties/edit/:id — сохранение изменений ===
router.post('/properties/edit/:id', upload.single('image'), async (req, res) => {
  const propertyId = req.params.id;
  const { title, description, price, city, district, type, rooms, area } = req.body;

  try {
    if (!title || !price || !city || !type) {
      const existing = await pool.query('SELECT * FROM properties WHERE id = $1', [propertyId]);
      return res.render('admin/edit-property', {
        error: 'Заполните обязательные поля: название, цена, город, тип.',
        property: { ...existing.rows[0], ...req.body, id: propertyId },
      });
    }

    // Если загружено новое фото — обновляем путь и удаляем старый файл с диска,
    // чтобы не копились неиспользуемые изображения в папке uploads.
    if (req.file) {
      const oldImageResult = await pool.query('SELECT image FROM properties WHERE id = $1', [propertyId]);
      const oldImage = oldImageResult.rows[0] && oldImageResult.rows[0].image;

      const newImagePath = 'uploads/' + req.file.filename;

      await pool.query(
        `UPDATE properties
         SET title = $1, description = $2, price = $3, city = $4, district = $5,
             type = $6, rooms = $7, area = $8, image = $9
         WHERE id = $10`,
        [title, description || null, price, city, district || null, type, rooms || null, area || null, newImagePath, propertyId]
      );

      if (oldImage) {
        const oldImageFullPath = path.join(__dirname, '..', oldImage);
        fs.unlink(oldImageFullPath, (unlinkErr) => {
          if (unlinkErr) console.error('Не удалось удалить старое фото:', unlinkErr.message);
        });
      }
    } else {
      // Фото не менялось — обновляем только текстовые поля.
      await pool.query(
        `UPDATE properties
         SET title = $1, description = $2, price = $3, city = $4, district = $5,
             type = $6, rooms = $7, area = $8
         WHERE id = $9`,
        [title, description || null, price, city, district || null, type, rooms || null, area || null, propertyId]
      );
    }

    res.redirect('/admin/dashboard?success=' + encodeURIComponent('Изменения сохранены.'));
  } catch (err) {
    console.error('Ошибка редактирования объекта:', err);
    res.render('admin/edit-property', {
      error: 'Произошла ошибка при сохранении изменений. Попробуйте ещё раз.',
      property: { ...req.body, id: propertyId },
    });
  }
});

// === POST /admin/properties/delete/:id — удаление объекта ===
router.post('/properties/delete/:id', async (req, res) => {
  try {
    const propertyId = req.params.id;

    // Сначала достаём путь к фото, чтобы удалить файл с диска после удаления записи из БД.
    const result = await pool.query('SELECT image FROM properties WHERE id = $1', [propertyId]);
    const image = result.rows[0] && result.rows[0].image;

    await pool.query('DELETE FROM properties WHERE id = $1', [propertyId]);

    if (image) {
      const imageFullPath = path.join(__dirname, '..', image);
      fs.unlink(imageFullPath, (unlinkErr) => {
        if (unlinkErr) console.error('Не удалось удалить файл фото:', unlinkErr.message);
      });
    }

    res.redirect('/admin/dashboard?success=' + encodeURIComponent('Объект удалён.'));
  } catch (err) {
    console.error('Ошибка удаления объекта:', err);
    res.status(500).send('Произошла ошибка при удалении объекта.');
  }
});

module.exports = router;
