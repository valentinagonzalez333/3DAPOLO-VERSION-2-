const db = require('../confg/db_conexion');

const ok = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const sanitize = (v) => (typeof v === 'string' ? v.trim().replace(/[<>"']/g, '') : v);


const listar = async (req, res) => {
  try {
    const {
      buscar = '', pagina = 1, limite = 20,
      proveedor = '', estado = '', fecha_ini = '', fecha_fin = '',
    } = req.query;

    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];
    let where = `WHERE 1=1`;

    if (proveedor) { where += ` AND c.id_proveedor = ?`; params.push(+proveedor); }
    if (estado) { where += ` AND c.estado = ?`; params.push(estado); }
    if (fecha_ini) { where += ` AND c.fecha >= ?`; params.push(fecha_ini); }
    if (fecha_fin) { where += ` AND c.fecha <= ?`; params.push(fecha_fin); }
    if (buscar) {
      where += ` AND (p.nombre LIKE ? OR c.notas LIKE ?)`;
      const b = `%${sanitize(buscar)}%`;
      params.push(b, b);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(DISTINCT c.id_compra) AS total
       FROM compras c
       LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
       ${where}`,
      params
    );

    const [rows] = await db.query(
      `SELECT
         c.id_compra, c.fecha, c.estado,
         c.subtotal, c.impuesto, c.total,
         c.notas, c.fecha_reg,
         p.nombre AS proveedor,
         u.nombre AS usuario,
         COUNT(d.id_det_compra) AS num_items
       FROM compras c
       LEFT JOIN proveedores    p ON p.id_proveedor = c.id_proveedor
       LEFT JOIN usuarios       u ON u.id_usuario   = c.id_usuario
       LEFT JOIN detalle_compra d ON d.id_compra    = c.id_compra
       ${where}
       GROUP BY c.id_compra
       ORDER BY c.fecha_reg DESC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) },
    });
  } catch (e) {
    console.error('[listar compras]', e);
    err(res, 'Error al obtener compras');
  }
};


const obtener = async (req, res) => {
  try {
    const id = +req.params.id;
    const [[compra]] = await db.query(
      `SELECT c.*, p.nombre AS proveedor, u.nombre AS usuario
       FROM compras c
       LEFT JOIN proveedores p ON p.id_proveedor = c.id_proveedor
       LEFT JOIN usuarios    u ON u.id_usuario   = c.id_usuario
       WHERE c.id_compra = ?`,
      [id]
    );
    if (!compra) return err(res, 'Compra no encontrada', 404);

    const [detalle] = await db.query(
      `SELECT
      d.*,
      COALESCE(pr.nombre, mp.nombre) AS nombre_item,
      CASE WHEN d.id_materia IS NOT NULL THEN 'materia' ELSE 'producto' END AS tipo_item
   FROM detalle_compra d
   LEFT JOIN productos      pr ON pr.id_producto = d.id_producto
   LEFT JOIN materias_primas mp ON mp.id_materia  = d.id_materia
   WHERE d.id_compra = ?`,
      [id]
    );

    ok(res, { ...compra, detalle });
  } catch (e) {
    console.error('[obtener compra]', e);
    err(res, 'Error al obtener compra');
  }
};


const crear = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      id_proveedor,
      fecha,
      subtotal,
      impuesto = 0,
      total,
      notas = null,
      detalle = [],
    } = req.body;


    if (!id_proveedor || !fecha || !detalle.length) {
      await conn.rollback();
      conn.release();
      return err(res, 'Faltan campos requeridos', 400);
    }

    const id_usuario = req.usuario?.id || null;

    const [result] = await conn.query(
      `INSERT INTO compras
         (id_proveedor, id_usuario, fecha, subtotal, impuesto, total, estado, notas)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
      [+id_proveedor, id_usuario, fecha, +subtotal, +impuesto, +total,
      notas ? sanitize(notas) : null]
    );

    const id_compra = result.insertId;

    for (const item of detalle) {
  // 1. Forzamos la detección: ¿Viene marcado como materia o el ID contiene 'mat'?
  const idString = String(item.id_producto || '');
  const esMateria = item.tipo_item === 'materia' || item.tipo === 'materia' || idString.startsWith('mat-');

  // 2. Limpiamos el ID quitándole letras si es que el frontend mandó "mat-20" o "prod-20"
  const idLimpio = parseInt(idString.replace('mat-', '').replace('prod-', ''), 10);

  await conn.query(
    `INSERT INTO detalle_compra
       (id_compra, id_producto, id_materia, cantidad, precio_unit, subtotal)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id_compra,
      esMateria ? null : idLimpio, // Si es materia, id_producto se guarda como NULL
      esMateria ? idLimpio : null, // Si es materia, se guarda en id_materia
      +item.cantidad,
      +item.precio_unit,
      +(item.cantidad * item.precio_unit).toFixed(2),
    ]
  );
}

    await conn.commit();
    conn.release();
    ok(res, { mensaje: 'Compra registrada', id_compra }, 201);
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[crear compra]', e);
    err(res, 'Error al registrar compra');
  }
};


const cambiarEstado = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const id = +req.params.id;
    const { estado } = req.body;
    const estadosValidos = ['pendiente', 'recibida', 'parcial', 'cancelada'];

    if (!estadosValidos.includes(estado)) {
      await conn.rollback(); conn.release();
      return err(res, 'Estado inválido', 400);
    }

    const [[compra]] = await conn.query(
      `SELECT * FROM compras WHERE id_compra = ?`, [id]
    );
    if (!compra) {
      await conn.rollback(); conn.release();
      return err(res, 'Compra no encontrada', 404);
    }
    if (compra.estado === 'recibida') {
      await conn.rollback(); conn.release();
      return err(res, 'La compra ya fue recibida', 409);
    }

    await conn.query(
      `UPDATE compras SET estado = ? WHERE id_compra = ?`, [estado, id]
    );


    if (estado === 'recibida') {
      const [detalle] = await conn.query(
        `SELECT * FROM detalle_compra WHERE id_compra = ?`, [id]
      );

      for (const item of detalle) {

        const [[prod]] = await conn.query(
          `SELECT id_producto, stock, costo_prom
           FROM productos WHERE id_producto = ? AND estado = 1`,
          [item.id_producto]
        );

        if (prod) {
          const stockNuevo = +prod.stock + +item.cantidad;
          const costoPromAnt = +prod.costo_prom || 0;
          const costoPromNew = stockNuevo > 0
            ? ((costoPromAnt * +prod.stock) + (+item.precio_unit * +item.cantidad)) / stockNuevo
            : +item.precio_unit;

          await conn.query(
            `UPDATE productos SET stock = ?, costo_prom = ? WHERE id_producto = ?`,
            [stockNuevo, +costoPromNew.toFixed(4), prod.id_producto]
          );
          await conn.query(
            `UPDATE detalle_compra SET costo_prom_ant = ?, costo_prom_new = ?
             WHERE id_det_compra = ?`,
            [costoPromAnt, +costoPromNew.toFixed(4), item.id_det_compra]
          );


          await conn.query(
            `INSERT INTO movimientos (id_producto, id_usuario, tipo, tipo_item, id_ref, cantidad, costo_unit)
   VALUES (?, ?, 'compra', 'producto', ?, ?, ?)`,
            [prod.id_producto, req.usuario?.id || null, id, +item.cantidad, +item.precio_unit]
          );
        } else {

          const [[mp]] = await conn.query(
            `SELECT id_materia, stock, costo_prom
             FROM materias_primas WHERE id_materia = ? AND estado = 1`,
            [item.id_producto]
          );

          if (mp) {
            const stockNuevo = +mp.stock + +item.cantidad;
            const costoPromAnt = +mp.costo_prom || 0;
            const costoPromNew = stockNuevo > 0
              ? ((costoPromAnt * +mp.stock) + (+item.precio_unit * +item.cantidad)) / stockNuevo
              : +item.precio_unit;

            await conn.query(
              `UPDATE materias_primas SET stock = ?, costo_prom = ? WHERE id_materia = ?`,
              [stockNuevo, +costoPromNew.toFixed(4), mp.id_materia]
            );
            await conn.query(
              `UPDATE detalle_compra SET costo_prom_ant = ?, costo_prom_new = ?
               WHERE id_det_compra = ?`,
              [costoPromAnt, +costoPromNew.toFixed(4), item.id_det_compra]
            );
            await conn.query(
              `INSERT INTO movimientos (id_producto, id_usuario, tipo, tipo_item, id_ref, cantidad, costo_unit)
   VALUES (?, ?, 'compra', 'materia', ?, ?, ?)`,
              [mp.id_materia, req.usuario?.id || null, id, +item.cantidad, +item.precio_unit]
            );
          }
        }
      }
    }

    await conn.commit();
    conn.release();
    ok(res, { mensaje: `Compra marcada como ${estado}` });
  } catch (e) {
    await conn.rollback();
    conn.release();
    console.error('[cambiarEstado compra]', e);
    err(res, 'Error al cambiar estado');
  }
};


const buscarItems = async (req, res) => {
  try {
    const { q = '', id_proveedor = '' } = req.query;
    if (!q || q.length < 2) return ok(res, []);

    const b = `%${sanitize(q)}%`;

    const [productos] = await db.query(
      `SELECT id_producto AS id, nombre, costo_prom AS precio, 'producto' AS tipo, stock
   FROM productos
   WHERE nombre LIKE ? AND estado = 1 AND tipo = 'comprado'
   LIMIT 15`,
      [b]
    );

    const materiasQuery = id_proveedor
      ? `SELECT id_materia AS id, nombre, costo_prom AS precio, 'materia' AS tipo, stock
     FROM materias_primas
     WHERE nombre LIKE ? AND estado = 1 
     AND (id_proveedor = ? OR id_proveedor IS NULL)
     LIMIT 15`
      : `SELECT id_materia AS id, nombre, costo_prom AS precio, 'materia' AS tipo, stock
     FROM materias_primas
     WHERE nombre LIKE ? AND estado = 1
     LIMIT 15`;

    const materiasParams = id_proveedor ? [b, +id_proveedor] : [b];
    const [materias] = await db.query(materiasQuery, materiasParams);

    ok(res, [...productos, ...materias]);
  } catch (e) {
    console.error('[buscarItems]', e);
    err(res, 'Error al buscar items');
  }
};


const resumen = async (req, res) => {
  try {
    const { fecha_ini = '', fecha_fin = '', id_proveedor = '' } = req.query;
    const params = [];
    let where = `WHERE c.estado = 'recibida'`;

    if (fecha_ini) { where += ` AND c.fecha >= ?`; params.push(fecha_ini); }
    if (fecha_fin) { where += ` AND c.fecha <= ?`; params.push(fecha_fin); }
    if (id_proveedor) { where += ` AND c.id_proveedor = ?`; params.push(+id_proveedor); }

    const [[stats]] = await db.query(
      `SELECT
         COUNT(*)      AS total_compras,
         SUM(c.total)    AS monto_total,
         SUM(c.impuesto) AS total_impuesto,
         AVG(c.total)    AS promedio
       FROM compras c ${where}`,
      params
    );

    const [porProveedor] = await db.query(
      `SELECT p.nombre AS proveedor, COUNT(*) AS compras, SUM(c.total) AS total
       FROM compras c
       JOIN proveedores p ON p.id_proveedor = c.id_proveedor
       ${where}
       GROUP BY c.id_proveedor
       ORDER BY total DESC
       LIMIT 10`,
      params
    );

    ok(res, { stats, porProveedor });
  } catch (e) {
    console.error('[resumen compras]', e);
    err(res, 'Error al obtener resumen');
  }
};

module.exports = { listar, obtener, crear, cambiarEstado, buscarItems, resumen };