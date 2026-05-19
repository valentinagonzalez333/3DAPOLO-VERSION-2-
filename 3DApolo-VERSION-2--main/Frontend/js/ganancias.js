

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


const hoy = new Date();
$('#fil-desde').value = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
$('#fil-hasta').value = hoy.toISOString().split('T')[0];


const cargarCategorias = async () => {
  const data = await apiFetch('/api/categorias?limite=100');
  if (!data) return;
  data.datos.forEach(c => {
    $('#fil-categoria').insertAdjacentHTML('beforeend',
      `<option value="${c.id_categoria}">${c.nombre}</option>`
    );
  });
};


const cargarInforme = async () => {
  const params = new URLSearchParams({
    desde:     $('#fil-desde').value,
    hasta:     $('#fil-hasta').value,
    categoria: $('#fil-categoria').value,
    orden:     $('#fil-orden').value,
    top:       $('#fil-top').value,
  });

  const data = await apiFetch(`/api/informes/ganancias?${params}`);
  if (!data || data.error) {
    mostrarToast(data?.error || 'Error al cargar informe', 'error');
    return;
  }

  renderCards(data.resumen);
  renderGrafico(data.productos);
  renderTabla(data.productos);
};


const renderCards = (r) => {
  $('#ci-productos').textContent = r.total_productos || 0;
  $('#ci-ingresos').textContent  = fmt(r.total_ingresos);
  $('#ci-ganancia').textContent  = fmt(r.total_ganancia);

  const margen = r.total_ingresos > 0
    ? ((r.total_ganancia / r.total_ingresos) * 100).toFixed(1)
    : '0';
  $('#ci-margen').textContent = `${margen}%`;
};


const renderGrafico = (productos) => {
  const top10    = productos.slice(0, 10);
  const labels   = top10.map(p => p.nombre.length > 20 ? p.nombre.slice(0, 20) + '…' : p.nombre);
  const ganancias = top10.map(p => +p.ganancia);
  const margenes  = top10.map(p => +p.margen);

  if (grafico) grafico.destroy();

  const isDark    = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#aaa' : '#888';

  grafico = new Chart($('#grafico-ganancias'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Ganancia',
          data: ganancias,
          backgroundColor: top10.map(p =>
            p.margen >= 30 ? 'rgba(34,197,94,0.75)' :
            p.margen >= 15 ? 'rgba(255,107,0,0.75)' :
                             'rgba(239,68,68,0.75)'
          ),
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: (ctx) => `Margen: ${margenes[ctx.dataIndex]}%`,
          },
        },
      },
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


const renderTabla = (productos) => {
  const tbody = $('#tabla-body');

  if (!productos.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="cargando">Sin datos en el periodo</td></tr>`;
    return;
  }

  tbody.innerHTML = productos.map((p, i) => {
    const margenClass =
      p.margen >= 30 ? 'badge-verde' :
      p.margen >= 15 ? 'badge-amarillo' : 'badge-rojo';

    return `
      <tr>
        <td><strong>${i + 1}</strong></td>
        <td><strong>${p.nombre}</strong></td>
        <td><span class="muted">${p.categoria || '—'}</span></td>
        <td>${p.unidades}</td>
        <td>${fmt(p.ingresos)}</td>
        <td>${fmt(p.costo)}</td>
        <td><strong>${fmt(p.ganancia)}</strong></td>
        <td><span class="badge ${margenClass}">${(+p.margen).toFixed(1)}%</span></td>
      </tr>
    `;
  }).join('');
};


const mostrarToast = (msg, tipo = 'ok') => {
  const t = document.createElement('div');
  t.className = `toast toast-${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
};

$('#btn-aplicar').addEventListener('click', cargarInforme);


cargarCategorias();
cargarInforme();