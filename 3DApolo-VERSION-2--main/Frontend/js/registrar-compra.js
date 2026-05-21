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



const $ = (sel, ctx = document) => ctx.querySelector(sel);
const API = '/api/compras';

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

let detalle = [];
let productosProveedor = []; 
let timerBusca;


const cargarProveedores = async () => {
  const data = await apiFetch('/api/proveedores?limite=100');
  if (!data) return;
  const sel = $('#sel-proveedor');
  data.datos.forEach(p => {
    sel.insertAdjacentHTML('beforeend',
      `<option value="${p.id_proveedor}">${p.nombre}</option>`
    );
  });
};


$('#sel-proveedor').addEventListener('change', async () => {
  const idProv = $('#sel-proveedor').value;


  detalle = [];
  productosProveedor = [];
  renderDetalle();
  renderDropdownProveedor([]);
  $('#buscar-item').value = '';
  $('#buscar-item').disabled = true;
  $('#buscar-item').placeholder = 'Selecciona un proveedor primero...';

  if (!idProv) return;

  const data = await apiFetch(`/api/proveedor-producto/${idProv}`);
  if (!data) return;

  if (!data.length) {
    mostrarToast('Este proveedor no tiene productos asignados', 'error');
    return;
  }

  productosProveedor = data;
  $('#buscar-item').disabled = false;
  $('#buscar-item').placeholder = `Buscar entre ${data.length} producto${data.length !== 1 ? 's' : ''} del proveedor...`;
});


$('#buscar-item').addEventListener('input', (e) => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(() => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderDropdownProveedor([]); return; }

    const filtrados = productosProveedor.filter(p =>
      p.nombre.toLowerCase().includes(q)
    );
    renderDropdownProveedor(filtrados);
  }, 200);
});


const renderDropdownProveedor = (items) => {
  const lista = $('#lista-items');

  if (!items.length) {
    lista.innerHTML = productosProveedor.length
      ? `<div class="item-vacio">Sin coincidencias</div>`
      : '';
    return;
  }

  lista.innerHTML = items.map(p => `
    <div class="item-row"
      onclick="agregarDesdeProveedor(${p.id_producto}, '${p.nombre.replace(/'/g, "\\'")}', ${p.precio_compra}, ${p.stock}, '${p.tipo || 'producto'}')"> 
      <span class="item-nombre">${p.nombre}</span>
      <span class="item-tipo badge ${p.tipo === 'materia' ? 'badge-verde' : 'badge-azul'}">${p.tipo === 'materia' ? 'Materia Prima' : 'Producto'}</span>
      <span class="item-precio">$${(+p.precio_compra).toLocaleString('es-CO')}</span>
    </div>
  `).join('');
};


$('#buscar-item').addEventListener('focus', () => {
  if (!productosProveedor.length) return;
  const q = $('#buscar-item').value.trim().toLowerCase();
  const filtrados = q
    ? productosProveedor.filter(p => p.nombre.toLowerCase().includes(q))
    : productosProveedor;
  renderDropdownProveedor(filtrados);
});


window.agregarDesdeProveedor = (id, nombre, precio, stock, tipo = 'producto') => {
  if (detalle.find(d => d.id === id && d.tipo === tipo)) {
    mostrarToast(`"${nombre}" ya está en la lista`, 'error');
    return;
  }
  detalle.push({
    id,
    nombre,
    precio_unit: +precio,
    tipo:  tipo, // 👈 Guardamos el tipo real proveniente de la base de datos
    stock: +stock,
    cantidad: 1,
  });
  $('#buscar-item').value = '';
  $('#lista-items').innerHTML = '';
  renderDetalle();
};


const renderDetalle = () => {
  const tbody = $('#detalle-body');

  if (!detalle.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="cargando">Sin items agregados</td></tr>`;
    calcularTotales();
    return;
  }

  tbody.innerHTML = detalle.map((d, i) => `
    <tr>
      <td>
        <strong>${d.nombre}</strong><br>
        <small class="muted">${d.tipo === 'producto' ? 'Producto' : 'Materia prima'}</small>
      </td>
      <td>
        <input type="number" class="inp-cant" min="1" value="${d.cantidad}"
          onchange="actualizarCantidad(${i}, this.value)">
      </td>
      <td>
        <input type="number" class="inp-precio" min="0" step="0.01" value="${d.precio_unit}"
          onchange="actualizarPrecio(${i}, this.value)">
      </td>
      <td>
        <strong>$${(d.cantidad * d.precio_unit).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
      </td>
      <td>
        <button class="btn-icono rojo" onclick="quitarItem(${i})" title="Quitar">🗑</button>
      </td>
    </tr>
  `).join('');

  calcularTotales();
};

window.actualizarCantidad = (i, val) => {
  detalle[i].cantidad = Math.max(1, +val || 1);
  renderDetalle();
};

window.actualizarPrecio = (i, val) => {
  detalle[i].precio_unit = Math.max(0, +val || 0);
  renderDetalle();
};

window.quitarItem = (i) => {
  detalle.splice(i, 1);
  renderDetalle();
};


const calcularTotales = () => {
  const subtotal = detalle.reduce((s, d) => s + d.cantidad * d.precio_unit, 0);
  const pct      = +($('#inp-impuesto').value) || 0;
  const impuesto = subtotal * pct / 100;
  const total    = subtotal + impuesto;

  $('#lbl-subtotal').textContent = `$${subtotal.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
  $('#lbl-impuesto').textContent = `$${impuesto.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
  $('#lbl-total').textContent    = `$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
};

$('#inp-impuesto').addEventListener('input', calcularTotales);


document.addEventListener('click', (e) => {
  if (!e.target.closest('.buscar-wrap')) $('#lista-items').innerHTML = '';
});


$('#form-compra').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!$('#sel-proveedor').value) {
    mostrarToast('Selecciona un proveedor', 'error');
    return;
  }
  if (!detalle.length) {
    mostrarToast('Agrega al menos un producto', 'error');
    return;
  }

  const btn = $('#btn-guardar');
  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const subtotal = detalle.reduce((s, d) => s + d.cantidad * d.precio_unit, 0);
  const pct      = +($('#inp-impuesto').value) || 0;
  const impuesto = subtotal * pct / 100;

  const payload = {
    id_proveedor: +$('#sel-proveedor').value,
    fecha:        $('#inp-fecha').value,
    subtotal:     +subtotal.toFixed(2),
    impuesto:     +impuesto.toFixed(2),
    total:        +(subtotal + impuesto).toFixed(2),
    notas:        $('#inp-notas').value || null,
   detalle: detalle.map(d => ({
  id_producto: d.id,
  cantidad:    d.cantidad,
  precio_unit: d.precio_unit,
  tipo_item:   d.tipo,   // 'producto' o 'materia'
})),
  };

  const data = await apiFetch(API, { method: 'POST', body: JSON.stringify(payload) });

  btn.disabled = false;
  btn.textContent = 'Registrar compra';

  if (data?.error) { mostrarToast(data.error, 'error'); return; }

  mostrarToast('Compra registrada correctamente', 'ok');
  detalle = [];
  productosProveedor = [];
  renderDetalle();
  $('#form-compra').reset();
  $('#buscar-item').disabled = true;
  $('#buscar-item').placeholder = 'Selecciona un proveedor primero...';
  $('#inp-fecha').value = new Date().toISOString().split('T')[0];
});


const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};


$('#inp-fecha').value = new Date().toISOString().split('T')[0];
$('#buscar-item').disabled = true;
$('#buscar-item').placeholder = 'Selecciona un proveedor primero...';
cargarProveedores();
renderDetalle();