const db   = require('../confg/db_conexion');
const bcrypt = require('bcryptjs');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const san = (v) => (typeof v === 'string' ? v.trim().replace(/[<>\"']/g, '') : v);

/* ───────────────────────────────────────────
   MI PERFIL
─────────────────────────────────────────── */

const miPerfil = async (req, res) => {
  try {
    const [[usuario]] = await db.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.usuario, u.telefono, r.nombre AS rol
       FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.id_usuario = ?`,
      [req.usuario.id]
    );
    if (!usuario) return err(res, 'Usuario no encontrado', 404);
    ok(res, usuario);
  } catch (e) {
    console.error('[miPerfil]', e);
    err(res, 'Error al obtener perfil');
  }
};

const actualizarPerfil = async (req, res) => {
  try {
    const { nombre, correo, telefono, contrasena_actual, contrasena_nueva } = req.body;
    const id = req.usuario.id;

    const [[u]] = await db.query(`SELECT contrasena FROM usuarios WHERE id_usuario = ?`, [id]);
    if (!u) return err(res, 'Usuario no encontrado', 404);

    let hashNuevo = null;
    if (contrasena_nueva) {
      if (!contrasena_actual) return err(res, 'Debes ingresar la contraseña actual', 400);
      const ok2 = await bcrypt.compare(contrasena_actual, u.contrasena);
      if (!ok2) return err(res, 'Contraseña actual incorrecta', 401);
      hashNuevo = await bcrypt.hash(contrasena_nueva, 10);
    }

    await db.query(
      `UPDATE usuarios SET
         nombre    = COALESCE(?, nombre),
         correo    = COALESCE(?, correo),
         telefono  = COALESCE(?, telefono),
         contrasena = COALESCE(?, contrasena)
       WHERE id_usuario = ?`,
      [nombre ? san(nombre) : null, correo ? san(correo) : null,
       telefono !== undefined ? san(telefono) : null, hashNuevo, id]
    );
    ok(res, { mensaje: 'Perfil actualizado' });
  } catch (e) {
    console.error('[actualizarPerfil]', e);
    err(res, 'Error al actualizar perfil');
  }
};

/* ───────────────────────────────────────────
   USUARIOS (solo admin)
─────────────────────────────────────────── */

const listarUsuarios = async (req, res) => {
  try {
    const { buscar = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];
    let where = 'WHERE 1=1';

    if (buscar) {
      where += ' AND (u.nombre LIKE ? OR u.usuario LIKE ? OR u.correo LIKE ?)';
      const b = `%${san(buscar)}%`;
      params.push(b, b, b);
    }

    const sqlBase = `FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol ${where}`;
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${sqlBase}`, params);

    const [rows] = await db.query(
      `SELECT u.id_usuario, u.nombre, u.correo, u.usuario, u.telefono, u.estado,
              r.id_rol, r.nombre AS rol
       ${sqlBase}
       ORDER BY u.id_usuario ASC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) }
    });
  } catch (e) {
    console.error('[listarUsuarios]', e);
    err(res, 'Error al obtener usuarios');
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, correo, usuario, contrasena, telefono, id_rol = 2 } = req.body;
    if (!nombre || !correo || !usuario || !contrasena) return err(res, 'Faltan campos requeridos', 400);

    const hash = await bcrypt.hash(contrasena, 10);
    const [result] = await db.query(
      `INSERT INTO usuarios (id_rol, nombre, correo, usuario, contrasena, telefono)
       VALUES (?,?,?,?,?,?)`,
      [+id_rol, san(nombre), san(correo), san(usuario), hash, telefono ? san(telefono) : null]
    );
    ok(res, { mensaje: 'Usuario creado', id_usuario: result.insertId }, 201);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return err(res, 'El correo o usuario ya existe', 409);
    console.error('[crearUsuario]', e);
    err(res, 'Error al crear usuario');
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    const id = +req.params.id;
    const { nombre, correo, usuario, telefono, id_rol, estado, contrasena } = req.body;

    let hash = null;
    if (contrasena) hash = await bcrypt.hash(contrasena, 10);

    await db.query(
      `UPDATE usuarios SET
         nombre     = COALESCE(?, nombre),
         correo     = COALESCE(?, correo),
         usuario    = COALESCE(?, usuario),
         telefono   = COALESCE(?, telefono),
         id_rol     = COALESCE(?, id_rol),
         estado     = COALESCE(?, estado),
         contrasena = COALESCE(?, contrasena)
       WHERE id_usuario = ?`,
      [nombre ? san(nombre) : null, correo ? san(correo) : null,
       usuario ? san(usuario) : null, telefono !== undefined ? san(telefono) : null,
       id_rol ? +id_rol : null, estado !== undefined ? +estado : null,
       hash, id]
    );
    ok(res, { mensaje: 'Usuario actualizado' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return err(res, 'El correo o usuario ya existe', 409);
    console.error('[actualizarUsuario]', e);
    err(res, 'Error al actualizar usuario');
  }
};

const toggleEstadoUsuario = async (req, res) => {
  try {
    const id = +req.params.id;
    if (id === req.usuario.id) return err(res, 'No puedes desactivar tu propia cuenta', 400);
    await db.query(`UPDATE usuarios SET estado = IF(estado=1,0,1) WHERE id_usuario = ?`, [id]);
    ok(res, { mensaje: 'Estado actualizado' });
  } catch (e) {
    console.error('[toggleEstado]', e);
    err(res, 'Error al cambiar estado');
  }
};

const listarRoles = async (req, res) => {
  try {
    const [roles] = await db.query(`SELECT id_rol, nombre FROM roles ORDER BY id_rol`);
    ok(res, { roles });
  } catch (e) {
    err(res, 'Error al obtener roles');
  }
};

module.exports = {
  miPerfil, actualizarPerfil,
  listarUsuarios, crearUsuario, actualizarUsuario, toggleEstadoUsuario, listarRoles
};
