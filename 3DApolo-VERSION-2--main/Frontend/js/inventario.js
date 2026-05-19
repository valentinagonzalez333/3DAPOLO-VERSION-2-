
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

let grafEstado     = null;
let grafCategorias = null;
let todosProductos = [];
let timer;

// ── Cargar categorías ──────────────────────────────────────────────────────
const cargarCategorias = async () => {
  const data = await apiFetch('/api/categorias?limite=100');
  if (!data) return;
  data.datos.forEach(c => {
    $('#fil-categoria').insertAdjacentHTML('beforeend',
      `<option value="${c.id_categoria}">${c.nombre}</option>`
    );
  });
};

// ── Cargar inventario ──────────────────────────────────────────────────────
const cargarInventario = async () => {
  const params = new URLSearchParams({
    categoria: $('#fil-categoria').value,
    tipo:      $('#fil-tipo').value,
    estado:    $('#fil-estado').value,
    buscar:    $('#buscar-input').value,
  });

  const data = await apiFetch(`/api/informes/inventario?${params}`);
  if (!data || data.error) {
    mostrarToast(data?.error || 'Error al cargar inventario', 'error');
    return;
  }

  todosProductos = data.productos;
  renderCards(data.resumen);
  renderGraficos(data.resumen, data.porCategoria);
  renderTabla(data.productos);
  $('#total-count').textContent = `${data.productos.length} producto${data.productos.length !== 1 ? 's' : ''}`;
};

// ── Cards ──────────────────────────────────────────────────────────────────
const renderCards = (r) => {
  $('#ci-total').textContent   = r.total;
  $('#ci-valor').textContent   = fmt(r.valor_total);
  $('#ci-ok').textContent      = r.en_stock;
  $('#ci-bajo').textContent    = r.stock_bajo;
  $('#ci-agotado').textContent = r.sin_stock;
};

// ── Gráficos ───────────────────────────────────────────────────────────────
const renderGraficos = (resumen, porCategoria) => {
  const isDark    = document.body.classList.contains('dark-mode');
  const textColor = isDark ? '#aaa' : '#888';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  if (grafEstado) grafEstado.destroy();
  if (grafCategorias) grafCategorias.destroy();

  // Dona — estado stock
  grafEstado = new Chart($('#grafico-estado'), {
    type: 'doughnut',
    data: {
      labels: ['En stock', 'Stock bajo', 'Sin stock'],
      datasets: [{
        data: [resumen.en_stock, resumen.stock_bajo, resumen.sin_stock],
        backgroundColor: [
          'rgba(34,197,94,0.8)',
          'rgba(234,179,8,0.8)',
          'rgba(239,68,68,0.8)',
        ],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10 } },
      },
    },
  });

  // Barras horizontales — valor por categoría
  const labels  = porCategoria.map(c => c.categoria.length > 15 ? c.categoria.slice(0, 15) + '…' : c.categoria);
  const valores = porCategoria.map(c => +c.valor);

  grafCategorias = new Chart($('#grafico-categorias'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Valor inventario',
        data: valores,
        backgroundColor: 'rgba(255,107,0,0.75)',
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (v) => `$${(v / 1000).toFixed(0)}k`,
          },
        },
        y: { grid: { display: false }, ticks: { color: textColor } },
      },
    },
  });
};

// ── Tabla ──────────────────────────────────────────────────────────────────
const renderTabla = (productos) => {
  const tbody = $('#tabla-body');

  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="cargando">Sin productos</td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map(p => {
    const badgeStock =
      p.stock === 0        ? `<span class="badge badge-rojo">Sin stock</span>` :
      p.stock <= p.stock_min ? `<span class="badge badge-amarillo">Stock bajo</span>` :
                              `<span class="badge badge-verde">OK</span>`;

    const badgeTipo = p.tipo === 'fabricado'
      ? `<span class="badge badge-azul">Fabricado</span>`
      : `<span class="badge badge-naranja">Comprado</span>`;

    const valorTotal = +p.stock * +p.costo_prom;

    return `
      <tr>
        <td><strong>${p.nombre}</strong></td>
        <td><span class="muted">${p.categoria || '—'}</span></td>
        <td>${badgeTipo}</td>
        <td><strong>${p.stock} ${p.abrev || ''}</strong></td>
        <td>${p.stock_min}</td>
        <td>${badgeStock}</td>
        <td>${fmt(p.costo_prom)}</td>
        <td>${fmt(p.precio_venta)}</td>
        <td><strong>${fmt(valorTotal)}</strong></td>
      </tr>
    `;
  }).join('');
};

// ── Exportar CSV ───────────────────────────────────────────────────────────
$('#btn-exportar').addEventListener('click', () => {
  if (!todosProductos.length) {
    mostrarToast('No hay datos para exportar', 'error');
    return;
  }

  const headers = ['Producto', 'Categoría', 'Tipo', 'Stock', 'Stock mínimo', 'Costo prom.', 'Precio venta', 'Valor total'];
  const filas = todosProductos.map(p => [
    `"${p.nombre}"`,
    `"${p.categoria || ''}"`,
    p.tipo,
    p.stock,
    p.stock_min,
    p.costo_prom,
    p.precio_venta,
    (+p.stock * +p.costo_prom).toFixed(2),
  ]);

  const csv = [headers, ...filas].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  mostrarToast('CSV exportado correctamente', 'ok');
});

// ── Filtros ────────────────────────────────────────────────────────────────
$('#btn-aplicar').addEventListener('click', cargarInventario);

$('#buscar-input').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(cargarInventario, 350);
});

// ── Toast ──────────────────────────────────────────────────────────────────
const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

// ── Init ───────────────────────────────────────────────────────────────────
cargarCategorias();
cargarInventario();