

const db = require('../confg/db_conexion');

const ok = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const sanitize = (v) => (typeof v === 'string' ? v.trim().replace(/[<>"']/g, '') : v);


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
    if (tipo) { where += ` AND p.tipo = ?`; params.push(sanitize(tipo)); }

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


const obtener = async (req, res) => {
  try {
    const [[producto]] = await db.query(
      `SELECT p.*, c.nombre AS categoria, u.nombre AS unidad, u.abrev
       FROM productos p
       LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
       LEFT JOIN unidades   u ON p.id_unidad    = u.id_unidad
       WHERE p.id_producto = ? AND p.estado = 1`,
      [+req.params.id]
    );

    if (!producto) return err(res, 'Producto no encontrado', 404);

    const [proveedores] = await db.query(
      `SELECT pp.*, pr.nombre AS proveedor
       FROM proveedor_producto pp
       JOIN proveedores pr ON pp.id_proveedor = pr.id_proveedor
       WHERE pp.id_producto = ?`,
      [producto.id_producto]
    );

    const [materiales] = await db.query(
      `SELECT lm.cantidad, mp.nombre, mp.costo_prom, u.abrev,
              (lm.cantidad * mp.costo_prom) AS subtotal
       FROM lista_materiales lm
       JOIN materias_primas mp ON lm.id_materia = mp.id_materia
       JOIN unidades        u  ON mp.id_unidad  = u.id_unidad
       WHERE lm.id_producto = ?`,
      [producto.id_producto]
    );

    ok(res, { ...producto, proveedores, materiales });
  } catch (e) {
    console.error('[obtener producto]', e);
    err(res, 'Error al obtener el producto');
  }
};


const crear = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      nombre,
      descripcion = '',
      tipo,
      id_categoria,
      id_unidad,
      precio_venta = 0,
      iva = 0,
      stock_min = 0,
      min_mayoreo = null,
      desc_mayoreo = 10,
      url_imagen = null,
    } = req.body;


    if (!nombre || !tipo || !id_categoria || !id_unidad) {
      await conn.rollback(); conn.release();
      return err(res, 'Faltan campos requeridos: nombre, tipo, categoría y unidad', 400);
    }

    if (!['fabricado', 'comprado'].includes(tipo)) {
      await conn.rollback(); conn.release();
      return err(res, 'Tipo inválido', 400);
    }

    const [result] = await conn.query(
      `INSERT INTO productos
         (id_categoria, id_unidad, nombre, descripcion, tipo,
          precio_venta, costo_prom, stock, stock_min,
          iva, min_mayoreo, desc_mayoreo, url_imagen)
       VALUES (?,?,?,?,?,?,0,0,?,?,?,?,?)`,
      [
        +id_categoria,
        +id_unidad,
        sanitize(nombre),
        sanitize(descripcion),
        tipo,
        +precio_venta,
        +stock_min,
        +iva,
        min_mayoreo ? +min_mayoreo : null,
        +desc_mayoreo,
        url_imagen,
      ]
    );

    await conn.commit();
    conn.release();

    ok(res, {
      mensaje: 'Producto creado. Asigna un proveedor para definir precio y stock.',
      id_producto: result.insertId,
    }, 201);
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[crear producto]', e);
    err(res, 'Error al crear el producto');
  }
};


const actualizar = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const id = +req.params.id;

    const [[existe]] = await conn.query(
      `SELECT id_producto FROM productos WHERE id_producto = ? AND estado = 1`,
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
      // put
      costo_prom, stock,
    } = req.body;

    await conn.query(
      `UPDATE productos SET
         nombre       = COALESCE(?, nombre),
         descripcion  = COALESCE(?, descripcion),
         id_categoria = COALESCE(?, id_categoria),
         id_unidad    = COALESCE(?, id_unidad),
         precio_venta = COALESCE(?, precio_venta),
         costo_prom   = COALESCE(?, costo_prom),
         stock        = COALESCE(?, stock),
         iva          = COALESCE(?, iva),
         stock_min    = COALESCE(?, stock_min),
         min_mayoreo  = COALESCE(?, min_mayoreo),
         desc_mayoreo = COALESCE(?, desc_mayoreo),
         url_imagen   = COALESCE(?, url_imagen)
       WHERE id_producto = ?`,
      [
        nombre ? sanitize(nombre) : null,
        descripcion !== undefined ? sanitize(descripcion) : null,
        id_categoria ? +id_categoria : null,
        id_unidad ? +id_unidad : null,
        precio_venta !== undefined ? +precio_venta : null,
        costo_prom !== undefined ? +costo_prom : null,
        stock !== undefined ? +stock : null,
        iva !== undefined ? +iva : null,
        stock_min !== undefined ? +stock_min : null,
        min_mayoreo !== undefined ? +min_mayoreo : null,
        desc_mayoreo !== undefined ? +desc_mayoreo : null,
        url_imagen !== undefined ? url_imagen : null,
        id,
      ]
    );

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


const ajustarStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const id = +req.params.id;
    const { cantidad, tipo_ajuste = 'ajuste_entrada' } = req.body;

    if (!cantidad || isNaN(+cantidad)) {
      await conn.rollback(); conn.release();
      return err(res, 'Cantidad inválida', 400);
    }

    const [[prod]] = await conn.query(
      `SELECT stock, costo_prom FROM productos WHERE id_producto = ? AND estado = 1`,
      [id]
    );
    if (!prod) {
      await conn.rollback(); conn.release();
      return err(res, 'Producto no encontrado', 404);
    }

    const delta = tipo_ajuste === 'ajuste_salida' ? -Math.abs(+cantidad) : Math.abs(+cantidad);
    const nuevo_stock = prod.stock + delta;

    if (nuevo_stock < 0) {
      await conn.rollback(); conn.release();
      return err(res, 'Stock insuficiente para el ajuste', 400);
    }

    await conn.query(
      `UPDATE productos SET stock = ? WHERE id_producto = ?`,
      [nuevo_stock, id]
    );

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

/* ── LISTA DE MATERIALES ────────────────── */
const listarMateriales = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT lm.id_lista, lm.id_materia, lm.cantidad,
              mp.nombre, mp.costo_prom,
              u.nombre AS unidad, u.abrev,
              (lm.cantidad * mp.costo_prom) AS subtotal
       FROM lista_materiales lm
       JOIN materias_primas mp ON lm.id_materia = mp.id_materia
       JOIN unidades        u  ON mp.id_unidad  = u.id_unidad
       WHERE lm.id_producto = ?
       ORDER BY mp.nombre`,
      [+req.params.id]
    );
    ok(res, { materiales: rows });
  } catch (e) {
    console.error('[listarMateriales]', e);
    err(res, 'Error al obtener materiales');
  }
};

const guardarMateriales = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const id = +req.params.id;
    const { materiales = [] } = req.body; // [{id_materia, cantidad}]

    // Eliminar los existentes y reinsertar (replace completo)
    await conn.query(`DELETE FROM lista_materiales WHERE id_producto = ?`, [id]);

    for (const m of materiales) {
      if (!m.id_materia || !m.cantidad) continue;
      if (+m.cantidad <= 0) {
        await conn.rollback(); conn.release();
        return err(res, 'La cantidad de cada material debe ser mayor a 0', 400);
      }
      const [[mp]] = await conn.query(
        `SELECT nombre, stock FROM materias_primas WHERE id_materia = ? AND estado = 1`, [+m.id_materia]);
      if (!mp) {
        await conn.rollback(); conn.release();
        return err(res, `Materia prima ${m.id_materia} no encontrada o inactiva`, 404);
      }
      if (+mp.stock > 0 && +m.cantidad > +mp.stock) {
        await conn.rollback(); conn.release();
        return err(res, `Sin stock suficiente para "${mp.nombre}" — disponible: ${mp.stock}`, 400);
      }
      await conn.query(
        `INSERT INTO lista_materiales (id_producto, id_materia, cantidad) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad)`,
        [id, +m.id_materia, +m.cantidad]
      );
    }

    await conn.commit(); conn.release();
    ok(res, { mensaje: 'Materiales guardados' });
  } catch (e) {
    await conn.rollback(); conn.release();
    console.error('[guardarMateriales]', e);
    err(res, 'Error al guardar materiales');
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, ajustarStock, catalogos, listarMateriales, guardarMateriales };
