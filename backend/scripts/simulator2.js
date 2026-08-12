const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');
const routeId = 'ruta-1';

// Puntos clave por donde quieres que pase la ruta en Barranquilla
const waypoints = [
  { lat: 10.96854, lng: -74.78132 }, // Calle 30 aprox.
  { lat: 10.97500, lng: -74.78000 }, // Hacia el Norte
  { lat: 10.97200, lng: -74.77000 }, // Hacia el Este
  { lat: 10.96500, lng: -74.77200 }, // Bajando al Sur
  { lat: 10.96854, lng: -74.78132 }, // Regreso al origen
];

// Función para obtener la ruta exacta por calles desde OSRM
async function getRoadPath(points) {
  const coordinatesString = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      // OSRM devuelve [lng, lat], los mapeamos a {lat, lng}
      return data.routes[0].geometry.coordinates.map(coord => ({
        lat: coord[1],
        lng: coord[0]
      }));
    }
  } catch (error) {
    console.error('⚠️ Error al consultar OSRM, usando puntos directos:', error.message);
  }
  return points;
}

socket.on('connect', async () => {
  console.log('⚡ Conectado al servidor WebSocket (ID:', socket.id, ')');
  console.log('🗺️ Obteniendo trazado de calles reales desde OSRM...');

  // 1. Obtenemos las coordenadas detalladas por la malla vial real
  const streetPath = await getRoadPath(waypoints);
  console.log(`🚗 Ruta generada con ${streetPath.length} puntos sobre calles reales.\n`);

  let currentIndex = 0;

  // 2. Transmisión periódica a través del Socket
  setInterval(() => {
    if (streetPath.length === 0) return;

    const currentPoint = streetPath[currentIndex];

    // Simular variación realista de velocidad urbana (20 km/h a 60 km/h)
    const speed = Math.floor(20 + Math.random() * 40);

    // Micro-ruido de señal GPS (temblor sutil)
    const lat = currentPoint.lat + (Math.random() - 0.5) * 0.00002;
    const lng = currentPoint.lng + (Math.random() - 0.5) * 0.00002;

    const payload = {
      routeId,
      lat,
      lng,
      speed
    };

    console.log(`📍 Puntuación [${currentIndex + 1}/${streetPath.length}] - Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} | Vel: ${speed} km/h`);
    socket.emit('updateLocation', payload);

    // Avanzar al siguiente punto de la calle (y reiniciar en bucle al finalizar)
    currentIndex = (currentIndex + 1) % streetPath.length;
  }, 1200); // Envío cada 1.2 segundos
});

socket.on('disconnect', () => {
  console.log('❌ Conexión cerrada con el servidor.');
});