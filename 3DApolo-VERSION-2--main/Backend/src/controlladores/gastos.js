const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const san = (v) => (typeof v === 'string' ? v.trim().replace(/[<>\"']/g, '') : v);

/* ───────────────────────────────────────────
   GASTOS
─────────────────────────────────────────── */

const listarGastos = async (req, res) => {
  try {
    const { buscar = '', categoria = '', desde = '', hasta = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];
    let where = 'WHERE 1=1';

    if (buscar) { where += ' AND g.descripcion LIKE ?'; params.push(`%${san(buscar)}%`); }
    if (categoria) { where += ' AND g.id_cat_gasto = ?'; params.push(+categoria); }
    if (desde) { where += ' AND g.fecha >= ?'; params.push(desde); }
    if (hasta) { where += ' AND g.fecha <= ?'; params.push(hasta); }

    const sqlBase = `
      FROM gastos g
      JOIN cat_gastos c ON g.id_cat_gasto = c.id_cat_gasto
      JOIN usuarios u   ON g.id_usuario   = u.id_usuario
      ${where}`;

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${sqlBase}`, params);
    const [[{ suma }]]  = await db.query(`SELECT COALESCE(SUM(g.monto),0) AS suma ${sqlBase}`, params);

    const [rows] = await db.query(
      `SELECT g.id_gasto, g.descripcion, g.monto, g.fecha, g.frecuencia,
              g.comprobante, g.fecha_reg,
              c.id_cat_gasto, c.nombre AS categoria,
              u.nombre AS usuario
       ${sqlBase}
       ORDER BY g.fecha DESC, g.id_gasto DESC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      total_monto: suma,
      paginacion: { total, pagina: +pagina, limite: +limite, paginas: Math.ceil(total / +limite) }
    });
  } catch (e) {
    console.error('[listarGastos]', e);
    err(res, 'Error al obtener gastos');
  }
};

const registrarGasto = async (req, res) => {
  try {
    const { id_cat_gasto, descripcion, monto, fecha, frecuencia = 'unica', comprobante } = req.body;
    if (!id_cat_gasto || !descripcion || !monto) return err(res, 'Faltan campos requeridos', 400);

    const [result] = await db.query(
      `INSERT INTO gastos (id_cat_gasto, id_usuario, descripcion, monto, fecha, frecuencia, comprobante)
       VALUES (?,?,?,?,?,?,?)`,
      [+id_cat_gasto, req.usuario.id, san(descripcion), +monto,
       fecha || new Date().toISOString().slice(0, 10),
       frecuencia, comprobante || null]
    );
    ok(res, { mensaje: 'Gasto registrado', id_gasto: result.insertId }, 201);
  } catch (e) {
    console.error('[registrarGasto]', e);
    err(res, 'Error al registrar gasto');
  }
};

const actualizarGasto = async (req, res) => {
  try {
    const id = +req.params.id;
    const { id_cat_gasto, descripcion, monto, fecha, frecuencia, comprobante } = req.body;

    await db.query(
      `UPDATE gastos SET
         id_cat_gasto = COALESCE(?, id_cat_gasto),
         descripcion  = COALESCE(?, descripcion),
         monto        = COALESCE(?, monto),
         fecha        = COALESCE(?, fecha),
         frecuencia   = COALESCE(?, frecuencia),
         comprobante  = COALESCE(?, comprobante)
       WHERE id_gasto = ?`,
      [id_cat_gasto ? +id_cat_gasto : null, descripcion ? san(descripcion) : null,
       monto !== undefined ? +monto : null, fecha || null,
       frecuencia || null, comprobante !== undefined ? comprobante : null, id]
    );
    ok(res, { mensaje: 'Gasto actualizado' });
  } catch (e) {
    console.error('[actualizarGasto]', e);
    err(res, 'Error al actualizar gasto');
  }
};

const eliminarGasto = async (req, res) => {
  try {
    const [[existe]] = await db.query(`SELECT id_gasto FROM gastos WHERE id_gasto = ?`, [+req.params.id]);
    if (!existe) return err(res, 'Gasto no encontrado', 404);
    await db.query(`DELETE FROM gastos WHERE id_gasto = ?`, [+req.params.id]);
    ok(res, { mensaje: 'Gasto eliminado' });
  } catch (e) {
    console.error('[eliminarGasto]', e);
    err(res, 'Error al eliminar gasto');
  }
};

const categoriasGasto = async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT id_cat_gasto, nombre FROM cat_gastos ORDER BY nombre`);
    ok(res, { categorias: rows });
  } catch (e) {
    console.error('[categoriasGasto]', e);
    err(res, 'Error al obtener categorías');
  }
};

module.exports = { listarGastos, registrarGasto, actualizarGasto, eliminarGasto, categoriasGasto };
