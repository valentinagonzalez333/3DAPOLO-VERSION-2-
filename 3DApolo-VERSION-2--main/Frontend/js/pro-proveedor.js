const body = document.body;
const mode = document.getElementById("btn_modo");

if (localStorage.getItem("mode") === "dark") {
  body.classList.add("dark-mode");
  if (mode) mode.checked = true;
}
mode?.addEventListener("change", () => {
  const isDark = body.classList.toggle("dark-mode");
  localStorage.setItem("mode", isDark ? "dark" : "light");
});

const API_PROV = '/api/proveedores';
const API_PROD = '/api/productos';
const API_PP   = '/api/proveedor-producto';

let proveedorActivo = null;
let editandoId      = null;
let editandoMateria = null;

const $ = (sel, ctx = document) => ctx.querySelector(sel);

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const apiFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res.json();
};

// ── Cargar select de proveedores ───────────────────────────────────────────
const cargarSelectProveedores = async () => {
  const data = await apiFetch(`${API_PROV}?limite=200`);
  if (!data) return;

  const sel = $('#select-proveedor');
  data.datos.forEach(({ id_proveedor, nombre }) => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${id_proveedor}">${nombre}</option>`
    );
  });

  const params = new URLSearchParams(location.search);
  const idUrl  = params.get('id');
  if (idUrl) {
    sel.value = idUrl;
    sel.dispatchEvent(new Event('change'));
  }
};

// ── Cargar productos del proveedor ─────────────────────────────────────────
const cargarProductosProveedor = async (idProveedor) => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="8" class="cargando">Cargando...</td></tr>`;
  $('#seccion-tabla').style.display = 'block';
  $('#estado-vacio').style.display  = 'none';

  const data = await apiFetch(`${API_PP}/${idProveedor}`);
  if (!data) return;

  tbody.innerHTML = '';

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="cargando">Este proveedor no tiene productos asignados</td></tr>`;
    return;
  }

  data.forEach((p) => {
    const esMateria = p.tipo === 'materia';

    const tipoBadge = esMateria
      ? `<span class="badge badge-naranja">Materia prima</span>`
      : `<span class="badge badge-azul">Producto</span>`;

    const margen = !esMateria && p.precio_venta && p.precio_compra
      ? (((p.precio_venta - p.precio_compra) / p.precio_venta) * 100).toFixed(1)
      : null;

    const precioVentaCol = esMateria
      ? `<span class="muted">N/A</span>`
      : (p.precio_venta > 0 ? fmt(p.precio_venta) : '<span class="muted">—</span>');

    const margenCol = esMateria
      ? `<span class="muted">N/A</span>`
      : (margen !== null ? `${margen}%` : '—%');

    const preferidoCol = esMateria
      ? `<span class="muted">—</span>`
      : (p.preferido
          ? `<span class="badge badge-verde">⭐ Sí</span>`
          : `<span class="badge badge-amarillo">No</span>`);

    // Materias: solo editar costo. Productos: editar y quitar.
    const acciones = esMateria
      ? `<button class="btn-icono btn-editar" title="Editar costo"
           onclick="abrirEditarMateria(${p.id_producto}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio_compra})">✏️</button>`
      : `<button class="btn-icono btn-editar" title="Editar"
           onclick="abrirEditarAsignacion(${p.id_prov_prod}, ${p.id_producto})">✏️</button>
         <button class="btn-icono btn-elim" title="Quitar"
           onclick="quitarProducto(${p.id_prov_prod}, '${p.nombre.replace(/'/g, "\\'")}')">🗑</button>`;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <strong>${p.nombre}</strong><br>
          <small class="muted">${p.categoria || '—'}</small>
        </td>
        <td>${tipoBadge}</td>
        <td>${fmt(p.precio_compra)}</td>
        <td>${margenCol}</td>
        <td>${precioVentaCol}</td>
        <td>${p.dias_entrega != null ? p.dias_entrega + ' días' : '— días'}</td>
        <td>${preferidoCol}</td>
        <td class="acciones">${acciones}</td>
      </tr>
    `);
  });
};

// ── Cambio de proveedor ────────────────────────────────────────────────────
$('#select-proveedor').addEventListener('change', async (e) => {
  const id = e.target.value;

  if (!id) {
    proveedorActivo = null;
    $('#estado-vacio').style.display  = 'block';
    $('#seccion-tabla').style.display = 'none';
    $('#nombre-proveedor-activo').textContent = '— Selecciona un proveedor';
    $('#btn-asignar').disabled  = true;
    $('#buscar-input').disabled = true;
    return;
  }

  proveedorActivo = +id;
  const opt = e.target.options[e.target.selectedIndex];
  $('#nombre-proveedor-activo').textContent = opt.text;
  $('#btn-asignar').disabled  = false;
  $('#buscar-input').disabled = false;

  await cargarProductosProveedor(id);
  await cargarSelectProductos();
});

// ── Cargar productos disponibles para asignar (solo tipo comprado) ─────────
const cargarSelectProductos = async () => {
  const data = await apiFetch(`${API_PROD}?limite=500&tipo=comprado`);
  if (!data) return;

  const sel = $('#form-producto');
  sel.innerHTML = '<option value="">— Seleccionar —</option>';

  const productos = data.datos || [];
  productos.forEach(({ id_producto, nombre }) => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${id_producto}">${nombre}</option>`
    );
  });
};

// ── Modal asignar nuevo producto ───────────────────────────────────────────
const abrirModalAsignar = () => {
  editandoId      = null;
  editandoMateria = null;

  $('#modal-asignar-titulo').textContent  = 'Asignar producto';
  $('#form-asignar').reset();
  $('#row-producto-select').style.display = 'block';
  $('#form-precio-venta-calc').value      = '';

  // Restaurar campos que pudieron ocultarse
  const pvGroup   = $('#form-precio-venta-calc').closest('.form-group');
  const prefGroup = document.getElementById('form-preferido')?.closest('.form-group');
  if (pvGroup)   pvGroup.style.display   = 'block';
  if (prefGroup) prefGroup.style.display = 'block';

  $('#modal-asignar').classList.add('visible');
};

const cerrarModalAsignar = () => {
  $('#modal-asignar').classList.remove('visible');
  $('#form-asignar').reset();
  editandoId      = null;
  editandoMateria = null;

  // Restaurar campos ocultos
  $('#row-producto-select').style.display = 'block';
  const pvGroup   = $('#form-precio-venta-calc').closest('.form-group');
  const prefGroup = document.getElementById('form-preferido')?.closest('.form-group');
  if (pvGroup)   pvGroup.style.display   = 'block';
  if (prefGroup) prefGroup.style.display = 'block';
};
window.cerrarModalAsignar = cerrarModalAsignar;

// ── Editar asignación de producto comprado ─────────────────────────────────
window.abrirEditarAsignacion = async (idPP, idProducto) => {
  if (!idPP || isNaN(idPP)) {
    mostrarToast('ID de asignación inválido', 'error');
    return;
  }

  editandoId      = idPP;
  editandoMateria = null;

  const data = await apiFetch(`${API_PP}/detalle/${idPP}`);
  if (!data || data.error) return mostrarToast('Error al cargar', 'error');

  $('#modal-asignar-titulo').textContent  = 'Editar asignación';
  $('#row-producto-select').style.display = 'none';
  $('#form-precio-compra').value          = data.precio_compra;
  $('#form-dias').value                   = data.dias_entrega || '';
  $('#form-preferido').checked            = !!data.preferido;

  // Restaurar campos
  const pvGroup   = $('#form-precio-venta-calc').closest('.form-group');
  const prefGroup = document.getElementById('form-preferido')?.closest('.form-group');
  if (pvGroup)   pvGroup.style.display   = 'block';
  if (prefGroup) prefGroup.style.display = 'block';

  if (data.precio_venta && data.precio_compra) {
    const margen = (((data.precio_venta - data.precio_compra) / data.precio_venta) * 100).toFixed(1);
    $('#form-margen').value = margen;
  }

  calcularPrecioVenta();
  $('#modal-asignar').classList.add('visible');
};

// ── Editar costo de materia prima ──────────────────────────────────────────
window.abrirEditarMateria = (idMateria, nombre, costoActual) => {
  editandoId      = null;
  editandoMateria = { id: idMateria, nombre };

  $('#modal-asignar-titulo').textContent  = `Editar costo: ${nombre}`;
  $('#row-producto-select').style.display = 'none';
  $('#form-precio-compra').value          = costoActual;
  $('#form-margen').value                 = '';
  $('#form-precio-venta-calc').value      = '';
  $('#form-dias').value                   = '';
  $('#form-preferido').checked            = false;

  // Ocultar campos irrelevantes para materia prima
  const pvGroup   = $('#form-precio-venta-calc').closest('.form-group');
  const prefGroup = document.getElementById('form-preferido')?.closest('.form-group');
  if (pvGroup)   pvGroup.style.display   = 'none';
  if (prefGroup) prefGroup.style.display = 'none';

  $('#modal-asignar').classList.add('visible');
};

// ── Calcular precio venta automático ──────────────────────────────────────
const calcularPrecioVenta = () => {
  const compra = +$('#form-precio-compra').value || 0;
  const margen = +$('#form-margen').value || 0;
  if (compra > 0 && margen > 0 && margen < 100) {
    $('#form-precio-venta-calc').value = (compra / (1 - margen / 100)).toFixed(0);
  } else if (compra > 0) {
    $('#form-precio-venta-calc').value = compra;
  }
};

$('#form-precio-compra').addEventListener('input', calcularPrecioVenta);
$('#form-margen').addEventListener('input', calcularPrecioVenta);

// ── Submit ─────────────────────────────────────────────────────────────────
$('#form-asignar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-guardar-asignar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const precioCompra = +$('#form-precio-compra').value;

  // ── Caso: edición de costo de materia prima ──
  if (editandoMateria) {
    const data = await apiFetch(`/api/produccion/materias/${editandoMateria.id}`, {
      method: 'PUT',
      body: JSON.stringify({ costo_prom: precioCompra }),
    });
    btn.disabled = false;
    btn.textContent = 'Guardar';
    if (data?.error) { mostrarToast(data.error, 'error'); return; }
    mostrarToast('Costo actualizado', 'ok');
    cerrarModalAsignar();
    cargarProductosProveedor(proveedorActivo);
    return;
  }

  // ── Caso: asignar o editar producto comprado ──
  const precioVenta = +$('#form-precio-venta-calc').value || precioCompra;
  const idProducto  = +$('#form-producto').value;
  const diasEntrega = $('#form-dias').value ? +$('#form-dias').value : null;
  const preferido   = $('#form-preferido').checked ? 1 : 0;

  let url, method, bodyData;

  if (editandoId) {
    url      = `${API_PP}/${editandoId}`;
    method   = 'PUT';
    bodyData = { precio_compra: precioCompra, dias_entrega: diasEntrega, preferido };
  } else {
    if (!idProducto) {
      mostrarToast('Selecciona un producto', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar';
      return;
    }
    url      = API_PP;
    method   = 'POST';
    bodyData = {
      id_proveedor:  proveedorActivo,
      id_producto:   idProducto,
      precio_compra: precioCompra,
      dias_entrega:  diasEntrega,
      preferido,
    };
  }

  const data = await apiFetch(url, { method, body: JSON.stringify(bodyData) });
  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) { mostrarToast(data.error, 'error'); return; }

  // Actualizar precio_venta y costo_prom en el producto
  const idProdFinal = editandoId
    ? (await apiFetch(`${API_PP}/detalle/${editandoId}`))?.id_producto
    : idProducto;

  if (precioVenta > 0 && idProdFinal) {
    await apiFetch(`${API_PROD}/${idProdFinal}`, {
      method: 'PUT',
      body: JSON.stringify({ precio_venta: precioVenta, costo_prom: precioCompra }),
    });
  }

  mostrarToast(data?.mensaje || 'Guardado', 'ok');
  cerrarModalAsignar();
  cargarProductosProveedor(proveedorActivo);
});

// ── Quitar producto ────────────────────────────────────────────────────────
window.quitarProducto = async (idPP, nombre) => {
  if (!idPP || isNaN(+idPP)) {
    mostrarToast('No se puede quitar este item', 'error');
    return;
  }
  if (!confirm(`¿Quitar "${nombre}" de este proveedor?`)) return;

  const data = await apiFetch(`${API_PP}/${idPP}`, { method: 'DELETE' });
  if (data?.error) return mostrarToast(data.error, 'error');
  mostrarToast('Producto quitado', 'ok');
  cargarProductosProveedor(proveedorActivo);
};

// ── Toast ──────────────────────────────────────────────────────────────────
const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

$('#btn-asignar').addEventListener('click', abrirModalAsignar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModalAsignar();
});

// ── Init ───────────────────────────────────────────────────────────────────
cargarSelectProveedores();