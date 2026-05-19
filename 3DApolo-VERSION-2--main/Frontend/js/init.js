/* init.js — inicialización común para todas las páginas */
lucide.createIcons();

const btnMenu = document.getElementById('btn');
if (btnMenu) {
  btnMenu.addEventListener('click', () =>
    document.getElementById('menu').classList.toggle('activo'));
}

const btnModo = document.getElementById('btn_modo');
if (btnModo) {
  // Restore saved mode
  if (localStorage.getItem('mode') === 'dark') {
    document.body.classList.add('dark-mode');
    btnModo.checked = true;
  }
  btnModo.addEventListener('change', function () {
    document.body.classList.toggle('dark-mode', this.checked);
    localStorage.setItem('mode', this.checked ? 'dark' : 'light');
  });
}

  function cerrarSesion() {
  if (!confirm('¿Cerrar sesión?')) return;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  fetch('/api/auth/logout', { method: 'POST' })
    .finally(() => window.location.replace('/login'));
}
