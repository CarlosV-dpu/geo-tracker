import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const socket = io('http://localhost:3000');

interface Position {
  lat: number;
  lng: number;
  speed: number;
}

export const MapView = () => {
  const routeId = 'ruta-1';

  const [position, setPosition] = useState<Position>({
    lat: 10.96854,
    lng: -74.78132,
    speed: 0,
  });

  const [path, setPath] = useState<[number, number][]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Petición HTTP inicial para traer el historial guardado en PostgreSQL
    const loadHistory = async () => {
      try {
        const response = await fetch(`http://localhost:3000/location/history/${routeId}`);
        const data: Position[] = await response.json();

        if (data.length > 0) {
          // Mapear todas las posiciones almacenadas para la Polyline
          const historicalPath: [number, number][] = data.map((item) => [item.lat, item.lng]);
          setPath(historicalPath);

          // Fijar el marcador en el último punto conocido
          const lastPosition = data[data.length - 1];
          setPosition({
            lat: lastPosition.lat,
            lng: lastPosition.lng,
            speed: lastPosition.speed,
          });
        }
      } catch (error) {
        console.error('Error cargando historial de ruta:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();

    // 2. Suscribirse a la sala de WebSockets
    socket.emit('joinRoute', { routeId });

    // 3. Escuchar nuevas coordenadas y anexarlas a la Polyline existente
    socket.on('locationUpdated', (data: Position) => {
      const newCoord: [number, number] = [data.lat, data.lng];
      setPosition(data);
      setPath((prevPath) => [...prevPath, newCoord]);
    });

    return () => {
      socket.off('locationUpdated');
    };
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative' }}>
      {/* Panel flotante de telemetría */}
      <div
        style={{
          position: 'absolute',
          top: 15,
          right: 15,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          fontSize: '14px',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>📡 Monitoreo en Vivo</h4>
        <div><strong>Estado:</strong> {loading ? 'Cargando historial...' : 'Conectado'}</div>
        <div><strong>Puntos en mapa:</strong> {path.length}</div>
        <div><strong>Velocidad actual:</strong> {position.speed} km/h</div>
      </div>

      <MapContainer
        center={[position.lat, position.lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {path.length > 1 && (
          <Polyline
            positions={path}
            color="#2563eb"
            weight={5}
            opacity={0.85}
          />
        )}

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