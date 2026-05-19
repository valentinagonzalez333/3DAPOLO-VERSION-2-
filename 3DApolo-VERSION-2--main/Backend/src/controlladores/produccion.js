const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const san = (v) => (typeof v === 'string' ? v.trim().replace(/[<>\"']/g, '') : v);

/* ───────────────────────────────────────────
   ÓRDENES DE PRODUCCIÓN
─────────────────────────────────────────── */

const listarOrdenes = async (req, res) => {
  try {
    const { buscar = '', estado = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];
    let where = 'WHERE 1=1';

    if (buscar) {
      where += ' AND (p.nombre LIKE ? OR o.notas LIKE ?)';
      const b = `%${san(buscar)}%`;
      params.push(b, b);
    }
    if (estado) { where += ' AND o.estado = ?'; params.push(san(estado)); }

    const sqlBase = `
      FROM ordenes_produccion o
      JOIN productos p ON o.id_producto = p.id_producto
      JOIN usuarios u  ON o.id_usuario  = u.id_usuario
      ${where}`;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${sqlBase}`, params);
    const [rows] = await db.query(
      `SELECT o.id_orden, o.cantidad, o.costo_mat, o.costo_mano, o.costo_total,
              o.costo_unit, o.estado, o.notas, o.fecha_inicio, o.fecha_fin, o.fecha_reg,
              p.nombre AS producto, p.id_producto,
              u.nombre AS usuario
       ${sqlBase}
       ORDER BY o.fecha_reg DESC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) }
    });
  } catch (e) {
    console.error('[listarOrdenes]', e);
    err(res, 'Error al obtener órdenes');
  }
};

const crearOrden = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id_producto, cantidad, costo_mano = 0, notas = '', fecha_inicio, fecha_fin } = req.body;

    if (!id_producto || !cantidad) {
      await conn.rollback(); conn.release();
      return err(res, 'Faltan campos requeridos', 400);
    }

    // Calcular costo de materiales desde lista_materiales
    const [mats] = await conn.query(
      `SELECT lm.cantidad, mp.costo_prom
       FROM lista_materiales lm
       JOIN materias_primas mp ON lm.id_materia = mp.id_materia
       WHERE lm.id_producto = ?`,
      [+id_producto]
    );

    const costo_mat_unit = mats.reduce((s, m) => s + m.cantidad * m.costo_prom, 0);
    const costo_mat = costo_mat_unit * +cantidad;
    const costo_total = costo_mat + +costo_mano;
    const costo_unit = +cantidad > 0 ? costo_total / +cantidad : 0;

    const [result] = await conn.query(
      `INSERT INTO ordenes_produccion
         (id_producto, id_usuario, cantidad, costo_mat, costo_mano, costo_total, costo_unit, notas, fecha_inicio, fecha_fin)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [+id_producto, req.usuario.id, +cantidad, costo_mat, +costo_mano,
       costo_total, costo_unit, san(notas),
       fecha_inicio || null, fecha_fin || null]
    );

    await conn.commit(); conn.release();
    ok(res, { mensaje: 'Orden creada', id_orden: result.insertId }, 201);
  } catch (e) {
    await conn.rollback(); conn.release();
    console.error('[crearOrden]', e);
    err(res, 'Error al crear orden');
  }
};

const actualizarOrden = async (req, res) => {
  try {
    const id = +req.params.id;
    const { estado, notas, costo_mano, fecha_inicio, fecha_fin } = req.body;

    await db.query(
      `UPDATE ordenes_produccion SET
         estado       = COALESCE(?, estado),
         notas        = COALESCE(?, notas),
         costo_mano   = COALESCE(?, costo_mano),
         fecha_inicio = COALESCE(?, fecha_inicio),
         fecha_fin    = COALESCE(?, fecha_fin)
       WHERE id_orden = ?`,
      [estado || null, notas !== undefined ? san(notas) : null,
       costo_mano !== undefined ? +costo_mano : null,
       fecha_inicio || null, fecha_fin || null, id]
    );

    ok(res, { mensaje: 'Orden actualizada' });
  } catch (e) {
    console.error('[actualizarOrden]', e);
    err(res, 'Error al actualizar orden');
  }
};

const eliminarOrden = async (req, res) => {
  try {
    const [[existe]] = await db.query(
      `SELECT id_orden FROM ordenes_produccion WHERE id_orden = ?`, [+req.params.id]
    );
    if (!existe) return err(res, 'Orden no encontrada', 404);
    await db.query(`DELETE FROM ordenes_produccion WHERE id_orden = ?`, [+req.params.id]);
    ok(res, { mensaje: 'Orden eliminada' });
  } catch (e) {
    console.error('[eliminarOrden]', e);
    err(res, 'Error al eliminar orden');
  }
};

/* ───────────────────────────────────────────
   MATERIAS PRIMAS
─────────────────────────────────────────── */

const listarMaterias = async (req, res) => {
  try {
    const { buscar = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];
    let where = 'WHERE mp.estado = 1';

    if (buscar) {
      where += ' AND mp.nombre LIKE ?';
      params.push(`%${san(buscar)}%`);
    }

    const sqlBase = `
      FROM materias_primas mp
      JOIN unidades u ON mp.id_unidad = u.id_unidad
      LEFT JOIN proveedores p ON mp.id_proveedor = p.id_proveedor
      ${where}`;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${sqlBase}`, params);
    const [rows] = await db.query(
      `SELECT mp.id_materia, mp.nombre, mp.costo_prom, mp.stock, mp.stock_min,
              u.nombre AS unidad, u.abrev,
              p.nombre AS proveedor, p.id_proveedor
       ${sqlBase}
       ORDER BY mp.nombre ASC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) }
    });
  } catch (e) {
    console.error('[listarMaterias]', e);
    err(res, 'Error al obtener materias primas');
  }
};

const crearMateria = async (req, res) => {
  try {
    const { nombre, id_unidad, costo_prom = 0, stock = 0, stock_min = 0, id_proveedor } = req.body;
    if (!nombre || !id_unidad) return err(res, 'Faltan campos requeridos', 400);

    const [result] = await db.query(
      `INSERT INTO materias_primas (id_unidad, id_proveedor, nombre, costo_prom, stock, stock_min)
       VALUES (?,?,?,?,?,?)`,
      [+id_unidad, id_proveedor ? +id_proveedor : null, san(nombre), +costo_prom, +stock, +stock_min]
    );
    ok(res, { mensaje: 'Materia prima creada', id_materia: result.insertId }, 201);
  } catch (e) {
    console.error('[crearMateria]', e);
    err(res, 'Error al crear materia prima');
  }
};

const actualizarMateria = async (req, res) => {
  try {
    const id = +req.params.id;
    const { nombre, id_unidad, costo_prom, stock, stock_min, id_proveedor } = req.body;

    await db.query(
      `UPDATE materias_primas SET
         nombre       = COALESCE(?, nombre),
         id_unidad    = COALESCE(?, id_unidad),
         costo_prom   = COALESCE(?, costo_prom),
         stock        = COALESCE(?, stock),
         stock_min    = COALESCE(?, stock_min),
         id_proveedor = COALESCE(?, id_proveedor)
       WHERE id_materia = ?`,
      [nombre ? san(nombre) : null, id_unidad ? +id_unidad : null,
       costo_prom !== undefined ? +costo_prom : null,
       stock !== undefined ? +stock : null,
       stock_min !== undefined ? +stock_min : null,
       id_proveedor !== undefined ? (id_proveedor ? +id_proveedor : null) : undefined,
       id]
    );
    ok(res, { mensaje: 'Materia prima actualizada' });
  } catch (e) {
    console.error('[actualizarMateria]', e);
    err(res, 'Error al actualizar materia prima');
  }
};

const eliminarMateria = async (req, res) => {
  try {
    await db.query(`UPDATE materias_primas SET estado = 0 WHERE id_materia = ?`, [+req.params.id]);
    ok(res, { mensaje: 'Materia prima eliminada' });
  } catch (e) {
    console.error('[eliminarMateria]', e);
    err(res, 'Error al eliminar materia prima');
  }
};

const catalogosProduccion = async (req, res) => {
  try {
    const [[unidades], [proveedores], [productos]] = await Promise.all([
      db.query(`SELECT id_unidad, nombre, abrev FROM unidades ORDER BY nombre`),
      db.query(`SELECT id_proveedor, nombre FROM proveedores WHERE estado = 1 ORDER BY nombre`),
      db.query(`SELECT id_producto, nombre FROM productos WHERE tipo = 'fabricado' AND estado = 1 ORDER BY nombre`),
    ]);
    ok(res, { unidades, proveedores, productos });
  } catch (e) {
    console.error('[catalogosProduccion]', e);
    err(res, 'Error al obtener catálogos');
  }
};

module.exports = {
  listarOrdenes, crearOrden, actualizarOrden, eliminarOrden,
  listarMaterias, crearMateria, actualizarMateria, eliminarMateria,
  catalogosProduccion
};
