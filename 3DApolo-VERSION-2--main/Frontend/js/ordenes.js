const $ = id => document.getElementById(id);

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const ESTADOS = {
  pendiente:  { label: 'Pendiente',  cls: 'badge-amarillo' },
  en_proceso: { label: 'En proceso', cls: 'badge-azul'     },
  completada: { label: 'Completada', cls: 'badge-verde'    },
  cancelada:  { label: 'Cancelada',  cls: 'badge-rojo'     },
};

let pag    = { pagina: 1, limite: 20, buscar: '', estado: '' };
let editId = null;

// ── Catálogos ──────────────────────────────────────────────────────────────
const cargarCatalogos = async () => {
  const data = await apiFetch('/api/produccion/catalogos');
  if (!data) return;
  const sel = $('f-prod');
  data.productos.forEach(p => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${p.id_producto}">${p.nombre}</option>`
    );
  });
};

// ── Tabla ──────────────────────────────────────────────────────────────────
const cargarOrdenes = async () => {
  const tbody = $('tbody');
  tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">Cargando...</td></tr>`;

  const params = new URLSearchParams({
    pagina: pag.pagina,
    limite: pag.limite,
    buscar: pag.buscar,
    estado: pag.estado,
  });

  const data = await apiFetch(`/api/produccion/ordenes?${params}`);
  if (!data) return;

  $('ci-total').textContent   = data.paginacion.total;
  $('ci-proceso').textContent = data.datos.filter(o => o.estado === 'en_proceso').length;
  $('ci-comp').textContent    = data.datos.filter(o => o.estado === 'completada').length;
  $('ci-pend').textContent    = data.datos.filter(o => o.estado === 'pendiente').length;

  tbody.innerHTML = '';

  if (!data.datos.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">Sin órdenes</td></tr>`;
    renderPag(data.paginacion);
    return;
  }

  data.datos.forEach(o => {
    const est      = ESTADOS[o.estado] || { label: o.estado, cls: '' };
    const fechaIni = o.fecha_inicio ? new Date(o.fecha_inicio).toLocaleDateString('es-CO') : '—';
    const fechaFin = o.fecha_fin    ? new Date(o.fecha_fin).toLocaleDateString('es-CO')    : '—';
    const puedeEditar   = o.estado !== 'completada' && o.estado !== 'cancelada';
    const puedeEliminar = o.estado === 'pendiente';

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>#${o.id_orden}</td>
        <td><strong>${o.producto}</strong></td>
        <td>${o.cantidad}</td>
        <td>${fmt(o.costo_total)}</td>
        <td><span class="badge ${est.cls}">${est.label}</span></td>
        <td>${fechaIni}</td>
        <td>${fechaFin}</td>
        <td>
          ${puedeEditar   ? `<button class="btn-icon" title="Editar" onclick='abrirEditar(${JSON.stringify(o)})'>✏️</button>` : ''}
          <button class="btn-icon" title="Ver detalle" onclick="verDetalle(${o.id_orden})">👁</button>
          ${puedeEliminar ? `<button class="btn-icon btn-del" title="Eliminar" onclick="eliminar(${o.id_orden})">🗑</button>` : ''}
        </td>
      </tr>
    `);
  });

  renderPag(data.paginacion);
};

// ── Paginación ─────────────────────────────────────────────────────────────
const renderPag = ({ pagina, paginas }) => {
  const el = $('pag');
  el.innerHTML = '';
  if (paginas <= 1) return;

  const btn = (label, pg, dis = false) =>
    `<button class="btn-pag${pg === pagina ? ' activo' : ''}" ${dis ? 'disabled' : ''}
      onclick="cambiarPag(${pg})">${label}</button>`;

  el.insertAdjacentHTML('beforeend', btn('‹', pagina - 1, pagina === 1));
  for (let i = 1; i <= paginas; i++) {
    el.insertAdjacentHTML('beforeend', btn(i, i));
  }
  el.insertAdjacentHTML('beforeend', btn('›', pagina + 1, pagina === paginas));
};

window.cambiarPag = (p) => { pag.pagina = p; cargarOrdenes(); };

// ── Modal nueva orden ──────────────────────────────────────────────────────
window.abrirModal = () => {
  editId = null;
  $('m-titulo').textContent = 'Nueva orden de producción';
  $('form').reset();
  $('f-est').value = 'pendiente';

  // Limpiar aviso si quedó de antes
  const aviso = document.getElementById('aviso-completar-inline');
  if (aviso) aviso.style.display = 'none';

  $('modal').classList.add('visible');
};

// ── Modal editar ───────────────────────────────────────────────────────────
window.abrirEditar = (o) => {
  editId = o.id_orden;
  $('m-titulo').textContent = `Editar orden #${o.id_orden}`;

  $('f-prod').value  = o.id_producto;
  $('f-cant').value  = o.cantidad;
  $('f-est').value   = o.estado;
  $('f-fi').value    = o.fecha_inicio ? o.fecha_inicio.split('T')[0] : '';
  $('f-ff').value    = o.fecha_fin    ? o.fecha_fin.split('T')[0]    : '';
  $('f-notas').value = o.notas || '';

  // Aviso al completar
  let aviso = document.getElementById('aviso-completar-inline');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id        = 'aviso-completar-inline';
    aviso.className = 'aviso-info';
    aviso.textContent = '⚠️ Al cambiar a "Completada" se descontarán materias primas y se sumará stock al producto.';
    $('f-est').parentElement.insertAdjacentElement('afterend', aviso);
  }
  aviso.style.display = o.estado === 'completada' ? 'block' : 'none';

  // Listener para mostrar/ocultar aviso al cambiar estado
  $('f-est').onchange = function () {
    aviso.style.display = this.value === 'completada' ? 'block' : 'none';
  };

  $('modal').classList.add('visible');
};

// ── Cerrar modal ───────────────────────────────────────────────────────────
window.cerrar = () => {
  $('modal').classList.remove('visible');
  $('form').reset();
  editId = null;
  $('f-est').onchange = null;
  const aviso = document.getElementById('aviso-completar-inline');
  if (aviso) aviso.style.display = 'none';
};

// ── Guardar ────────────────────────────────────────────────────────────────
window.guardar = async (e) => {
  e.preventDefault();

  const body = {
    id_producto:  +$('f-prod').value,
    cantidad:     +$('f-cant').value,
    estado:       $('f-est').value,
    notas:        $('f-notas').value,
    fecha_inicio: $('f-fi').value  || null,
    fecha_fin:    $('f-ff').value  || null,
  };

  if (!body.id_producto) { toast('Selecciona un producto', 'error'); return; }
  if (!body.cantidad)    { toast('Ingresa una cantidad',    'error'); return; }

  const url    = editId ? `/api/produccion/ordenes/${editId}` : '/api/produccion/ordenes';
  const method = editId ? 'PUT' : 'POST';

  const data = await apiFetch(url, { method, body: JSON.stringify(body) });
  if (data?.error) { toast(data.error, 'error'); return; }

  toast(data?.mensaje || 'Guardado', 'ok');
  cerrar();
  cargarOrdenes();
};

// ── Ver detalle ────────────────────────────────────────────────────────────
window.verDetalle = async (id) => {
  const data = await apiFetch(`/api/produccion/ordenes/${id}`);
  if (!data || data.error) { toast('Error al cargar detalle', 'error'); return; }

  const est  = ESTADOS[data.estado] || { label: data.estado, cls: '' };
  const mats = (data.materiales || []).map(m =>
    `<li>${m.nombre}: ${m.cantidad_requerida} ${m.abrev} × ${fmt(m.costo_prom)} = ${fmt(m.subtotal)}</li>`
  ).join('') || '<li>Sin materiales registrados</li>';

  $('m-titulo').textContent = `Detalle orden #${data.id_orden}`;
  $('form').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Producto</label>
           <p style="margin:4px 0;font-weight:600">${data.producto}</p></div>
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Estado</label>
           <p style="margin:4px 0"><span class="badge ${est.cls}">${est.label}</span></p></div>
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Cantidad</label>
           <p style="margin:4px 0">${data.cantidad}</p></div>
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Costo unitario</label>
           <p style="margin:4px 0">${fmt(data.costo_unit)}</p></div>
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Costo materiales</label>
           <p style="margin:4px 0">${fmt(data.costo_mat)}</p></div>
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Costo total</label>
           <p style="margin:4px 0"><strong>${fmt(data.costo_total)}</strong></p></div>
      <div><label style="font-size:11px;color:#aaa;text-transform:uppercase">Registrado por</label>
           <p style="margin:4px 0">${data.usuario}</p></div>
    </div>
    ${data.notas ? `<p><strong>Notas:</strong> ${data.notas}</p>` : ''}
    <div>
      <strong style="color:var(--naranja)">Materiales</strong>
      <ul style="margin-top:8px;padding-left:20px">${mats}</ul>
    </div>
    <div class="modal-foot" style="margin-top:16px">
      <button type="button" class="btn-cancel" onclick="cerrar()">Cerrar</button>
    </div>
  `;
  $('modal').classList.add('visible');
};

// ── Eliminar ───────────────────────────────────────────────────────────────
window.eliminar = async (id) => {
  if (!confirm('¿Eliminar esta orden?')) return;
  const data = await apiFetch(`/api/produccion/ordenes/${id}`, { method: 'DELETE' });
  if (data?.error) { toast(data.error, 'error'); return; }
  toast('Orden eliminada', 'ok');
  cargarOrdenes();
};

// ── Toast ──────────────────────────────────────────────────────────────────
const toast = (msg, tipo = 'ok') => {
  const el = $('toast');
  el.textContent = msg;
  el.className   = `toast-visible toast-${tipo}`;
  setTimeout(() => { el.className = ''; }, 3000);
};

// ── Filtros ────────────────────────────────────────────────────────────────
let timer;
$('buscar').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    pag.buscar = e.target.value;
    pag.pagina = 1;
    cargarOrdenes();
  }, 350);
});

$('f-estado').addEventListener('change', (e) => {
  pag.estado = e.target.value;
  pag.pagina = 1;
  cargarOrdenes();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrar();
});

// ── Init ───────────────────────────────────────────────────────────────────
cargarCatalogos();
cargarOrdenes();