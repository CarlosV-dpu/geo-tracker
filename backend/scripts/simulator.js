const { io } = require('socket.io-client');

// Conectar al gateway de WebSockets en NestJS
const socket = io('http://localhost:3000');

const routeId = 'ruta-1';

// Coordenadas iniciales de prueba
let lat = 10.96854;
let lng = -74.78132;
let speed = 35;

socket.on('connect', () => {
  console.log('⚡ Conectado al servidor WebSocket (ID:', socket.id, ')');
  console.log(`🚗 Iniciando transmisión de coordenadas para la ruta: "${routeId}"...\n`);

  // Emitir nueva posición cada 1.5 segundos
  setInterval(() => {
    // Simular desplazamiento gradual (dirección Noreste)
    lat += 0.0003 + (Math.random() - 0.5) * 0.00005;
    lng += 0.0003 + (Math.random() - 0.5) * 0.00005;
    speed = Math.floor(30 + Math.random() * 20); // Velocidad entre 30 y 50 km/h

    const payload = {
      routeId,
      lat,
      lng,
      speed,
    };

    console.log(`📍 Enviado -> Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)} | Vel: ${speed} km/h`);
    socket.emit('updateLocation', payload);
  }, 1500);
});

socket.on('disconnect', () => {
  console.log('❌ Conexión cerrada con el servidor.');
});