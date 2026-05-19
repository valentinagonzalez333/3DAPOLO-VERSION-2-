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

function toast(msg, tipo='ok') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + tipo;
    setTimeout(() => t.className = '', 3100);
  }
  const frecLabels={unica:'Única',diaria:'Diaria',semanal:'Semanal',mensual:'Mensual',anual:'Anual'};

  const API='/api/gastos';
  let datos=[], pag=1, totalPags=1;
  let catsList=[];

  async function cargarCategorias() {
    const d = await apiFetch(API+'/categorias');
    catsList=d.categorias||[];
    const s1=document.getElementById('f-cat'), s2=document.getElementById('f-cat2');
    catsList.forEach(c=>{
      [s1,s2].forEach(s=>{const o=document.createElement('option');o.value=c.id_cat_gasto;o.textContent=c.nombre;s.appendChild(o);});
    });
  }

  async function cargar() {
    const b=document.getElementById('buscar').value;
    const cat=document.getElementById('f-cat').value;
    const desde=document.getElementById('f-desde').value;
    const hasta=document.getElementById('f-hasta').value;
    const d = await apiFetch(`${API}?buscar=${encodeURIComponent(b)}&categoria=${cat}&desde=${desde}&hasta=${hasta}&pagina=${pag}`);
    datos=d.datos||[]; totalPags=d.paginacion?.paginas||1;
    document.getElementById('ci-total').textContent = d.paginacion?.total||0;
    document.getElementById('ci-monto').textContent = '$'+Number(d.total_monto||0).toLocaleString('es-CO',{maximumFractionDigits:0});
    renderTabla(); renderPag();
  }

  function renderTabla() {
    const tb=document.getElementById('tbody');
    if(!datos.length){tb.innerHTML='<tr><td colspan="8" class="tbl-empty">Sin gastos registrados</td></tr>';return;}
    tb.innerHTML=datos.map(g=>`
      <tr>
        <td>#${g.id_gasto}</td>
        <td>${g.descripcion}</td>
        <td><span class="badge badge-naranja">${g.categoria}</span></td>
        <td><strong>${Number(g.monto).toLocaleString('es-CO')}</strong></td>
        <td>${g.fecha?g.fecha.slice(0,10):'—'}</td>
        <td>${frecLabels[g.frecuencia]||g.frecuencia}</td>
        <td>${g.usuario||'—'}</td>
        <td>
          <button class="btn-acc" onclick="editar(${g.id_gasto})"><i data-lucide="pencil"></i></button>
          <button class="btn-acc rojo" onclick="eliminar(${g.id_gasto})"><i data-lucide="trash-2"></i></button>
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

  function cerrar(){document.getElementById('modal').classList.remove('open');}

  function editar(id){
    const g=datos.find(x=>x.id_gasto===id);if(!g)return;
    document.getElementById('f-id').value   = g.id_gasto;
    document.getElementById('f-desc').value = g.descripcion;
    document.getElementById('f-cat2').value = g.id_cat_gasto;
    document.getElementById('f-monto').value= g.monto;
    document.getElementById('f-fecha').value= g.fecha?g.fecha.slice(0,10):'';
    document.getElementById('f-frec').value = g.frecuencia;
    document.getElementById('modal').classList.add('open');
  }

  async function eliminar(id){
    if(!confirm('¿Eliminar este gasto?'))return;
    const d = await apiFetch(API+'/'+id, {method:'DELETE'});
    if(!d?.error){toast('Gasto eliminado');cargar();}else toast(d.error||'Error','err');
  }

  async function guardar(e){
    e.preventDefault();
    const id=document.getElementById('f-id').value;
    const body={
      id_cat_gasto: document.getElementById('f-cat2').value,
      descripcion:  document.getElementById('f-desc').value,
      monto:        document.getElementById('f-monto').value,
      fecha:        document.getElementById('f-fecha').value,
      frecuencia:   document.getElementById('f-frec').value,
    };
    const d = await apiFetch(API+'/'+id, {method:'PUT', body:JSON.stringify(body)});
    if(!d?.error){toast('Gasto actualizado');cerrar();cargar();}
    else toast(d.error||'Error','err');
  }

  ['buscar','f-cat','f-desde','f-hasta'].forEach(id=>
    document.getElementById(id).addEventListener('change',()=>{pag=1;cargar();}));
  document.getElementById('buscar').addEventListener('input',()=>{pag=1;cargar();});
  cargarCategorias(); cargar();
