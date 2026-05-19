

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

const API = '/api/productos';

let estado = {
  pagina: 1, limite: 20, buscar: '', categoria: '', tipo: '', editandoId: null,
};

const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const fmt = (n) =>
  Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const badge = (stock, min) => {
  if (stock === 0) return `<span class="badge badge-rojo">Sin stock</span>`;
  if (stock <= min) return `<span class="badge badge-amarillo">Stock bajo</span>`;
  return `<span class="badge badge-verde">OK</span>`;
};

const tipoBadge = (tipo) =>
  tipo === 'fabricado'
    ? `<span class="badge badge-azul">Fabricado</span>`
    : `<span class="badge badge-naranja">Comprado</span>`;

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

/* ── CATÁLOGOS ── */
const cargarCatalogos = async () => {
  const data = await apiFetch(`${API}/catalogos`);
  if (!data) return;
  const selCatFiltro = $('#filtro-categoria');
  const selCatForm   = $('#form-categoria');
  const selUnidad    = $('#form-unidad');
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
};

/* ── TABLA ── */
const cargarProductos = async () => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="7" class="cargando">Cargando...</td></tr>`;
  const params = new URLSearchParams({
    pagina: estado.pagina, limite: estado.limite,
    buscar: estado.buscar, categoria: estado.categoria, tipo: estado.tipo,
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
    const margen = p.precio_venta && p.costo_prom
      ? (((p.precio_venta - p.costo_prom) / p.precio_venta) * 100).toFixed(1) : '—';
    tbody.insertAdjacentHTML('beforeend', `
      <tr data-id="${p.id_producto}">
        <td><strong>${p.nombre}</strong><br><small class="muted">${p.categoria || '—'}</small></td>
        <td>${tipoBadge(p.tipo)}</td>
        <td>${p.precio_venta > 0 ? fmt(p.precio_venta) : '<span class="muted">—</span>'}</td>
        <td>${p.costo_prom  > 0 ? fmt(p.costo_prom)   : '<span class="muted">—</span>'}</td>
        <td><span class="margen">${margen}%</span></td>
        <td>${p.stock} ${p.abrev || ''}</td>
        <td>${badge(p.stock, p.stock_min)}</td>
        <td class="acciones">
          <button class="btn-icono btn-ver"    onclick="verProducto(${p.id_producto})">👁</button>
          <button class="btn-icono btn-editar" onclick="abrirEditar(${p.id_producto})">✏️</button>
          <button class="btn-icono btn-elim"   onclick="eliminarProducto(${p.id_producto},'${p.nombre}')">🗑</button>
        </td>
      </tr>`);
  });
  renderPaginacion(data.paginacion);
};

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

/* ── MODAL ABRIR/CERRAR ── */
const abrirModal = (titulo = 'Nuevo producto') => {
  $('#modal-titulo').textContent = titulo;
  $('#modal-producto').classList.add('visible');
};

const cerrarModal = () => {
  $('#modal-producto').classList.remove('visible');
  $('#form-producto').reset();
  estado.editandoId = null;
  // Reset materiales panel
  const panel = document.getElementById('panel-materiales');
  if (panel) {
    panel.style.display = 'none';
    document.getElementById('lista-materiales').innerHTML = '';
  }
};
window.cerrarModal = cerrarModal;

/* ── PANEL MATERIALES: mostrar/ocultar según tipo ── */
$('#form-tipo').addEventListener('change', function () {
  const panel = document.getElementById('panel-materiales');
  if (!panel) return;
  if (this.value === 'fabricado') {
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
    document.getElementById('lista-materiales').innerHTML = '';
  }
});

/* ── SUBMIT ── */
$('#form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const tipo = $('#form-tipo').value;

  // Validate materials stock BEFORE saving product
  if (tipo === 'fabricado') {
    const stockOk = validarStockMateriales();
    if (!stockOk) {
      btn.disabled = false;
      btn.textContent = 'Guardar';
      return;
    }
  }

  const body = {
    nombre:       $('#form-nombre').value,
    descripcion:  $('#form-descripcion').value,
    tipo,
    id_categoria: $('#form-categoria').value,
    id_unidad:    $('#form-unidad').value,
    precio_venta: $('#form-precio-venta').value || 0,
    iva:          $('#form-iva').value || 0,
    stock_min:    $('#form-stock-min').value || 0,
    min_mayoreo:  $('#form-min-mayoreo').value || null,
    desc_mayoreo: $('#form-desc-mayoreo').value || 10,
  };

  const url    = estado.editandoId ? `${API}/${estado.editandoId}` : API;
  const method = estado.editandoId ? 'PUT' : 'POST';
  const data   = await apiFetch(url, { method, body: JSON.stringify(body) });

  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) { mostrarToast(data.error, 'error'); return; }

  // Save materiales if fabricado
  const idProd = estado.editandoId || data?.id_producto;
  if (tipo === 'fabricado' && idProd) {
    const ok = await guardarMateriales(idProd);
    if (!ok) return;
  }

  mostrarToast(data?.mensaje || 'Guardado', 'ok');
  cerrarModal();
  cargarProductos();
});

/* ── VER / EDITAR / ELIMINAR ── */
window.abrirEditar = async (id) => {
  estado.editandoId = id;
  const data = await apiFetch(`${API}/${id}`);
  if (!data || data.error) return mostrarToast('Error al cargar producto', 'error');

  abrirModal('Editar producto');

  $('#form-nombre').value       = data.nombre;
  $('#form-descripcion').value  = data.descripcion || '';
  $('#form-tipo').value         = data.tipo;
  $('#form-categoria').value    = data.id_categoria;
  $('#form-unidad').value       = data.id_unidad;
  $('#form-precio-venta').value = data.precio_venta || '';
  $('#form-iva').value          = data.iva;
  $('#form-stock-min').value    = data.stock_min;
  $('#form-min-mayoreo').value  = data.min_mayoreo || '';
  $('#form-desc-mayoreo').value = data.desc_mayoreo;

  // Show materiales panel if fabricado
  const panel = document.getElementById('panel-materiales');
  const lista = document.getElementById('lista-materiales');
  if (data.tipo === 'fabricado' && panel) {
    panel.style.display = 'block';
    lista.innerHTML = '';
    const d = await apiFetch(`${API}/${id}/materiales`);
    (d?.materiales || []).forEach(m => agregarFilaMaterial(m.id_materia, m.cantidad));
  } else if (panel) {
    panel.style.display = 'none';
    lista.innerHTML = '';
  }
};

window.verProducto = async (id) => {
  const data = await apiFetch(`${API}/${id}`);
  if (!data) return;
  const det  = $('#detalle-contenido');
  const prov = data.proveedores?.map(p =>
    `<li>${p.proveedor} — ${fmt(p.precio_compra)}${p.preferido ? ' ⭐' : ''}</li>`
  ).join('') || '<li>Sin proveedores asignados aún</li>';
  const mats = data.materiales?.map(m =>
    `<li>${m.nombre}: ${m.cantidad} ${m.abrev} × ${fmt(m.costo_prom)} = ${fmt(m.subtotal)}</li>`
  ).join('') || '<li>Sin materiales</li>';
  det.innerHTML = `
    <div class="detalle-grid">
      <div class="detalle-item"><label>Nombre</label><span>${data.nombre}</span></div>
      <div class="detalle-item"><label>Tipo</label><span>${tipoBadge(data.tipo)}</span></div>
      <div class="detalle-item"><label>Categoría</label><span>${data.categoria || '—'}</span></div>
      <div class="detalle-item"><label>Unidad</label><span>${data.unidad} (${data.abrev})</span></div>
      <div class="detalle-item"><label>Precio venta</label><span>${data.precio_venta > 0 ? fmt(data.precio_venta) : '—'}</span></div>
      <div class="detalle-item"><label>Costo promedio</label><span>${data.costo_prom > 0 ? fmt(data.costo_prom) : '—'}</span></div>
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

window.eliminarProducto = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
  const data = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (data?.error) return mostrarToast(data.error, 'error');
  mostrarToast('Producto eliminado', 'ok');
  cargarProductos();
};

/* ── TOAST ── */
const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

/* ── FILTROS ── */
let timer;
$('#buscar-input').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => { estado.buscar = e.target.value; estado.pagina = 1; cargarProductos(); }, 350);
});
$('#filtro-categoria').addEventListener('change', (e) => {
  estado.categoria = e.target.value; estado.pagina = 1; cargarProductos();
});
$('#filtro-tipo').addEventListener('change', (e) => {
  estado.tipo = e.target.value; estado.pagina = 1; cargarProductos();
});
$('#btn-nuevo').addEventListener('click', () => { estado.editandoId = null; abrirModal('Nuevo producto'); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { cerrarModal(); cerrarDetalle(); }
});

/* ══════════════════════════════════════════
   MATERIAS PRIMAS — panel en modal fabricado
══════════════════════════════════════════ */
let materiasDisponibles = [];

const cargarMateriasDisponibles = async () => {
  const d = await apiFetch('/api/produccion/materias?limite=500');
  if (d?.datos) materiasDisponibles = d.datos;
};

/* Agrega una fila al panel de materiales */
window.agregarFilaMaterial = (idMateria = '', cantidad = '') => {
  const lista = document.getElementById('lista-materiales');
  if (!lista) return;

  const opts = materiasDisponibles.map(m => {
    const sinStock = +m.stock <= 0;
    return `<option value="${m.id_materia}" data-stock="${m.stock}"
      ${m.id_materia == idMateria ? 'selected' : ''}
      ${sinStock ? 'style="color:#c0392b"' : ''}>
      ${m.nombre} (${m.abrev || ''}) — stock: ${m.stock}${sinStock ? ' ⚠ SIN STOCK' : ''}
    </option>`;
  }).join('');

  const fila = document.createElement('div');
  fila.className = 'fila-material';
  fila.innerHTML = `
    <select class="mat-select" onchange="validarStockFila(this)">
      <option value="">— Materia prima —</option>
      ${opts}
    </select>
    <input type="number" class="mat-cant" min="0.0001" step="0.0001"
      value="${cantidad || ''}" placeholder="Cantidad"
      oninput="validarCantFila(this)">
    <button type="button" class="mat-del"
      onclick="this.closest('.fila-material').remove()">✕</button>`;
  lista.appendChild(fila);

  // Auto-validate if editing existing material
  if (cantidad) {
    const input = fila.querySelector('.mat-cant');
    validarCantFila(input);
  }
};

/* Valida cantidad vs stock en tiempo real */
window.validarCantFila = (input) => {
  const fila  = input.closest('.fila-material');
  const sel   = fila.querySelector('.mat-select');
  const opt   = sel.options[sel.selectedIndex];
  const stock = opt && opt.value ? +opt.dataset.stock : Infinity;
  const cant  = +input.value;
  const excede = stock > 0 && cant > stock;
  input.style.borderColor = excede ? '#c0392b' : '';
  input.style.background  = excede ? '#fff0f0' : '';
  input.title = excede ? `⚠ Stock disponible: ${stock}` : '';
  return !excede;
};

window.validarStockFila = (sel) => {
  const fila  = sel.closest('.fila-material');
  const input = fila.querySelector('.mat-cant');
  if (input && input.value) validarCantFila(input);
};

/* Valida TODOS los materiales antes de guardar — retorna true si todo ok */
const validarStockMateriales = () => {
  const filas = [...document.querySelectorAll('.fila-material')];
  if (!filas.length) return true;

  for (const fila of filas) {
    const sel  = fila.querySelector('.mat-select');
    const cant = fila.querySelector('.mat-cant');
    if (!sel.value || !cant.value) continue;

    const opt   = sel.options[sel.selectedIndex];
    const stock = opt ? +opt.dataset.stock : Infinity;
    const nombre = opt ? opt.textContent.split('—')[0].trim() : '?';

    if (+cant.value <= 0) {
      mostrarToast(`La cantidad de "${nombre}" debe ser mayor a 0`, 'error');
      cant.focus();
      return false;
    }
    if (stock > 0 && +cant.value > stock) {
      mostrarToast(`Sin stock suficiente para "${nombre}" — disponible: ${stock}`, 'error');
      cant.style.borderColor = '#c0392b';
      cant.focus();
      return false;
    }
  }
  return true;
};

/* Guarda los materiales en el servidor */
const guardarMateriales = async (idProd) => {
  const filas = [...document.querySelectorAll('.fila-material')];
  const materiales = filas
    .map(f => ({
      id_materia: f.querySelector('.mat-select').value,
      cantidad:   +f.querySelector('.mat-cant').value,
    }))
    .filter(m => m.id_materia && m.cantidad > 0);

  if (!materiales.length) return true;

  const d = await apiFetch(`${API}/${idProd}/materiales`, {
    method: 'POST',
    body: JSON.stringify({ materiales }),
  });

  if (d?.error) { mostrarToast(d.error, 'error'); return false; }
  return true;
};

/* ── INIT ── */
(async () => {
  await cargarCatalogos();
  await cargarMateriasDisponibles();
  await cargarProductos();
})();