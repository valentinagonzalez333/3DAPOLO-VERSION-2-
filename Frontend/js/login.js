// ─── Toggle mostrar/ocultar contraseña ───
function togglePass() {
    const input = document.getElementById('contrasena');
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ─── Login ───
document.getElementById('btnLogin').addEventListener('click', login);

// También al presionar Enter
document.getElementById('contrasena').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
});

async function login() {
    const usuario    = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value.trim();
    const errorEl    = document.getElementById('error');
    const btnLogin   = document.getElementById('btnLogin');

    // Limpiar error anterior
    errorEl.textContent = '';

    // Validar campos vacíos
    if (!usuario || !contrasena) {
        errorEl.textContent = 'Por favor completa todos los campos';
        return;
    }

    // Deshabilitar botón mientras carga
    btnLogin.disabled    = true;
    btnLogin.textContent = 'Entrando...';

    try {
        const respuesta = await fetch('http://localhost:4000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, contrasena })
        });

        const data = await respuesta.json();

        if (respuesta.ok) {
            // Guardar sesión en localStorage
            localStorage.setItem('token',   data.token);
            localStorage.setItem('usuario', JSON.stringify(data.usuario));

            // Redirigir al dashboard
            window.location.href = '../pages/panel.html';
        } else {
            errorEl.textContent = data.mensaje || 'Error al iniciar sesión';
        }

    } catch (error) {
        errorEl.textContent = 'No se pudo conectar con el servidor';
        console.error(error);
    } finally {
        // Rehabilitar botón siempre
        btnLogin.disabled    = false;
        btnLogin.textContent = 'Entrar';
    }
}