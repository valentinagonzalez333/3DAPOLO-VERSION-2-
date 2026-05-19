const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const san = (v) => (typeof v === 'string' ? v.trim().replace(/[<>\"']/g, '') : v);

/* ── LISTAR DEVOLUCIONES ─────────────────── */
const listar = async (req, res) => {
  try {
    const { buscar = '', estado = '', desde = '', hasta = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const p = [];
    let where = 'WHERE 1=1';
    if (buscar) {
      where += ' AND (d.id_devolucion LIKE ? OR v.id_venta LIKE ? OR u.nombre LIKE ?)';
      const b = `%${san(buscar)}%`; p.push(b, b, b);
    }
    if (estado) { where += ' AND d.estado = ?'; p.push(san(estado)); }
    if (desde)  { where += ' AND DATE(d.fecha) >= ?'; p.push(desde); }
    if (hasta)  { where += ' AND DATE(d.fecha) <= ?'; p.push(hasta); }

    const base = `FROM devoluciones d
      JOIN ventas   v ON d.id_venta   = v.id_venta
      JOIN usuarios u ON d.id_usuario = u.id_usuario
      ${where}`;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, p);
    const [[{ suma }]]  = await db.query(`SELECT COALESCE(SUM(d.monto_devuelto),0) AS suma ${base}`, p);
    const [rows] = await db.query(
      `SELECT d.id_devolucion, d.fecha, d.motivo, d.tipo, d.monto_devuelto, d.estado, d.notas,
              v.id_venta, v.total AS total_venta, u.nombre AS usuario
       ${base} ORDER BY d.fecha DESC, d.id_devolucion DESC LIMIT ? OFFSET ?`,
      [...p, Math.min(+limite, 100), offset]);
    ok(res, { datos: rows, total_monto: suma,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) } });
  } catch (e) { console.error('[listarDev]', e); err(res, 'Error al obtener devoluciones'); }
};

/* ── DETALLE DEVOLUCIÓN ──────────────────── */
const detalle = async (req, res) => {
  try {
    const [[dev]] = await db.query(
      `SELECT d.*, v.id_venta, v.total AS total_venta, u.nombre AS usuario
       FROM devoluciones d
       JOIN ventas   v ON d.id_venta   = v.id_venta
       JOIN usuarios u ON d.id_usuario = u.id_usuario
       WHERE d.id_devolucion = ?`, [+req.params.id]);
    if (!dev) return err(res, 'Devolución no encontrada', 404);
    const [items] = await db.query(
      `SELECT dd.*, p.nombre AS producto
       FROM detalle_devolucion dd
       JOIN productos p ON dd.id_producto = p.id_producto
       WHERE dd.id_devolucion = ?`, [+req.params.id]);
    ok(res, { ...dev, items });
  } catch (e) { console.error('[detalleDev]', e); err(res, 'Error al obtener detalle'); }
};

/* ── LISTAR VENTAS COMPLETADAS (para historial visual) ── */
const listarVentasCompletadas = async (req, res) => {
  try {
    const { buscar = '', desde = '', hasta = '', pagina = 1, limite = 15 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 50);
    const p = [];
    // Show completada OR devuelta (partial returns still show the sale)
    let where = "WHERE v.estado IN ('completada','devuelta')";
    if (buscar) {
      where += ' AND (v.id_venta LIKE ? OR u.nombre LIKE ? OR cm.nombre LIKE ?)';
      const b = `%${san(buscar)}%`; p.push(b, b, b);
    }
    if (desde) { where += ' AND DATE(v.fecha) >= ?'; p.push(desde); }
    if (hasta) { where += ' AND DATE(v.fecha) <= ?'; p.push(hasta); }

    const base = `FROM ventas v
      JOIN usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN clientes_mayoreo cm ON v.id_cliente = cm.id_cliente
      ${where}`;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, p);
    const [rows] = await db.query(
      `SELECT v.id_venta, v.fecha, v.total, v.estado, v.metodo_pago, v.tipo_venta,
              u.nombre AS vendedor, COALESCE(cm.nombre,'Sin cliente') AS cliente
       ${base} ORDER BY v.fecha DESC LIMIT ? OFFSET ?`,
      [...p, Math.min(+limite, 50), offset]);
    ok(res, { ventas: rows, paginacion: { total, pagina: +pagina, paginas: Math.ceil(total / +limite) } });
  } catch (e) { console.error('[listarVentas]', e); err(res, 'Error al listar ventas'); }
};

/* ── ITEMS DE UNA VENTA PARA DEVOLUCIÓN ──── */
const itemsVenta = async (req, res) => {
  try {
    const [[venta]] = await db.query(
      `SELECT v.id_venta, v.total, v.estado, v.metodo_pago, v.tipo_venta,
              u.nombre AS vendedor, COALESCE(cm.nombre,'Sin cliente') AS cliente
       FROM ventas v
       JOIN usuarios u ON v.id_usuario = u.id_usuario
       LEFT JOIN clientes_mayoreo cm ON v.id_cliente = cm.id_cliente
       WHERE v.id_venta = ?`, [+req.params.id]);
    if (!venta) return err(res, 'Venta no encontrada', 404);

    // Get items with already-returned quantities subtracted
    const [items] = await db.query(
      `SELECT dv.id_producto, p.nombre AS producto,
              dv.cantidad AS cantidad_original,
              dv.precio_venta, dv.subtotal, dv.desc_pct,
              COALESCE(SUM(dd.cantidad), 0) AS ya_devuelto,
              (dv.cantidad - COALESCE(SUM(dd.cantidad), 0)) AS disponible
       FROM detalle_venta dv
       JOIN productos p ON dv.id_producto = p.id_producto
       LEFT JOIN detalle_devolucion dd ON dd.id_producto = dv.id_producto
         AND dd.id_devolucion IN (
           SELECT id_devolucion FROM devoluciones WHERE id_venta = ?
         )
       WHERE dv.id_venta = ?
       GROUP BY dv.id_producto, dv.cantidad, dv.precio_venta, dv.subtotal, dv.desc_pct, p.nombre
       HAVING disponible > 0`,
      [+req.params.id, +req.params.id]);

    ok(res, { ...venta, items });
  } catch (e) { console.error('[itemsVenta]', e); err(res, 'Error al obtener ítems'); }
};

/* ── REGISTRAR DEVOLUCIÓN ────────────────── */
const registrar = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { id_venta, motivo, tipo = 'total', notas = '', items = [] } = req.body;
    if (!id_venta || !motivo) {
      await conn.rollback(); conn.release();
      return err(res, 'Faltan campos requeridos: id_venta y motivo', 400);
    }

    const [[venta]] = await conn.query(
      `SELECT id_venta, total, estado FROM ventas WHERE id_venta = ?`, [+id_venta]);
    if (!venta) { await conn.rollback(); conn.release(); return err(res, 'Venta no encontrada', 404); }
    if (!['completada', 'devuelta'].includes(venta.estado)) {
      await conn.rollback(); conn.release();
      return err(res, 'Solo se pueden devolver ventas completadas', 400);
    }

    // Calculate amount
    let monto_devuelto;
    let itemsToProcess;

    if (tipo === 'total') {
      // Get all remaining items (not yet returned)
      const [allItems] = await conn.query(
        `SELECT dv.id_producto, dv.precio_venta,
                (dv.cantidad - COALESCE(SUM(dd.cantidad),0)) AS disponible,
                dv.subtotal
         FROM detalle_venta dv
         LEFT JOIN detalle_devolucion dd ON dd.id_producto = dv.id_producto
           AND dd.id_devolucion IN (SELECT id_devolucion FROM devoluciones WHERE id_venta = ?)
         WHERE dv.id_venta = ?
         GROUP BY dv.id_producto, dv.cantidad, dv.precio_venta, dv.subtotal
         HAVING disponible > 0`,
        [+id_venta, +id_venta]);
      itemsToProcess = allItems.map(it => ({
        id_producto:  it.id_producto,
        cantidad:     it.disponible,
        precio_venta: it.precio_venta,
        subtotal:     it.precio_venta * it.disponible,
      }));
      monto_devuelto = itemsToProcess.reduce((s, it) => s + +it.subtotal, 0);
    } else {
      // Validate partial items
      for (const it of items) {
        if (!it.id_producto || !it.cantidad) continue;
        const [[orig]] = await conn.query(
          `SELECT dv.cantidad - COALESCE(SUM(dd.cantidad),0) AS disponible
           FROM detalle_venta dv
           LEFT JOIN detalle_devolucion dd ON dd.id_producto = dv.id_producto
             AND dd.id_devolucion IN (SELECT id_devolucion FROM devoluciones WHERE id_venta = ?)
           WHERE dv.id_venta = ? AND dv.id_producto = ?
           GROUP BY dv.cantidad`,
          [+id_venta, +id_venta, +it.id_producto]);
        if (!orig || +it.cantidad > +orig.disponible) {
          await conn.rollback(); conn.release();
          return err(res, `Cantidad devuelta supera lo disponible para producto ${it.id_producto}`, 400);
        }
      }
      itemsToProcess = items.filter(it => it.id_producto && it.cantidad);
      monto_devuelto = itemsToProcess.reduce((s, it) => s + (+it.precio_venta * +it.cantidad), 0);
    }

    // Insert devolucion
    const [rv] = await conn.query(
      `INSERT INTO devoluciones (id_venta, id_usuario, motivo, tipo, monto_devuelto, notas)
       VALUES (?,?,?,?,?,?)`,
      [+id_venta, req.usuario.id, san(motivo), tipo, monto_devuelto, san(notas)]);
    const id_dev = rv.insertId;

    // Process items: insert detalle, restore stock
    for (const it of itemsToProcess) {
      const subtotal = +it.precio_venta * +it.cantidad;
      await conn.query(
        `INSERT INTO detalle_devolucion (id_devolucion,id_producto,cantidad,precio_venta,subtotal)
         VALUES (?,?,?,?,?)`,
        [id_dev, +it.id_producto, +it.cantidad, +it.precio_venta, subtotal]);
      // Restore product stock
      await conn.query(
        `UPDATE productos SET stock = stock + ? WHERE id_producto = ?`,
        [+it.cantidad, +it.id_producto]);
    }

    // Update venta estado:
    // Check if ALL items have been returned → mark as 'devuelta'
    // Otherwise it stays as 'devuelta' (partial) — we always mark devuelta when any return happens
    await conn.query(`UPDATE ventas SET estado = 'devuelta' WHERE id_venta = ?`, [+id_venta]);

    await conn.commit(); conn.release();
    ok(res, { mensaje: 'Devolución registrada', id_devolucion: id_dev, monto_devuelto }, 201);
  } catch (e) {
    await conn.rollback(); conn.release();
    console.error('[registrarDev]', e);
    err(res, e.message || 'Error al registrar devolución');
  }
};

/* ── CAMBIAR ESTADO ──────────────────────── */
const cambiarEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['aprobada', 'rechazada', 'pendiente'].includes(estado))
      return err(res, 'Estado inválido', 400);
    await db.query(`UPDATE devoluciones SET estado = ? WHERE id_devolucion = ?`, [estado, +req.params.id]);
    ok(res, { mensaje: 'Estado actualizado' });
  } catch (e) { console.error('[cambiarEstado]', e); err(res, 'Error'); }
};

module.exports = { listar, detalle, listarVentasCompletadas, itemsVenta, registrar, cambiarEstado };
