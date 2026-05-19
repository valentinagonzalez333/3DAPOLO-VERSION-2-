lucide.createIcons();
document.getElementById('btn').addEventListener('click', () =>
    document.getElementById('menu').classList.toggle('activo'));
document.getElementById('btn_modo').addEventListener('change', function () {
    document.body.classList.toggle('dark-mode', this.checked);
});


  function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => window.location.replace('/login'));
}


function toast(msg, tipo = 'ok') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = 'show ' + tipo;
    setTimeout(() => t.className = '', 3100);
}

const API = '/api/configuracion';

async function cargarPerfil() {
    const d = await apiFetch(API + '/perfil');
    document.getElementById('p-nombre').textContent = d.nombre || '—';
    document.getElementById('p-rol').textContent = d.rol || '—';
    document.getElementById('f-nombre').value = d.nombre || '';
    document.getElementById('f-usuario').value = d.usuario || '';
    document.getElementById('f-correo').value = d.correo || '';
    document.getElementById('f-tel').value = d.telefono || '';
}

async function guardarPerfil(e) {
    e.preventDefault();
    const body = {
        nombre: document.getElementById('f-nombre').value,
        correo: document.getElementById('f-correo').value,
        telefono: document.getElementById('f-tel').value,
        contrasena_actual: document.getElementById('f-pass-act').value || undefined,
        contrasena_nueva: document.getElementById('f-pass-new').value || undefined,
    };
    if (!body.contrasena_nueva) { delete body.contrasena_actual; delete body.contrasena_nueva; }
    const d = await apiFetch(API + '/perfil', { method: 'PUT', body: JSON.stringify(body) });
    if (!d?.error) { toast('Perfil actualizado'); document.getElementById('f-pass-act').value = ''; document.getElementById('f-pass-new').value = ''; cargarPerfil(); }
    else toast(d.error || 'Error', 'err');
}

cargarPerfil();
