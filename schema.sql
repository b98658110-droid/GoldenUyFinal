-- schema.sql
-- Справочный файл со структурой таблиц проекта GoldenUy, строго по техзаданию.
-- Раз твоя БД уже создана через psql — выполнять этот файл не обязательно.
-- Он здесь для сверки полей, которые использует код ниже.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' или 'admin'
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(15, 2) NOT NULL,
    city VARCHAR(255) NOT NULL,
    district VARCHAR(255),
    type VARCHAR(50) NOT NULL,      -- 'квартира', 'дом', 'участок'
    rooms INTEGER,
    area NUMERIC(10, 2),
    image VARCHAR(255),             -- путь к фото, например uploads/house1.jpg
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    UNIQUE (user_id, property_id)
);

CREATE TABLE IF NOT EXISTS cart (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    UNIQUE (user_id, property_id)
);

-- Таблица для хранения сессий (используется модулем connect-pg-simple).
-- Если её нет — connect-pg-simple создаст её сам при первом запуске (createTableIfMissing: true).
