const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500)  => res.status(status).json({ error: msg });

// ── GET /api/proveedor-producto/:id_proveedor ──────────────────────────────
const listarPorProveedor = async (req, res) => {
  try {
    const idProv = +req.params.id_proveedor;

    if (!idProv || isNaN(idProv)) return err(res, 'ID de proveedor inválido', 400);

    const [rows] = await db.query(
      `SELECT
         pp.id_prov_prod,
         pp.id_proveedor,
         pp.id_producto,
         pp.precio_compra,
         pp.dias_entrega,
         pp.preferido,
         pp.fecha_act,
         p.nombre,
         p.precio_venta,
         p.stock,
         p.costo_prom,
         c.nombre AS categoria,
         'producto' AS tipo
       FROM proveedor_producto pp
       JOIN productos p ON pp.id_producto = p.id_producto
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       WHERE pp.id_proveedor = ? AND p.estado = 1

       UNION ALL

       SELECT
         NULL            AS id_prov_prod,
         ?               AS id_proveedor,
         mp.id_materia   AS id_producto,
         mp.costo_prom   AS precio_compra,
         NULL            AS dias_entrega,
         0               AS preferido,
         NULL            AS fecha_act,
         mp.nombre,
         NULL            AS precio_venta,
         mp.stock,
         mp.costo_prom,
         NULL            AS categoria,
         'materia'       AS tipo
       FROM materias_primas mp
       WHERE mp.id_proveedor = ? AND mp.estado = 1

       ORDER BY nombre ASC`,
      [idProv, idProv, idProv]
    );

    ok(res, rows);
  } catch (e) {
    console.error('[listarPorProveedor]', e);
    err(res, 'Error al obtener productos del proveedor');
  }
};

// ── GET /api/proveedor-producto/detalle/:id_prov_prod ─────────────────────
const obtenerDetalle = async (req, res) => {
  try {
    const id = +req.params.id_prov_prod;
    if (!id || isNaN(id)) return err(res, 'ID inválido', 400);

    const [[row]] = await db.query(
      `SELECT
         pp.*,
         p.nombre,
         p.precio_venta,
         p.costo_prom
       FROM proveedor_producto pp
       JOIN productos p ON pp.id_producto = p.id_producto
       WHERE pp.id_prov_prod = ?`,
      [id]
    );
    if (!row) return err(res, 'Asignación no encontrada', 404);
    ok(res, row);
  } catch (e) {
    console.error('[obtenerDetalle]', e);
    err(res, 'Error al obtener detalle');
  }
};

// ── POST /api/proveedor-producto ───────────────────────────────────────────
const asignar = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      id_proveedor,
      id_producto,
      precio_compra,
      dias_entrega = null,
      preferido    = 0,
    } = req.body;

    if (!id_proveedor || !id_producto || !precio_compra) {
      await conn.rollback(); conn.release();
      return err(res, 'Faltan campos requeridos', 400);
    }

    const [[yaExiste]] = await conn.query(
      `SELECT id_prov_prod FROM proveedor_producto
       WHERE id_proveedor = ? AND id_producto = ?`,
      [+id_proveedor, +id_producto]
    );
    if (yaExiste) {
      await conn.rollback(); conn.release();
      return err(res, 'Este producto ya está asignado a este proveedor', 409);
    }

    if (+preferido === 1) {
      await conn.query(
        `UPDATE proveedor_producto SET preferido = 0 WHERE id_producto = ?`,
        [+id_producto]
      );
    }

    const [result] = await conn.query(
      `INSERT INTO proveedor_producto
         (id_proveedor, id_producto, precio_compra, dias_entrega, preferido)
       VALUES (?, ?, ?, ?, ?)`,
      [+id_proveedor, +id_producto, +precio_compra,
       dias_entrega ? +dias_entrega : null, +preferido]
    );

    const [[prod]] = await conn.query(
      `SELECT costo_prom FROM productos WHERE id_producto = ?`,
      [+id_producto]
    );

    if (+preferido === 1 || +prod.costo_prom === 0) {
      await conn.query(
        `UPDATE productos SET costo_prom = ? WHERE id_producto = ?`,
        [+precio_compra, +id_producto]
      );
    }

    await conn.commit();
    conn.release();
    ok(res, { mensaje: 'Producto asignado correctamente', id_prov_prod: result.insertId }, 201);
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[asignar]', e);
    err(res, 'Error al asignar producto');
  }
};

// ── PUT /api/proveedor-producto/:id_prov_prod ─────────────────────────────
const editar = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const id = +req.params.id_prov_prod;
    if (!id || isNaN(id)) {
      await conn.rollback(); conn.release();
      return err(res, 'ID inválido', 400);
    }

    const { precio_compra, dias_entrega, preferido } = req.body;

    const [[asig]] = await conn.query(
      `SELECT * FROM proveedor_producto WHERE id_prov_prod = ?`, [id]
    );
    if (!asig) {
      await conn.rollback(); conn.release();
      return err(res, 'Asignación no encontrada', 404);
    }

    if (+preferido === 1) {
      await conn.query(
        `UPDATE proveedor_producto SET preferido = 0
         WHERE id_producto = ? AND id_prov_prod != ?`,
        [asig.id_producto, id]
      );
    }

    await conn.query(
      `UPDATE proveedor_producto SET
         precio_compra = COALESCE(?, precio_compra),
         dias_entrega  = COALESCE(?, dias_entrega),
         preferido     = ?
       WHERE id_prov_prod = ?`,
      [
        precio_compra !== undefined ? +precio_compra : null,
        dias_entrega  !== undefined ? +dias_entrega  : null,
        preferido !== undefined ? +preferido : asig.preferido,
        id,
      ]
    );

    if (+preferido === 1 && precio_compra) {
      await conn.query(
        `UPDATE productos SET costo_prom = ? WHERE id_producto = ?`,
        [+precio_compra, asig.id_producto]
      );
    }

    await conn.commit();
    conn.release();
    ok(res, { mensaje: 'Asignación actualizada' });
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[editar asignacion]', e);
    err(res, 'Error al editar asignación');
  }
};

// ── DELETE /api/proveedor-producto/:id_prov_prod ──────────────────────────
const quitar = async (req, res) => {
  try {
    const id = +req.params.id_prov_prod;

    if (!id || isNaN(id)) return err(res, 'ID de asignación inválido', 400);

    const [[existe]] = await db.query(
      `SELECT id_prov_prod FROM proveedor_producto WHERE id_prov_prod = ?`, [id]
    );
    if (!existe) return err(res, 'Asignación no encontrada', 404);

    await db.query(
      `DELETE FROM proveedor_producto WHERE id_prov_prod = ?`, [id]
    );

    ok(res, { mensaje: 'Producto quitado del proveedor' });
  } catch (e) {
    console.error('[quitar]', e);
    err(res, 'Error al quitar producto');
  }
};

// ── PATCH /api/proveedor-producto/materia/:id_materia/desasociar ──────────
const desasociarMateria = async (req, res) => {
  try {
    const id = +req.params.id_materia;
    if (!id || isNaN(id)) return err(res, 'ID inválido', 400);

    const [[existe]] = await db.query(
      `SELECT id_materia FROM materias_primas WHERE id_materia = ? AND estado = 1`, [id]
    );
    if (!existe) return err(res, 'Materia prima no encontrada', 404);

    await db.query(
      `UPDATE materias_primas SET id_proveedor = NULL WHERE id_materia = ?`, [id]
    );

    ok(res, { mensaje: 'Materia prima desasociada del proveedor' });
  } catch (e) {
    console.error('[desasociarMateria]', e);
    err(res, 'Error al desasociar materia prima');
  }
};

module.exports = {
  listarPorProveedor,
  obtenerDetalle,
  asignar,
  editar,
  quitar,
  desasociarMateria,
};