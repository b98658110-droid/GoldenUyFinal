// middleware/auth.js
// Middleware-функции для проверки доступа пользователя.
// Используются в маршрутах: подключаются перед обработчиком роута,
// чтобы не дать неавторизованным пользователям попасть туда, куда нельзя.

// Проверяет, что пользователь вошёл в систему (есть активная сессия).
// Если нет — перенаправляет на страницу входа.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
}

// Проверяет, что пользователь вошёл в систему И имеет роль 'admin'.
// Если пользователь не вошёл — отправляем на /login.
// Если вошёл, но не админ — отправляем на главную (403 по-простому, без отдельной страницы ошибки).
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.role !== 'admin') {
    return res.status(403).redirect('/');
  }
  return next();
}

// Делает данные о текущем пользователе доступными во ВСЕХ EJS-шаблонах
// через переменную currentUser, без необходимости передавать её в каждом res.render().
// Подключается в app.js как app.use(attachUser) до всех маршрутов.
function attachUser(req, res, next) {
  res.locals.currentUser = req.session && req.session.userId
    ? { id: req.session.userId, name: req.session.userName, role: req.session.role }
    : null;
  next();
}

module.exports = { requireAuth, requireAdmin, attachUser };
