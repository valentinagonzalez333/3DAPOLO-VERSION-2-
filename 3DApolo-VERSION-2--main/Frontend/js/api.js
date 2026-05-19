// api.js — helper compartido para todas las páginas nuevas
const apiFetch = async (url, opts = {}) => {
  const token = localStorage.getItem('token') || '';
  
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',        // evita que el middleware devuelva HTML
    'Authorization': `Bearer ${token}`,
    ...(opts.headers || {}),
  };

  let res;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (e) {
    console.error('[apiFetch] Error de red:', url, e);
    return { error: 'Error de red. Verifica tu conexión.' };
  }

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login';
    return null;
  }
  if (res.status === 403) return { error: 'Sin permisos suficientes.' };

  // Si la respuesta no es JSON (HTML de error), atrapar el parse error
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    console.error('[apiFetch] Respuesta no-JSON:', res.status, url);
    return { error: `Error del servidor (${res.status})` };
  }

  return res.json();
};
