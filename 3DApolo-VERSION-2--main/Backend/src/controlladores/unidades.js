const db = require('../confg/db_conexion');

const ok       = (res, data, status = 200) => res.status(status).json(data);
const err      = (res, msg, status = 500)  => res.status(status).json({ error: msg });
const sanitize = (v) => (typeof v === 'string' ? v.trim().replace(/[<>"']/g, '') : v);


const listar = async (req, res) => {
  try {
    const { buscar = '', pagina = 1, limite = 20 } = req.query;
    const offset = (Math.max(1, +pagina) - 1) * Math.min(+limite, 100);
    const params = [];

    let where = `WHERE 1=1`;
    if (buscar) {
      where += ` AND (nombre LIKE ? OR abrev LIKE ?)`;
      const b = `%${sanitize(buscar)}%`;
      params.push(b, b);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM unidades ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT id_unidad, nombre, abrev
       FROM unidades
       ${where}
       ORDER BY nombre ASC
       LIMIT ? OFFSET ?`,
      [...params, Math.min(+limite, 100), offset]
    );

    ok(res, {
      datos: rows,
      paginacion: {
        total,
        pagina:  +pagina,
        limite:  +limite,
        paginas: Math.ceil(total / +limite),
      },
    });
  } catch (e) {
    console.error('[listar unidades]', e);
    err(res, 'Error al obtener unidades');
  }
};


const obtener = async (req, res) => {
  try {
    const [[u]] = await db.query(
      `SELECT * FROM unidades WHERE id_unidad = ?`, [+req.params.id]
    );
    if (!u) return err(res, 'Unidad no encontrada', 404);
    ok(res, u);
  } catch (e) {
    console.error('[obtener unidad]', e);
    err(res, 'Error al obtener unidad');
  }
};


const crear = async (req, res) => {
  try {
    const { nombre, abrev } = req.body;
    if (!nombre) return err(res, 'El nombre es obligatorio', 400);
    if (!abrev)  return err(res, 'La abreviatura es obligatoria', 400);

    const [[existe]] = await db.query(
      `SELECT id_unidad FROM unidades WHERE nombre = ? OR abrev = ?`,
      [sanitize(nombre), sanitize(abrev)]
    );
    if (existe) return err(res, 'Ya existe una unidad con ese nombre o abreviatura', 409);

    const [result] = await db.query(
      `INSERT INTO unidades (nombre, abrev) VALUES (?, ?)`,
      [sanitize(nombre), sanitize(abrev)]
    );

    ok(res, { mensaje: 'Unidad creada', id_unidad: result.insertId }, 201);
  } catch (e) {
    console.error('[crear unidad]', e);
    err(res, 'Error al crear unidad');
  }
};


const actualizar = async (req, res) => {
  try {
    const id = +req.params.id;
    const [[existe]] = await db.query(
      `SELECT id_unidad FROM unidades WHERE id_unidad = ?`, [id]
    );
    if (!existe) return err(res, 'Unidad no encontrada', 404);

    const { nombre, abrev } = req.body;

    if (nombre || abrev) {
      const [[dup]] = await db.query(
        `SELECT id_unidad FROM unidades
         WHERE (nombre = ? OR abrev = ?) AND id_unidad != ?`,
        [sanitize(nombre || ''), sanitize(abrev || ''), id]
      );
      if (dup) return err(res, 'Ya existe otra unidad con ese nombre o abreviatura', 409);
    }

    await db.query(
      `UPDATE unidades SET
         nombre = COALESCE(?, nombre),
         abrev  = COALESCE(?, abrev)
       WHERE id_unidad = ?`,
      [
        nombre ? sanitize(nombre) : null,
        abrev  ? sanitize(abrev)  : null,
        id,
      ]
    );

    ok(res, { mensaje: 'Unidad actualizada' });
  } catch (e) {
    console.error('[actualizar unidad]', e);
    err(res, 'Error al actualizar unidad');
  }
};


const eliminar = async (req, res) => {
  try {
    const id = +req.params.id;
    const [[existe]] = await db.query(
      `SELECT id_unidad FROM unidades WHERE id_unidad = ?`, [id]
    );
    if (!existe) return err(res, 'Unidad no encontrada', 404);

    await db.query(
      `UPDATE productos SET id_unidad = NULL WHERE id_unidad = ?`, [id]
    );

    await db.query(`DELETE FROM unidades WHERE id_unidad = ?`, [id]);

    ok(res, { mensaje: 'Unidad eliminada' });
  } catch (e) {
    console.error('[eliminar unidad]', e);
    err(res, 'Error al eliminar unidad');
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };