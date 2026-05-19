function togglePass() {
  const input = document.getElementById('contrasena');
  input.type = input.type === 'password' ? 'text' : 'password';
}

document.getElementById('btnLogin').addEventListener('click', login);

document.getElementById('contrasena').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});

async function login() {
  const usuario = document.getElementById('usuario').value.trim();
  const contrasena = document.getElementById('contrasena').value.trim();
  const errorEl = document.getElementById('error');
  const btnLogin = document.getElementById('btnLogin');

  errorEl.textContent = '';

  if (!usuario || !contrasena) {
    errorEl.textContent = 'Por favor completa todos los campos';
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Entrando...';

  try {
    const respuesta = await fetch('https://joyful-spontaneity-production-409d.up.railway.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contrasena }),
    });

    const data = await respuesta.json();

    if (respuesta.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      window.location.replace('/inicio');
    } else {
      errorEl.textContent = data.mensaje || 'Error al iniciar sesión';
    }

  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      mensaje: "Error interno en login",
      error: error.message
    });
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Entrar';
  }
}