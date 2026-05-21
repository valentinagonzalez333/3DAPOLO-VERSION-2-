const db = require('../confg/db_conexion');

const ok = (res, data, status = 200) =>
  res.status(status).json(data);

const err = (res, msg, status = 500) =>
  res.status(status).json({ error: msg });

/* =========================================================
   LISTAR
========================================================= */

const listarPorProveedor = async (req, res) => {
  try {

    const idProveedor = +req.params.id_proveedor;

    // PRODUCTOS

    const productosQuery = `
      SELECT
        pp.id_prov_prod,
        pp.id_proveedor,
        pp.id_producto,
        pp.precio_compra,
        pp.dias_entrega,
        pp.preferido,
        pp.fecha_act,

        p.nombre,
        p.precio_venta,
        p.stock,
        p.costo_prom,
        p.tipo,

        c.nombre AS categoria

      FROM proveedor_producto pp

      INNER JOIN productos p
        ON p.id_producto = pp.id_producto

      LEFT JOIN categorias c
        ON c.id_categoria = p.id_categoria

      WHERE pp.id_proveedor = ?
    `;

    // MATERIAS

    const materiasQuery = `
      SELECT
        NULL AS id_prov_prod,
        mp.id_proveedor,
        mp.id_materia AS id_producto,
        mp.costo_prom AS precio_compra,
        NULL AS dias_entrega,
        0 AS preferido,
        mp.fecha_act,

        mp.nombre,
        0 AS precio_venta,
        mp.stock,
        mp.costo_prom,

        'materia' AS tipo,

        'Materia prima' AS categoria

      FROM materias_primas mp

      WHERE mp.id_proveedor = ?
      AND mp.estado = 1
    `;

    const [productos] = await db.query(
      productosQuery,
      [idProveedor]
    );

    const [materias] = await db.query(
      materiasQuery,
      [idProveedor]
    );

    const rows = [
      ...productos,
      ...materias
    ];

    rows.sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '')
    );

    ok(res, rows);

  } catch (e) {

    console.error('[listarPorProveedor]', e);

    err(res, 'Error al obtener productos');
  }
};

/* =========================================================
   DETALLE
========================================================= */

const obtenerDetalle = async (req, res) => {
  try {

    const [[row]] = await db.query(
      `
      SELECT
        pp.*,
        p.nombre,
        p.precio_venta,
        p.costo_prom

      FROM proveedor_producto pp

      INNER JOIN productos p
        ON p.id_producto = pp.id_producto

      WHERE pp.id_prov_prod = ?
      `,
      [+req.params.id_prov_prod]
    );

    if (!row) {
      return err(res, 'Asignación no encontrada', 404);
    }

    ok(res, row);

  } catch (e) {

    console.error('[obtenerDetalle]', e);

    err(res, 'Error al obtener detalle');
  }
};

/* =========================================================
   ASIGNAR
========================================================= */

const asignar = async (req, res) => {

  const conn = await db.getConnection();

  try {

    await conn.beginTransaction();

    const {
      id_proveedor,
      id_producto,
      id_materia,
      precio_compra,
      dias_entrega = null,
      preferido = 0
    } = req.body;

    // VALIDAR

    if (
      !id_proveedor ||
      !precio_compra ||
      (!id_producto && !id_materia)
    ) {
      await conn.rollback();
      conn.release();

      return err(
        res,
        'Faltan campos requeridos',
        400
      );
    }

    /* =====================================================
       MATERIA PRIMA
    ===================================================== */

    if (id_materia) {

      await conn.query(
        `
        UPDATE materias_primas
        SET
          id_proveedor = ?,
          costo_prom = ?
        WHERE id_materia = ?
        `,
        [
          +id_proveedor,
          +precio_compra,
          +id_materia
        ]
      );

      await conn.commit();
      conn.release();

      return ok(
        res,
        {
          mensaje: 'Materia prima asignada'
        },
        201
      );
    }

    /* =====================================================
       PRODUCTO
    ===================================================== */

    const [[yaExiste]] = await conn.query(
      `
      SELECT id_prov_prod
      FROM proveedor_producto
      WHERE id_proveedor = ?
      AND id_producto = ?
      `,
      [
        +id_proveedor,
        +id_producto
      ]
    );

    if (yaExiste) {

      await conn.rollback();
      conn.release();

      return err(
        res,
        'Este producto ya está asignado',
        409
      );
    }

    if (+preferido === 1) {

      await conn.query(
        `
        UPDATE proveedor_producto
        SET preferido = 0
        WHERE id_producto = ?
        `,
        [+id_producto]
      );
    }

    const [result] = await conn.query(
      `
      INSERT INTO proveedor_producto
      (
        id_proveedor,
        id_producto,
        precio_compra,
        dias_entrega,
        preferido
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        +id_proveedor,
        +id_producto,
        +precio_compra,
        dias_entrega ? +dias_entrega : null,
        +preferido
      ]
    );

    await conn.query(
      `
      UPDATE productos
      SET costo_prom = ?
      WHERE id_producto = ?
      `,
      [
        +precio_compra,
        +id_producto
      ]
    );

    await conn.commit();
    conn.release();

    ok(
      res,
      {
        mensaje: 'Producto asignado',
        id_prov_prod: result.insertId
      },
      201
    );

  } catch (e) {

    await conn.rollback();
    conn.release();

    console.error('[asignar]', e);

    err(res, 'Error al asignar');
  }
};

/* =========================================================
   EDITAR
========================================================= */

const editar = async (req, res) => {

  const conn = await db.getConnection();

  try {

    await conn.beginTransaction();

    const id = +req.params.id_prov_prod;

    const {
      precio_compra,
      dias_entrega,
      preferido
    } = req.body;

    const [[asig]] = await conn.query(
      `
      SELECT *
      FROM proveedor_producto
      WHERE id_prov_prod = ?
      `,
      [id]
    );

    if (!asig) {

      await conn.rollback();
      conn.release();

      return err(
        res,
        'Asignación no encontrada',
        404
      );
    }

    if (+preferido === 1) {

      await conn.query(
        `
        UPDATE proveedor_producto
        SET preferido = 0
        WHERE id_producto = ?
        AND id_prov_prod != ?
        `,
        [
          asig.id_producto,
          id
        ]
      );
    }

    await conn.query(
      `
      UPDATE proveedor_producto
      SET
        precio_compra = ?,
        dias_entrega = ?,
        preferido = ?
      WHERE id_prov_prod = ?
      `,
      [
        +precio_compra,
        dias_entrega,
        +preferido,
        id
      ]
    );

    await conn.query(
      `
      UPDATE productos
      SET costo_prom = ?
      WHERE id_producto = ?
      `,
      [
        +precio_compra,
        asig.id_producto
      ]
    );

    await conn.commit();
    conn.release();

    ok(res, {
      mensaje: 'Asignación actualizada'
    });

  } catch (e) {

    await conn.rollback();
    conn.release();

    console.error('[editar]', e);

    err(res, 'Error al editar');
  }
};

/* =========================================================
   QUITAR
========================================================= */

const quitar = async (req, res) => {
  try {

    await db.query(
      `
      DELETE FROM proveedor_producto
      WHERE id_prov_prod = ?
      `,
      [+req.params.id_prov_prod]
    );

    ok(res, {
      mensaje: 'Producto quitado'
    });

  } catch (e) {

    console.error('[quitar]', e);

    err(res, 'Error al quitar');
  }
};

/* =========================================================
   DESASOCIAR MATERIA
========================================================= */

const desasociarMateria = async (req, res) => {
  try {

    await db.query(
      `
      UPDATE materias_primas
      SET id_proveedor = NULL
      WHERE id_materia = ?
      `,
      [+req.params.id_materia]
    );

    ok(res, {
      mensaje: 'Materia desasociada'
    });

  } catch (e) {

    console.error('[desasociarMateria]', e);

    err(res, 'Error al desasociar materia');
  }
};

module.exports = {
  listarPorProveedor,
  obtenerDetalle,
  asignar,
  editar,
  quitar,
  desasociarMateria
};