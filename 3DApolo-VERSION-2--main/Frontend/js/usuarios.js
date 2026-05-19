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

  const API='/api/configuracion';
  let datos=[], pag=1, totalPags=1, editId=null, roles=[];

  async function cargarRoles() {
    const d = await apiFetch(API+'/roles');
    roles=d.roles||[];
    const sel=document.getElementById('f-rol');
    roles.forEach(r=>{const o=document.createElement('option');o.value=r.id_rol;o.textContent=r.nombre;sel.appendChild(o);});
  }

  async function cargar() {
    const b=document.getElementById('buscar').value;
    const d = await apiFetch(`${API}/usuarios?buscar=${encodeURIComponent(b)}&pagina=${pag}`);
    datos=d.datos||[]; totalPags=d.paginacion?.paginas||1;
    renderTabla(); renderPag();
  }

  function renderTabla() {
    const tb=document.getElementById('tbody');
    if(!datos.length){tb.innerHTML='<tr><td colspan="7" class="tbl-empty">Sin usuarios</td></tr>';return;}
    tb.innerHTML=datos.map(u=>`
      <tr>
        <td>#${u.id_usuario}</td>
        <td><strong>${u.nombre}</strong></td>
        <td>${u.usuario}</td>
        <td>${u.correo}</td>
        <td><span class="badge badge-azul">${u.rol}</span></td>
        <td><span class="badge ${u.estado?'badge-verde':'badge-rojo'}">${u.estado?'Activo':'Inactivo'}</span></td>
        <td>
          <button class="btn-acc" onclick="editar(${u.id_usuario})"><i data-lucide="pencil"></i></button>
          <button class="btn-acc" title="${u.estado?'Desactivar':'Activar'}" onclick="toggleEstado(${u.id_usuario})">
            <i data-lucide="${u.estado?'user-x':'user-check'}"></i>
          </button>
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
    document.getElementById('m-titulo').textContent='Nuevo usuario';
    document.getElementById('form').reset();
    document.getElementById('pass-req').style.display='';
    document.getElementById('pass-hint').style.display='none';
    document.getElementById('f-pass').required=true;
    document.getElementById('modal').classList.add('open');
  }
  function cerrar(){document.getElementById('modal').classList.remove('open');}

  function editar(id){
    const u=datos.find(x=>x.id_usuario===id);if(!u)return;
    editId=id;
    document.getElementById('m-titulo').textContent='Editar usuario';
    document.getElementById('f-nombre').value  = u.nombre;
    document.getElementById('f-usuario').value = u.usuario;
    document.getElementById('f-correo').value  = u.correo;
    document.getElementById('f-rol').value     = u.id_rol;
    document.getElementById('f-tel').value     = u.telefono||'';
    document.getElementById('f-pass').value    = '';
    document.getElementById('f-pass').required = false;
    document.getElementById('pass-req').style.display='none';
    document.getElementById('pass-hint').style.display='';
    document.getElementById('modal').classList.add('open');
  }

  async function toggleEstado(id){
    const u=datos.find(x=>x.id_usuario===id);
    if(!u)return;
    const accion=u.estado?'desactivar':'activar';
    if(!confirm(`¿${accion.charAt(0).toUpperCase()+accion.slice(1)} a ${u.nombre}?`))return;
    const d = await apiFetch(API+'/usuarios/'+id+'/estado', {method:'PATCH'});
    if(!d?.error){toast('Estado actualizado');cargar();}else toast(d.error||'Error','err');
  }

  async function guardar(e){
    e.preventDefault();
    const body={
      nombre:    document.getElementById('f-nombre').value,
      usuario:   document.getElementById('f-usuario').value,
      correo:    document.getElementById('f-correo').value,
      id_rol:    document.getElementById('f-rol').value,
      telefono:  document.getElementById('f-tel').value||null,
      contrasena:document.getElementById('f-pass').value||undefined,
    };
    if(!body.contrasena) delete body.contrasena;
    const url=editId?API+'/usuarios/'+editId:API+'/usuarios';
    const method=editId?'PUT':'POST';
    const d = await apiFetch(url, {method, body:JSON.stringify(body)});
    if(!d?.error){toast(editId?'Usuario actualizado':'Usuario creado');cerrar();cargar();}
    else toast(d.error||'Error','err');
  }

  document.getElementById('buscar').addEventListener('input',()=>{pag=1;cargar();});
  cargarRoles(); cargar();
