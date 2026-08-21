import { useEffect, useState, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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

export const MapView = () => {
  const routeId = 'ruta-1';
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  const [position, setPosition] = useState<Position>({
    lat: 10.96854,
    lng: -74.78132,
    speed: 0,
  });

  const [path, setPath] = useState<[number, number][]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--:--');

  const totalDistance = useMemo(() => calculateTotalDistance(path), [path]);

  // 1. Inicialización del Mapa MapLibre GL
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      // Estilo vectorial público (Puedes cambiarlo después por MapTiler para un diseño oscuro o claro custom)
      style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${apiKey}`,
      center: [-74.78132, 10.96854], // Longitud, Latitud (Ojo: MapLibre usa [LNG, LAT])
      zoom: 15,
    });

    // 🛠️ FIX: Manejar íconos faltantes del estilo para limpiar la consola
    map.current.on('styleimagemissing', (e) => {
      const id = e.id;
      if (map.current && !map.current.hasImage(id)) {
        // Creamos un píxel transparente de 1x1
        map.current.addImage(id, {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        });
      }
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Crear marcador para el vehículo
    const el = document.createElement('div');
    el.className = 'pulse-marker';
    el.style.width = '20px';
    el.style.height = '20px';

    marker.current = new maplibregl.Marker({ element: el })
      .setLngLat([-74.78132, 10.96854])
      .addTo(map.current);

    map.current.on('load', () => {
      // 1. Obtener el estilo del mapa
      const style = map.current?.getStyle();
      if (!style || !style.layers) return;

      // 2. Modificar TODAS las capas que rendericen texto (símbolos con text-field)
      style.layers.forEach((layer) => {
        const isTextLayer =
          layer.type === 'symbol' &&
          layer.layout &&
          'text-field' in layer.layout;

        if (isTextLayer) {
          // 3. Aplicar una escala de tamaño legible y clara según el nivel de zoom
          map.current?.setLayoutProperty(layer.id, 'text-size', [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 24, // A zoom alejado (10) -> fuente de 16px
            14, 16, // A zoom medio (14)   -> fuente de 24px
            17, 16  // A zoom cercano (17) -> fuente de 34px
          ]);
        }
      });

      // Capa GeoJSON para la línea del recorrido
      map.current?.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      });

      map.current?.addLayer({
        id: 'route-layer',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 6,
          'line-opacity': 0.85,
        },
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // 2. Conexión WebSockets e Historial
  useEffect(() => {
    fetch(`http://localhost:3000/location/history/${routeId}`)
      .then((res) => res.json())
      .then((data: Position[]) => {
        if (data && data.length > 0) {
          const coords: [number, number][] = data.map((p) => [p.lat, p.lng]);
          setPath(coords);
          const latest = data[data.length - 1];
          setPosition(latest);
        }
      })
      .catch((err) => console.error('Error al cargar historial previo:', err));

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.emit('joinRoute', { routeId });

    socket.on('locationUpdated', (data: Position) => {
      setPosition(data);
      setPath((prevPath) => [...prevPath, [data.lat, data.lng]]);
      setLastUpdatedTime(new Date().toLocaleTimeString());
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('locationUpdated');
    };
  }, []);

  // 3. Actualizar la posición del vehículo y la línea en MapLibre
  useEffect(() => {
    if (!map.current) return;

    // Mover el marcador a la nueva posición
    marker.current?.setLngLat([position.lng, position.lat]);

    // Centrar mapa suavemente
    map.current.easeTo({ center: [position.lng, position.lat], duration: 1000 });

    // Actualizar la trazada de la ruta
    const geojsonSource = map.current.getSource('route') as maplibregl.GeoJSONSource;
    if (geojsonSource && path.length > 0) {
      // MapLibre requiere [LNG, LAT]
      const formattedCoords = path.map(([lat, lng]) => [lng, lat]);
      geojsonSource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: formattedCoords,
        },
      });
    }
  }, [position, path]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>

      {/* PANEL SUPERIOR */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '15px',
          left: '50%',
          transform: 'translateX(-50%) scale(1.0)',
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
              GeoTracker <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.3)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.5)', fontWeight: 'bold' }}>PRO</span>
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
              Consola de Monitoreo en Vivo
            </p>
          </div>
        </div>

        <div style={{ height: '28px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.4)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <span style={{ height: '10px', width: '10px', borderRadius: '50%', backgroundColor: isConnected ? '#10b981' : '#ef4444', boxShadow: isConnected ? '0 0 10px #10b981' : 'none' }}></span>
          <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: isConnected ? '#10b981' : '#ef4444' }}>
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {/* PANEL INFERIOR DE TELEMETRÍA */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%) scale(1.2)',
          zIndex: 10,
          padding: '16px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          borderRadius: '18px',
          maxWidth: '92vw',
          background: 'rgba(15, 23, 42, 0.92)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block' }}>Vehículo</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#ffffff' }}>Unidad V-01</span>
          </div>
          <div style={{ height: '36px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block' }}>Velocidad</span>
            <span style={{ fontSize: '32px', fontWeight: '900', fontFamily: 'monospace', color: '#60a5fa', lineHeight: '1' }}>
              {position.speed} <span style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>km/h</span>
            </span>
          </div>
        </div>

        <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ display: 'flex', gap: '20px', fontFamily: 'monospace' }}>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block', fontFamily: 'sans-serif' }}>Distancia Traza</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>{totalDistance.toFixed(2)} <span style={{ fontSize: '11px', color: '#94a3b8' }}>km</span></span>
          </div>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block', fontFamily: 'sans-serif' }}>Puntos Recibidos</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>{path.length}</span>
          </div>
        </div>

        <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#f1f5f9', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div><span style={{ color: '#64748b', fontWeight: 'bold' }}>LAT:</span> {position.lat.toFixed(5)}</div>
          <div><span style={{ color: '#64748b', fontWeight: 'bold' }}>LNG:</span> {position.lng.toFixed(5)}</div>
        </div>

        <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block', fontFamily: 'sans-serif' }}>Último Paquete</span>
          <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>{lastUpdatedTime}</span>
        </div>
      </div>

      {/* CONTENEDOR DEL MAPA VECORiAL */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

    </div>
  );
};