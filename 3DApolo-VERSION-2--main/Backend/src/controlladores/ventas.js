const db = require('../confg/db_conexion');

const ok  = (res, data, status = 200) => res.status(status).json(data);
const err = (res, msg, status = 500) => res.status(status).json({ error: msg });
const san = (v) => (typeof v === 'string' ? v.trim().replace(/[<>\"']/g, '') : v);

/* ── CATÁLOGOS ─────────────────────────────── */
const catalogosVentas = async (req, res) => {
  try {
    const [[productos], [clientes]] = await Promise.all([
      db.query(`SELECT id_producto, nombre, precio_venta, costo_prom, stock,
                       iva, min_mayoreo, desc_mayoreo
                FROM productos WHERE estado = 1 ORDER BY nombre`),
      db.query(`SELECT id_cliente, nombre, documento, desc_esp
                FROM clientes_mayoreo WHERE estado = 1 ORDER BY nombre`),
    ]);
    ok(res, { productos, clientes });
  } catch (e) { console.error('[catalogosVentas]', e); err(res, 'Error catálogos'); }
};

/* ── LISTAR VENTAS ─────────────────────────── */
const listarVentas = async (req, res) => {
  try {
    const { buscar='', estado='', desde='', hasta='', pagina=1, limite=20 } = req.query;
    const offset = (Math.max(1,+pagina)-1) * Math.min(+limite,100);
    const p = [];
    let where = 'WHERE 1=1';
    if (buscar) { where += ' AND (v.id_venta LIKE ? OR u.nombre LIKE ? OR cm.nombre LIKE ?)'; const b=`%${san(buscar)}%`; p.push(b,b,b); }
    if (estado) { where += ' AND v.estado = ?'; p.push(san(estado)); }
    if (desde)  { where += ' AND DATE(v.fecha) >= ?'; p.push(desde); }
    if (hasta)  { where += ' AND DATE(v.fecha) <= ?'; p.push(hasta); }

    const base = `FROM ventas v
      JOIN usuarios u ON v.id_usuario = u.id_usuario
      LEFT JOIN clientes_mayoreo cm ON v.id_cliente = cm.id_cliente
      ${where}`;

    const [[{total}]] = await db.query(`SELECT COUNT(*) AS total ${base}`, p);
    const [[{suma}]]  = await db.query(`SELECT COALESCE(SUM(v.total),0) AS suma ${base}`, p);
    const [rows] = await db.query(
      `SELECT v.id_venta, v.fecha, v.subtotal, v.descuento, v.impuesto, v.total,
              v.metodo_pago, v.tipo_entrega, v.tipo_venta, v.estado, v.notas,
              u.nombre AS vendedor, cm.nombre AS cliente
       ${base} ORDER BY v.fecha DESC, v.id_venta DESC LIMIT ? OFFSET ?`,
      [...p, Math.min(+limite,100), offset]
    );
    ok(res, { datos: rows, total_monto: suma,
      paginacion: { total, pagina:+pagina, limite:+limite, paginas: Math.ceil(total/+limite) } });
  } catch (e) { console.error('[listarVentas]', e); err(res, 'Error al listar ventas'); }
};

/* ── DETALLE VENTA ─────────────────────────── */
const detalleVenta = async (req, res) => {
  try {
    const [[venta]] = await db.query(
      `SELECT v.*, u.nombre AS vendedor, cm.nombre AS cliente
       FROM ventas v JOIN usuarios u ON v.id_usuario=u.id_usuario
       LEFT JOIN clientes_mayoreo cm ON v.id_cliente=cm.id_cliente
       WHERE v.id_venta=?`, [+req.params.id]);
    if (!venta) return err(res,'Venta no encontrada',404);
    const [items] = await db.query(
      `SELECT dv.*, p.nombre AS producto FROM detalle_venta dv
       JOIN productos p ON dv.id_producto=p.id_producto WHERE dv.id_venta=?`, [+req.params.id]);
    ok(res, { ...venta, items });
  } catch (e) { console.error('[detalleVenta]', e); err(res, 'Error detalle'); }
};

/* ── REGISTRAR VENTA ───────────────────────── */
const registrarVenta = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items=[], metodo_pago, tipo_entrega='tienda', tipo_venta='menudeo', id_cliente=null, notas='' } = req.body;
    if (!items.length || !metodo_pago) {
      await conn.rollback(); conn.release();
      return err(res,'Faltan campos requeridos',400);
    }

    let subtotal=0, descuento=0, impuesto=0;
    const filas=[];
    for (const it of items) {
      const [[prod]] = await conn.query(
        `SELECT id_producto,nombre,precio_venta,costo_prom,stock,iva FROM productos WHERE id_producto=? AND estado=1`,
        [+it.id_producto]);
      if (!prod) throw new Error(`Producto ${it.id_producto} no encontrado`);
      if (prod.stock < +it.cantidad) throw new Error(`Stock insuficiente: ${prod.nombre}`);

      const precio   = +it.precio_venta || +prod.precio_venta;
      const desc_pct = +it.desc_pct || 0;
      const lineSub  = precio * +it.cantidad;
      const lineDesc = lineSub * desc_pct / 100;
      const lineNet  = lineSub - lineDesc;
      const lineIva  = lineNet * (+prod.iva / 100);

      subtotal  += lineSub;
      descuento += lineDesc;
      impuesto  += lineIva;
      filas.push({ id_producto:+it.id_producto, cantidad:+it.cantidad, precio_venta:precio,
        costo_prom:+prod.costo_prom, mayoreo: tipo_venta==='mayoreo'?1:0, desc_pct, subtotal_item: lineNet+lineIva });
    }

    const total = subtotal - descuento + impuesto;
    const [rv] = await conn.query(
      `INSERT INTO ventas (id_usuario,id_cliente,subtotal,descuento,impuesto,total,metodo_pago,tipo_entrega,tipo_venta,notas)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [req.usuario.id, id_cliente||null, subtotal, descuento, impuesto, total,
       san(metodo_pago), san(tipo_entrega), san(tipo_venta), san(notas)]);
    const id_venta = rv.insertId;

    for (const f of filas) {
      await conn.query(
        `INSERT INTO detalle_venta (id_venta,id_producto,cantidad,precio_venta,costo_prom,mayoreo,desc_pct,subtotal) VALUES (?,?,?,?,?,?,?,?)`,
        [id_venta,f.id_producto,f.cantidad,f.precio_venta,f.costo_prom,f.mayoreo,f.desc_pct,f.subtotal_item]);
      await conn.query(`UPDATE productos SET stock=stock-? WHERE id_producto=?`,[f.cantidad,f.id_producto]);
      await conn.query(
        `INSERT INTO movimientos (id_producto,id_usuario,tipo,id_ref,cantidad,costo_unit) VALUES (?,?,'venta',?,?,?)`,
        [f.id_producto,req.usuario.id,id_venta,-f.cantidad,f.costo_prom]);
    }

    await conn.commit(); conn.release();
    ok(res,{ mensaje:'Venta registrada', id_venta, total },201);
  } catch(e) {
    await conn.rollback(); conn.release();
    console.error('[registrarVenta]',e);
    err(res, e.message || 'Error al registrar venta');
  }
};

/* ── ANULAR VENTA ──────────────────────────── */
const anularVenta = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const id = +req.params.id;
    const [[v]] = await conn.query(`SELECT estado FROM ventas WHERE id_venta=?`,[id]);
    if (!v) { await conn.rollback(); conn.release(); return err(res,'Venta no encontrada',404); }
    if (v.estado !== 'completada') { await conn.rollback(); conn.release(); return err(res,'Solo se pueden anular ventas completadas',400); }

    await conn.query(`UPDATE ventas SET estado='anulada' WHERE id_venta=?`,[id]);
    // Devolver stock
    const [items] = await conn.query(`SELECT id_producto,cantidad FROM detalle_venta WHERE id_venta=?`,[id]);
    for (const it of items) {
      await conn.query(`UPDATE productos SET stock=stock+? WHERE id_producto=?`,[it.cantidad,it.id_producto]);
    }
    await conn.commit(); conn.release();
    ok(res,{ mensaje:'Venta anulada' });
  } catch(e) {
    await conn.rollback(); conn.release();
    console.error('[anularVenta]',e);
    err(res,'Error al anular venta');
  }
};

/* ── CLIENTES MAYOREO CRUD ─────────────────── */
const listarClientes = async (req, res) => {
  try {
    const { buscar='', pagina=1, limite=20 } = req.query;
    const offset = (Math.max(1,+pagina)-1)*Math.min(+limite,100);
    const p=[];
    let where='WHERE 1=1';
    if (buscar){ where+=' AND (nombre LIKE ? OR documento LIKE ? OR ciudad LIKE ?)'; const b=`%${san(buscar)}%`; p.push(b,b,b); }
    const [[{total}]] = await db.query(`SELECT COUNT(*) AS total FROM clientes_mayoreo ${where}`,p);
    const [rows] = await db.query(
      `SELECT * FROM clientes_mayoreo ${where} ORDER BY nombre ASC LIMIT ? OFFSET ?`,
      [...p,Math.min(+limite,100),offset]);
    ok(res,{ datos:rows, paginacion:{total,pagina:+pagina,limite:+limite,paginas:Math.ceil(total/+limite)} });
  } catch(e){ console.error('[listarClientes]',e); err(res,'Error clientes'); }
};

const crearCliente = async (req, res) => {
  try {
    const { nombre,documento,telefono,correo,direccion,ciudad,desc_esp } = req.body;
    if (!nombre) return err(res,'Nombre requerido',400);
    const [r] = await db.query(
      `INSERT INTO clientes_mayoreo (nombre,documento,telefono,correo,direccion,ciudad,desc_esp) VALUES (?,?,?,?,?,?,?)`,
      [san(nombre),san(documento)||null,san(telefono)||null,san(correo)||null,san(direccion)||null,san(ciudad)||null,desc_esp||null]);
    ok(res,{mensaje:'Cliente creado',id_cliente:r.insertId},201);
  } catch(e){
    if(e.code==='ER_DUP_ENTRY') return err(res,'El documento ya existe',409);
    console.error('[crearCliente]',e); err(res,'Error al crear cliente');
  }
};

const actualizarCliente = async (req, res) => {
  try {
    const { nombre,documento,telefono,correo,direccion,ciudad,desc_esp,estado } = req.body;
    await db.query(
      `UPDATE clientes_mayoreo SET nombre=COALESCE(?,nombre),documento=COALESCE(?,documento),
       telefono=COALESCE(?,telefono),correo=COALESCE(?,correo),direccion=COALESCE(?,direccion),
       ciudad=COALESCE(?,ciudad),desc_esp=COALESCE(?,desc_esp),estado=COALESCE(?,estado)
       WHERE id_cliente=?`,
      [san(nombre)||null,san(documento)||null,san(telefono)||null,san(correo)||null,
       san(direccion)||null,san(ciudad)||null,desc_esp!=null?+desc_esp:null,
       estado!=null?+estado:null,+req.params.id]);
    ok(res,{mensaje:'Cliente actualizado'});
  } catch(e){ console.error('[actualizarCliente]',e); err(res,'Error al actualizar'); }
};

module.exports = {
  catalogosVentas, listarVentas, detalleVenta,
  registrarVenta, anularVenta,
  listarClientes, crearCliente, actualizarCliente
};
