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

const API = '/api/produccion';
let datos = [], pag = 1, totalPags = 1, editId = null;

async function cargarCatalogos() {
  const d = await apiFetch(API + '/catalogos');
  const su = document.getElementById('f-unidad'), sp = document.getElementById('f-prov');
  (d.unidades || []).forEach(u => { const o = document.createElement('option'); o.value = u.id_unidad; o.textContent = u.nombre + ' (' + u.abrev + ')'; su.appendChild(o); });
}

async function cargar() {
  const b = document.getElementById('buscar').value;
  const d = await apiFetch(`${API}/materias?buscar=${encodeURIComponent(b)}&pagina=${pag}`);
  datos = d.datos || []; totalPags = d.paginacion?.paginas || 1;
  document.getElementById('ci-total').textContent = d.paginacion?.total || 0;
  const bajo = datos.filter(m => parseFloat(m.stock) <= parseFloat(m.stock_min)).length;
  document.getElementById('ci-bajo').textContent = bajo;
  const val = datos.reduce((s, m) => s + parseFloat(m.stock || 0) * parseFloat(m.costo_prom || 0), 0);
  document.getElementById('ci-valor').textContent = '$' + val.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  renderTabla(); renderPag();
}

function renderTabla() {
  const tb = document.getElementById('tbody');
  if (!datos.length) { tb.innerHTML = '<tr><td colspan="8" class="tbl-empty">Sin materias registradas</td></tr>'; return; }
  tb.innerHTML = datos.map(m => {
    const bajo = parseFloat(m.stock) <= parseFloat(m.stock_min);
    const estadoBadge = bajo ? '<span class="badge badge-rojo">Stock bajo</span>' : '<span class="badge badge-verde">Normal</span>';
    return `<tr>
        <td><strong>${m.nombre}</strong></td>
        <td>${m.abrev || m.unidad}</td>
        <td>${parseFloat(m.stock).toLocaleString('es-CO')}</td>
        <td>${parseFloat(m.stock_min).toLocaleString('es-CO')}</td>
        <td>${Number(m.costo_prom || 0).toLocaleString('es-CO')}</td>
        <td>${estadoBadge}</td>
        <td>${m.proveedor || '—'}</td>
        <td>
          <button class="btn-acc" onclick="editar(${m.id_materia})"><i data-lucide="pencil"></i></button>
          <button class="btn-acc rojo" onclick="eliminar(${m.id_materia})"><i data-lucide="trash-2"></i></button>
        </td></tr>`;
  }).join('');
  lucide.createIcons();
}

function renderPag() {
  const c = document.getElementById('pag');
  if (totalPags <= 1) { c.innerHTML = ''; return; }
  c.innerHTML = Array.from({ length: totalPags }, (_, i) =>
    `<button class="${i + 1 === pag ? 'activa' : ''}" onclick="irPag(${i + 1})">${i + 1}</button>`).join('');
}
function irPag(n) { pag = n; cargar(); }

function abrirModal() {
  editId = null;
  document.getElementById('m-titulo').textContent = 'Nueva materia prima';
  document.getElementById('form').reset();
  document.getElementById('modal').classList.add('open');
}
function cerrar() { document.getElementById('modal').classList.remove('open'); }

function editar(id) {
  const m = datos.find(x => x.id_materia === id); if (!m) return;
  editId = id;
  document.getElementById('m-titulo').textContent = 'Editar: ' + m.nombre;
  document.getElementById('f-nombre').value = m.nombre;
  document.getElementById('f-unidad').value = m.id_unidad || '';
  document.getElementById('f-stock-min').value = m.stock_min || 0;
  document.getElementById('f-stock').value = m.stock || 0;
  document.getElementById('f-costo').value = m.costo_prom || 0;
  document.getElementById('f-prov-display').value = m.proveedor || 'Sin proveedor asignado';
  document.getElementById('f-prov').value = m.id_proveedor || '';
  document.getElementById('modal').classList.add('open');}


async function eliminar(id) {
  if (!confirm('¿Eliminar esta materia prima?')) return;
  const d = await apiFetch(API + '/materias/' + id, { method: 'DELETE' });
  if (!d?.error) { toast('Materia eliminada'); cargar(); } else toast(d.error || 'Error', 'err');
}

async function guardar(e) {
  e.preventDefault();
  const body = editId
    ? {
      nombre: document.getElementById('f-nombre').value,
      id_unidad: document.getElementById('f-unidad').value,
      stock_min: document.getElementById('f-stock-min').value,
    }
    : {
      nombre: document.getElementById('f-nombre').value,
      id_unidad: document.getElementById('f-unidad').value,
      stock_min: document.getElementById('f-stock-min').value,
      stock: 0,
      costo_prom: 0,
    };

  const url = editId ? API + '/materias/' + editId : API + '/materias';
  const method = editId ? 'PUT' : 'POST';
  const d = await apiFetch(url, { method, body: JSON.stringify(body) });
  if (!d?.error) { toast(editId ? 'Materia actualizada' : 'Materia creada'); cerrar(); cargar(); }
  else toast(d.error || 'Error', 'err');
}

document.getElementById('buscar').addEventListener('input', () => { pag = 1; cargar(); });
cargarCatalogos(); cargar();


