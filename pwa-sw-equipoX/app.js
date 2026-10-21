const lista = document.getElementById('lista');
const estado = document.getElementById('estado-red');
const origen = document.getElementById('origen');

function actualizarEstadoRed() {
  estado.textContent = navigator.onLine ? 'En línea' : 'Sin conexión';
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);
actualizarEstadoRed();

async function cargarTareas() {
  try {
    const r = await fetch('data/tareas.json');
    const datos = await r.json();
    lista.innerHTML = datos.tareas.map(t => `<li>${t.titulo}</li>`).join('');
    origen.textContent = 'Versión de los datos: ' + datos.version_datos;
  } catch (e) {
    origen.textContent = 'No fue posible cargar los datos';
  }
}
cargarTareas();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const reg = await navigator.serviceWorker.register('./sw.js');
    console.log('[APP] SW registrado. Scope:', reg.scope);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          document.getElementById('aviso').hidden = false;
          document.getElementById('btn-actualizar').onclick =
            () => nuevo.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  });

  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}
