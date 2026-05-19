const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500)  => res.status(status).json({ error: msg });

// ── GET /api/dashboard/finanzas ────────────────────────────────────────────
const finanzas = async (req, res) => {
  try {
    const { desde = '', hasta = '' } = req.query;
    const params = [];
    let where = `WHERE v.estado = 'completada'`;
    if (desde) { where += ` AND DATE(v.fecha) >= ?`; params.push(desde); }
    if (hasta) { where += ` AND DATE(v.fecha) <= ?`; params.push(hasta); }

    // Ingresos y costo de materias primas usadas en ventas
    const [[ventas]] = await db.query(
      `SELECT
         COALESCE(SUM(v.total), 0)                          AS ingresos_brutos,
         COUNT(DISTINCT v.id_venta)                         AS num_ventas,
         COALESCE(AVG(v.total), 0)                          AS ticket_promedio,
         COALESCE(SUM(d.cantidad), 0)                       AS unidades_vendidas,
         COALESCE(SUM(d.cantidad * d.costo_prom), 0)        AS costo_materias
       FROM ventas v
       JOIN detalle_venta d ON d.id_venta = v.id_venta
       ${where}`,
      params
    );

    // Gastos operativos del periodo
    const gastosParams = [];
    let whereGastos = `WHERE 1=1`;
    if (desde) { whereGastos += ` AND fecha >= ?`; gastosParams.push(desde); }
    if (hasta) { whereGastos += ` AND fecha <= ?`; gastosParams.push(hasta); }

    const [[gastos]] = await db.query(
      `SELECT
         COALESCE(SUM(monto), 0) AS gastos_operativos,
         COUNT(*)                AS num_gastos
       FROM gastos
       ${whereGastos}`,
      gastosParams
    );

    ok(res, {
      ingresos_brutos:   +ventas.ingresos_brutos,
      num_ventas:        +ventas.num_ventas,
      ticket_promedio:   +ventas.ticket_promedio,
      unidades_vendidas: +ventas.unidades_vendidas,
      costo_materias:    +ventas.costo_materias,
      gastos_operativos: +gastos.gastos_operativos,
      num_gastos:        +gastos.num_gastos,
    });
  } catch (e) {
    console.error('[dashboard finanzas]', e);
    err(res, 'Error al cargar finanzas');
  }
};

// ── GET /api/dashboard/inventario ─────────────────────────────────────────
const inventario = async (req, res) => {
  try {
    const [[stats]] = await db.query(
      `SELECT
         COUNT(*)                                              AS total_productos,
         COALESCE(SUM(p.stock * p.costo_prom), 0)            AS valor_inventario,
         SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END)        AS sin_stock,
         SUM(CASE WHEN p.stock > 0
               AND p.stock <= p.stock_min THEN 1 ELSE 0 END) AS stock_bajo
       FROM productos p
       WHERE p.estado = 1`
    );

    // Alertas: productos con stock bajo o agotado
    const [alertas] = await db.query(
      `SELECT p.nombre, p.stock, p.stock_min, u.abrev
       FROM productos p
       LEFT JOIN unidades u ON u.id_unidad = p.id_unidad
       WHERE p.estado = 1 AND p.stock <= p.stock_min
       ORDER BY p.stock ASC
       LIMIT 10`
    );

    ok(res, { ...stats, alertas });
  } catch (e) {
    console.error('[dashboard inventario]', e);
    err(res, 'Error al cargar inventario');
  }
};

// ── GET /api/dashboard/movimientos-recientes ──────────────────────────────
const movimientosRecientes = async (req, res) => {
  try {
    const [movs] = await db.query(
      `SELECT
         m.tipo, m.cantidad, m.fecha,
         p.nombre AS producto
       FROM movimientos m
       JOIN productos p ON p.id_producto = m.id_producto
       WHERE DATE(m.fecha) = CURDATE()
       ORDER BY m.fecha DESC
       LIMIT 15`
    );
    ok(res, movs);
  } catch (e) {
    console.error('[dashboard movimientos]', e);
    err(res, 'Error al cargar movimientos');
  }
};

module.exports = { finanzas, inventario, movimientosRecientes };