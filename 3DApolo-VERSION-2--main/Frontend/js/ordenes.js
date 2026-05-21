lucide.createIcons();
document.getElementById('btn').addEventListener('click', () =>
  document.getElementById('menu').classList.toggle('activo'));
document.getElementById('btn_modo').addEventListener('change', function () {
  document.body.classList.toggle('dark-mode', this.checked);
});

function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => window.location.replace('/login'));
}

function toast(msg, tipo = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + tipo;
  setTimeout(() => t.className = '', 3100);
}

function badge(e) {
  const m = {
    pendiente:   ['badge-naranja', 'Pendiente'],
    en_proceso:  ['badge-azul',    'En proceso'],
    completada:  ['badge-verde',   'Completada'],
    cancelada:   ['badge-rojo',    'Cancelada'],
  };
  const [c, l] = m[e] || ['badge-gris', e];
  return `<span class="badge ${c}">${l}</span>`;
}

const API = '/api/produccion';
let datos = [], pag = 1, totalPags = 1, editId = null;

async function cargarCatalogos() {
  const d = await apiFetch(API + '/catalogos');
  const sel = document.getElementById('f-prod');
  (d.productos || []).forEach(p => {
    const o = document.createElement('option');
    o.value = p.id_producto; o.textContent = p.nombre;
    sel.appendChild(o);
  });
}

async function cargar() {
  const b = document.getElementById('buscar').value;
  const e = document.getElementById('f-estado').value;
  const d = await apiFetch(`${API}/ordenes?buscar=${encodeURIComponent(b)}&estado=${e}&pagina=${pag}`);
  datos = d.datos || []; totalPags = d.paginacion?.paginas || 1;

  const total     = d.paginacion?.total || 0;
  const proceso   = datos.filter(x => x.estado === 'en_proceso').length;
  const comp      = datos.filter(x => x.estado === 'completada').length;
  const pend      = datos.filter(x => x.estado === 'pendiente').length;

  document.getElementById('ci-total').textContent   = total;
  document.getElementById('ci-proceso').textContent = proceso;
  document.getElementById('ci-comp').textContent    = comp;
  document.getElementById('ci-pend').textContent    = pend;

  renderTabla(); renderPag();
}

function renderTabla() {
  const tb = document.getElementById('tbody');
  if (!datos.length) {
    tb.innerHTML = '<tr><td colspan="8" class="tbl-empty">Sin órdenes registradas</td></tr>';
    return;
  }

  tb.innerHTML = datos.map(o => {
    const completable = ['pendiente', 'en_proceso'].includes(o.estado);
    const cancelable  = ['pendiente', 'en_proceso'].includes(o.estado);
    const eliminable  = o.estado !== 'completada';

    return `
      <tr>
        <td><strong>#${o.id_orden}</strong></td>
        <td>${o.producto || '—'}</td>
        <td>${o.cantidad}</td>
        <td>$${Number(o.costo_total || 0).toLocaleString('es-CO')}</td>
        <td>${badge(o.estado)}</td>
        <td>${o.fecha_inicio ? o.fecha_inicio.slice(0, 10) : '—'}</td>
        <td>${o.fecha_fin    ? o.fecha_fin.slice(0, 10)    : '—'}</td>
        <td>
          <div class="acciones">
            ${completable ? `<button class="btn-acc" title="Completar" onclick="cambiarEstado(${o.id_orden},'completada')"><i data-lucide="check-circle"></i></button>` : ''}
            ${cancelable  ? `<button class="btn-acc rojo" title="Cancelar" onclick="cambiarEstado(${o.id_orden},'cancelada')"><i data-lucide="x-circle"></i></button>` : ''}
            <button class="btn-acc" title="Editar" onclick="editar(${o.id_orden})"><i data-lucide="pencil"></i></button>
            ${eliminable  ? `<button class="btn-acc rojo" title="Eliminar" onclick="eliminar(${o.id_orden})"><i data-lucide="trash-2"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  lucide.createIcons();
}

function renderPag() {
  const c = document.getElementById('pag');
  if (totalPags <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = Array.from({ length: totalPags }, (_, i) =>
    `<button class="${i + 1 === pag ? 'activa' : ''}" onclick="irPag(${i + 1})">${i + 1}</button>`
  ).join('');
}

function irPag(n) { pag = n; cargar(); }

function abrirModal() {
  editId = null;
  document.getElementById('m-titulo').textContent = 'Nueva orden de producción';
  document.getElementById('form').reset();
  document.getElementById('modal').classList.add('open');
}

function cerrar() { document.getElementById('modal').classList.remove('open'); }

function editar(id) {
  const o = datos.find(x => x.id_orden === id);
  if (!o) return;

  if (['completada', 'cancelada'].includes(o.estado)) {
    toast('Esta orden ya no se puede editar', 'err');
    return;
  }

  editId = id;
  document.getElementById('m-titulo').textContent = 'Editar orden #' + id;
  document.getElementById('f-prod').value  = o.id_producto || '';
  document.getElementById('f-cant').value  = o.cantidad;
  document.getElementById('f-mano').value  = o.costo_mano || 0;
  document.getElementById('f-est').value   = o.estado;
  document.getElementById('f-fi').value    = o.fecha_inicio ? o.fecha_inicio.slice(0, 10) : '';
  document.getElementById('f-ff').value    = o.fecha_fin    ? o.fecha_fin.slice(0, 10)    : '';
  document.getElementById('f-notas').value = o.notas || '';
  document.getElementById('modal').classList.add('open');
}

async function cambiarEstado(id, nuevoEstado) {
  const labels = { completada: 'completar', cancelada: 'cancelar' };
  if (!confirm(`¿Deseas ${labels[nuevoEstado]} la orden #${id}?${nuevoEstado === 'completada' ? '\n\nEsto descontará las materias primas y sumará stock al producto.' : ''}`)) return;

  const d = await apiFetch(`${API}/ordenes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ estado: nuevoEstado }),
  });

  if (!d?.error) {
    toast(d.mensaje || 'Estado actualizado');
    cargar();
  } else {
    toast(d.error || 'Error al cambiar estado', 'err');
  }
}

async function eliminar(id) {
  if (!confirm('¿Eliminar esta orden?')) return;
  const d = await apiFetch(API + '/ordenes/' + id, { method: 'DELETE' });
  if (!d?.error) { toast('Orden eliminada'); cargar(); }
  else toast(d.error || 'Error', 'err');
}

async function guardar(e) {
  e.preventDefault();
  const body = {
    id_producto:  document.getElementById('f-prod').value,
    cantidad:     document.getElementById('f-cant').value,
    costo_mano:   document.getElementById('f-mano').value,
    estado:       document.getElementById('f-est').value,
    fecha_inicio: document.getElementById('f-fi').value,
    fecha_fin:    document.getElementById('f-ff').value,
    notas:        document.getElementById('f-notas').value,
  };

  const url    = editId ? `${API}/ordenes/${editId}` : `${API}/ordenes`;
  const method = editId ? 'PUT' : 'POST';
  const d = await apiFetch(url, { method, body: JSON.stringify(body) });

  if (!d?.error) {
    toast(editId ? 'Orden actualizada' : 'Orden creada');
    cerrar(); cargar();
  } else {
    toast(d.error || 'Error al guardar', 'err');
  }
}

document.getElementById('buscar').addEventListener('input', () => { pag = 1; cargar(); });
document.getElementById('f-estado').addEventListener('change', () => { pag = 1; cargar(); });

cargarCatalogos();
cargar();