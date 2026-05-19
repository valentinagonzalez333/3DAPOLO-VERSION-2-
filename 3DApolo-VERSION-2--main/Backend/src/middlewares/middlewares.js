const jwt = require('jsonwebtoken');

const esApiRequest = (req) => req.path.startsWith('/api') || req.xhr ||
  (req.headers.accept && !req.headers.accept.includes('text/html'));

const verificarToken = (req, res, next) => {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    if (!esApiRequest(req)) return res.redirect('/');
    return res.status(401).json({ error: 'Token requerido.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { ...payload, id: payload.id_usuario ?? payload.id };
    next();
  } catch {
    if (!esApiRequest(req)) return res.redirect('/');
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
