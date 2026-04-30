const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    // Si es petición de página HTML → redirigir al login
    if (req.accepts('html')) return res.redirect('/');
    return res.status(401).json({ error: 'Token requerido.' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    if (req.accepts('html')) return res.redirect('/');
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuario?.rol !== 'administrador') {
    return res.status(403).json({ error: 'Sin permisos suficientes.' });
  }
  next();
};

module.exports = { verificarToken, soloAdmin };