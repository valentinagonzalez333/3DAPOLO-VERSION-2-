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
let editandoId = null;
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

// ─────────────────────────────────────────────────────────────
// PROVEEDORES
// ─────────────────────────────────────────────────────────────

const cargarSelectProveedores = async () => {
  const data = await apiFetch(`${API_PROV}?limite=200`);
  if (!data) return;

  const sel = $('#select-proveedor');

  data.datos.forEach(({ id_proveedor, nombre }) => {
    sel.insertAdjacentHTML(
      'beforeend',
      `<option value="${id_proveedor}">${nombre}</option>`
    );
  });

  const params = new URLSearchParams(location.search);
  const idUrl = params.get('id');

  if (idUrl) {
    sel.value = idUrl;
    sel.dispatchEvent(new Event('change'));
  }
};

// ─────────────────────────────────────────────────────────────
// TABLA PRODUCTOS / MATERIAS
// ─────────────────────────────────────────────────────────────

const cargarProductosProveedor = async (idProveedor) => {
  const tbody = $('#tabla-body');

  tbody.innerHTML =
    `<tr><td colspan="8" class="cargando">Cargando...</td></tr>`;

  $('#seccion-tabla').style.display = 'block';
  $('#estado-vacio').style.display = 'none';

  const data = await apiFetch(`${API_PP}/${idProveedor}`);

  if (!data) return;

  tbody.innerHTML = '';

  if (!data.length) {
    tbody.innerHTML =
      `<tr><td colspan="8" class="cargando">
        Este proveedor no tiene productos asignados
      </td></tr>`;
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
      : (
          p.preferido
            ? `<span class="badge badge-verde">⭐ Sí</span>`
            : `<span class="badge badge-amarillo">No</span>`
        );

    const acciones = esMateria
      ? `
        <button
          class="btn-icono btn-editar"
          title="Editar costo"
          onclick="abrirEditarMateria(
            ${p.id_producto},
            '${p.nombre.replace(/'/g, "\\'")}',
            ${p.precio_compra}
          )"
        >✏️</button>

        <button
          class="btn-icono btn-elim"
          title="Desasociar"
          onclick="desasociarMateria(
            ${p.id_producto},
            '${p.nombre.replace(/'/g, "\\'")}'
          )"
        >🗑</button>
      `
      : `
        <button
          class="btn-icono btn-editar"
          title="Editar"
          onclick="abrirEditarAsignacion(
            ${p.id_prov_prod},
            ${p.id_producto}
          )"
        >✏️</button>

        <button
          class="btn-icono btn-elim"
          title="Quitar"
          onclick="quitarProducto(
            ${p.id_prov_prod},
            '${p.nombre.replace(/'/g, "\\'")}'
          )"
        >🗑</button>
      `;

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td>
          <strong>${p.nombre}</strong><br>
          <small class="muted">${p.categoria || '—'}</small>
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

// ─────────────────────────────────────────────────────────────
// CAMBIO PROVEEDOR
// ─────────────────────────────────────────────────────────────

$('#select-proveedor').addEventListener('change', async (e) => {

  const id = e.target.value;

  if (!id) {
    proveedorActivo = null;

    $('#estado-vacio').style.display = 'block';
    $('#seccion-tabla').style.display = 'none';

    $('#nombre-proveedor-activo').textContent =
      '— Selecciona un proveedor';

    $('#btn-asignar').disabled = true;
    $('#buscar-input').disabled = true;

    return;
  }

  proveedorActivo = +id;

  const opt = e.target.options[e.target.selectedIndex];

  $('#nombre-proveedor-activo').textContent = opt.text;

  $('#btn-asignar').disabled = false;
  $('#buscar-input').disabled = false;

  await cargarProductosProveedor(id);
  await cargarSelectProductos();
});

// ─────────────────────────────────────────────────────────────
// SELECT PRODUCTOS + MATERIAS
// ─────────────────────────────────────────────────────────────

const cargarSelectProductos = async () => {

  const [productos, materias] = await Promise.all([
    apiFetch(`${API_PROD}?limite=500&tipo=comprado`),
    apiFetch(`/api/produccion/materias?limite=500`)
  ]);

  const sel = $('#form-producto');

  sel.innerHTML =
    '<option value="">— Seleccionar —</option>';

  // PRODUCTOS

  (productos?.datos || []).forEach(({ id_producto, nombre }) => {

    sel.insertAdjacentHTML(
      'beforeend',
      `
      <option value="prod-${id_producto}">
        🛒 ${nombre}
      </option>
      `
    );
  });

  // MATERIAS

  (materias?.datos || []).forEach(({ id_materia, nombre }) => {

    sel.insertAdjacentHTML(
      'beforeend',
      `
      <option value="mat-${id_materia}">
        🧱 ${nombre}
      </option>
      `
    );
  });
};

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────

const abrirModalAsignar = () => {
  editandoId = null;
  editandoMateria = null;

  $('#modal-asignar-titulo').textContent = 'Asignar producto';
  $('#form-asignar').reset();
  

  $('#form-producto').required = true; 

  $('#row-producto-select').style.display = 'block';
  

  $('#form-precio-venta-calc').value = '';

  const pvGroup =
    $('#form-precio-venta-calc').closest('.form-group');

  const prefGroup =
    document.getElementById('form-preferido')
      ?.closest('.form-group');

  if (pvGroup) pvGroup.style.display = 'block';
  if (prefGroup) prefGroup.style.display = 'block';

  $('#modal-asignar').classList.add('visible');
};

const cerrarModalAsignar = () => {

  $('#modal-asignar').classList.remove('visible');

  $('#form-asignar').reset();

  editandoId = null;
  editandoMateria = null;

  $('#row-producto-select').style.display = 'block';

  const pvGroup =
    $('#form-precio-venta-calc').closest('.form-group');

  const prefGroup =
    document.getElementById('form-preferido')
      ?.closest('.form-group');

  if (pvGroup) pvGroup.style.display = 'block';
  if (prefGroup) prefGroup.style.display = 'block';
};

window.cerrarModalAsignar = cerrarModalAsignar;

// ─────────────────────────────────────────────────────────────
// EDITAR ASIGNACIÓN
// ─────────────────────────────────────────────────────────────

window.abrirEditarAsignacion = async (idPP) => {

  if (!idPP || isNaN(idPP)) {
    mostrarToast('ID inválido', 'error');
    return;
  }

editandoId = idPP;
  editandoMateria = null;

  const data = await apiFetch(`${API_PP}/detalle/${idPP}`);

  if (!data || data.error) {
    mostrarToast('Error al cargar', 'error');
    return;
  }

 $('#modal-asignar-titulo').textContent = 'Editar asignación';
  $('#row-producto-select').style.display = 'none';
$('#form-producto').required = false; 

  $('#form-precio-compra').value = data.precio_compra;
  $('#form-dias').value = data.dias_entrega || '';
  $('#form-preferido').checked = !!data.preferido;

  const pvGroup =
    $('#form-precio-venta-calc').closest('.form-group');

  const prefGroup =
    document.getElementById('form-preferido')
      ?.closest('.form-group');

  if (pvGroup) pvGroup.style.display = 'block';
  if (prefGroup) prefGroup.style.display = 'block';

  if (data.precio_venta && data.precio_compra) {

    const margen =
      (((data.precio_venta - data.precio_compra)
      / data.precio_venta) * 100).toFixed(1);

    $('#form-margen').value = margen;
  }

  calcularPrecioVenta();

  $('#modal-asignar').classList.add('visible');
};

// ─────────────────────────────────────────────────────────────
// EDITAR MATERIA
// ─────────────────────────────────────────────────────────────

window.abrirEditarMateria = (
  idMateria,
  nombre,
  costoActual
) => {

  editandoId = null;
  editandoMateria = { id: idMateria, nombre };

  $('#modal-asignar-titulo').textContent = `Editar costo: ${nombre}`;
  $('#row-producto-select').style.display = 'none';
  
  
  $('#form-producto').required = false; 

  $('#form-precio-compra').value = costoActual;

  $('#form-margen').value = '';
  $('#form-precio-venta-calc').value = '';
  $('#form-dias').value = '';

  $('#form-preferido').checked = false;

  const pvGroup =
    $('#form-precio-venta-calc').closest('.form-group');

  const prefGroup =
    document.getElementById('form-preferido')
      ?.closest('.form-group');

  if (pvGroup) pvGroup.style.display = 'none';
  if (prefGroup) prefGroup.style.display = 'none';

  $('#modal-asignar').classList.add('visible');
};

// ─────────────────────────────────────────────────────────────
// CALCULAR
// ─────────────────────────────────────────────────────────────

const calcularPrecioVenta = () => {

  const compra =
    +$('#form-precio-compra').value || 0;

  const margen =
    +$('#form-margen').value || 0;

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

// ─────────────────────────────────────────────────────────────
// GUARDAR
// ─────────────────────────────────────────────────────────────

$('#form-asignar').addEventListener('submit', async (e) => {

  e.preventDefault();

  const btn = $('#btn-guardar-asignar');

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const precioCompra =
    +$('#form-precio-compra').value;

  // EDITAR MATERIA

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

  // PRODUCTO / MATERIA NUEVA

  const precioVenta =
    +$('#form-precio-venta-calc').value || precioCompra;

  const valorSelect =
    $('#form-producto').value;

  let idProducto = null;
  let idMateria = null;

  if (valorSelect.startsWith('prod-')) {
    idProducto =
      +valorSelect.replace('prod-', '');
  }

  if (valorSelect.startsWith('mat-')) {
    idMateria =
      +valorSelect.replace('mat-', '');
  }

  const diasEntrega =
    $('#form-dias').value
      ? +$('#form-dias').value
      : null;

  const preferido =
    $('#form-preferido').checked ? 1 : 0;

  let url;
  let method;
  let bodyData;

  if (editandoId) {

    url = `${API_PP}/${editandoId}`;

    method = 'PUT';

    bodyData = {
      precio_compra: precioCompra,
      dias_entrega: diasEntrega,
      preferido
    };

  } else {

    if (!idProducto && !idMateria) {

      mostrarToast(
        'Selecciona un producto o materia',
        'error'
      );

      btn.disabled = false;
      btn.textContent = 'Guardar';

      return;
    }

    url = API_PP;

    method = 'POST';

    bodyData = {
      id_proveedor: proveedorActivo,
      id_producto: idProducto,
      id_materia: idMateria,
      precio_compra: precioCompra,
      dias_entrega: diasEntrega,
      preferido,
    };
  }

  const data = await apiFetch(url, {
    method,
    body: JSON.stringify(bodyData)
  });

  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) {
    mostrarToast(data.error, 'error');
    return;
  }

  const idProdFinal = editandoId
    ? (await apiFetch(`${API_PP}/detalle/${editandoId}`))
        ?.id_producto
    : idProducto;

  if (precioVenta > 0 && idProdFinal) {

    await apiFetch(`${API_PROD}/${idProdFinal}`, {
      method: 'PUT',
      body: JSON.stringify({
        precio_venta: precioVenta,
        costo_prom: precioCompra
      }),
    });
  }

  mostrarToast(data?.mensaje || 'Guardado', 'ok');

  cerrarModalAsignar();

  cargarProductosProveedor(proveedorActivo);
});

// ─────────────────────────────────────────────────────────────
// QUITAR
// ─────────────────────────────────────────────────────────────

window.quitarProducto = async (idPP, nombre) => {

  if (!idPP || isNaN(+idPP)) {

    mostrarToast(
      'No se puede quitar este item',
      'error'
    );

    return;
  }

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

// ─────────────────────────────────────────────────────────────
// DESASOCIAR MATERIA
// ─────────────────────────────────────────────────────────────

window.desasociarMateria = async (
  idMateria,
  nombre
) => {

  if (!confirm(
    `¿Desasociar "${nombre}" del proveedor?`
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

// ─────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────

const mostrarToast = (msg, tipo = 'ok') => {

  const t = document.createElement('div');

  t.className = `toast toast-${tipo}`;

  t.textContent = msg;

  document.body.appendChild(t);

  setTimeout(() => {
    t.classList.add('visible');
  }, 10);

  setTimeout(() => {

    t.classList.remove('visible');

    setTimeout(() => {
      t.remove();
    }, 400);

  }, 3000);
};

// ─────────────────────────────────────────────────────────────
// EVENTOS
// ─────────────────────────────────────────────────────────────

$('#btn-asignar')
  .addEventListener('click', abrirModalAsignar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModalAsignar();
});

// ─────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────

cargarSelectProveedores();