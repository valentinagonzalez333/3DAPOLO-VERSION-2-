
lucide.createIcons();
  document.getElementById('btn').addEventListener('click', () =>
    document.getElementById('menu').classList.toggle('activo'));
  document.getElementById('btn_modo').addEventListener('change', function() {
    document.body.classList.toggle('dark-mode', this.checked);
  });
 

   function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => window.location.replace('/login'));
}

const API_DEV   = '/api/devoluciones';
const API_VENTAS = '/api/ventas';

let ventaActual = null;  // venta seleccionada para devolver
let pagVentas   = 1;
let pagDev      = 1;
let totalPagsVentas = 1;
let totalPagesDev   = 1;
let datosDev    = [];

function toast(msg, tipo = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + tipo;
  setTimeout(() => t.className = '', 3100);
}

function badgeEstado(e) {
  const m = { aprobada: 'badge-verde', rechazada: 'badge-rojo', pendiente: 'badge-naranja', devuelta: 'badge-azul' };
  return `<span class="badge ${m[e] || 'badge-gris'}">${e}</span>`;
}

function fmt(n) { return '$' + Number(n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 }); }

/* ══════════════════════════════════════════
   PANEL IZQUIERDO — Historial de ventas
══════════════════════════════════════════ */
async function cargarVentas() {
  const b     = document.getElementById('buscar-ventas').value;
  const desde = document.getElementById('vf-desde').value;
  const hasta = document.getElementById('vf-hasta').value;
  const d = await apiFetch(
    `${API_DEV}/ventas-completadas?buscar=${encodeURIComponent(b)}&desde=${desde}&hasta=${hasta}&pagina=${pagVentas}&limite=10`
  );
  if (!d || d.error) return;
  totalPagsVentas = d.paginacion?.paginas || 1;
  renderVentas(d.ventas || []);
  renderPagVentas();
}

function renderVentas(ventas) {
  const cont = document.getElementById('ventas-lista');
  if (!ventas.length) {
    cont.innerHTML = '<div class="dev-empty">Sin ventas disponibles para devolución</div>';
    return;
  }
  cont.innerHTML = ventas.map(v => {
    const selClass = ventaActual?.id_venta === v.id_venta ? ' seleccionada' : '';
    const fecha = v.fecha ? new Date(v.fecha).toLocaleDateString('es-CO') : '—';
    return `<div class="venta-row${selClass}" onclick="seleccionarVenta(${v.id_venta})">
      <div class="venta-row-id">#${v.id_venta}</div>
      <div class="venta-row-info">
        <div class="vr-top">${v.cliente}</div>
        <div class="vr-bot">${v.vendedor} · ${fecha} · ${badgeEstado(v.estado)}</div>
      </div>
      <div class="venta-row-monto">${fmt(v.total)}</div>
    </div>`;
  }).join('');
}

function renderPagVentas() {
  const c = document.getElementById('ventas-pag');
  if (totalPagsVentas <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = Array.from({ length: totalPagsVentas }, (_, i) =>
    `<button class="${i+1===pagVentas?'activa':''}" onclick="irPagV(${i+1})">${i+1}</button>`
  ).join('');
}
function irPagV(n) { pagVentas = n; cargarVentas(); }

/* ══════════════════════════════════════════
   SELECCIONAR VENTA
══════════════════════════════════════════ */
async function seleccionarVenta(idVenta) {
  const d = await apiFetch(`${API_DEV}/venta/${idVenta}/items`);
  if (!d || d.error) { toast(d?.error || 'Error al cargar venta', 'err'); return; }
  ventaActual = d;

  // Show info box
  document.getElementById('vsb-num').textContent     = `Venta #${d.id_venta}`;
  document.getElementById('vsb-estado').textContent  = d.estado;
  document.getElementById('vsb-cliente').textContent = d.cliente;
  document.getElementById('vsb-vendedor').textContent= d.vendedor;
  document.getElementById('vsb-total').textContent   = fmt(d.total);
  document.getElementById('venta-sel-box').classList.add('visible');
  document.getElementById('dev-no-sel').style.display = 'none';
  document.getElementById('form-dev').style.display   = 'block';

  // Reset form
  document.getElementById('f-motivo').value = '';
  document.getElementById('f-tipo').value   = 'total';
  document.getElementById('f-notas').value  = '';
  document.getElementById('seccion-items').style.display  = 'none';
  document.getElementById('items-lista').innerHTML = '';

  // Highlight in list
  document.querySelectorAll('.venta-row').forEach(el => el.classList.remove('seleccionada'));
  document.querySelectorAll('.venta-row').forEach(el => {
    if (el.textContent.includes(`#${d.id_venta}`)) el.classList.add('seleccionada');
  });

  lucide.createIcons();
}

function limpiarForm() {
  ventaActual = null;
  document.getElementById('venta-sel-box').classList.remove('visible');
  document.getElementById('dev-no-sel').style.display = '';
  document.getElementById('form-dev').style.display   = 'none';
  document.getElementById('seccion-items').style.display = 'none';
  document.getElementById('items-lista').innerHTML = '';
  document.querySelectorAll('.venta-row').forEach(el => el.classList.remove('seleccionada'));
}

/* Tipo parcial → mostrar items */
document.getElementById('f-tipo').addEventListener('change', function () {
  const seccion = document.getElementById('seccion-items');
  if (this.value === 'parcial') {
    seccion.style.display = 'block';
    if (ventaActual) renderItemsDevolucion(ventaActual.items || []);
  } else {
    seccion.style.display = 'none';
    document.getElementById('items-lista').innerHTML = '';
  }
});

function renderItemsDevolucion(items) {
  const lista = document.getElementById('items-lista');
  if (!items.length) {
    lista.innerHTML = '<p style="color:#aaa;font-size:13px;text-align:center">No hay productos disponibles para devolver</p>';
    return;
  }
  lista.innerHTML = items.map(it => `
    <div class="item-dev">
      <input type="checkbox" class="chk-item"
        data-id="${it.id_producto}" data-precio="${it.precio_venta}"
        data-max="${it.disponible}" checked>
      <span class="item-nombre">${it.producto}</span>
      <span class="item-max">máx ${it.disponible}</span>
      <input type="number" class="item-cant" min="1" max="${it.disponible}"
        value="${it.disponible}" oninput="actualizarSub(this)">
      <span class="item-sub">${fmt(it.precio_venta * it.disponible)}</span>
    </div>`).join('');
}

function actualizarSub(input) {
  const row   = input.closest('.item-dev');
  const chk   = row.querySelector('.chk-item');
  const precio = +chk.dataset.precio;
  row.querySelector('.item-sub').textContent = fmt(precio * (+input.value || 0));
}

/* ══════════════════════════════════════════
   GUARDAR DEVOLUCIÓN
══════════════════════════════════════════ */
document.getElementById('form-dev').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!ventaActual) { toast('Selecciona una venta primero', 'err'); return; }

  const tipo = document.getElementById('f-tipo').value;
  let items = [];

  if (tipo === 'parcial') {
    const chks = [...document.querySelectorAll('.chk-item:checked')];
    if (!chks.length) { toast('Selecciona al menos un producto', 'err'); return; }
    items = chks.map(chk => {
      const row  = chk.closest('.item-dev');
      const cant = +row.querySelector('.item-cant').value;
      const max  = +chk.dataset.max;
      if (cant > max) { toast(`Cantidad mayor al disponible`, 'err'); throw new Error('qty'); }
      return {
        id_producto:  +chk.dataset.id,
        cantidad:     cant,
        precio_venta: +chk.dataset.precio,
        subtotal:     +chk.dataset.precio * cant,
      };
    });
  }

  const btn = e.target.querySelector('[type=submit]');
  btn.disabled = true; btn.textContent = 'Registrando...';

  const body = {
    id_venta: ventaActual.id_venta,
    motivo:   document.getElementById('f-motivo').value,
    tipo, notas: document.getElementById('f-notas').value, items,
  };

  const d = await apiFetch(API_DEV, { method: 'POST', body: JSON.stringify(body) });

  btn.disabled = false;
  btn.innerHTML = '<i data-lucide="check"></i> Registrar devolución';
  lucide.createIcons();

  if (!d || d.error) { toast(d?.error || 'Error al registrar', 'err'); return; }

  // Change estado if needed
  const estadoSel = document.getElementById('f-estado-nuevo').value;
  if (estadoSel !== 'aprobada' && d.id_devolucion) {
    await apiFetch(`${API_DEV}/${d.id_devolucion}/estado`, {
      method: 'PATCH', body: JSON.stringify({ estado: estadoSel })
    });
  }

  toast(`✓ Devolución registrada — ${fmt(d.monto_devuelto)}`);
  limpiarForm();
  cargarVentas();   // refresh ventas list (some may disappear if fully returned)
  cargarDev();      // refresh historial
});

/* ══════════════════════════════════════════
   HISTORIAL DE DEVOLUCIONES
══════════════════════════════════════════ */
async function cargarDev() {
  const b     = document.getElementById('buscar-dev').value;
  const est   = document.getElementById('f-estado-dev').value;
  const desde = document.getElementById('f-desde-dev').value;
  const hasta = document.getElementById('f-hasta-dev').value;
  const d = await apiFetch(
    `${API_DEV}?buscar=${encodeURIComponent(b)}&estado=${est}&desde=${desde}&hasta=${hasta}&pagina=${pagDev}`
  );
  if (!d || d.error) return;
  datosDev = d.datos || []; totalPagesDev = d.paginacion?.paginas || 1;
  document.getElementById('ci-total').textContent = d.paginacion?.total || 0;
  document.getElementById('ci-monto').textContent = fmt(d.total_monto);
  document.getElementById('ci-apro').textContent  = datosDev.filter(x => x.estado === 'aprobada').length;
  document.getElementById('ci-pend').textContent  = datosDev.filter(x => x.estado === 'pendiente').length;
  renderTabla(); renderPag();
}

function renderTabla() {
  const tb = document.getElementById('tbody');
  if (!datosDev.length) {
    tb.innerHTML = '<tr><td colspan="9" class="tbl-empty">Sin devoluciones registradas</td></tr>';
    return;
  }
  tb.innerHTML = datosDev.map(d => `
    <tr>
      <td><strong>#${d.id_devolucion}</strong></td>
      <td>#${d.id_venta}</td>
      <td>${d.fecha ? new Date(d.fecha).toLocaleDateString('es-CO') : '—'}</td>
      <td>${d.motivo}</td>
      <td><span class="badge badge-azul">${d.tipo}</span></td>
      <td><strong>${fmt(d.monto_devuelto)}</strong></td>
      <td>${badgeEstado(d.estado)}</td>
      <td>${d.usuario}</td>
      <td>
        <button class="btn-acc" title="Ver detalle" onclick="verDetalle(${d.id_devolucion})">
          <i data-lucide="eye"></i>
        </button>
        ${d.estado === 'pendiente' ? `
          <button class="btn-acc" style="color:#1a7a45" title="Aprobar" onclick="cambiarEstado(${d.id_devolucion},'aprobada')">
            <i data-lucide="check"></i>
          </button>
          <button class="btn-acc rojo" title="Rechazar" onclick="cambiarEstado(${d.id_devolucion},'rechazada')">
            <i data-lucide="x"></i>
          </button>` : ''}
      </td>
    </tr>`).join('');
  lucide.createIcons();
}

function renderPag() {
  const c = document.getElementById('pag');
  if (totalPagesDev <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = Array.from({ length: totalPagesDev }, (_, i) =>
    `<button class="${i+1===pagDev?'activa':''}" onclick="irPagD(${i+1})">${i+1}</button>`
  ).join('');
}
function irPagD(n) { pagDev = n; cargarDev(); }

async function verDetalle(id) {
  const v = await apiFetch(`${API_DEV}/${id}`);
  if (!v || v.error) return;
  document.getElementById('det-titulo').textContent = `Devolución #${v.id_devolucion}`;
  document.getElementById('det-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13.5px">
      <div><b>Venta:</b> #${v.id_venta}</div>
      <div><b>Fecha:</b> ${v.fecha ? new Date(v.fecha).toLocaleString('es-CO') : '—'}</div>
      <div><b>Tipo:</b> <span class="badge badge-azul">${v.tipo}</span></div>
      <div><b>Estado:</b> ${badgeEstado(v.estado)}</div>
      <div style="grid-column:1/-1"><b>Motivo:</b> ${v.motivo}</div>
      ${v.notas ? `<div style="grid-column:1/-1"><b>Notas:</b> ${v.notas}</div>` : ''}
    </div>
    ${(v.items||[]).length ? `
    <div class="tbl-wrap" style="margin-bottom:14px">
      <table>
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${v.items.map(it => `<tr>
            <td>${it.producto}</td><td>${it.cantidad}</td>
            <td>${fmt(it.precio_venta)}</td>
            <td><b>${fmt(it.subtotal)}</b></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}
    <div style="text-align:right;font-size:15px;font-weight:700;color:var(--naranja)">
      Monto devuelto: ${fmt(v.monto_devuelto)}
    </div>`;
  document.getElementById('modal-det').classList.add('open');
  lucide.createIcons();
}

async function cambiarEstado(id, estado) {
  const accion = estado === 'aprobada' ? 'aprobar' : 'rechazar';
  if (!confirm(`¿${accion.charAt(0).toUpperCase()+accion.slice(1)} devolución #${id}?`)) return;
  const d = await apiFetch(`${API_DEV}/${id}/estado`, {
    method: 'PATCH', body: JSON.stringify({ estado })
  });
  if (!d || d.error) { toast(d?.error || 'Error', 'err'); return; }
  toast(`Devolución ${estado}`); cargarDev();
}

/* ══════════════════════════════════════════
   FILTROS
══════════════════════════════════════════ */
['buscar-ventas','vf-desde','vf-hasta'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('change', () => { pagVentas = 1; cargarVentas(); });
  if (id === 'buscar-ventas') el.addEventListener('input', () => { pagVentas = 1; cargarVentas(); });
});

['buscar-dev','f-estado-dev','f-desde-dev','f-hasta-dev'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('change', () => { pagDev = 1; cargarDev(); });
  if (id === 'buscar-dev') el.addEventListener('input', () => { pagDev = 1; cargarDev(); });
});

/* ── Init ── */
cargarVentas();
cargarDev();
