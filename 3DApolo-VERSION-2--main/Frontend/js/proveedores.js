
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

const API = '/api/proveedores';

let estado = {
  pagina: 1,
  limite: 20,
  buscar: '',
  editandoId: null,
};

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const fmt = (n) =>
  Number(n).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

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

const cargarProveedores = async () => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="7" class="cargando">Cargando...</td></tr>`;

  const params = new URLSearchParams({
    pagina: estado.pagina,
    limite: estado.limite,
    buscar: estado.buscar,
  });

  const data = await apiFetch(`${API}?${params}`);
  if (!data) return;

  tbody.innerHTML = '';

  if (!data.datos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="cargando">Sin proveedores</td></tr>`;
    renderPaginacion(data.paginacion);
    return;
  }

  data.datos.forEach((p) => {
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.nit || '—'}</td>
        <td>${p.telefono || '—'}</td>
        <td>${p.ciudad || '—'}</td>
        <td>${p.correo || '—'}</td>
        <td>
          <a href="/productos-proveedor?id=${p.id_proveedor}" class="btn-icono btn-ver" title="Ver productos">
            📦 ${p.total_productos ?? 0}
          </a>
        </td>
        <td class="acciones">
          <button class="btn-icono btn-ver"    title="Ver"     onclick="verProveedor(${p.id_proveedor})">👁</button>
          <button class="btn-icono btn-editar" title="Editar"  onclick="abrirEditar(${p.id_proveedor})">✏️</button>
          <button class="btn-icono btn-elim"   title="Eliminar" onclick="eliminarProveedor(${p.id_proveedor}, '${p.nombre}')">🗑</button>
        </td>
      </tr>
    `);
  });

  renderPaginacion(data.paginacion);
};


const renderPaginacion = ({ pagina, paginas, total }) => {
  const el = $('#paginacion');
  el.innerHTML = '';
  $('#total-count').textContent = `${total} proveedor${total !== 1 ? 'es' : ''}`;
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

window.cambiarPagina = (p) => { estado.pagina = p; cargarProveedores(); };


const abrirModal = (titulo = 'Nuevo proveedor') => {
  $('#modal-titulo').textContent = titulo;
  $('#modal-proveedor').classList.add('visible');
};

const cerrarModal = () => {
  $('#modal-proveedor').classList.remove('visible');
  $('#form-proveedor').reset();
  estado.editandoId = null;
};
window.cerrarModal = cerrarModal;

$('#form-proveedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const body = {
    nombre:    $('#form-nombre').value,
    nit:       $('#form-nit').value,
    telefono:  $('#form-telefono').value,
    correo:    $('#form-correo').value,
    ciudad:    $('#form-ciudad').value,
    direccion: $('#form-direccion').value,
  };

  const url    = estado.editandoId ? `${API}/${estado.editandoId}` : API;
  const method = estado.editandoId ? 'PUT' : 'POST';

  const data = await apiFetch(url, { method, body: JSON.stringify(body) });
  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) { mostrarToast(data.error, 'error'); return; }
  mostrarToast(data?.mensaje || 'Guardado', 'ok');
  cerrarModal();
  cargarProveedores();
});


window.abrirEditar = async (id) => {
  estado.editandoId = id;
  const data = await apiFetch(`${API}/${id}`);
  if (!data || data.error) return mostrarToast('Error al cargar proveedor', 'error');

  abrirModal('Editar proveedor');
  $('#form-nombre').value    = data.nombre;
  $('#form-nit').value       = data.nit || '';
  $('#form-telefono').value  = data.telefono || '';
  $('#form-correo').value    = data.correo || '';
  $('#form-ciudad').value    = data.ciudad || '';
  $('#form-direccion').value = data.direccion || '';
};


window.verProveedor = async (id) => {
  const data = await apiFetch(`${API}/${id}`);
  if (!data) return;

  $('#detalle-contenido').innerHTML = `
    <div class="detalle-grid">
      <div class="detalle-item"><label>Nombre</label><span>${data.nombre}</span></div>
      <div class="detalle-item"><label>NIT</label><span>${data.nit || '—'}</span></div>
      <div class="detalle-item"><label>Teléfono</label><span>${data.telefono || '—'}</span></div>
      <div class="detalle-item"><label>Correo</label><span>${data.correo || '—'}</span></div>
      <div class="detalle-item"><label>Ciudad</label><span>${data.ciudad || '—'}</span></div>
      <div class="detalle-item span-2"><label>Dirección</label><span>${data.direccion || '—'}</span></div>
      <div class="detalle-item"><label>Registrado</label>
        <span>${new Date(data.fecha_reg).toLocaleDateString('es-CO')}</span>
      </div>
    </div>
    <div style="margin-top:16px">
      <a href="/productos-proveedor?id=${data.id_proveedor}" class="btn-primario" style="display:inline-flex;gap:6px;align-items:center">
        <i data-lucide="package-search"></i> Ver productos asignados
      </a>
    </div>
  `;
  $('#modal-detalle').classList.add('visible');
  lucide.createIcons();
};

window.cerrarDetalle = () => $('#modal-detalle').classList.remove('visible');


window.eliminarProveedor = async (id, nombre) => {
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
  const data = await apiFetch(`${API}/${id}`, { method: 'DELETE' });
  if (data?.error) return mostrarToast(data.error, 'error');
  mostrarToast('Proveedor eliminado', 'ok');
  cargarProveedores();
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
    cargarProveedores();
  }, 350);
});

$('#btn-nuevo').addEventListener('click', () => {
  estado.editandoId = null;
  abrirModal('Nuevo proveedor');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { cerrarModal(); cerrarDetalle(); }
});

cargarProveedores();