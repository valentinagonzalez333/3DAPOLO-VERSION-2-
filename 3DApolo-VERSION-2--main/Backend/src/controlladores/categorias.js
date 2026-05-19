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
      where += ` AND (c.nombre LIKE ? OR c.descripcion LIKE ?)`;
      const b = `%${sanitize(buscar)}%`;
      params.push(b, b);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM categorias c ${where}`, params
    );

    const [rows] = await db.query(
      `SELECT
         c.id_categoria,
         c.nombre,
         c.descripcion,
         COUNT(p.id_producto) AS total_productos
       FROM categorias c
       LEFT JOIN productos p ON p.id_categoria = c.id_categoria AND p.estado = 1
       ${where}
       GROUP BY c.id_categoria
       ORDER BY c.nombre ASC
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
    console.error('[listar categorias]', e);
    err(res, 'Error al obtener categorías');
  }
};


const obtener = async (req, res) => {
  try {
    const [[cat]] = await db.query(
      `SELECT * FROM categorias WHERE id_categoria = ?`,
      [+req.params.id]
    );
    if (!cat) return err(res, 'Categoría no encontrada', 404);
    ok(res, cat);
  } catch (e) {
    console.error('[obtener categoria]', e);
    err(res, 'Error al obtener categoría');
  }
};


const crear = async (req, res) => {
  try {
    const { nombre, descripcion = null } = req.body;
    if (!nombre) return err(res, 'El nombre es obligatorio', 400);

  
    const [[existe]] = await db.query(
      `SELECT id_categoria FROM categorias WHERE nombre = ?`,
      [sanitize(nombre)]
    );
    if (existe) return err(res, 'Ya existe una categoría con ese nombre', 409);

    const [result] = await db.query(
      `INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)`,
      [sanitize(nombre), descripcion ? sanitize(descripcion) : null]
    );

    ok(res, { mensaje: 'Categoría creada', id_categoria: result.insertId }, 201);
  } catch (e) {
    console.error('[crear categoria]', e);
    err(res, 'Error al crear categoría');
  }
};


const actualizar = async (req, res) => {
  try {
    const id = +req.params.id;
    const [[existe]] = await db.query(
      `SELECT id_categoria FROM categorias WHERE id_categoria = ?`, [id]
    );
    if (!existe) return err(res, 'Categoría no encontrada', 404);

    const { nombre, descripcion } = req.body;

    
    if (nombre) {
      const [[dup]] = await db.query(
        `SELECT id_categoria FROM categorias WHERE nombre = ? AND id_categoria != ?`,
        [sanitize(nombre), id]
      );
      if (dup) return err(res, 'Ya existe otra categoría con ese nombre', 409);
    }

    await db.query(
      `UPDATE categorias SET
         nombre      = COALESCE(?, nombre),
         descripcion = COALESCE(?, descripcion)
       WHERE id_categoria = ?`,
      [
        nombre      ? sanitize(nombre)      : null,
        descripcion !== undefined ? sanitize(descripcion) : null,
        id,
      ]
    );

    ok(res, { mensaje: 'Categoría actualizada' });
  } catch (e) {
    console.error('[actualizar categoria]', e);
    err(res, 'Error al actualizar categoría');
  }
};


const eliminar = async (req, res) => {
  try {
    const id = +req.params.id;
    const [[existe]] = await db.query(
      `SELECT id_categoria FROM categorias WHERE id_categoria = ?`, [id]
    );
    if (!existe) return err(res, 'Categoría no encontrada', 404);

    // Desasociar productos antes de eliminar
    await db.query(
      `UPDATE productos SET id_categoria = NULL WHERE id_categoria = ?`, [id]
    );

    await db.query(`DELETE FROM categorias WHERE id_categoria = ?`, [id]);

    ok(res, { mensaje: 'Categoría eliminada' });
  } catch (e) {
    console.error('[eliminar categoria]', e);
    err(res, 'Error al eliminar categoría');
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };