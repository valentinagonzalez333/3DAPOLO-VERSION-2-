const db = require('../confg/db_conexion');

// Helpers

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });

const sanitize = (v) => (typeof v === 'string' ? v.trim().replace(/[<>"']/g, '') : v);

// GET /api/productos 
const listar = async (req, res) => {
  try {
    const { buscar = '', categoria = '', tipo = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];

    let where = `WHERE p.estado = 1`;

    if (buscar) {
      where += ` AND (p.nombre LIKE ? OR p.descripcion LIKE ?)`;
      const b = `%${sanitize(buscar)}%`;
      params.push(b, b);
    }
    if (categoria) { where += ` AND p.id_categoria = ?`; params.push(+categoria); }
    if (tipo)      { where += ` AND p.tipo = ?`;          params.push(sanitize(tipo)); }

    const sqlBase = `
      FROM productos p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN unidades   u ON p.id_unidad    = u.id_unidad
      ${where}
    `;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${sqlBase}`, params);

    const [rows] = await db.query(
      `SELECT
         p.id_producto, p.nombre, p.descripcion, p.tipo,
         p.precio_venta, p.costo_prom, p.stock, p.stock_min,
         p.iva, p.min_mayoreo, p.desc_mayoreo, p.url_imagen,
         p.fecha_reg, p.fecha_act,
         c.id_categoria, c.nombre AS categoria,
         u.id_unidad,   u.nombre AS unidad, u.abrev
       ${sqlBase}
       ORDER BY p.nombre ASC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) },
    });
  } catch (e) {
    console.error('[listar productos]', e);
    err(res, 'Error al obtener productos');
  }
};

//  GET /api/productos/:id 
const obtener = async (req, res) => {
  try {
    const [[producto]] = await db.query(
      `SELECT
         p.*, c.nombre AS categoria, u.nombre AS unidad, u.abrev
       FROM productos p
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN unidades   u ON p.id_unidad    = u.id_unidad
       WHERE p.id_producto = ? AND p.estado = 1`,
      [+req.params.id]
    );

    if (!producto) return err(res, 'Producto no encontrado', 404);

    // Proveedores vinculados (solo para productos tipo 'comprado')
    const [proveedores] = await db.query(
      `SELECT pp.*, pr.nombre AS proveedor
       FROM proveedor_producto pp
       JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
       WHERE pp.id_producto = ?`,
      [producto.id_producto]
    );

    // Lista de materiales (solo para productos tipo 'fabricado')
    const [materiales] = await db.query(
      `SELECT lm.cantidad, mp.nombre, mp.costo_prom, u.abrev,
              (lm.cantidad * mp.costo_prom) AS subtotal
       FROM lista_materiales lm
       JOIN materias_primas mp ON lm.id_materia  = mp.id_materia
       JOIN unidades        u  ON mp.id_unidad   = u.id_unidad
       WHERE lm.id_producto = ?`,
      [producto.id_producto]
    );

    ok(res, { ...producto, proveedores, materiales });
  } catch (e) {
    console.error('[obtener producto]', e);
    err(res, 'Error al obtener el producto');
  }
};

//  POST /api/productos 
const crear = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      nombre, descripcion = '', tipo,
      id_categoria, id_unidad,
      precio_venta, iva = 0,
      stock = 0, stock_min = 0,
      min_mayoreo = null, desc_mayoreo = 10,
      url_imagen = null,
      // Para tipo 'comprado': precio_compra, id_proveedor (proveedor principal)
      precio_compra, id_proveedor,
    } = req.body;

    // Validaciones básicas
    if (!nombre || !tipo || !id_categoria || !id_unidad || !precio_venta) {
      await conn.rollback();
      conn.release();
      return err(res, 'Faltan campos requeridos', 400);
    }

    if (!['fabricado', 'comprado'].includes(tipo)) {
      await conn.rollback();
      conn.release();
      return err(res, 'Tipo inválido', 400);
    }

    // Costo promedio inicial: para 'comprado' viene del precio_compra
    const costo_prom_inicial = tipo === 'comprado' && precio_compra ? +precio_compra : 0;

    const [result] = await conn.query(
      `INSERT INTO productos
         (id_categoria, id_unidad, nombre, descripcion, tipo,
          precio_venta, costo_prom, stock, stock_min,
          iva, min_mayoreo, desc_mayoreo, url_imagen)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        +id_categoria, +id_unidad,
        sanitize(nombre), sanitize(descripcion), tipo,
        +precio_venta, costo_prom_inicial,
        +stock, +stock_min,
        +iva, min_mayoreo ? +min_mayoreo : null,
        +desc_mayoreo, url_imagen,
      ]
    );

    const id_producto = result.insertId;

    // Si es 'comprado' y viene proveedor, vincularlo
    if (tipo === 'comprado' && id_proveedor && precio_compra) {
      await conn.query(
        `INSERT INTO proveedor_producto (id_proveedor, id_producto, precio_compra, preferido)
         VALUES (?, ?, ?, 1)`,
        [+id_proveedor, id_producto, +precio_compra]
      );
    }

    // Movimiento inicial de inventario si llega con stock
    if (+stock > 0) {
      await conn.query(
        `INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, costo_unit)
         VALUES (?, ?, 'ajuste_entrada', ?, ?)`,
        [id_producto, req.usuario.id, +stock, costo_prom_inicial]
      );
    }

    await conn.commit();
    conn.release();

    ok(res, { mensaje: 'Producto creado exitosamente', id_producto }, 201);
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[crear producto]', e);
    err(res, 'Error al crear el producto');
  }
};

//  PUT /api/productos/:id 
const actualizar = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const id = +req.params.id;

    const [[existe]] = await conn.query(
      `SELECT id_producto, tipo FROM productos WHERE id_producto = ? AND estado = 1`,
      [id]
    );
    if (!existe) {
      await conn.rollback(); conn.release();
      return err(res, 'Producto no encontrado', 404);
    }

    const {
      nombre, descripcion, tipo,
      id_categoria, id_unidad,
      precio_venta, iva,
      stock_min, min_mayoreo, desc_mayoreo,
      url_imagen,
      // proveedor actualización
      precio_compra, id_proveedor,
    } = req.body;

    await conn.query(
      `UPDATE productos SET
         nombre       = COALESCE(?, nombre),
         descripcion  = COALESCE(?, descripcion),
         id_categoria = COALESCE(?, id_categoria),
         id_unidad    = COALESCE(?, id_unidad),
         precio_venta = COALESCE(?, precio_venta),
         iva          = COALESCE(?, iva),
         stock_min    = COALESCE(?, stock_min),
         min_mayoreo  = COALESCE(?, min_mayoreo),
         desc_mayoreo = COALESCE(?, desc_mayoreo),
         url_imagen   = COALESCE(?, url_imagen)
       WHERE id_producto = ?`,
      [
        nombre   ? sanitize(nombre)   : null,
        descripcion !== undefined ? sanitize(descripcion) : null,
        id_categoria ? +id_categoria  : null,
        id_unidad    ? +id_unidad     : null,
        precio_venta ? +precio_venta  : null,
        iva          !== undefined ? +iva : null,
        stock_min    !== undefined ? +stock_min    : null,
        min_mayoreo  !== undefined ? +min_mayoreo  : null,
        desc_mayoreo !== undefined ? +desc_mayoreo : null,
        url_imagen !== undefined   ? url_imagen    : null,
        id,
      ]
    );

    // Actualizar proveedor si viene
    if (id_proveedor && precio_compra) {
      await conn.query(
        `INSERT INTO proveedor_producto (id_proveedor, id_producto, precio_compra, preferido)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE precio_compra = ?, preferido = 1`,
        [+id_proveedor, id, +precio_compra, +precio_compra]
      );
    }

    await conn.commit();
    conn.release();
    ok(res, { mensaje: 'Producto actualizado' });
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[actualizar producto]', e);
    err(res, 'Error al actualizar el producto');
  }
};

//  DELETE /api/productos/:id
const eliminar = async (req, res) => {
  try {
    const [[existe]] = await db.query(
      `SELECT id_producto FROM productos WHERE id_producto = ? AND estado = 1`,
      [+req.params.id]
    );
    if (!existe) return err(res, 'Producto no encontrado', 404);

    await db.query(`UPDATE productos SET estado = 0 WHERE id_producto = ?`, [+req.params.id]);

    ok(res, { mensaje: 'Producto eliminado' });
  } catch (e) {
    console.error('[eliminar producto]', e);
    err(res, 'Error al eliminar el producto');
  }
};

//  PATCH /api/productos/:id/stock  (ajuste manual de stock)
const ajustarStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const id = +req.params.id;
    const { cantidad, tipo_ajuste = 'ajuste_entrada', motivo = '' } = req.body;

    if (!cantidad || isNaN(+cantidad)) {
      await conn.rollback(); conn.release();
      return err(res, 'Cantidad inválida', 400);
    }

    const [[prod]] = await conn.query(
      `SELECT stock, costo_prom FROM productos WHERE id_producto = ? AND estado = 1`,
      [id]
    );
    if (!prod) { await conn.rollback(); conn.release(); return err(res, 'Producto no encontrado', 404); }

    const delta = tipo_ajuste === 'ajuste_salida' ? -Math.abs(+cantidad) : Math.abs(+cantidad);
    const nuevo_stock = prod.stock + delta;

    if (nuevo_stock < 0) {
      await conn.rollback(); conn.release();
      return err(res, 'Stock insuficiente para el ajuste', 400);
    }

    await conn.query(`UPDATE productos SET stock = ? WHERE id_producto = ?`, [nuevo_stock, id]);

    await conn.query(
      `INSERT INTO movimientos (id_producto, id_usuario, tipo, cantidad, costo_unit)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.usuario.id, tipo_ajuste, delta, prod.costo_prom]
    );

    await conn.commit();
    conn.release();
    ok(res, { mensaje: 'Stock ajustado', stock_actual: nuevo_stock });
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[ajustar stock]', e);
    err(res, 'Error al ajustar stock');
  }
};

//  GET /api/productos/catalogos  (categorías + unidades para formularios)
const catalogos = async (req, res) => {
  try {
    const [[categorias], [unidades], [proveedores]] = await Promise.all([
      db.query(`SELECT id_categoria, nombre FROM categorias ORDER BY nombre`),
      db.query(`SELECT id_unidad, nombre, abrev FROM unidades ORDER BY nombre`),
      db.query(`SELECT id_proveedor, nombre FROM proveedores WHERE estado = 1 ORDER BY nombre`),
    ]);
    ok(res, { categorias, unidades, proveedores });
  } catch (e) {
    console.error('[catalogos]', e);
    err(res, 'Error al obtener catálogos');
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, ajustarStock, catalogos };