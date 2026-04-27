const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../confg/db_conexion');

const login = async (req, res) => {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
        return res.status(400).json({ mensaje: 'Usuario y contraseña son requeridos' });
    }

    try {
        const [rows] = await db.query(
            `SELECT u.*, r.nombre AS rol
             FROM usuarios u
             JOIN roles r ON u.id_rol = r.id_rol
             WHERE u.usuario = ? AND u.estado = 1`,
            [usuario]
        );

        if (rows.length === 0) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
        }

        const usuarioDB = rows[0];

        const passwordValida = await bcrypt.compare(contrasena, usuarioDB.contrasena);

        if (!passwordValida) {
            return res.status(401).json({ mensaje: 'Usuario o contraseña incorrectos' });
        }

        const token = jwt.sign(
            {
                id_usuario: usuarioDB.id_usuario,
                usuario:    usuarioDB.usuario,
                rol:        usuarioDB.rol
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            usuario: {
                id_usuario: usuarioDB.id_usuario,
                nombre:     usuarioDB.nombre,
                usuario:    usuarioDB.usuario,
                rol:        usuarioDB.rol
            }
        });

    } catch (error) {
        console.error('Error en login:', error.message);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { login };