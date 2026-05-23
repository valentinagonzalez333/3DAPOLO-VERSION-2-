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


const $ = (sel, ctx = document) => ctx.querySelector(sel);

const apiFetch = async (url) => {
  const token = localStorage.getItem('token') || '';
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) { window.location.href = '/login'; return null; }
  return res.json();
};

const fmt = (n) =>
  Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 });

const TIPOS = {
  compra:          { label: 'Compra',             dir: 'entrada', cls: 'badge-azul'     },
  produccion:      { label: 'Producción',         dir: 'entrada', cls: 'badge-azul'     },
  ajuste_entrada:  { label: 'Ajuste entrada',     dir: 'entrada', cls: 'badge-verde'    },
  dev_entrada:     { label: 'Devolución entrada', dir: 'entrada', cls: 'badge-verde'    },
  venta:           { label: 'Venta',              dir: 'salida',  cls: 'badge-naranja'  },
  ajuste_salida:   { label: 'Ajuste salida',      dir: 'salida',  cls: 'badge-amarillo' },
  dev_salida:      { label: 'Devolución salida',  dir: 'salida',  cls: 'badge-rojo'     },
};

let estado = {
  pagina: 1,
  limite: 30,
  buscar: '',
  tipo:   '',
  desde:  '',
  hasta:  '',
};

const hoy = new Date();
$('#fil-desde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
$('#fil-hasta').value = hoy.toISOString().split('T')[0];
estado.desde = $('#fil-desde').value;
estado.hasta = $('#fil-hasta').value;


const cargarMovimientos = async () => {
  const tbody = $('#tabla-body');
  tbody.innerHTML = `<tr><td colspan="8" class="cargando">Cargando...</td></tr>`;

  const params = new URLSearchParams({
    pagina: estado.pagina,
    limite: estado.limite,
    buscar: estado.buscar,
    tipo:   estado.tipo,
    desde:  estado.desde,
    hasta:  estado.hasta,
  });

  const data = await apiFetch(`/api/movimientos?${params}`);
  if (!data || data.error) {
    tbody.innerHTML = `<tr><td colspan="8" class="cargando">Error al cargar</td></tr>`;
    return;
  }

  renderCards(data.resumen);
  renderTabla(data.datos);
  renderPaginacion(data.paginacion);
  $('#total-count').textContent = `${data.paginacion.total} movimiento${data.paginacion.total !== 1 ? 's' : ''}`;
};


const renderCards = (r) => {
  $('#ci-total').textContent    = r.total     || 0;
  $('#ci-entradas').textContent = r.entradas  || 0;
  $('#ci-salidas').textContent  = r.salidas   || 0;
  $('#ci-valor').textContent    = fmt(r.valor_total);
};


const renderTabla = (datos) => {
  const tbody = $('#tabla-body');

  if (!datos.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="cargando">Sin movimientos en el periodo</td></tr>`;
    return;
  }

  tbody.innerHTML = datos.map(m => {
    const info = TIPOS[m.tipo] || { label: m.tipo, dir: '—', cls: 'badge-gris' };
    const esEntrada = info.dir === 'entrada';
    const cantidad  = Math.abs(m.cantidad);
    const valor     = cantidad * +m.costo_unit;

    const dirBadge = esEntrada
      ? `<span class="mov-dir entrada">↑ Entrada</span>`
      : `<span class="mov-dir salida">↓ Salida</span>`;

    const fecha = new Date(m.fecha);
    const fechaStr = fecha.toLocaleDateString('es-CO');
    const horaStr  = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    return `
      <tr>
        <td>
          <strong>${fechaStr}</strong><br>
          <small class="muted">${horaStr}</small>
        </td>
        <td><strong>${m.producto}</strong></td>
        <td><span class="badge ${info.cls}">${info.label}</span></td>
        <td>${dirBadge}</td>
        <td>
          <strong class="${esEntrada ? 'texto-verde' : 'texto-rojo'}">
            ${esEntrada ? '+' : '-'}${cantidad}
          </strong>
        </td>
        <td>${fmt(m.costo_unit)}</td>
        <td><strong>${fmt(valor)}</strong></td>
        <td><span class="muted">${m.usuario || '—'}</span></td>
      </tr>
    `;
  }).join('');
};


const renderPaginacion = ({ pagina, paginas, total }) => {
  const el = $('#paginacion');
  el.innerHTML = '';
  if (paginas <= 1) return;

  const btn = (label, pg, disabled = false) =>
    `<button class="btn-pag${pg === pagina ? ' activo' : ''}" ${disabled ? 'disabled' : ''}
      onclick="cambiarPagina(${pg})">${label}</button>`;

  el.insertAdjacentHTML('beforeend', btn('‹', pagina - 1, pagina === 1));
  for (let i = 1; i <= paginas; i++) {
    if (paginas > 7 && i > 2 && i < paginas - 1 && Math.abs(i - pagina) > 1) {
      if (i === 3 || i === paginas - 2) el.insertAdjacentHTML('beforeend', '<span>…</span>');
      continue;
    }
    el.insertAdjacentHTML('beforeend', btn(i, i));
  }
  el.insertAdjacentHTML('beforeend', btn('›', pagina + 1, pagina === paginas));
};

window.cambiarPagina = (p) => { estado.pagina = p; cargarMovimientos(); };


const aplicarFiltros = () => {
  estado.pagina = 1;
  estado.tipo   = $('#fil-tipo').value;
  estado.desde  = $('#fil-desde').value;
  estado.hasta  = $('#fil-hasta').value;
  cargarMovimientos();
};

$('#btn-aplicar').addEventListener('click', aplicarFiltros);

$('#btn-limpiar').addEventListener('click', () => {
  $('#fil-tipo').value  = '';
  $('#buscar-input').value = '';
  $('#fil-desde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  $('#fil-hasta').value = hoy.toISOString().split('T')[0];
  estado = { ...estado, pagina: 1, tipo: '', buscar: '',
    desde: $('#fil-desde').value, hasta: $('#fil-hasta').value };
  cargarMovimientos();
});

let timer;
$('#buscar-input').addEventListener('input', (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    estado.buscar = e.target.value;
    estado.pagina = 1;
    cargarMovimientos();
  }, 350);
});


cargarMovimientos();