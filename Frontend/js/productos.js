// ── Config ───────────────────────────────────────────────────────────────────
const API = '/api/productos';

// ── Estado global ────────────────────────────────────────────────────────────
let estado = {
  pagina: 1,
  limite: 20,
  buscar: '',
  categoria: '',
  tipo: '',
  editandoId: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const fmt = (n) =>
  Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const badge = (stock, min) => {
  if (stock === 0)       return `<span class="badge badge-rojo">Sin stock</span>`;
  if (stock <= min)      return `<span class="badge badge-amarillo">Stock bajo</span>`;
  return                        `<span class="badge badge-verde">OK</span>`;
};

const tipoBadge = (tipo) =>
  tipo === 'fabricado'
    ? `<span class="badge badge-azul">Fabricado</span>`
    : `<span class="badge badge-naranja">Comprado</span>`;

// ── Fetch con token ──────────────────────────────────────────────────────────
const apiFetch = async (url, opts = {}) => {
  const token = document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1] || '';
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) { window.location.href = '/'; return null; }
  return res.json();
};

// ── Cargar catálogos (categorías, unidades, proveedores) ─────────────────────
const cargarCatalogos = async () => {
  const data = await apiFetch(`${API}/catalogos`);
  if (!data) return;

  // Llenar selects de filtro y formulario
  const selCatFiltro = $('#filtro-categoria');
  const selCatForm   = $('#form-categoria');
  const selUnidad    = $('#form-unidad');
  const selProveedor = $('#form-proveedor');

  data.categorias.forEach(({ id_categoria, nombre }) => {
    const opt = `<option value="${id_categoria}">${nombre}</option>`;
    selCatFiltro.insertAdjacentHTML('beforeend', opt);
    selCatForm.insertAdjacentHTML('beforeend', opt);
  });

  data.unidades.forEach(({ id_unidad, nombre, abrev }) => {
    selUnidad.insertAdjacentHTML(
      'beforeend',
      `<option value="${id_unidad}">${nombre} (${abrev})</option>`
    );
  });

  data.proveedores.forEach(({ id_proveedor, nombre }) => {
    selProveedor.insertAdjacentHTML(
      'beforeend',
      `<option value="${id_proveedor}">${nombre}</option>`
    );
  });
};

// ── Cargar tabla ─────────────────────────────────────────────────────────────
const cargarProductos = async () => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="8" class="cargando">Cargando...</td></tr>`;

  const params = new URLSearchParams({
    pagina: estado.pagina,
    limite: estado.limite,
    buscar: estado.buscar,
    categoria: estado.categoria,
    tipo: estado.tipo,
  });

  const data = await apiFetch(`${API}?${params}`);
  if (!data) return;

  tbody.innerHTML = '';

  if (!data.datos.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="cargando">Sin productos</td></tr>`;
    renderPaginacion(data.paginacion);
    return;
  }

  data.datos.forEach((p) => {
    // Calcula precio de compra desde costo_prom para mostrar
    const margen = p.precio_venta && p.costo_prom
      ? (((p.precio_venta - p.costo_prom) / p.precio_venta) * 100).toFixed(1)
      : '—';

    tbody.insertAdjacentHTML(
      'beforeend',
      `<tr data-id="${p.id_producto}">
        <td><strong>${p.nombre}</strong><br><small class="muted">${p.categoria || '—'}</small></td>
        <td>${tipoBadge(p.tipo)}</td>
        <td>${fmt(p.precio_venta)}</td>
        <td>${fmt(p.costo_prom)}</td>
        <td><span class="margen">${margen}%</span></td>
        <td>${p.stock} ${p.abrev || ''}</td>
        <td>${badge(p.stock, p.stock_min)}</td>
        <td class="acciones">
          <button class="btn-icono btn-ver"    title="Ver"     onclick="verProducto(${p.id_producto})">👁</button>
          <button class="btn-icono btn-editar" title="Editar"  onclick="abrirEditar(${p.id_producto})">✏️</button>
          <button class="btn-icono btn-stock"  title="Ajustar stock" onclick="abrirStock(${p.id_producto}, ${p.stock}, '${p.nombre}')">📦</button>
          <button class="btn-icono btn-elim"   title="Eliminar" onclick="eliminarProducto(${p.id_producto}, '${p.nombre}')">🗑</button>
        </td>
      </tr>`
    );
  });

  renderPaginacion(data.paginacion);
};

// ── Paginación ────────────────────────────────────────────────────────────────
const renderPaginacion = ({ pagina, paginas, total }) => {
  const el = $('#paginacion');
  el.innerHTML = '';

  $('#total-count').textContent = `${total} producto${total !== 1 ? 's' : ''}`;

  if (paginas <= 1) return;

  const btn = (label, pg, disabled = false) =>
    `<button class="btn-pag${pg === pagina ? ' activo' : ''}" ${disabled ? 'disabled' : ''}
      onclick="cambiarPagina(${pg})">${label}</button>`;

  el.insertAdjacentHTML('beforeend', btn('‹', pagina - 1, pagina === 1));
  for (let i = 1; i <= paginas; i++) {
    if (paginas > 7 && (i > 2 && i < paginas - 1 && Math.abs(i - pagina) > 1)) {
      if (i === 3 || i === paginas - 2) el.insertAdjacentHTML('beforeend', '<span>…</span>');
      continue;
    }
    el.insertAdjacentHTML('beforeend', btn(i, i));
  }
  el.insertAdjacentHTML('beforeend', btn('›', pagina + 1, pagina === paginas));
};

window.cambiarPagina = (p) => { estado.pagina = p; cargarProductos(); };

// ── Modal Crear / Editar ──────────────────────────────────────────────────────
const abrirModal = (titulo = 'Nuevo producto') => {
  $('#modal-titulo').textContent = titulo;
  $('#modal-producto').classList.add('visible');
};

const cerrarModal = () => {
  $('#modal-producto').classList.remove('visible');
  $('#form-producto').reset();
  estado.editandoId = null;
  toggleProveedor('');
};

window.cerrarModal = cerrarModal;

// Mostrar/ocultar campo proveedor según tipo
const toggleProveedor = (tipo) => {
  const secProv = $('#seccion-proveedor');
  secProv.style.display = tipo === 'comprado' ? 'block' : 'none';
};

$('#form-tipo').addEventListener('change', (e) => toggleProveedor(e.target.value));

// Calcular precio_venta automático a partir de precio_compra + % margen
const calcularPrecioVenta = () => {
  const compra  = +$('#form-precio-compra').value || 0;
  const margen  = +$('#form-margen').value || 0;
  if (compra > 0 && margen >= 0) {
    $('#form-precio-venta').value = (compra / (1 - margen / 100)).toFixed(0);
  }
};

$('#form-precio-compra').addEventListener('input', calcularPrecioVenta);
$('#form-margen').addEventListener('input', calcularPrecioVenta);

// Guardar (crear o editar)
$('#form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const tipo = $('#form-tipo').value;

  const body = {
    nombre:       $('#form-nombre').value,
    descripcion:  $('#form-descripcion').value,
    tipo,
    id_categoria: $('#form-categoria').value,
    id_unidad:    $('#form-unidad').value,
    precio_venta: $('#form-precio-venta').value,
    iva:          $('#form-iva').value || 0,
    stock_min:    $('#form-stock-min').value || 0,
    min_mayoreo:  $('#form-min-mayoreo').value || null,
    desc_mayoreo: $('#form-desc-mayoreo').value || 10,
  };

  if (tipo === 'comprado') {
    body.id_proveedor  = $('#form-proveedor').value;
    body.precio_compra = $('#form-precio-compra').value;
  }

  // Stock inicial solo en creación
  if (!estado.editandoId) {
    body.stock = $('#form-stock').value || 0;
  }

  const url    = estado.editandoId ? `${API}/${estado.editandoId}` : API;
  const method = estado.editandoId ? 'PUT' : 'POST';

  const data = await apiFetch(url, { method, body: JSON.stringify(body) });

  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) {
    mostrarToast(data.error, 'error');
    return;
  }

  mostrarToast(data?.mensaje || 'Guardado', 'ok');
  cerrarModal();
  cargarProductos();
});

// Abrir modal en modo edición
window.abrirEditar = async (id) => {
  estado.editandoId = id;
  const data = await apiFetch(`${API}/${id}`);
  if (!data || data.error) return mostrarToast('Error al cargar producto', 'error');

  abrirModal('Editar producto');

  $('#form-nombre').value      = data.nombre;
  $('#form-descripcion').value = data.descripcion || '';
  $('#form-tipo').value        = data.tipo;
  $('#form-categoria').value   = data.id_categoria;
  $('#form-unidad').value      = data.id_unidad;
  $('#form-precio-venta').value= data.precio_venta;
  $('#form-iva').value         = data.iva;
  $('#form-stock-min').value   = data.stock_min;
  $('#form-min-mayoreo').value = data.min_mayoreo || '';
  $('#form-desc-mayoreo').value= data.desc_mayoreo;

  toggleProveedor(data.tipo);

  if (data.tipo === 'comprado' && data.proveedores?.length) {
    const pref = data.proveedores.find(p => p.preferido) || data.proveedores[0];
    $('#form-proveedor').value    = pref.id_proveedor;
    $('#form-precio-compra').value= pref.precio_compra;
  }

  // Ocultar campo stock en edición
  $('#row-stock').style.display = 'none';
};

// ── Modal Ver detalle ─────────────────────────────────────────────────────────
window.verProducto = async (id) => {
  const data = await apiFetch(`${API}/${id}`);
  if (!data) return;

  const det = $('#detalle-contenido');
  const prov = data.proveedores?.map(p =>
    `<li>${p.proveedor} — ${fmt(p.precio_compra)}${p.preferido ? ' ⭐' : ''}</li>`
  ).join('') || '<li>Sin proveedores</li>';

  const mats = data.materiales?.map(m =>
    `<li>${m.nombre}: ${m.cantidad} ${m.abrev} × ${fmt(m.costo_prom)} = ${fmt(m.subtotal)}</li>`
  ).join('') || '<li>Sin materiales</li>';

  det.innerHTML = `
    <div class="detalle-grid">
      <div class="detalle-item"><label>Nombre</label><span>${data.nombre}</span></div>
      <div class="detalle-item"><label>Tipo</label><span>${tipoBadge(data.tipo)}</span></div>
      <div class="detalle-item"><label>Categoría</label><span>${data.categoria || '—'}</span></div>
      <div class="detalle-item"><label>Unidad</label><span>${data.unidad} (${data.abrev})</span></div>
      <div class="detalle-item"><label>Precio venta</label><span>${fmt(data.precio_venta)}</span></div>
      <div class="detalle-item"><label>Costo promedio</label><span>${fmt(data.costo_prom)}</span></div>
      <div class="detalle-item"><label>IVA</label><span>${data.iva}%</span></div>
      <div class="detalle-item"><label>Stock actual</label><span>${data.stock} ${data.abrev}</span></div>
      <div class="detalle-item"><label>Stock mínimo</label><span>${data.stock_min}</span></div>
      <div class="detalle-item"><label>Mayoreo desde</label><span>${data.min_mayoreo || '—'} und</span></div>
      <div class="detalle-item"><label>Desc. mayoreo</label><span>${data.desc_mayoreo}%</span></div>
    </div>
    <div class="detalle-seccion">
      <strong>${data.tipo === 'fabricado' ? 'Materiales' : 'Proveedores'}</strong>
      <ul>${data.tipo === 'fabricado' ? mats : prov}</ul>
    </div>
    ${data.descripcion ? `<div class="detalle-seccion"><strong>Descripción</strong><p>${data.descripcion}</p></div>` : ''}
  `;

  $('#modal-detalle').classList.add('visible');
};

window.cerrarDetalle = () => $('#modal-detalle').classList.remove('visible');

// ── Modal Ajuste de Stock ─────────────────────────────────────────────────────
window.abrirStock = (id, stockActual, nombre) => {
  $('#stock-nombre').textContent  = nombre;
  $('#stock-actual').textContent  = stockActual;
  $('#stock-prod-id').value       = id;
  $('#form-stock-ajuste').reset();
  $('#modal-stock').classList.add('visible');
};

window.cerrarStock = () => $('#modal-stock').classList.remove('visible');

$('#form-stock-ajuste').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id    = $('#stock-prod-id').value;
  const body  = {
    cantidad:     +$('#stock-cantidad').value,
    tipo_ajuste:  $('#stock-tipo').value,
  };

  const data = await apiFetch(`${API}/${id}/stock`, { method: 'PATCH', body: JSON.stringify(body) });
  if (data?.error) return mostrarToast(data.error, 'error');

  mostrarToast(`Stock actualizado → ${data.stock_actual}`, 'ok');
  cerrarStock();
  cargarProductos();
});

// ── Eliminar ─────────────────────────────────────────────────────────────────
window.eliminarProducto = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
  const data = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (data?.error) return mostrarToast(data.error, 'error');
  mostrarToast('Producto eliminado', 'ok');
  cargarProductos();
};

// ── Toast ─────────────────────────────────────────────────────────────────────
const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

// ── Filtros ───────────────────────────────────────────────────────────────────
let timer;
$('#buscar-input').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    estado.buscar = e.target.value;
    estado.pagina = 1;
    cargarProductos();
  }, 350);
});

$('#filtro-categoria').addEventListener('change', (e) => {
  estado.categoria = e.target.value;
  estado.pagina = 1;
  cargarProductos();
});

$('#filtro-tipo').addEventListener('change', (e) => {
  estado.tipo = e.target.value;
  estado.pagina = 1;
  cargarProductos();
});

// Botón nuevo producto
$('#btn-nuevo').addEventListener('click', () => {
  estado.editandoId = null;
  $('#row-stock').style.display = 'block';
  abrirModal('Nuevo producto');
});

// Cerrar modales con Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { cerrarModal(); cerrarDetalle(); cerrarStock(); }
});

// ── Init ──────────────────────────────────────────────────────────────────────
(async () => {
  await cargarCatalogos();
  await cargarProductos();
})();