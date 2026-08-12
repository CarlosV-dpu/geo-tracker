const { io } = require('socket.io-client');

// Conectar al gateway de WebSockets en NestJS
const socket = io('http://localhost:3000');
const routeId = 'ruta-1';

// Definimos una ruta con varios puntos (waypoints) para que no sea una línea recta
const waypoints = [
  { lat: 10.96854, lng: -74.78132 }, // Punto inicial
  { lat: 10.97250, lng: -74.78132 }, // Sube hacia el Norte
  { lat: 10.97250, lng: -74.77600 }, // Gira a la derecha (Este)
  { lat: 10.96600, lng: -74.77600 }, // Baja hacia el Sur
  { lat: 10.96600, lng: -74.78132 }, // Gira a la izquierda (Oeste)
];

let currentTargetIndex = 1;
let lat = waypoints[0].lat;
let lng = waypoints[0].lng;
let progress = 0; // Porcentaje del 0 al 100

socket.on('connect', () => {
  console.log('⚡ Conectado al servidor WebSocket (ID:', socket.id, ')');
  console.log(`🚗 Iniciando transmisión de coordenadas para la ruta: "${routeId}"...\n`);

  setInterval(() => {
    const target = waypoints[currentTargetIndex];
    
    // Calcular distancia hasta el siguiente punto objetivo
    const dLat = target.lat - lat;
    const dLng = target.lng - lng;
    const distance = Math.sqrt(dLat * dLat + dLng * dLng);

    // Si llegamos muy cerca del objetivo, pasamos al siguiente punto
    if (distance < 0.0005) {
      currentTargetIndex = (currentTargetIndex + 1) % waypoints.length;
    }

    // Moverse hacia el punto objetivo
    const step = 0.0002; // Tamaño del paso (velocidad en el mapa)
    const angle = Math.atan2(dLat, dLng);
    lat += Math.sin(angle) * step;
    lng += Math.cos(angle) * step;

    // Añadir un micro-ruido para que el movimiento se vea orgánico (temblor de GPS real)
    lat += (Math.random() - 0.5) * 0.00003;
    lng += (Math.random() - 0.5) * 0.00003;

    // Generar velocidad aleatoria (0 a 80 km/h)
    const speed = Math.floor(Math.random() * 80); 

    const payload = {
      routeId,
      lat,
      lng,
      speed
    };

    console.log(`📍 Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} | Vel: ${speed} km/h`);
    socket.emit('updateLocation', payload);
  }, 1500); // Actualización cada 1.5s
});

socket.on('disconnect', () => {
  console.log('❌ Conexión cerrada con el servidor.');
});