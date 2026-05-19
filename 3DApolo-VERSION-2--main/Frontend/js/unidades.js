const body = document.body;
const mode = document.getElementById('btn_modo');

if (localStorage.getItem('mode') === 'dark') {
  body.classList.add('dark-mode');
  if (mode) mode.checked = true;
}

mode?.addEventListener('change', () => {
  const isDark = body.classList.toggle('dark-mode');
  localStorage.setItem('mode', isDark ? 'dark' : 'light');
});

const API = '/api/unidades';

let estado = {
  pagina: 1,
  limite: 20,
  buscar: '',
  editandoId: null,
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);

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

const cargarUnidades = async () => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="4" class="cargando">Cargando...</td></tr>`;

  const params = new URLSearchParams({
    pagina: estado.pagina,
    limite: estado.limite,
    buscar: estado.buscar,
  });

  const data = await apiFetch(`${API}?${params}`);
  if (!data) return;

  tbody.innerHTML = '';

  if (!data.datos.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="cargando">Sin unidades registradas</td></tr>`;
    renderPaginacion(data.paginacion);
    return;
  }

  data.datos.forEach((u, i) => {
    const num = (estado.pagina - 1) * estado.limite + i + 1;
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td class="muted">${num}</td>
        <td><strong>${u.nombre}</strong></td>
        <td><span class="badge badge-gris">${u.abrev}</span></td>
        <td>
          <div class="acciones">
            <button class="btn-icono" title="Editar"
              onclick="abrirEditar(${u.id_unidad})">✏️</button>
            <button class="btn-icono rojo" title="Eliminar"
              onclick="eliminarUnidad(${u.id_unidad}, '${u.nombre}')">🗑</button>
          </div>
        </td>
      </tr>
    `);
  });

  renderPaginacion(data.paginacion);
};

const renderPaginacion = ({ pagina, paginas, total }) => {
  const el = $('#paginacion');
  el.innerHTML = '';
  $('#total-count').textContent = `${total} unidad${total !== 1 ? 'es' : ''}`;
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

window.cambiarPagina = (p) => { estado.pagina = p; cargarUnidades(); };

const abrirModal = (titulo = 'Nueva unidad') => {
  $('#modal-titulo').textContent = titulo;
  $('#modal-unidad').classList.add('visible');
};

const cerrarModal = () => {
  $('#modal-unidad').classList.remove('visible');
  $('#form-unidad').reset();
  estado.editandoId = null;
};
window.cerrarModal = cerrarModal;

$('#form-unidad').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const body = {
    nombre: $('#form-nombre').value.trim(),
    abrev:  $('#form-abrev').value.trim(),
  };

  const url    = estado.editandoId ? `${API}/${estado.editandoId}` : API;
  const method = estado.editandoId ? 'PUT' : 'POST';

  const data = await apiFetch(url, { method, body: JSON.stringify(body) });
  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) { mostrarToast(data.error, 'error'); return; }
  mostrarToast(data?.mensaje || 'Guardado', 'ok');
  cerrarModal();
  cargarUnidades();
});

window.abrirEditar = async (id) => {
  estado.editandoId = id;
  const data = await apiFetch(`${API}/${id}`);
  if (!data || data.error) return mostrarToast('Error al cargar unidad', 'error');

  abrirModal('Editar unidad');
  $('#form-nombre').value = data.nombre;
  $('#form-abrev').value  = data.abrev;
};

window.eliminarUnidad = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"? Los productos asignados quedarán sin unidad.`)) return;
  const data = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (data?.error) return mostrarToast(data.error, 'error');
  mostrarToast('Unidad eliminada', 'ok');
  cargarUnidades();
};

const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

let timer;
$('#buscar-input').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    estado.buscar = e.target.value;
    estado.pagina = 1;
    cargarUnidades();
  }, 350);
});

$('#btn-nuevo').addEventListener('click', () => {
  estado.editandoId = null;
  abrirModal('Nueva unidad');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModal();
});

cargarUnidades();