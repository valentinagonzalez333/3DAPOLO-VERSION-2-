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
  Number(n || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  });

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

  if (res.status === 401) {
    window.location.href = '/login';
    return null;
  }

  return res.json();
};

// ── Cargar proveedores ─────────────────────────────────────────────────────
const cargarSelectProveedores = async () => {

  const data = await apiFetch(`${API_PROV}?limite=200`);
  if (!data) return;

  const sel = $('#select-proveedor');

  data.datos.forEach(({ id_proveedor, nombre }) => {

    sel.insertAdjacentHTML(
      'beforeend',
      `<option value="${id_proveedor}">
        ${nombre}
      </option>`
    );

  });

  const params = new URLSearchParams(location.search);
  const idUrl  = params.get('id');

  if (idUrl) {
    sel.value = idUrl;
    sel.dispatchEvent(new Event('change'));
  }
};

// ── Cargar productos y materias primas ────────────────────────────────────
const cargarSelectProductos = async () => {

  const [productosData, materiasData] = await Promise.all([
    apiFetch(`${API_PROD}?limite=500`),
    apiFetch(`/api/produccion/materias?limite=500`)
  ]);

  const sel = $('#form-producto');

  sel.innerHTML = '<option value="">— Seleccionar —</option>';

  // ── PRODUCTOS ──
  const productos = productosData?.datos || [];

  if (productos.length) {

    sel.insertAdjacentHTML(
      'beforeend',
      `<optgroup label="Productos"></optgroup>`
    );

    const group = sel.querySelector('optgroup[label="Productos"]');

    productos.forEach(({ id_producto, nombre }) => {

      group.insertAdjacentHTML(
        'beforeend',
        `<option value="producto-${id_producto}">
          ${nombre}
        </option>`
      );

    });
  }

  // ── MATERIAS PRIMAS ──
  const materias = materiasData?.datos || [];

  if (materias.length) {

    sel.insertAdjacentHTML(
      'beforeend',
      `<optgroup label="Materias primas"></optgroup>`
    );

    const group = sel.querySelector('optgroup[label="Materias primas"]');

    materias.forEach(({ id_materia, nombre }) => {

      group.insertAdjacentHTML(
        'beforeend',
        `<option value="materia-${id_materia}">
          ${nombre}
        </option>`
      );

    });
  }
};

// ── Cargar productos del proveedor ─────────────────────────────────────────
const cargarProductosProveedor = async (idProveedor) => {

  const tbody = $('#tabla-body');

  tbody.innerHTML = `
    <tr>
      <td colspan="8" class="cargando">
        Cargando...
      </td>
    </tr>
  `;

  $('#seccion-tabla').style.display = 'block';
  $('#estado-vacio').style.display  = 'none';

  const data = await apiFetch(`${API_PP}/${idProveedor}`);

  if (!data) return;

  tbody.innerHTML = '';

  if (!data.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="cargando">
          Este proveedor no tiene productos asignados
        </td>
      </tr>
    `;

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
      : (p.precio_venta > 0
          ? fmt(p.precio_venta)
          : '<span class="muted">—</span>');

    const margenCol = esMateria
      ? `<span class="muted">N/A</span>`
      : (margen !== null ? `${margen}%` : '—%');

    const preferidoCol = esMateria
      ? `<span class="muted">—</span>`
      : (p.preferido
          ? `<span class="badge badge-verde">⭐ Sí</span>`
          : `<span class="badge badge-amarillo">No</span>`);

    const acciones = esMateria

      ? `
        <button class="btn-icono btn-editar"
          title="Editar costo"
          onclick="abrirEditarMateria(
            ${p.id_producto},
            '${p.nombre.replace(/'/g, "\\'")}',
            ${p.precio_compra}
          )">
          ✏️
        </button>

        <button class="btn-icono btn-elim"
          title="Desasociar"
          onclick="desasociarMateria(
            ${p.id_producto},
            '${p.nombre.replace(/'/g, "\\'")}'
          )">
          🗑
        </button>
      `

      : `
        <button class="btn-icono btn-editar"
          title="Editar"
          onclick="abrirEditarAsignacion(
            ${p.id_prov_prod},
            ${p.id_producto}
          )">
          ✏️
        </button>

        <button class="btn-icono btn-elim"
          title="Quitar"
          onclick="quitarProducto(
            ${p.id_prov_prod},
            '${p.nombre.replace(/'/g, "\\'")}'
          )">
          🗑
        </button>
      `;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <strong>${p.nombre}</strong><br>
          <small class="muted">
            ${p.categoria || '—'}
          </small>
        </td>

        <td>${tipoBadge}</td>

        <td>${fmt(p.precio_compra)}</td>

        <td>${margenCol}</td>

        <td>${precioVentaCol}</td>

        <td>
          ${p.dias_entrega != null
            ? p.dias_entrega + ' días'
            : '— días'}
        </td>

        <td>${preferidoCol}</td>

        <td class="acciones">
          ${acciones}
        </td>
      </tr>
    `);

  });
};

// ── Cambio proveedor ───────────────────────────────────────────────────────
$('#select-proveedor').addEventListener('change', async (e) => {

  const id = e.target.value;

  if (!id) {

    proveedorActivo = null;

    $('#estado-vacio').style.display  = 'block';
    $('#seccion-tabla').style.display = 'none';

    $('#nombre-proveedor-activo').textContent =
      '— Selecciona un proveedor';

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

// ── Modal ──────────────────────────────────────────────────────────────────
const abrirModalAsignar = () => {

  editandoId      = null;
  editandoMateria = null;

  $('#modal-asignar-titulo').textContent =
    'Asignar producto';

  $('#form-asignar').reset();

  $('#row-producto-select').style.display = 'block';

  $('#form-precio-venta-calc').value = '';

  const pvGroup = $('#form-precio-venta-calc')
    .closest('.form-group');

  const prefGroup = document.getElementById('form-preferido')
    ?.closest('.form-group');

  if (pvGroup)   pvGroup.style.display   = 'block';
  if (prefGroup) prefGroup.style.display = 'block';

  $('#modal-asignar').classList.add('visible');
};

const cerrarModalAsignar = () => {

  $('#modal-asignar').classList.remove('visible');

  $('#form-asignar').reset();

  editandoId      = null;
  editandoMateria = null;
};

window.cerrarModalAsignar = cerrarModalAsignar;

// ── Editar materia ─────────────────────────────────────────────────────────
window.abrirEditarMateria = (idMateria, nombre, costoActual) => {

  editandoId      = null;

  editandoMateria = {
    id: idMateria,
    nombre
  };

  $('#modal-asignar-titulo').textContent =
    `Editar costo: ${nombre}`;

  $('#row-producto-select').style.display = 'none';

  $('#form-precio-compra').value = costoActual;

  $('#modal-asignar').classList.add('visible');
};

// ── Calcular precio venta ──────────────────────────────────────────────────
const calcularPrecioVenta = () => {

  const compra = +$('#form-precio-compra').value || 0;
  const margen = +$('#form-margen').value || 0;

  if (compra > 0 && margen > 0 && margen < 100) {

    $('#form-precio-venta-calc').value =
      (compra / (1 - margen / 100)).toFixed(0);

  } else if (compra > 0) {

    $('#form-precio-venta-calc').value = compra;
  }
};

$('#form-precio-compra')
  .addEventListener('input', calcularPrecioVenta);

$('#form-margen')
  .addEventListener('input', calcularPrecioVenta);

// ── Submit ─────────────────────────────────────────────────────────────────
$('#form-asignar').addEventListener('submit', async (e) => {

  e.preventDefault();

  const btn = $('#btn-guardar-asignar');

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const precioCompra = +$('#form-precio-compra').value;

  // ── EDITAR MATERIA ──
  if (editandoMateria) {

    const data = await apiFetch(
      `/api/produccion/materias/${editandoMateria.id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          costo_prom: precioCompra
        }),
      }
    );

    btn.disabled = false;
    btn.textContent = 'Guardar';

    if (data?.error) {
      mostrarToast(data.error, 'error');
      return;
    }

    mostrarToast('Costo actualizado', 'ok');

    cerrarModalAsignar();

    cargarProductosProveedor(proveedorActivo);

    return;
  }

  // ── NUEVO / EDITAR ──
  const precioVenta = +$('#form-precio-venta-calc').value
    || precioCompra;

  const valorSelect = $('#form-producto').value;

  if (!valorSelect) {

    mostrarToast(
      'Selecciona un producto o materia prima',
      'error'
    );

    btn.disabled = false;
    btn.textContent = 'Guardar';

    return;
  }

  const [tipoItem, idItem] = valorSelect.split('-');

  const diasEntrega = $('#form-dias').value
    ? +$('#form-dias').value
    : null;

  const preferido = $('#form-preferido').checked ? 1 : 0;

  let url, method, bodyData;

  if (editandoId) {

    url    = `${API_PP}/${editandoId}`;
    method = 'PUT';

    bodyData = {
      precio_compra: precioCompra,
      dias_entrega: diasEntrega,
      preferido,
    };

  } else {

    url    = API_PP;
    method = 'POST';

    bodyData = {
      id_proveedor: proveedorActivo,
      precio_compra: precioCompra,
      dias_entrega: diasEntrega,
      preferido,
    };

    // ── PRODUCTO ──
    if (tipoItem === 'producto') {
      bodyData.id_producto = +idItem;
    }

    // ── MATERIA ──
    if (tipoItem === 'materia') {
      bodyData.id_materia = +idItem;
    }
  }

  const data = await apiFetch(url, {
    method,
    body: JSON.stringify(bodyData),
  });

  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) {

    mostrarToast(data.error, 'error');

    return;
  }

  mostrarToast(
    data?.mensaje || 'Guardado',
    'ok'
  );

  cerrarModalAsignar();

  cargarProductosProveedor(proveedorActivo);
});

// ── Eliminar ───────────────────────────────────────────────────────────────
window.quitarProducto = async (idPP, nombre) => {

  if (!confirm(`¿Quitar "${nombre}"?`)) return;

  const data = await apiFetch(
    `${API_PP}/${idPP}`,
    { method: 'DELETE' }
  );

  if (data?.error) {
    mostrarToast(data.error, 'error');
    return;
  }

  mostrarToast('Producto quitado', 'ok');

  cargarProductosProveedor(proveedorActivo);
};

// ── Desasociar materia ─────────────────────────────────────────────────────
window.desasociarMateria = async (idMateria, nombre) => {

  if (!confirm(
    `¿Desasociar "${nombre}" de este proveedor?`
  )) return;

  const data = await apiFetch(
    `/api/proveedor-producto/materia/${idMateria}/desasociar`,
    {
      method: 'PATCH',
      body: JSON.stringify({})
    }
  );

  if (data?.error) {
    mostrarToast(data.error, 'error');
    return;
  }

  mostrarToast(
    'Materia desasociada',
    'ok'
  );

  cargarProductosProveedor(proveedorActivo);
};

// ── Toast ──────────────────────────────────────────────────────────────────
const mostrarToast = (msg, tipo = 'ok') => {

  const t = document.createElement('div');

  t.className = `toast toast-${tipo}`;

  t.textContent = msg;

  document.body.appendChild(t);

  setTimeout(() => t.classList.add('visible'), 10);

  setTimeout(() => {

    t.classList.remove('visible');

    setTimeout(() => t.remove(), 400);

  }, 3000);
};

// ── Eventos ────────────────────────────────────────────────────────────────
$('#btn-asignar')
  .addEventListener('click', abrirModalAsignar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModalAsignar();
});

// ── Init ───────────────────────────────────────────────────────────────────
cargarSelectProveedores();