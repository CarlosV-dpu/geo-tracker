const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');
const routeId = 'ruta-1';

// Punto por defecto en caso de que la BD esté vacía o la API no responda
const DEFAULT_START = { lat: 10.96854, lng: -74.78132 };

// Desplazamientos relativos para construir el tramo a partir de la última posición
const stepDeltas = [
  { dLat:  0.00646, dLng:  0.00132 },
  { dLat: -0.00300, dLng:  0.01000 },
  { dLat: -0.00700, dLng: -0.00200 },
  { dLat:  0.00354, dLng: -0.00932 }
];

/**
 * Consulta la última ubicación almacenada en la BD PostgreSQL a través de NestJS
 */
async function getLastLocation(routeId) {
  try {
    const response = await fetch(`http://localhost:3000/location/history/${routeId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const history = await response.json();

    if (Array.isArray(history) && history.length > 0) {
      const lastRecord = history[history.length - 1];
      console.log(`🗄️ Última posición recuperada de Postgres: Lat ${lastRecord.lat}, Lng ${lastRecord.lng}`);
      return { lat: Number(lastRecord.lat), lng: Number(lastRecord.lng) };
    }
  } catch (error) {
    console.warn(`⚠️ No se pudo obtener el historial de la BD (${error.message}). Usando ubicación por defecto.`);
  }

  return DEFAULT_START;
}

/**
 * Genera coordenadas dinámicas sumando los deltas al origen
 */
function generateWaypointsFromDeltas(start, deltas) {
  const points = [{ ...start }];
  let currentLat = start.lat;
  let currentLng = start.lng;

  for (const delta of deltas) {
    currentLat += delta.dLat;
    currentLng += delta.dLng;

    points.push({
      lat: Number(currentLat.toFixed(5)),
      lng: Number(currentLng.toFixed(5))
    });
  }

  return points;
}

// Obtiene la ruta ajustada a la malla vial real usando OSRM
async function getRoadPath(points) {
  const coordinatesString = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
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

  // 1. Consultar la última posición guardada en Postgres
  const startWaypoint = await getLastLocation(routeId);

  // 2. Generar nuevos waypoints desde ese último punto
  const waypoints = generateWaypointsFromDeltas(startWaypoint, stepDeltas);

  // 3. Obtener trazado sobre las calles con OSRM
  console.log('🗺️ Solicitando trazado de calles a OSRM desde la ubicación recuperada...');
  const streetPath = await getRoadPath(waypoints);
  console.log(`🚗 Tramo generado con ${streetPath.length} puntos sobre calles reales.\n`);

  let currentIndex = 0;

  // 4. Transmitir el nuevo trayecto
  setInterval(() => {
    if (streetPath.length === 0) return;

    const currentPoint = streetPath[currentIndex];

    const speed = Math.floor(20 + Math.random() * 40);
    const lat = currentPoint.lat + (Math.random() - 0.5) * 0.00002;
    const lng = currentPoint.lng + (Math.random() - 0.5) * 0.00002;

    const payload = {
      routeId,
      lat,
      lng,
      speed
    };

    console.log(`📍 Punto [${currentIndex + 1}/${streetPath.length}] - Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} | Vel: ${speed} km/h`);
    socket.emit('updateLocation', payload);

    currentIndex = (currentIndex + 1) % streetPath.length;
  }, 1200);
});

socket.on('disconnect', () => {
  console.log('❌ Conexión cerrada con el servidor.');
});