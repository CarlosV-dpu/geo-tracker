import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { io } from 'socket.io-client';
import L from 'leaflet';

// Corregir el icono por defecto de Leaflet en React/Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Conexión al backend de NestJS
const socket = io('http://localhost:3000');

interface Position {
  lat: number;
  lng: number;
  speed: number;
}

export const MapView = () => {
  const routeId = 'ruta-1';
  // Ubicación inicial por defecto (Barranquilla)
  const [position, setPosition] = useState<Position>({
    lat: 10.96854,
    lng: -74.78132,
    speed: 0,
  });

  useEffect(() => {
    // 1. Unirse a la sala de la ruta
    socket.emit('joinRoute', { routeId });

    // 2. Escuchar coordenadas en tiempo real emitidas por el backend
    socket.on('locationUpdated', (data: Position) => {
      setPosition({
        lat: data.lat,
        lng: data.lng,
        speed: data.speed,
      });
    });

    return () => {
      socket.off('locationUpdated');
    };
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer
        center={[position.lat, position.lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[position.lat, position.lng]}>
          <Popup>
            <strong>Vehículo en monitoreo</strong> <br />
            Velocidad: {position.speed} km/h <br />
            Lat: {position.lat.toFixed(5)}, Lng: {position.lng.toFixed(5)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};