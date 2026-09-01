import { useEffect, useState, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../context/AuthContext';

interface Position {
  identity?: string;
  name?: string;
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

export const MapView = () => {
  const { token, user, logout } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  const [activeRouteInfo, setActiveRouteInfo] = useState<{ identity: string; name: string }>({
    identity: 'Esperando ruta...',
    name: 'Sin ruta activa',
  });

  const [position, setPosition] = useState<Position>({
    lat: 10.96854,
    lng: -74.78132,
    speed: 0,
  });

  const [historicRoutes, setHistoricRoutes] = useState<[number, number][][]>([]);
  const [activePath, setActivePath] = useState<[number, number][]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--:--');

  const activeRouteInfoRef = useRef(activeRouteInfo);
  activeRouteInfoRef.current = activeRouteInfo;

  const activePathRef = useRef(activePath);
  activePathRef.current = activePath;

  const totalDistance = useMemo(() => {
    const allCoords = [...historicRoutes.flat(), ...activePath];
    return calculateTotalDistance(allCoords);
  }, [historicRoutes, activePath]);

  const totalPointsCount = useMemo(() => {
    const historicCount = historicRoutes.reduce((acc, r) => acc + r.length, 0);
    return historicCount + activePath.length;
  }, [historicRoutes, activePath]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${apiKey}`,
      center: [-74.78132, 10.96854],
      zoom: 15,
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    const el = document.createElement('div');
    el.className = 'pulse-marker';
    el.style.width = '20px';
    el.style.height = '20px';

    marker.current = new maplibregl.Marker({ element: el })
      .setLngLat([-74.78132, 10.96854])
      .addTo(map.current);

    map.current.on('load', () => {
      map.current?.addSource('routes-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current?.addLayer({
        id: 'routes-layer',
        type: 'line',
        source: 'routes-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
        },
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    fetch(`http://localhost:3000/location/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((routeData) => {
        if (routeData && routeData.positions && routeData.positions.length > 0) {
          setActiveRouteInfo({ identity: routeData.identity, name: routeData.name });
          const coords: [number, number][] = routeData.positions.map((p: any) => [p.lat, p.lng]);
          setHistoricRoutes([coords]);
          const latest = routeData.positions[routeData.positions.length - 1];
          setPosition(latest);
        }
      })
      .catch((err) => console.error('Error al obtener la ruta activa:', err));

    const socket = io('http://localhost:3000', { auth: { token } });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('locationUpdated', (data: Position) => {
      if (data.identity && data.identity !== activeRouteInfoRef.current.identity) {
        setActiveRouteInfo({ identity: data.identity, name: data.name || 'Nueva Ruta' });
        if (activePathRef.current.length > 0) {
          setHistoricRoutes((prev) => [...prev, activePathRef.current]);
          setActivePath([]);
        }
      }

      setPosition(data);
      setActivePath((prev) => [...prev, [data.lat, data.lng]]);
      setLastUpdatedTime(new Date().toLocaleTimeString());
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('locationUpdated');
      socket.disconnect();
    };
  }, [token]);

  // Renderizado dinámico de rutas sobre el mapa
  useEffect(() => {
    if (!map.current) return;

    marker.current?.setLngLat([position.lng, position.lat]);
    map.current.easeTo({ center: [position.lng, position.lat], duration: 1000 });

    const source = map.current.getSource('routes-source') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: maplibregl.GeoJSONFeature[] = [];
    const totalHistoric = historicRoutes.length;

    // Gradiente de tonos de azul para rutas históricas según antigüedad
    const blueShades = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];

    historicRoutes.forEach((routeCoords, index) => {
      if (routeCoords.length < 2) return;

      // recencyIndex: 0 = Ruta inmediatamente anterior a la activa
      const recencyIndex = totalHistoric - 1 - index;

      // Asignación de color según recencia
      const color = blueShades[recencyIndex] || '#e2e8f0';

      // Opacidad decreciente (de 0.75 a un mínimo de 0.15)
      const opacity = Math.max(0.15, 0.75 - recencyIndex * 0.15);

      // Grosor decreciente (de 5px a un mínimo de 2px)
      const width = Math.max(2, 5 - recencyIndex);

      features.push({
        type: 'Feature',
        properties: { color, opacity, width },
        geometry: {
          type: 'LineString',
          coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
        },
      } as unknown as maplibregl.GeoJSONFeature);
    });

    // Ruta Activa actual: Azul intenso brillante, opacidad completa y mayor grosor
    if (activePath.length > 1) {
      features.push({
        type: 'Feature',
        properties: { color: '#1d4ed8', opacity: 1.0, width: 6 },
        geometry: {
          type: 'LineString',
          coordinates: activePath.map(([lat, lng]) => [lng, lat]),
        },
      } as unknown as maplibregl.GeoJSONFeature);
    }

    source.setData({
      type: 'FeatureCollection',
      features: features as unknown as maplibregl.GeoJSONFeature[],
    });
  }, [position, historicRoutes, activePath]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* PANEL SUPERIOR */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '15px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: '#3b82f6', fontSize: '22px' }}>⚡</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
              GeoTracker <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.3)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px' }}>PRO</span>
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>
              Ruta: {activeRouteInfo.name}
            </p>
          </div>
        </div>

        <div style={{ height: '28px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px 14px', borderRadius: '20px' }}>
          <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: isConnected ? '#10b981' : '#ef4444' }}></span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: isConnected ? '#10b981' : '#ef4444' }}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <div style={{ height: '28px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffffff', display: 'block' }}>{user?.name}</span>
            <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '600' }}>{user?.role}</span>
          </div>
          <button onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </div>

      {/* PANEL INFERIOR DE TELEMETRÍA */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          borderRadius: '18px',
          background: 'rgba(15, 23, 42, 0.92)'
        }}
      >
        <div>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block' }}>Velocidad</span>
          <span style={{ fontSize: '32px', fontWeight: '900', fontFamily: 'monospace', color: '#60a5fa' }}>
            {position.speed} <span style={{ fontSize: '12px', color: '#94a3b8' }}>km/h</span>
          </span>
        </div>

        <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ fontFamily: 'monospace' }}>
          <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Distancia</span><strong>{totalDistance.toFixed(2)} km</strong></div>
          <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Puntos</span><strong>{totalPointsCount}</strong></div>
        </div>

        <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#f1f5f9' }}>
          <div><span style={{ color: '#64748b' }}>LAT:</span> {position.lat.toFixed(5)}</div>
          <div><span style={{ color: '#64748b' }}>LNG:</span> {position.lng.toFixed(5)}</div>
        </div>

        <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block' }}>Último Paquete</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>{lastUpdatedTime}</span>
        </div>
      </div>

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};