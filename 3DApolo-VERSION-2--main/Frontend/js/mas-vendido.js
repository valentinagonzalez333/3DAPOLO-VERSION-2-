
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

let grafUnidades = null;
let grafIngresos = null;

const COLORES = [
  'rgba(255,107,0,0.8)',
  'rgba(34,197,94,0.8)',
  'rgba(59,130,246,0.8)',
  'rgba(168,85,247,0.8)',
  'rgba(234,179,8,0.8)',
  'rgba(239,68,68,0.8)',
  'rgba(20,184,166,0.8)',
  'rgba(249,115,22,0.8)',
  'rgba(99,102,241,0.8)',
  'rgba(236,72,153,0.8)',
];

// ── Fechas por defecto ─────────────────────────────────────────────────────
const hoy = new Date();
$('#fil-desde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
$('#fil-hasta').value = hoy.toISOString().split('T')[0];

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

// ── Cargar informe ─────────────────────────────────────────────────────────
const cargarInforme = async () => {
  const params = new URLSearchParams({
    desde:     $('#fil-desde').value,
    hasta:     $('#fil-hasta').value,
    categoria: $('#fil-categoria').value,
    tipo:      $('#fil-tipo').value,
    top:       $('#fil-top').value,
  });

  const data = await apiFetch(`/api/informes/mas-vendido?${params}`);
  if (!data || data.error) {
    mostrarToast(data?.error || 'Error al cargar informe', 'error');
    return;
  }

  renderPodio(data.productos);
  renderGraficos(data.productos, data.total_unidades);
  renderTabla(data.productos, data.total_unidades);
};

// ── Podio top 3 ────────────────────────────────────────────────────────────
const renderPodio = (productos) => {
  const podio = $('#podio');
  if (!productos.length) { podio.innerHTML = ''; return; }

  const medallas = ['🥇', '🥈', '🥉'];
  const alturas  = ['podio-1', 'podio-2', 'podio-3'];
  const top3 = productos.slice(0, 3);

  // Orden visual: 2do - 1ro - 3ro
  const orden = [
    top3[1] || null,
    top3[0] || null,
    top3[2] || null,
  ];
  const clasesOrden = ['podio-2', 'podio-1', 'podio-3'];

  podio.innerHTML = `
    <div class="podio">
      ${orden.map((p, i) => p ? `
        <div class="podio-col ${clasesOrden[i]}">
          <div class="podio-medalla">${medallas[i === 0 ? 1 : i === 1 ? 0 : 2]}</div>
          <div class="podio-nombre">${p.nombre}</div>
          <div class="podio-valor">${p.unidades} und</div>
          <div class="podio-ingreso">${fmt(p.ingresos)}</div>
          <div class="podio-base">${i === 1 ? '1°' : i === 0 ? '2°' : '3°'}</div>
        </div>
      ` : '').join('')}
    </div>
  `;
};

// ── Gráficos dona ──────────────────────────────────────────────────────────
const renderGraficos = (productos, totalUnidades) => {
  const labels    = productos.map(p => p.nombre.length > 15 ? p.nombre.slice(0, 15) + '…' : p.nombre);
  const unidades  = productos.map(p => +p.unidades);
  const ingresos  = productos.map(p => +p.ingresos);
  const colores   = productos.map((_, i) => COLORES[i % COLORES.length]);

  if (grafUnidades) grafUnidades.destroy();
  if (grafIngresos) grafIngresos.destroy();

  const optsComunes = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: { font: { size: 11 }, padding: 12 },
      },
    },
    cutout: '60%',
  };

  grafUnidades = new Chart($('#grafico-unidades'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: unidades, backgroundColor: colores, borderWidth: 2 }] },
    options: {
      ...optsComunes,
      plugins: {
        ...optsComunes.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.raw} und (${((ctx.raw / totalUnidades) * 100).toFixed(1)}%)`,
          },
        },
      },
    },
  });

  grafIngresos = new Chart($('#grafico-ingresos'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: ingresos, backgroundColor: colores, borderWidth: 2 }] },
    options: {
      ...optsComunes,
      plugins: {
        ...optsComunes.plugins,
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)}`,
          },
        },
      },
    },
  });
};

// ── Tabla ──────────────────────────────────────────────────────────────────
const renderTabla = (productos, totalUnidades) => {
  const tbody = $('#tabla-body');

  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="cargando">Sin datos en el periodo</td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map((p, i) => {
    const pct = totalUnidades > 0
      ? ((p.unidades / totalUnidades) * 100).toFixed(1)
      : '0';

    const posIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

    return `
      <tr>
        <td><strong>${posIcon}</strong></td>
        <td><strong>${p.nombre}</strong></td>
        <td><span class="muted">${p.categoria || '—'}</span></td>
        <td><strong>${p.unidades}</strong></td>
        <td>${p.veces_vendido}</td>
        <td>${fmt(p.ingresos)}</td>
        <td>${fmt(p.ganancia)}</td>
        <td>
          <div class="pct-bar-wrap">
            <div class="pct-bar" style="width:${pct}%"></div>
            <span>${pct}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

// ── Toast ──────────────────────────────────────────────────────────────────
const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

$('#btn-aplicar').addEventListener('click', cargarInforme);

// ── Init ───────────────────────────────────────────────────────────────────
cargarCategorias();
cargarInforme();