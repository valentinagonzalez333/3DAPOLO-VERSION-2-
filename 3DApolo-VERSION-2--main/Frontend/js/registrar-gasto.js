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

  const API = '/api/gastos';

  async function cargarCategorias() {
    const d = await apiFetch(API+'/categorias');
    const sel=document.getElementById('f-cat');
    (d.categorias||[]).forEach(c=>{const o=document.createElement('option');o.value=c.id_cat_gasto;o.textContent=c.nombre;sel.appendChild(o);});
  }

  // Fecha de hoy por defecto
  document.getElementById('f-fecha').value = new Date().toISOString().slice(0,10);

  async function guardar(e) {
    e.preventDefault();
    const body = {
      id_cat_gasto: document.getElementById('f-cat').value,
      descripcion:  document.getElementById('f-desc').value,
      monto:        document.getElementById('f-monto').value,
      fecha:        document.getElementById('f-fecha').value,
      frecuencia:   document.getElementById('f-frec').value,
      comprobante:  document.getElementById('f-comp').value||null,
    };
    const d = await apiFetch(API, {method:'POST', body:JSON.stringify(body)});
    if(!d?.error){toast('Gasto registrado correctamente');limpiar();}
    else toast(d.error||'Error al registrar','err');
  }

  function limpiar() {
    document.getElementById('form').reset();
    document.getElementById('f-fecha').value = new Date().toISOString().slice(0,10);
  }

  cargarCategorias();
