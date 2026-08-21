import { useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';

const startIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [32, 52],
  iconAnchor: [16, 52],
});

const livePulseIcon = L.divIcon({
  className: 'pulse-marker-container',
  html: `<div class="pulse-marker" style="width: 28px; height: 28px;"></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const socket = io('http://localhost:3000');

interface Position {
  lat: number;
  lng: number;
  speed: number;
  timestamp?: string;
}

const calculateTotalDistance = (coords: [number, number][]): number => {
  if (coords.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [lat1, lon1] = coords[i];
    const [lat2, lon2] = coords[i + 1];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
};

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

export const MapView = () => {
  const routeId = 'ruta-1';

  const [position, setPosition] = useState<Position>({
    lat: 10.96854,
    lng: -74.78132,
    speed: 0,
  });

  const [lastStoredPosition, setLastStoredPosition] = useState<Position | null>(null);
  const [path, setPath] = useState<[number, number][]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--:--');

  const totalDistance = useMemo(() => calculateTotalDistance(path), [path]);

  useEffect(() => {
    fetch(`http://localhost:3000/location/history/${routeId}`)
      .then((res) => res.json())
      .then((data: Position[]) => {
        if (data && data.length > 0) {
          const coords: [number, number][] = data.map((p) => [p.lat, p.lng]);
          setPath(coords);

          const latest = data[data.length - 1];
          setLastStoredPosition(latest);
          setPosition(latest);
        }
      })
      .catch((err) => console.error('Error al cargar historial previo:', err));

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.emit('joinRoute', { routeId });

    socket.on('locationUpdated', (data: Position) => {
      const newCoord: [number, number] = [data.lat, data.lng];
      setPosition(data);
      setPath((prevPath) => [...prevPath, newCoord]);
      setLastUpdatedTime(new Date().toLocaleTimeString());
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('locationUpdated');
    };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* 1. ENCABEZADO SUPERIOR XL (BRANDING & ESTADO) */}
      <div 
        className="glass-panel" 
        style={{
          position: 'absolute',
          top: '32px',
          left: '364px',
          transform: 'translateX(-50%) scale(2.5)',
          transformOrigin: 'top left',
          zIndex: 1000,
          padding: '22px 36px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
          border: '2px solid rgba(255,255,255,0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#3b82f6', fontSize: '40px' }}>⚡</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: '900', letterSpacing: '0.5px', color: '#ffffff' }}>
              GeoTracker <span style={{ fontSize: '15px', background: 'rgba(59,130,246,0.3)', color: '#60a5fa', padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.5)', fontWeight: 'bold', verticalAlign: 'middle' }}>PRO</span>
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#94a3b8', fontWeight: '600' }}>
              Consola de Monitoreo en Vivo
            </p>
          </div>
        </div>

        <div style={{ height: '48px', width: '2px', background: 'rgba(255,255,255,0.2)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.5)', padding: '10px 20px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span style={{ height: '14px', width: '14px', borderRadius: '50%', backgroundColor: isConnected ? '#10b981' : '#ef4444', boxShadow: isConnected ? '0 0 16px #10b981' : 'none' }}></span>
          <span style={{ fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace', color: isConnected ? '#10b981' : '#ef4444', letterSpacing: '1px' }}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* 2. PANEL DE TELEMETRÍA INFERIOR XL (RESPONSIVE / HIGH-DPI) */}
      <div 
        className="glass-panel" 
        style={{
          position: 'absolute',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%) scale(2.5)',
          transformOrigin: 'bottom center',
          zIndex: 1000,
          padding: '28px 56px',
          display: 'flex',
          alignItems: 'center',
          gap: '50px',
          borderRadius: '28px',
          maxWidth: '95vw',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          border: '2px solid rgba(255,255,255,0.15)',
          background: 'rgba(15, 23, 42, 0.92)'
        }}
      >
        {/* VEHÍCULO Y VELOCIDAD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <div>
            <span style={{ fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px', display: 'block' }}>Vehículo</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>Unidad V-01</span>
          </div>
          <div style={{ height: '60px', width: '2px', background: 'rgba(255,255,255,0.2)' }}></div>
          <div>
            <span style={{ fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px', display: 'block' }}>Velocidad</span>
            <span style={{ fontSize: '64px', fontWeight: '900', fontFamily: 'monospace', color: '#60a5fa', lineHeight: '1' }}>
              {position.speed} <span style={{ fontSize: '20px', fontWeight: '600', color: '#94a3b8' }}>km/h</span>
            </span>
          </div>
        </div>

        <div style={{ height: '70px', width: '2px', background: 'rgba(255,255,255,0.2)' }}></div>

        {/* DISTANCIA Y PUNTOS */}
        <div style={{ display: 'flex', gap: '40px', fontFamily: 'monospace' }}>
          <div>
            <span style={{ fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px', display: 'block', fontFamily: 'sans-serif' }}>Distancia Traza</span>
            <span style={{ fontSize: '28px', fontWeight: '800', color: '#ffffff' }}>{totalDistance.toFixed(2)} <span style={{ fontSize: '18px', color: '#94a3b8' }}>km</span></span>
          </div>
          <div>
            <span style={{ fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px', display: 'block', fontFamily: 'sans-serif' }}>Puntos Recibidos</span>
            <span style={{ fontSize: '28px', fontWeight: '800', color: '#ffffff' }}>{path.length}</span>
          </div>
        </div>

        <div style={{ height: '70px', width: '2px', background: 'rgba(255,255,255,0.2)' }}></div>

        {/* COORDENADAS LAT / LNG */}
        <div style={{ fontFamily: 'monospace', fontSize: '18px', color: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div><span style={{ color: '#64748b', fontWeight: 'bold' }}>LAT:</span> {position.lat.toFixed(5)}</div>
          <div><span style={{ color: '#64748b', fontWeight: 'bold' }}>LNG:</span> {position.lng.toFixed(5)}</div>
        </div>

        <div style={{ height: '70px', width: '2px', background: 'rgba(255,255,255,0.2)' }}></div>

        {/* ÚLTIMA ACTUALIZACIÓN */}
        <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
          <span style={{ fontSize: '14px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', letterSpacing: '1px', display: 'block', fontFamily: 'sans-serif' }}>Último Paquete</span>
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8' }}>{lastUpdatedTime}</span>
        </div>
      </div>

      {/* 3. MAPA LEAFLET A PANTALLA COMPLETA */}
      <MapContainer
        center={[10.96854, -74.78132]}
        zoom={17}
        maxZoom={20}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <MapController center={[position.lat, position.lng]} />

        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
          detectRetina={true}
          tileSize={2048}
          zoomOffset={-3}
          maxZoom={20}
          maxNativeZoom={19}
        />

        {path.length > 1 && (
          <Polyline
            positions={path}
            color="#2563eb"
            weight={7}
            opacity={0.85}
          />
        )}

        {lastStoredPosition && (
          <Marker position={[lastStoredPosition.lat, lastStoredPosition.lng]} icon={startIcon}>
            <Popup>
              <div style={{ padding: '8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>🏁 Punto Inicial BD</p>
              </div>
            </Popup>
          </Marker>
        )}

        <Marker position={[position.lat, position.lng]} icon={livePulseIcon}>
          <Popup>
            <div style={{ padding: '8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px', color: '#3b82f6' }}>⚡ Vehículo V-01 (En Vivo)</p>
              <p style={{ margin: '6px 0 0 0', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '18px' }}>{position.speed} km/h</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

    </div>
  );
};