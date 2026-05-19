
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

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const API = '/api/compras';

const apiFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res.json();
};

let estado = { pagina: 1, limite: 20, buscar: '', proveedor: '', estado: '', fecha_ini: '', fecha_fin: '' };
let ultimaData = [];

const ESTADOS = {
  pendiente: { label: 'Pendiente', cls: 'badge-amarillo' },
  recibida: { label: 'Recibida', cls: 'badge-verde' },
  parcial: { label: 'Parcial', cls: 'badge-naranja' },
  cancelada: { label: 'Cancelada', cls: 'badge-rojo' },
};


const cargarProveedores = async () => {
  const data = await apiFetch('/api/proveedores?limite=100');
  if (!data) return;
  const sel = $('#fil-proveedor');
  data.datos.forEach(p => {
    sel.insertAdjacentHTML('beforeend', `<option value="${p.id_proveedor}">${p.nombre}</option>`);
  });
};


const cargarHistorial = async () => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="7" class="cargando">Cargando...</td></tr>`;

  const params = new URLSearchParams({
    pagina: estado.pagina,
    limite: estado.limite,
    buscar: estado.buscar,
    proveedor: estado.proveedor,
    estado: estado.estado,
    fecha_ini: estado.fecha_ini,
    fecha_fin: estado.fecha_fin,
  });

  const data = await apiFetch(`${API}?${params}`);
  if (!data) return;
  ultimaData = data.datos;

  tbody.innerHTML = '';
  if (!data.datos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="cargando">Sin compras registradas</td></tr>`;
    renderPaginacion(data.paginacion);
    return;
  }

  data.datos.forEach(c => {
    const est = ESTADOS[c.estado] || { label: c.estado, cls: 'badge-gris' };
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong>#${c.id_compra}</strong></td>
        <td>${c.proveedor || '<span class="muted">—</span>'}</td>
        <td>${new Date(c.fecha).toLocaleDateString('es-CO')}</td>
        <td>${c.num_items} item${c.num_items !== 1 ? 's' : ''}</td>
        <td><strong>$${(+c.total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong></td>
        <td><span class="badge ${est.cls}">${est.label}</span></td>
        <td>
          <div class="acciones">
            <button class="btn-icono" title="Ver detalle" onclick="verDetalle(${c.id_compra})">🔍</button>
            ${c.estado !== 'recibida' && c.estado !== 'cancelada' ? `
              <button class="btn-icono" title="Marcar recibida" onclick="cambiarEstado(${c.id_compra},'recibida')">✅</button>
              <button class="btn-icono rojo" title="Cancelar" onclick="cambiarEstado(${c.id_compra},'cancelada')">✕</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `);
  });

  renderPaginacion(data.paginacion);
  cargarResumen();
};


const cargarResumen = async () => {
  const params = new URLSearchParams({
    fecha_ini: estado.fecha_ini,
    fecha_fin: estado.fecha_fin,
    id_proveedor: estado.proveedor,
  });
  const data = await apiFetch(`${API}/resumen?${params}`);
  if (!data) return;

  const s = data.stats;
  $('#card-compras').textContent = s.total_compras || 0;
  $('#card-monto').textContent = `$${(+(s.monto_total || 0)).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
  $('#card-impuesto').textContent = `$${(+(s.total_impuesto || 0)).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
  $('#card-promedio').textContent = `$${(+(s.promedio || 0)).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
};


const renderPaginacion = ({ pagina, paginas, total }) => {
  const el = $('#paginacion');
  el.innerHTML = '';
  $('#total-count').textContent = `${total} compra${total !== 1 ? 's' : ''}`;
  if (paginas <= 1) return;

  const btn = (label, pg, disabled = false) =>
    `<button class="btn-pag${pg === pagina ? ' activo' : ''}" ${disabled ? 'disabled' : ''}
      onclick="cambiarPagina(${pg})">${label}</button>`;

  el.insertAdjacentHTML('beforeend', btn('‹', pagina - 1, pagina === 1));
  for (let i = 1; i <= paginas; i++) {
    if (paginas > 7 && i > 2 && i < paginas - 1 && Math.abs(i - pagina) > 1) {
      if (i === 3 || i === paginas - 2) el.insertAdjacentHTML('beforeend', '<span>…</span>');
      continue;
    }
    el.insertAdjacentHTML('beforeend', btn(i, i));
  }
  el.insertAdjacentHTML('beforeend', btn('›', pagina + 1, pagina === paginas));
};

window.cambiarPagina = (p) => { estado.pagina = p; cargarHistorial(); };


window.verDetalle = async (id) => {
  const data = await apiFetch(`${API}/${id}`);
  if (!data || data.error) { mostrarToast('Error al cargar compra', 'error'); return; }

  const est = ESTADOS[data.estado] || { label: data.estado, cls: 'badge-gris' };

  $('#modal-detalle-body').innerHTML = `
    <div class="detalle-grid">
      <div class="detalle-item"><label>#</label><span>${data.id_compra}</span></div>
      <div class="detalle-item"><label>Proveedor</label><span>${data.proveedor || '—'}</span></div>
      <div class="detalle-item"><label>Fecha</label><span>${new Date(data.fecha).toLocaleDateString('es-CO')}</span></div>
      <div class="detalle-item"><label>Estado</label><span class="badge ${est.cls}">${est.label}</span></div>
      <div class="detalle-item"><label>Subtotal</label><span>$${(+data.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span></div>
      <div class="detalle-item"><label>Impuesto</label><span>$${(+data.impuesto).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</span></div>
      <div class="detalle-item"><label>Total</label><span><strong>$${(+data.total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong></span></div>
      <div class="detalle-item"><label>Registrado por</label><span>${data.usuario || '—'}</span></div>
    </div>
    ${data.notas ? `<div class="detalle-seccion"><strong>Notas</strong><p>${data.notas}</p></div>` : ''}
    <div class="detalle-seccion">
      <strong>Productos / Materias primas</strong>
      <table class="tabla-productos" style="margin-top:8px">
        <thead><tr><th>Item</th><th>Tipo</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
        // ── Ver detalle modal ── línea del .map en el HTML
<tbody>
  ${(data.detalle || []).map(d => `
    <tr>
      <td><strong>${d.nombre_item}</strong></td>
      <td><span class="badge ${d.tipo_item === 'producto' ? 'badge-azul' : 'badge-naranja'}">${d.tipo_item === 'producto' ? 'Producto' : 'Materia prima'}</span></td>
      <td>${d.cantidad}</td>
      <td>$${(+d.precio_unit).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
      <td>$${(+d.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('')}
</tbody>
      </table>
    </div>
  `;

  $('#modal-detalle-id').textContent = `Compra #${data.id_compra}`;
  $('#modal-detalle').classList.add('visible');


  $('#btn-imprimir').onclick = () => imprimirCompra(data);
};


window.cambiarEstado = async (id, nuevoEstado) => {
  const labels = { recibida: 'marcar como recibida', cancelada: 'cancelar' };
  if (!confirm(`¿Deseas ${labels[nuevoEstado]} la compra #${id}?`)) return;
  const data = await apiFetch(`${API}/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: nuevoEstado }) });
  if (data?.error) { mostrarToast(data.error, 'error'); return; }
  mostrarToast(data.mensaje, 'ok');
  cargarHistorial();
};

const cerrarModal = () => $('#modal-detalle').classList.remove('visible');
window.cerrarModal = cerrarModal;


const imprimirCompra = (data) => {
  const win = window.open('', '_blank');
  const est = ESTADOS[data.estado] || { label: data.estado };
  win.document.write(`
    <!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Compra #${data.id_compra}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #222; font-size: 14px; }
      h1 { color: #ff6b00; margin-bottom: 4px; }
      .sub { color: #888; margin-bottom: 24px; font-size: 13px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
      .item { background: #f9f9f9; border-radius: 8px; padding: 10px 14px; }
      .item label { display: block; font-size: 11px; color: #aaa; text-transform: uppercase; margin-bottom: 3px; }
      .item span { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { text-align: left; font-size: 12px; color: #b05a2c; padding: 6px 10px; border-bottom: 1.5px solid #ffe0cc; }
      td { padding: 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
      .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #ff6b00; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <h1>Compra #${data.id_compra}</h1>
    <div class="sub">Generado el ${new Date().toLocaleDateString('es-CO')}</div>
    <div class="grid">
      <div class="item"><label>Proveedor</label><span>${data.proveedor || '—'}</span></div>
      <div class="item"><label>Fecha</label><span>${new Date(data.fecha).toLocaleDateString('es-CO')}</span></div>
      <div class="item"><label>Estado</label><span>${est.label}</span></div>
      <div class="item"><label>Registrado por</label><span>${data.usuario || '—'}</span></div>
    </div>
    ${data.notas ? `<p><strong>Notas:</strong> ${data.notas}</p>` : ''}
    <table>
      <thead><tr><th>Item</th><th>Tipo</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
      // ── imprimirCompra ── línea del .map en la tabla
<tbody>
  ${(data.detalle || []).map(d => `
    <tr>
      <td>${d.nombre_item}</td>
      <td>${d.tipo_item === 'producto' ? 'Producto' : 'Materia prima'}</td>
      <td>${d.cantidad}</td>
      <td>$${(+d.precio_unit).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
      <td>$${(+d.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('')}
  <tr class="total-row">
    <td colspan="4">Subtotal</td>
    <td>$${(+data.subtotal).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
  </tr>
  <tr>
    <td colspan="4">Impuesto</td>
    <td>$${(+data.impuesto).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
  </tr>
  <tr class="total-row">
    <td colspan="4">TOTAL</td>
    <td>$${(+data.total).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</td>
  </tr>
</tbody>
    </table>
    <script>window.onload = () => { window.print(); }<\/script>
    </body></html>
  `);
  win.document.close();
};


const aplicarFiltros = () => {
  estado.pagina = 1;
  estado.proveedor = $('#fil-proveedor').value;
  estado.estado = $('#fil-estado').value;
  estado.fecha_ini = $('#fil-fecha-ini').value;
  estado.fecha_fin = $('#fil-fecha-fin').value;
  cargarHistorial();
};

$('#btn-filtrar').addEventListener('click', aplicarFiltros);
$('#btn-limpiar').addEventListener('click', () => {
  $('#fil-proveedor').value = '';
  $('#fil-estado').value = '';
  $('#fil-fecha-ini').value = '';
  $('#fil-fecha-fin').value = '';
  estado = { ...estado, pagina: 1, proveedor: '', estado: '', fecha_ini: '', fecha_fin: '' };
  cargarHistorial();
});

let timer;
$('#buscar-input').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => { estado.buscar = e.target.value; estado.pagina = 1; cargarHistorial(); }, 350);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });


const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

cargarProveedores();
cargarHistorial();