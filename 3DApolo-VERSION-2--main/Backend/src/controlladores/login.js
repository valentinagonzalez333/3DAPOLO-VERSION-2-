const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../confg/db_conexion');

const login = async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({
        mensaje: 'Usuario y contraseña son requeridos'
      });
    }

    console.log("🔍 Login intento:", usuario);

    const [rows] = await db.query(
      `SELECT u.*, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.usuario = ? AND u.estado = 1`,
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        mensaje: 'Usuario o contraseña incorrectos'
      });
    }

    const usuarioDB = rows[0];

    // 🔥 seguridad extra
    if (!usuarioDB.contrasena) {
      return res.status(500).json({
        mensaje: 'Usuario sin contraseña configurada'
      });
    }

    const passwordValida = await bcrypt.compare(
      contrasena,
      usuarioDB.contrasena
    );

    if (!passwordValida) {
      return res.status(401).json({
        mensaje: 'Usuario o contraseña incorrectos'
      });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET no está definido en variables de entorno");
    }

    const token = jwt.sign(
      {
        id_usuario: usuarioDB.id_usuario,
        usuario: usuarioDB.usuario,
        rol: usuarioDB.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      token,
      usuario: {
        id_usuario: usuarioDB.id_usuario,
        nombre: usuarioDB.nombre,
        usuario: usuarioDB.usuario,
        rol: usuarioDB.rol
      }
    });

  } catch (error) {
    console.error("🔥 ERROR LOGIN COMPLETO:", error);

    return res.status(500).json({
      mensaje: "Error interno en login",
      error: error.message,
      stack: error.stack
    });
  }
};

const logout = (req, res) => {
  res.clearCookie('token');
  res.json({ mensaje: 'Sesión cerrada' });
};

module.exports = { login, logout };