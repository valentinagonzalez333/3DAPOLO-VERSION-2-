
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

let grafDona   = null;
let grafBarras = null;

const COLORES = [
  'rgba(255,107,0,0.8)',   'rgba(34,197,94,0.8)',
  'rgba(59,130,246,0.8)',  'rgba(168,85,247,0.8)',
  'rgba(234,179,8,0.8)',   'rgba(239,68,68,0.8)',
  'rgba(20,184,166,0.8)',  'rgba(249,115,22,0.8)',
  'rgba(99,102,241,0.8)',  'rgba(236,72,153,0.8)',
];

// ── Fechas por defecto: mes actual ─────────────────────────────────────────
const hoy = new Date();
$('#fil-desde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
$('#fil-hasta').value = hoy.toISOString().split('T')[0];

// ── Cargar informe ─────────────────────────────────────────────────────────
const cargarInforme = async () => {
  const params = new URLSearchParams({
    desde:      $('#fil-desde').value,
    hasta:      $('#fil-hasta').value,
    frecuencia: $('#fil-frecuencia').value,
  });

  const data = await apiFetch(`/api/informes/gastos-categoria?${params}`);
  if (!data || data.error) {
    mostrarToast(data?.error || 'Error al cargar informe', 'error');
    return;
  }

  renderCards(data.resumen, data.categorias);
  renderGraficos(data.categorias);
  renderTabla(data.categorias, data.resumen.total_monto);
};

// ── Cards ──────────────────────────────────────────────────────────────────
const renderCards = (r, categorias) => {
  $('#ci-total').textContent      = fmt(r.total_monto);
  $('#ci-categorias').textContent = r.total_categorias || 0;
  $('#ci-registros').textContent  = r.total_registros  || 0;

  const mayor = categorias.length
    ? categorias.reduce((a, b) => +a.total > +b.total ? a : b)
    : null;
  $('#ci-mayor').textContent = mayor ? mayor.categoria : '—';
};

// ── Gráficos ───────────────────────────────────────────────────────────────
const renderGraficos = (categorias) => {
  const labels  = categorias.map(c => c.categoria);
  const montos  = categorias.map(c => +c.total);
  const colores = categorias.map((_, i) => COLORES[i % COLORES.length]);

  const isDark    = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#aaa' : '#888';

  if (grafDona) grafDona.destroy();
  if (grafBarras) grafBarras.destroy();

  grafDona = new Chart($('#grafico-dona'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: montos, backgroundColor: colores, borderWidth: 2 }],
    },
    options: {
      responsive: true,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { font: { size: 11 }, padding: 10 } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)}`,
          },
        },
      },
    },
  });

  grafBarras = new Chart($('#grafico-barras'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Total gastado',
        data: montos,
        backgroundColor: colores,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      indexAxis: 'y',
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
const renderTabla = (categorias, totalMonto) => {
  const tbody = $('#tabla-body');

  if (!categorias.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="cargando">Sin datos en el periodo</td></tr>`;
    return;
  }

  tbody.innerHTML = categorias.map((c, i) => {
    const pct = totalMonto > 0
      ? ((+c.total / +totalMonto) * 100).toFixed(1)
      : '0';
    const color = COLORES[i % COLORES.length];

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="width:12px;height:12px;border-radius:3px;background:${color};display:inline-block;flex-shrink:0"></span>
            <strong>${c.categoria}</strong>
          </div>
        </td>
        <td>${c.registros}</td>
        <td><strong>${fmt(c.total)}</strong></td>
        <td>
          <div class="pct-bar-wrap">
            <div class="pct-bar" style="width:${Math.min(+pct, 100)}%"></div>
            <span>${pct}%</span>
          </div>
        </td>
        <td>${fmt(c.promedio)}</td>
        <td>${fmt(c.mayor)}</td>
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
cargarInforme();