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
  let datos=[], pag=1, totalPags=1, editId=null;

  async function cargar(){
    const b=document.getElementById('buscar').value;
    const d = await apiFetch(`${API}/clientes/lista?buscar=${encodeURIComponent(b)}&pagina=${pag}`);
    datos=d.datos||[]; totalPags=d.paginacion?.paginas||1;
    renderTabla(); renderPag();
  }

  function renderTabla(){
    const tb=document.getElementById('tbody');
    if(!datos.length){tb.innerHTML='<tr><td colspan="7" class="tbl-empty">Sin clientes</td></tr>';return;}
    tb.innerHTML=datos.map(c=>`
      <tr>
        <td><strong>${c.nombre}</strong></td>
        <td>${c.documento||'—'}</td>
        <td>${c.telefono||'—'}</td>
        <td>${c.ciudad||'—'}</td>
        <td>${c.desc_esp?c.desc_esp+'%':'—'}</td>
        <td><span class="badge ${c.estado?'badge-verde':'badge-rojo'}">${c.estado?'Activo':'Inactivo'}</span></td>
        <td>
          <button class="btn-acc" onclick="editar(${c.id_cliente})"><i data-lucide="pencil"></i></button>
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

  function abrirModal(){
    editId=null;
    document.getElementById('m-titulo').textContent='Nuevo cliente mayoreo';
    document.getElementById('form').reset();
    document.getElementById('modal').classList.add('open');
  }
  function cerrar(){document.getElementById('modal').classList.remove('open');}

  function editar(id){
    const c=datos.find(x=>x.id_cliente===id);if(!c)return;
    editId=id;
    document.getElementById('m-titulo').textContent='Editar: '+c.nombre;
    document.getElementById('f-nombre').value  = c.nombre;
    document.getElementById('f-doc').value     = c.documento||'';
    document.getElementById('f-tel').value     = c.telefono||'';
    document.getElementById('f-correo').value  = c.correo||'';
    document.getElementById('f-ciudad').value  = c.ciudad||'';
    document.getElementById('f-dir').value     = c.direccion||'';
    document.getElementById('f-desc').value    = c.desc_esp||'';
    document.getElementById('modal').classList.add('open');
  }

  async function guardar(e){
    e.preventDefault();
    const body={
      nombre:    document.getElementById('f-nombre').value,
      documento: document.getElementById('f-doc').value||null,
      telefono:  document.getElementById('f-tel').value||null,
      correo:    document.getElementById('f-correo').value||null,
      ciudad:    document.getElementById('f-ciudad').value||null,
      direccion: document.getElementById('f-dir').value||null,
      desc_esp:  document.getElementById('f-desc').value||null,
    };
    const url=editId?API+'/clientes/'+editId:API+'/clientes';
    const method=editId?'PUT':'POST';
    const d = await apiFetch(url, {method, body:JSON.stringify(body)});
    if(!d?.error){toast(editId?'Cliente actualizado':'Cliente creado');cerrar();cargar();}
    else toast(d.error||'Error','err');
  }

  document.getElementById('buscar').addEventListener('input',()=>{pag=1;cargar();});
  cargar();
