const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500)  => res.status(status).json({ error: msg });

const TIPOS_ENTRADA = ['compra', 'produccion', 'ajuste_entrada', 'dev_entrada'];
const TIPOS_SALIDA  = ['venta', 'ajuste_salida', 'dev_salida'];

// ── GET /api/movimientos ───────────────────────────────────────────────────
const listar = async (req, res) => {
  try {
    const {
      buscar = '', tipo = '', desde = '', hasta = '',
      pagina = 1, limite = 30,
    } = req.query;

    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];
    let where = `WHERE 1=1`;

    if (desde) { where += ` AND DATE(m.fecha) >= ?`; params.push(desde); }
    if (hasta) { where += ` AND DATE(m.fecha) <= ?`; params.push(hasta); }

    // Filtro por tipo o dirección
    if (tipo === 'entrada') {
      where += ` AND m.tipo IN (${TIPOS_ENTRADA.map(() => '?').join(',')})`;
      params.push(...TIPOS_ENTRADA);
    } else if (tipo === 'salida') {
      where += ` AND m.tipo IN (${TIPOS_SALIDA.map(() => '?').join(',')})`;
      params.push(...TIPOS_SALIDA);
    } else if (tipo) {
      where += ` AND m.tipo = ?`;
      params.push(tipo);
    }

    if (buscar) {
      where += ` AND p.nombre LIKE ?`;
      params.push(`%${buscar}%`);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM movimientos m
       JOIN productos p ON p.id_producto = m.id_producto
       ${where}`,
      params
    );

    const [datos] = await db.query(
      `SELECT
         m.id_movimiento,
         m.tipo,
         m.cantidad,
         m.costo_unit,
         m.fecha,
         m.id_ref,
         p.nombre  AS producto,
         u.nombre  AS usuario
       FROM movimientos m
       JOIN productos p        ON p.id_producto = m.id_producto
       LEFT JOIN usuarios u    ON u.id_usuario  = m.id_usuario
       ${where}
       ORDER BY m.fecha DESC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    // Resumen del periodo filtrado
    const resumenParams = [];
    let whereResumen = `WHERE 1=1`;
    if (desde) { whereResumen += ` AND DATE(m.fecha) >= ?`; resumenParams.push(desde); }
    if (hasta) { whereResumen += ` AND DATE(m.fecha) <= ?`; resumenParams.push(hasta); }

    const [[resumen]] = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN m.tipo IN ('compra','produccion','ajuste_entrada','dev_entrada')
             THEN 1 ELSE 0 END) AS entradas,
         SUM(CASE WHEN m.tipo IN ('venta','ajuste_salida','dev_salida')
             THEN 1 ELSE 0 END) AS salidas,
         COALESCE(SUM(ABS(m.cantidad) * m.costo_unit), 0) AS valor_total
       FROM movimientos m
       ${whereResumen}`,
      resumenParams
    );

    ok(res, {
      datos,
      resumen,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) },
    });
  } catch (e) {
    console.error('[listar movimientos]', e);
    err(res, 'Error al obtener movimientos');
  }
};

module.exports = { listar };