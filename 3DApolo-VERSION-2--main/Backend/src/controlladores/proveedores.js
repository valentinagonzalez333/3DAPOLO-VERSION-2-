const db = require('../confg/db_conexion');

const ok       = (res, data, status = 200) => res.status(status).json(data);
const err      = (res, msg, status = 500)  => res.status(status).json({ error: msg });
const sanitize = (v) => (typeof v === 'string' ? v.trim().replace(/[<>"']/g, '') : v);


const listar = async (req, res) => {
  try {
    const { buscar = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 200);
    const params = [];

    let where = `WHERE p.estado = 1`;
    if (buscar) {
      where += ` AND (p.nombre LIKE ? OR p.nit LIKE ? OR p.ciudad LIKE ?)`;
      const b = `%${sanitize(buscar)}%`;
      params.push(b, b, b);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM proveedores p ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT
         p.id_proveedor, p.nombre, p.nit, p.telefono,
         p.correo, p.ciudad, p.direccion, p.fecha_reg,
         COUNT(pp.id_prov_prod) AS total_productos
       FROM proveedores p
       LEFT JOIN proveedor_producto pp ON pp.id_proveedor = p.id_proveedor
       ${where}
       GROUP BY p.id_proveedor
       ORDER BY p.nombre ASC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 200), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: {
        total,
        pagina:  +pagina,
        limite:  +limite,
        paginas: Math.ceil(total / +limite),
      },
    });
  } catch (e) {
    console.error('[listar proveedores]', e);
    err(res, 'Error al obtener proveedores');
  }
};


const obtener = async (req, res) => {
  try {
    const [[proveedor]] = await db.query(
      `SELECT * FROM proveedores WHERE id_proveedor = ? AND estado = 1`,
      [+req.params.id]
    );
    if (!proveedor) return err(res, 'Proveedor no encontrado', 404);
    ok(res, proveedor);
  } catch (e) {
    console.error('[obtener proveedor]', e);
    err(res, 'Error al obtener proveedor');
  }
};


const crear = async (req, res) => {
  try {
    const {
      nombre,
      nit       = null,
      telefono  = null,
      correo    = null,
      direccion = null,
      ciudad    = null,
    } = req.body;

    if (!nombre) return err(res, 'El nombre es obligatorio', 400);

    const [result] = await db.query(
      `INSERT INTO proveedores (nombre, nit, telefono, correo, direccion, ciudad)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sanitize(nombre),
        nit      ? sanitize(nit)      : null,
        telefono ? sanitize(telefono) : null,
        correo   ? sanitize(correo)   : null,
        direccion ? sanitize(direccion) : null,
        ciudad   ? sanitize(ciudad)   : null,
      ]
    );

    ok(res, { mensaje: 'Proveedor creado', id_proveedor: result.insertId }, 201);
  } catch (e) {
    console.error('[crear proveedor]', e);
    err(res, 'Error al crear proveedor');
  }
};


const actualizar = async (req, res) => {
  try {
    const id = +req.params.id;
    const [[existe]] = await db.query(
      `SELECT id_proveedor FROM proveedores WHERE id_proveedor = ? AND estado = 1`, [id]
    );
    if (!existe) return err(res, 'Proveedor no encontrado', 404);

    const { nombre, nit, telefono, correo, direccion, ciudad } = req.body;

    await db.query(
      `UPDATE proveedores SET
         nombre    = COALESCE(?, nombre),
         nit       = COALESCE(?, nit),
         telefono  = COALESCE(?, telefono),
         correo    = COALESCE(?, correo),
         direccion = COALESCE(?, direccion),
         ciudad    = COALESCE(?, ciudad)
       WHERE id_proveedor = ?`,
      [
        nombre    ? sanitize(nombre)    : null,
        nit       ? sanitize(nit)       : null,
        telefono  ? sanitize(telefono)  : null,
        correo    ? sanitize(correo)    : null,
        direccion ? sanitize(direccion) : null,
        ciudad    ? sanitize(ciudad)    : null,
        id,
      ]
    );

    ok(res, { mensaje: 'Proveedor actualizado' });
  } catch (e) {
    console.error('[actualizar proveedor]', e);
    err(res, 'Error al actualizar proveedor');
  }
};


const eliminar = async (req, res) => {
  try {
    const [[existe]] = await db.query(
      `SELECT id_proveedor FROM proveedores WHERE id_proveedor = ? AND estado = 1`,
      [+req.params.id]
    );
    if (!existe) return err(res, 'Proveedor no encontrado', 404);

    await db.query(
      `UPDATE proveedores SET estado = 0 WHERE id_proveedor = ?`,
      [+req.params.id]
    );

    ok(res, { mensaje: 'Proveedor eliminado' });
  } catch (e) {
    console.error('[eliminar proveedor]', e);
    err(res, 'Error al eliminar proveedor');
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };