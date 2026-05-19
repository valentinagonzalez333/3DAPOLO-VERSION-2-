const db = require('../confg/db_conexion');

const ok = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });


const ventaPeriodo = async (req, res) => {
    try {
        const {
            desde = '',
            hasta = '',
            agrupacion = 'mes',
            metodo = '',
            tipo = '',
        } = req.query;

        const params = [];
        let where = `WHERE v.estado = 'completada'`;

        if (desde) { where += ` AND DATE(v.fecha) >= ?`; params.push(desde); }
        if (hasta) { where += ` AND DATE(v.fecha) <= ?`; params.push(hasta); }
        if (metodo) { where += ` AND v.metodo_pago = ?`; params.push(metodo); }
        if (tipo) { where += ` AND v.tipo_venta = ?`; params.push(tipo); }

        const formatoMap = {
            dia: `DATE_FORMAT(v.fecha, '%d/%m/%Y')`,
            semana: `DATE_FORMAT(v.fecha, '%u - %Y')`,
            mes: `DATE_FORMAT(v.fecha, '%m/%Y')`,
        };
        const formato = formatoMap[agrupacion] || formatoMap.mes;

        // Resumen general
        const [[resumen]] = await db.query(
            `SELECT
         COUNT(DISTINCT v.id_venta)          AS total_ventas,
         COALESCE(SUM(v.total), 0)           AS total_ingresos,
         COALESCE(SUM(
           d.cantidad * (d.precio_venta - d.costo_prom)
         ), 0)                               AS total_ganancia,
         COALESCE(SUM(d.cantidad), 0)        AS total_unidades,
         COALESCE(AVG(v.total), 0)           AS ticket_promedio
       FROM ventas v
       JOIN detalle_venta d ON d.id_venta = v.id_venta
       ${where}`,
            params
        );

        
        const [periodos] = await db.query(
            `SELECT
     ${formato}                                    AS periodo,
     COUNT(DISTINCT v.id_venta)                   AS num_ventas,
     COALESCE(SUM(d.cantidad), 0)                 AS unidades,
     COALESCE(SUM(v.total), 0)                    AS ingresos,
     COALESCE(SUM(d.cantidad * d.costo_prom), 0)  AS costo,
     COALESCE(SUM(
       d.cantidad * (d.precio_venta - d.costo_prom)
     ), 0)                                        AS ganancia
   FROM ventas v
   JOIN detalle_venta d ON d.id_venta = v.id_venta
   ${where}
   GROUP BY ${formato}
   ORDER BY MIN(v.fecha) ASC`,
            params
        );

        ok(res, { resumen, periodos });
    } catch (e) {
        console.error('[venta-periodo]', e);
        err(res, 'Error al generar informe');
    }
};
// ── GET /api/informes/ganancias ────────────────────────────────────────────
const ganancias = async (req, res) => {
  try {
    const {
      desde = '',
      hasta = '',
      categoria = '',
      orden = 'ganancia',
      top = 20,
    } = req.query;

    const params = [];
    let where = `WHERE v.estado = 'completada'`;

    if (desde)     { where += ` AND DATE(v.fecha) >= ?`; params.push(desde); }
    if (hasta)     { where += ` AND DATE(v.fecha) <= ?`; params.push(hasta); }
    if (categoria) { where += ` AND p.id_categoria = ?`; params.push(+categoria); }

    const ordenMap = {
      ganancia:  'ganancia DESC',
      margen:    'margen DESC',
      unidades:  'unidades DESC',
      ingresos:  'ingresos DESC',
    };
    const orderBy = ordenMap[orden] || 'ganancia DESC';
    const limite  = +top > 0 ? `LIMIT ${+top}` : '';

    const [[resumen]] = await db.query(
      `SELECT
         COUNT(DISTINCT d.id_producto)               AS total_productos,
         COALESCE(SUM(v.total), 0)                   AS total_ingresos,
         COALESCE(SUM(
           d.cantidad * (d.precio_venta - d.costo_prom)
         ), 0)                                       AS total_ganancia
       FROM ventas v
       JOIN detalle_venta d ON d.id_venta = v.id_venta
       JOIN productos p     ON p.id_producto = d.id_producto
       ${where}`,
      params
    );

    const [productos] = await db.query(
      `SELECT
         p.nombre,
         c.nombre                                        AS categoria,
         COALESCE(SUM(d.cantidad), 0)                   AS unidades,
         COALESCE(SUM(d.subtotal), 0)                   AS ingresos,
         COALESCE(SUM(d.cantidad * d.costo_prom), 0)    AS costo,
         COALESCE(SUM(
           d.cantidad * (d.precio_venta - d.costo_prom)
         ), 0)                                          AS ganancia,
         CASE
           WHEN SUM(d.subtotal) > 0
           THEN ROUND(
             SUM(d.cantidad * (d.precio_venta - d.costo_prom))
             / SUM(d.subtotal) * 100, 2)
           ELSE 0
         END                                            AS margen
       FROM ventas v
       JOIN detalle_venta d ON d.id_venta  = v.id_venta
       JOIN productos p     ON p.id_producto = d.id_producto
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       ${where}
       GROUP BY d.id_producto
       ORDER BY ${orderBy}
       ${limite}`,
      params
    );

    ok(res, { resumen, productos });
  } catch (e) {
    console.error('[ganancias]', e);
    err(res, 'Error al generar informe de ganancias');
  }
};

// ── GET /api/informes/mas-vendido ──────────────────────────────────────────
const masVendido = async (req, res) => {
  try {
    const {
      desde = '',
      hasta = '',
      categoria = '',
      tipo = '',
      top = 10,
    } = req.query;

    const params = [];
    let where = `WHERE v.estado = 'completada'`;

    if (desde)     { where += ` AND DATE(v.fecha) >= ?`; params.push(desde); }
    if (hasta)     { where += ` AND DATE(v.fecha) <= ?`; params.push(hasta); }
    if (tipo)      { where += ` AND v.tipo_venta = ?`;   params.push(tipo); }
    if (categoria) { where += ` AND p.id_categoria = ?`; params.push(+categoria); }

    const limite = +top > 0 ? `LIMIT ${+top}` : '';

    const [productos] = await db.query(
      `SELECT
         p.nombre,
         c.nombre                                        AS categoria,
         SUM(d.cantidad)                                 AS unidades,
         COUNT(DISTINCT v.id_venta)                      AS veces_vendido,
         COALESCE(SUM(d.subtotal), 0)                    AS ingresos,
         COALESCE(SUM(d.cantidad * d.costo_prom), 0)     AS costo,
         COALESCE(SUM(
           d.cantidad * (d.precio_venta - d.costo_prom)
         ), 0)                                           AS ganancia
       FROM ventas v
       JOIN detalle_venta d ON d.id_venta    = v.id_venta
       JOIN productos p     ON p.id_producto = d.id_producto
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       ${where}
       GROUP BY d.id_producto
       ORDER BY unidades DESC
       ${limite}`,
      params
    );

    const totalUnidades = productos.reduce((s, p) => s + +p.unidades, 0);

    ok(res, { productos, total_unidades: totalUnidades });
  } catch (e) {
    console.error('[mas-vendido]', e);
    err(res, 'Error al generar informe');
  }
};

// ── GET /api/informes/gastos-categoria ────────────────────────────────────
const gastosPorCategoria = async (req, res) => {
  try {
    const { desde = '', hasta = '', frecuencia = '' } = req.query;

    const params = [];
    let where = `WHERE 1=1`;

    if (desde)      { where += ` AND g.fecha >= ?`;       params.push(desde); }
    if (hasta)      { where += ` AND g.fecha <= ?`;       params.push(hasta); }
    if (frecuencia) { where += ` AND g.frecuencia = ?`;   params.push(frecuencia); }

    const [[resumen]] = await db.query(
      `SELECT
         COALESCE(SUM(g.monto), 0)     AS total_monto,
         COUNT(*)                       AS total_registros,
         COUNT(DISTINCT g.id_cat_gasto) AS total_categorias
       FROM gastos g
       ${where}`,
      params
    );

    const [categorias] = await db.query(
      `SELECT
         COALESCE(cg.nombre, 'Sin categoría') AS categoria,
         COUNT(*)                              AS registros,
         COALESCE(SUM(g.monto), 0)            AS total,
         COALESCE(AVG(g.monto), 0)            AS promedio,
         COALESCE(MAX(g.monto), 0)            AS mayor
       FROM gastos g
       LEFT JOIN cat_gastos cg ON cg.id_cat_gasto = g.id_cat_gasto
       ${where}
       GROUP BY g.id_cat_gasto
       ORDER BY total DESC`,
      params
    );

    ok(res, { resumen, categorias });
  } catch (e) {
    console.error('[gastos-categoria]', e);
    err(res, 'Error al generar informe de gastos');
  }
};

// ── GET /api/informes/inventario ───────────────────────────────────────────
const inventario = async (req, res) => {
  try {
    const { categoria = '', tipo = '', estado = '', buscar = '' } = req.query;

    const params = [];
    let where = `WHERE p.estado = 1`;

    if (categoria) { where += ` AND p.id_categoria = ?`;  params.push(+categoria); }
    if (tipo)      { where += ` AND p.tipo = ?`;           params.push(tipo); }
    if (buscar)    {
      where += ` AND p.nombre LIKE ?`;
      params.push(`%${buscar}%`);
    }
    if (estado === 'agotado') { where += ` AND p.stock = 0`; }
    else if (estado === 'bajo') { where += ` AND p.stock > 0 AND p.stock <= p.stock_min`; }
    else if (estado === 'ok')   { where += ` AND p.stock > p.stock_min`; }

    const [productos] = await db.query(
      `SELECT
         p.id_producto, p.nombre, p.tipo,
         p.stock, p.stock_min, p.costo_prom, p.precio_venta,
         c.nombre AS categoria,
         u.abrev
       FROM productos p
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       LEFT JOIN unidades   u ON u.id_unidad    = p.id_unidad
       ${where}
       ORDER BY p.nombre ASC`,
      params
    );

    // Resumen general (sin filtros de estado para que las cards sean globales)
    const [[resumen]] = await db.query(
      `SELECT
         COUNT(*)                                    AS total,
         COALESCE(SUM(p.stock * p.costo_prom), 0)   AS valor_total,
         SUM(CASE WHEN p.stock > p.stock_min THEN 1 ELSE 0 END)           AS en_stock,
         SUM(CASE WHEN p.stock > 0 AND p.stock <= p.stock_min THEN 1 ELSE 0 END) AS stock_bajo,
         SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END)                     AS sin_stock
       FROM productos p
       WHERE p.estado = 1`
    );

    // Valor por categoría
    const [porCategoria] = await db.query(
      `SELECT
         COALESCE(c.nombre, 'Sin categoría')        AS categoria,
         COALESCE(SUM(p.stock * p.costo_prom), 0)   AS valor
       FROM productos p
       LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
       WHERE p.estado = 1
       GROUP BY p.id_categoria
       ORDER BY valor DESC
       LIMIT 10`
    );

    ok(res, { productos, resumen, porCategoria });
  } catch (e) {
    console.error('[inventario]', e);
    err(res, 'Error al generar informe de inventario');
  }
};
module.exports = { ventaPeriodo, ganancias, masVendido, gastosPorCategoria, inventario };