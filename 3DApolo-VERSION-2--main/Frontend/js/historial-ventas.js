lucide.createIcons();
  document.getElementById('btn').addEventListener('click', () =>
    document.getElementById('menu').classList.toggle('activo'));
  document.getElementById('btn_modo').addEventListener('change', function() {
    document.body.classList.toggle('dark-mode', this.checked);
  });
  

    function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => window.location.replace('/login'));
}

function toast(msg,tipo='ok'){const t=document.getElementById('toast');t.textContent=msg;t.className='show '+tipo;setTimeout(()=>t.className='',3100);}
  const API='/api/ventas';
  let datos=[], pag=1, totalPags=1;
  const metodoPago={efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',otro:'Otro'};

  function badgeEstado(e){
    const m={completada:'badge-verde',anulada:'badge-rojo',devuelta:'badge-naranja'};
    return `<span class="badge ${m[e]||'badge-gris'}">${e}</span>`;
  }

  async function cargar(){
    const b=document.getElementById('buscar').value;
    const est=document.getElementById('f-estado').value;
    const desde=document.getElementById('f-desde').value;
    const hasta=document.getElementById('f-hasta').value;
    const d = await apiFetch(`${API}?buscar=${encodeURIComponent(b)}&estado=${est}&desde=${desde}&hasta=${hasta}&pagina=${pag}`);
    datos=d.datos||[]; totalPags=d.paginacion?.paginas||1;
    document.getElementById('ci-total').textContent = d.paginacion?.total||0;
    document.getElementById('ci-monto').textContent = '$'+Number(d.total_monto||0).toLocaleString('es-CO',{maximumFractionDigits:0});
    document.getElementById('ci-comp').textContent  = datos.filter(x=>x.estado==='completada').length;
    document.getElementById('ci-anul').textContent  = datos.filter(x=>x.estado==='anulada').length;
    renderTabla(); renderPag();
  }

  function renderTabla(){
    const tb=document.getElementById('tbody');
    if(!datos.length){tb.innerHTML='<tr><td colspan="9" class="tbl-empty">Sin ventas registradas</td></tr>';return;}
    tb.innerHTML=datos.map(v=>`
      <tr>
        <td><strong>#${v.id_venta}</strong></td>
        <td>${v.fecha?new Date(v.fecha).toLocaleDateString('es-CO'):'—'}</td>
        <td>${v.vendedor}</td>
        <td>${v.cliente||'—'}</td>
        <td><strong>${Number(v.total).toLocaleString('es-CO',{maximumFractionDigits:0})}</strong></td>
        <td>${metodoPago[v.metodo_pago]||v.metodo_pago}</td>
        <td><span class="badge badge-azul">${v.tipo_venta}</span></td>
        <td>${badgeEstado(v.estado)}</td>
        <td>
          <button class="btn-acc" title="Ver detalle" onclick="verDetalle(${v.id_venta})"><i data-lucide="eye"></i></button>
          ${v.estado==='completada'?`<button class="btn-acc rojo" title="Anular" onclick="anular(${v.id_venta})"><i data-lucide="x-circle"></i></button>`:''}
        </td>
      </tr>`).join('');
    lucide.createIcons();
  }

  function renderPag(){
    const c=document.getElementById('pag');
    if(totalPags<=1){c.innerHTML='';return;}
    c.innerHTML=Array.from({length:totalPags},(_, i)=>
      `<button class="${i+1===pag?'activa':''}" onclick="irPag(${i+1})">${i+1}</button>`).join('');
  }
  function irPag(n){pag=n;cargar();}

  async function verDetalle(id){
    const v=await apiFetch(API+'/'+id);
    document.getElementById('det-titulo').textContent='Venta #'+v.id_venta;
    document.getElementById('det-body').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13.5px">
        <div><b>Fecha:</b> ${v.fecha?new Date(v.fecha).toLocaleString('es-CO'):'—'}</div>
        <div><b>Estado:</b> ${badgeEstado(v.estado)}</div>
        <div><b>Vendedor:</b> ${v.vendedor}</div>
        <div><b>Cliente:</b> ${v.cliente||'—'}</div>
        <div><b>Método:</b> ${metodoPago[v.metodo_pago]||v.metodo_pago}</div>
        <div><b>Tipo:</b> ${v.tipo_venta} / ${v.tipo_entrega}</div>
      </div>
      <div class="tbl-wrap" style="margin-bottom:14px">
        <table>
          <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Desc.%</th><th>Subtotal</th></tr></thead>
          <tbody>
            ${(v.items||[]).map(it=>`<tr>
              <td>${it.producto}</td>
              <td>${it.cantidad}</td>
              <td>${Number(it.precio_venta).toLocaleString('es-CO')}</td>
              <td>${it.desc_pct}%</td>
              <td>${Number(it.subtotal).toLocaleString('es-CO',{maximumFractionDigits:0})}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div style="text-align:right;font-size:14px">
        <div>Subtotal: <b>${Number(v.subtotal).toLocaleString('es-CO',{maximumFractionDigits:0})}</b></div>
        <div>Descuento: <b>-${Number(v.descuento||0).toLocaleString('es-CO',{maximumFractionDigits:0})}</b></div>
        <div>IVA: <b>${Number(v.impuesto||0).toLocaleString('es-CO',{maximumFractionDigits:0})}</b></div>
        <div style="font-size:17px;font-weight:700;color:var(--naranja)">TOTAL: ${Number(v.total).toLocaleString('es-CO',{maximumFractionDigits:0})}</div>
      </div>
      ${v.notas?`<p style="margin-top:10px;font-size:13px;color:#aaa">Notas: ${v.notas}</p>`:''}`;
    document.getElementById('modal-det').classList.add('open');
    lucide.createIcons();
  }

  async function anular(id){
    if(!confirm('¿Anular la venta #'+id+'? Se restaurará el stock.'))return;
    const d = await apiFetch(API+'/'+id+'/anular', {method:'PATCH'});
    if(!d?.error){toast('Venta anulada');cargar();}else toast(d.error||'Error','err');
  }

  ['buscar','f-estado','f-desde','f-hasta'].forEach(id=>{
    const el=document.getElementById(id);
    el.addEventListener('change',()=>{pag=1;cargar();});
    if(id==='buscar') el.addEventListener('input',()=>{pag=1;cargar();});
  });
  cargar();
