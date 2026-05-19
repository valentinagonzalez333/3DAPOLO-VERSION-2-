
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

const $ = (sel, ctx = document) => ctx.querySelector(sel);

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


const cargarSelectProveedores = async () => {
  const data = await apiFetch(`${API_PROV}?limite=200`);
  if (!data) return;

  const sel = $('#select-proveedor');
  data.datos.forEach(({ id_proveedor, nombre }) => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${id_proveedor}">${nombre}</option>`
    );
  });

  const params = new URLSearchParams(location.search);
  const idUrl  = params.get('id');
  if (idUrl) {
    sel.value = idUrl;
    sel.dispatchEvent(new Event('change'));
  }
};


const cargarProductosProveedor = async (idProveedor) => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="7" class="cargando">Cargando...</td></tr>`;
  $('#seccion-tabla').style.display = 'block';
  $('#estado-vacio').style.display  = 'none';

  const data = await apiFetch(`${API_PP}/${idProveedor}`);
  if (!data) return;

  tbody.innerHTML = '';

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="cargando">Este proveedor no tiene productos asignados</td></tr>`;
    return;
  }

  data.forEach((p) => {
    const margen = p.precio_venta && p.precio_compra
      ? (((p.precio_venta - p.precio_compra) / p.precio_venta) * 100).toFixed(1)
      : '—';

    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><strong>${p.nombre}</strong><br><small class="muted">${p.categoria || '—'}</small></td>
        <td>${fmt(p.precio_compra)}</td>
        <td>${margen}%</td>
        <td>${p.precio_venta > 0 ? fmt(p.precio_venta) : '<span class="muted">—</span>'}</td>
        <td>${p.dias_entrega ?? '—'} días</td>
        <td>${p.preferido ? '<span class="badge badge-verde">⭐ Sí</span>' : '<span class="badge badge-amarillo">No</span>'}</td>
        <td class="acciones">
          <button class="btn-icono btn-editar" title="Editar"
            onclick="abrirEditarAsignacion(${p.id_prov_prod}, ${p.id_producto})">✏️</button>
          <button class="btn-icono btn-elim" title="Quitar"
            onclick="quitarProducto(${p.id_prov_prod}, '${p.nombre}')">🗑</button>
        </td>
      </tr>
    `);
  });
};

$('#select-proveedor').addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) {
    proveedorActivo = null;
    $('#estado-vacio').style.display  = 'block';
    $('#seccion-tabla').style.display = 'none';
    $('#nombre-proveedor-activo').textContent = '— Selecciona un proveedor';
    $('#btn-asignar').disabled = true;
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

const cargarSelectProductos = async () => {
  const data = await apiFetch(`${API_PROD}?limite=500`);
  console.log(data);

  if (!data) return;

  const sel = $('#form-producto');

  sel.innerHTML = '<option value="">— Seleccionar —</option>';

  const productos = data.datos || data;

  productos.forEach(({ id_producto, nombre }) => {
    sel.insertAdjacentHTML(
      'beforeend',
      `<option value="${id_producto}">${nombre}</option>`
    );
  });
};


const abrirModalAsignar = () => {
  editandoId = null;
  $('#modal-asignar-titulo').textContent = 'Asignar producto';
  $('#form-asignar').reset();
  $('#row-producto-select').style.display = 'block';
  $('#form-precio-venta-calc').value = '';
  $('#modal-asignar').classList.add('visible');
};

const cerrarModalAsignar = () => {
  $('#modal-asignar').classList.remove('visible');
  $('#form-asignar').reset();
  editandoId = null;
};
window.cerrarModalAsignar = cerrarModalAsignar;


window.abrirEditarAsignacion = async (idPP, idProducto) => {
  editandoId = idPP;
  const data = await apiFetch(`${API_PP}/detalle/${idPP}`);
  if (!data || data.error) return mostrarToast('Error al cargar', 'error');

  $('#modal-asignar-titulo').textContent = 'Editar asignación';
  $('#row-producto-select').style.display = 'none'; // No se cambia el producto al editar
  $('#form-precio-compra').value = data.precio_compra;
  $('#form-dias').value          = data.dias_entrega || '';
  $('#form-preferido').checked   = !!data.preferido;

  // Calcular margen actual
  if (data.precio_venta && data.precio_compra) {
    const margen = (((data.precio_venta - data.precio_compra) / data.precio_venta) * 100).toFixed(1);
    $('#form-margen').value = margen;
  }

  calcularPrecioVenta();
  $('#modal-asignar').classList.add('visible');
};


const calcularPrecioVenta = () => {
  const compra = +$('#form-precio-compra').value || 0;
  const margen = +$('#form-margen').value || 0;
  if (compra > 0 && margen > 0 && margen < 100) {
    $('#form-precio-venta-calc').value = (compra / (1 - margen / 100)).toFixed(0);
  } else if (compra > 0) {
    $('#form-precio-venta-calc').value = compra;
  }
};

$('#form-precio-compra').addEventListener('input', calcularPrecioVenta);
$('#form-margen').addEventListener('input', calcularPrecioVenta);

$('#form-asignar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#btn-guardar-asignar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const precioCompra = +$('#form-precio-compra').value;
  const precioVenta  = +$('#form-precio-venta-calc').value || precioCompra;
  const idProducto   = +$('#form-producto').value;
  const diasEntrega  = $('#form-dias').value ? +$('#form-dias').value : null;
  const preferido    = $('#form-preferido').checked ? 1 : 0;

  let url, method, body;

  if (editandoId) {

    url    = `${API_PP}/${editandoId}`;
    method = 'PUT';
    body   = { precio_compra: precioCompra, dias_entrega: diasEntrega, preferido };
  } else {
  
    if (!idProducto) {
      mostrarToast('Selecciona un producto', 'error');
      btn.disabled = false;
      btn.textContent = 'Guardar';
      return;
    }
    url    = API_PP;
    method = 'POST';
    body   = {
      id_proveedor: proveedorActivo,
      id_producto:  idProducto,
      precio_compra: precioCompra,
      dias_entrega:  diasEntrega,
      preferido,
    };
  }

  const data = await apiFetch(url, { method, body: JSON.stringify(body) });
  btn.disabled = false;
  btn.textContent = 'Guardar';

  if (data?.error) { mostrarToast(data.error, 'error'); return; }

  // Actualizar precio_venta y costo_prom en el producto
  if (precioVenta > 0 && idProducto) {
    await apiFetch(`${API_PROD}/${editandoId ? (await apiFetch(`${API_PP}/detalle/${editandoId}`))?.id_producto : idProducto}`, {
      method: 'PUT',
      body: JSON.stringify({ precio_venta: precioVenta, costo_prom: precioCompra }),
    });
  }

  mostrarToast(data?.mensaje || 'Guardado', 'ok');
  cerrarModalAsignar();
  cargarProductosProveedor(proveedorActivo);
});


window.quitarProducto = async (idPP, nombre) => {
  if (!confirm(`¿Quitar "${nombre}" de este proveedor?`)) return;
  const data = await apiFetch(`${API_PP}/${idPP}`, { method: 'DELETE' });
  if (data?.error) return mostrarToast(data.error, 'error');
  mostrarToast('Producto quitado', 'ok');
  cargarProductosProveedor(proveedorActivo);
};

const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

$('#btn-asignar').addEventListener('click', abrirModalAsignar);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarModalAsignar();
});

cargarSelectProveedores();