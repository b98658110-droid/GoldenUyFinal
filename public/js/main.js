// public/js/main.js
// Общая клиентская логика публичных страниц: переключение избранного,
// переключение корзины и работа выпадающей панели фильтров каталога.
// Все запросы идут на сервер через fetch — состояние хранится в PostgreSQL,
// а не в localStorage, чтобы избранное/корзина были привязаны к аккаунту.

// === Избранное ===
async function toggleFavorite(event, propertyId) {
    event.preventDefault();
    event.stopPropagation();

    try {
        const res = await fetch('/favorites/toggle/' + propertyId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await res.json();
        const btn = event.currentTarget;
        const icon = btn.querySelector('i');

        if (data.liked) {
            btn.classList.add('liked');
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
        } else {
            btn.classList.remove('liked');
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');

            // Если мы находимся на странице "Избранное" — карточку нужно убрать со страницы целиком,
            // а не просто погасить иконку, иначе будет путаница (объект убран, но карточка осталась).
            if (window.location.pathname === '/favorites') {
                const card = btn.closest('.property-card-wrap');
                if (card) card.remove();
            }
        }
    } catch (err) {
        console.error('Ошибка при обновлении избранного:', err);
    }
}

// === Корзина ===
async function toggleCart(event, propertyId) {
    event.preventDefault();
    event.stopPropagation();

    try {
        const res = await fetch('/cart/toggle/' + propertyId, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await res.json();
        const btn = event.currentTarget;

        if (data.inCart) {
            btn.classList.add('in-cart');
            btn.textContent = '✓ В корзине';
        } else {
            btn.classList.remove('in-cart');
            btn.textContent = 'Добавить в корзину';

            if (window.location.pathname === '/cart') {
                const card = btn.closest('.property-card-wrap');
                if (card) card.remove();
                updateCartTotal();
            }
        }
    } catch (err) {
        console.error('Ошибка при обновлении корзины:', err);
    }
}

// Пересчитывает итоговую сумму на странице корзины после удаления объекта
// (вызывается без перезагрузки страницы, чтобы итог сразу был верным).
function updateCartTotal() {
    const priceEls = document.querySelectorAll('.property-card-wrap .card-price');
    let total = 0;
    priceEls.forEach((el) => {
        const value = parseFloat(el.textContent.replace(/[^\d.]/g, ''));
        if (!isNaN(value)) total += value;
    });
    const totalEl = document.getElementById('cart-total');
    if (totalEl) {
        totalEl.textContent = total.toLocaleString('ru-RU') + ' $';
    }
    const countEl = document.getElementById('cart-count');
    if (countEl) {
        countEl.textContent = priceEls.length;
    }
    // Если корзина опустела — показываем пустое состояние
    if (priceEls.length === 0) {
        const emptyState = document.getElementById('cart-empty-state');
        const cartGrid = document.getElementById('cart-grid');
        const summary = document.getElementById('cart-summary');
        if (emptyState) emptyState.style.display = 'flex';
        if (cartGrid) cartGrid.style.display = 'none';
        if (summary) summary.style.display = 'none';
    }
}

// === Выпадающая панель каталога на главной странице ===
function toggleCatalogPanel(event) {
    event.preventDefault();
    const panel = document.getElementById('catalogPanel');
    if (panel) panel.classList.toggle('active');
}

document.addEventListener('click', function (event) {
    const panel = document.getElementById('catalogPanel');
    const toggle = document.getElementById('catalogToggle');
    if (panel && panel.classList.contains('active')) {
        if (!panel.contains(event.target) && event.target !== toggle && !toggle.contains(event.target)) {
            panel.classList.remove('active');
        }
    }
});
