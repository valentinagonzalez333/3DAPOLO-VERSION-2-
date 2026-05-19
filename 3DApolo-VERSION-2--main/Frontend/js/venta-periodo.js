
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

let grafico = null;

// ── Fechas por defecto: mes actual ─────────────────────────────────────────
const hoy = new Date();
const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
const hoyStr = hoy.toISOString().split('T')[0];
$('#fil-desde').value = primerDiaMes;
$('#fil-hasta').value = hoyStr;

// ── Cargar informe ─────────────────────────────────────────────────────────
const cargarInforme = async () => {
  const params = new URLSearchParams({
    desde: $('#fil-desde').value,
    hasta: $('#fil-hasta').value,
    agrupacion: $('#fil-agrupacion').value,
    metodo: $('#fil-metodo').value,
    tipo: $('#fil-tipo').value,
  });

  const data = await apiFetch(`/api/informes/venta-periodo?${params}`);
  if (!data) return;

  renderCards(data.resumen);
  renderGrafico(data.periodos);
  renderTabla(data.periodos);
};

// ── Cards ──────────────────────────────────────────────────────────────────
const renderCards = (r) => {
  $('#ci-ventas').textContent = r.total_ventas || 0;
  $('#ci-ingresos').textContent = fmt(r.total_ingresos);
  $('#ci-ganancia').textContent = fmt(r.total_ganancia);
  $('#ci-unidades').textContent = r.total_unidades || 0;
  $('#ci-ticket').textContent = fmt(r.ticket_promedio);

  const margen = r.total_ingresos > 0
    ? ((r.total_ganancia / r.total_ingresos) * 100).toFixed(1)
    : '0';
  $('#ci-margen').textContent = `${margen}%`;
};

// ── Gráfico ────────────────────────────────────────────────────────────────
const renderGrafico = (periodos) => {
  const labels = periodos.map(p => p.periodo);
  const ingresos = periodos.map(p => +p.ingresos);
  const ganancia = periodos.map(p => +p.ganancia);

  if (grafico) grafico.destroy();

  const isDark = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#aaa' : '#888';

  grafico = new Chart($('#grafico-ventas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: ingresos,
          backgroundColor: 'rgba(255,107,0,0.7)',
          borderRadius: 6,
          order: 2,
        },
        {
          label: 'Ganancia',
          data: ganancia,
          type: 'line',
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.1)',
          borderWidth: 2,
          pointRadius: 4,
          tension: 0.3,
          fill: true,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (v) => `$${(v / 1000).toFixed(0)}k`,
          },
        },
      },
    },
  });
};

// ── Tabla ──────────────────────────────────────────────────────────────────
const renderTabla = (periodos) => {
  const tbody = $('#tabla-body');

  if (!periodos.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="cargando">Sin datos en el periodo</td></tr>`;
    return;
  }

  tbody.innerHTML = periodos.map(p => {
    const margen = p.ingresos > 0
      ? ((p.ganancia / p.ingresos) * 100).toFixed(1)
      : '0';
    const margenClass = margen >= 30 ? 'badge-verde' : margen >= 15 ? 'badge-amarillo' : 'badge-rojo';

    return `
      <tr>
        <td><strong>${p.periodo}</strong></td>
        <td>${p.num_ventas}</td>
        <td>${p.unidades}</td>
        <td>${fmt(p.ingresos)}</td>
        <td>${fmt(p.costo)}</td>
        <td><strong>${fmt(p.ganancia)}</strong></td>
        <td><span class="badge ${margenClass}">${margen}%</span></td>
      </tr>
    `;
  }).join('');
};

$('#btn-aplicar').addEventListener('click', cargarInforme);

// ── Init ───────────────────────────────────────────────────────────────────
cargarInforme();