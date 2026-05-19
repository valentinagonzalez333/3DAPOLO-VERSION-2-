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

const TIPOS_MOV = {
  compra:         { label: 'Compra',           color: '#3b82f6' },
  produccion:     { label: 'Producción',       color: '#8b5cf6' },
  ajuste_entrada: { label: 'Ajuste +',         color: '#22c55e' },
  dev_entrada:    { label: 'Dev. entrada',     color: '#22c55e' },
  venta:          { label: 'Venta',            color: '#ff6b00' },
  ajuste_salida:  { label: 'Ajuste -',         color: '#ef4444' },
  dev_salida:     { label: 'Dev. salida',      color: '#ef4444' },
};

let periodoActivo = 'hoy';

// ── Fecha del header ───────────────────────────────────────────────────────
const hoy = new Date();
$('#dash-fecha').textContent = hoy.toLocaleDateString('es-CO', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});

// ── Rango de fechas según periodo ──────────────────────────────────────────
const getRango = (periodo) => {
  const hoy  = new Date();
  const hasta = hoy.toISOString().split('T')[0];
  let desde;

  if (periodo === 'hoy') {
    desde = hasta;
  } else if (periodo === 'semana') {
    const d = new Date(hoy);
    d.setDate(hoy.getDate() - hoy.getDay() + 1);
    desde = d.toISOString().split('T')[0];
  } else {
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];
  }

  return { desde, hasta };
};

// ── Cargar todo el dashboard ───────────────────────────────────────────────
const cargarDashboard = async () => {
  const { desde, hasta } = getRango(periodoActivo);

  const [finanzas, inventario, movimientos] = await Promise.all([
    apiFetch(`/api/dashboard/finanzas?desde=${desde}&hasta=${hasta}`),
    apiFetch(`/api/dashboard/inventario`),
    apiFetch(`/api/dashboard/movimientos-recientes`),
  ]);

  if (finanzas)    renderFinanzas(finanzas);
  if (inventario)  renderInventario(inventario);
  if (movimientos) renderMovimientos(movimientos);
};

// ── Render finanzas ────────────────────────────────────────────────────────
const renderFinanzas = (d) => {
  const ingresos   = +d.ingresos_brutos || 0;
  const costoMp    = +d.costo_materias  || 0;
  const gastosOp   = +d.gastos_operativos || 0;
  const gastosTot  = costoMp + gastosOp;
  const ganancia   = ingresos - gastosTot;
  const margen     = ingresos > 0 ? ((ganancia / ingresos) * 100).toFixed(1) : '0';

  // Cards principales
  $('#d-ingresos').textContent     = fmt(ingresos);
  $('#d-ingresos-sub').textContent = `${d.num_ventas || 0} ventas`;
  $('#d-gastos').textContent       = fmt(gastosTot);
  $('#d-gastos-sub').textContent   = `MP: ${fmt(costoMp)} + Op: ${fmt(gastosOp)}`;
  $('#d-ganancia').textContent     = fmt(ganancia);
  $('#d-ganancia-sub').textContent = ganancia >= 0 ? '✓ Positiva' : '✗ Negativa';
  $('#d-ganancia').style.color     = ganancia >= 0 ? '#22c55e' : '#ef4444';
  $('#d-margen').textContent       = `${margen}%`;
  $('#d-margen').style.color       = margen >= 20 ? '#22c55e' : margen >= 10 ? '#eab308' : '#ef4444';

  // Desglose costos
  $('#d-costo-mp').textContent     = fmt(costoMp);
  $('#d-costo-mp-sub').textContent = `${d.unidades_vendidas || 0} unidades producidas/vendidas`;
  $('#d-gastos-op').textContent    = fmt(gastosOp);
  $('#d-gastos-op-sub').textContent = `${d.num_gastos || 0} registros de gasto`;

  // Operativas
  $('#d-num-ventas').textContent = d.num_ventas || 0;
  $('#d-ticket').textContent     = fmt(d.ticket_promedio);
};

// ── Render inventario ──────────────────────────────────────────────────────
const renderInventario = (d) => {
  $('#d-inventario').textContent      = fmt(d.valor_inventario);
  $('#d-productos').textContent       = d.total_productos || 0;
  $('#d-productos-sub').textContent   = `${d.sin_stock} agotados`;
  $('#d-alertas-stock').textContent   = (+d.stock_bajo + +d.sin_stock) || 0;

  // Alertas
  const cont = $('#contenedorAlertas');
  if (!d.alertas || !d.alertas.length) {
    cont.innerHTML = `<div class="sin-alertas">✓ Sin alertas de stock</div>`;
    return;
  }

  cont.innerHTML = d.alertas.map(a => `
    <div class="alerta-item ${a.stock === 0 ? 'alerta-roja' : 'alerta-amarilla'}">
      <span class="alerta-icono">${a.stock === 0 ? '🔴' : '🟡'}</span>
      <div class="alerta-info">
        <strong>${a.nombre}</strong>
        <span>Stock: ${a.stock} ${a.abrev} (mín: ${a.stock_min})</span>
      </div>
      <a href="/productos" class="alerta-link">Ver</a>
    </div>
  `).join('');
};

// ── Render movimientos recientes ───────────────────────────────────────────
const renderMovimientos = (movs) => {
  const tbody = $('#tablaDatos');

  if (!movs.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;color:#aaa">Sin movimientos hoy</td></tr>`;
    return;
  }

  tbody.innerHTML = movs.map(m => {
    const info  = TIPOS_MOV[m.tipo] || { label: m.tipo, color: '#aaa' };
    const esEntrada = ['compra','produccion','ajuste_entrada','dev_entrada'].includes(m.tipo);
    const fecha = new Date(m.fecha);
    const hora  = fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    return `
      <tr>
        <td><strong>${m.producto}</strong></td>
        <td><span style="color:${info.color};font-weight:600;font-size:12px">${info.label}</span></td>
        <td style="color:${esEntrada ? '#22c55e' : '#ef4444'};font-weight:700">
          ${esEntrada ? '+' : '-'}${Math.abs(m.cantidad)}
        </td>
        <td style="color:#aaa;font-size:12px">${hora}</td>
      </tr>
    `;
  }).join('');
};

// ── Botones de periodo ─────────────────────────────────────────────────────
document.querySelectorAll('.btn-periodo').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('activo'));
    btn.classList.add('activo');
    periodoActivo = btn.dataset.periodo;
    cargarDashboard();
  });
});

// ── Dark mode ──────────────────────────────────────────────────────────────
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

// ── Init ───────────────────────────────────────────────────────────────────
cargarDashboard();