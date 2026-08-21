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

interface RouteSegment {
  id: string;
  coords: [number, number][]; // Array de [lat, lng]
  color: string;
  opacity: number;
  width: number;
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

  // Estado separado: Historial de rutas anteriores vs Ruta activa en vivo
  const [historicRoutes, setHistoricRoutes] = useState<[number, number][][]>([]);
  const [activePath, setActivePath] = useState<[number, number][]>([]);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('--:--:--');

  // Calcular distancia total combinando historial y ruta activa
  const totalDistance = useMemo(() => {
    const allCoords = [...historicRoutes.flat(), ...activePath];
    return calculateTotalDistance(allCoords);
  }, [historicRoutes, activePath]);

  // Total de puntos sumando el historial y la ruta activa
  const totalPointsCount = useMemo(() => {
    const historicCount = historicRoutes.reduce((acc, r) => acc + r.length, 0);
    return historicCount + activePath.length;
  }, [historicRoutes, activePath]);

  // 1. Inicialización del Mapa MapLibre GL
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${apiKey}`,
      center: [-74.78132, 10.96854], // [LNG, LAT]
      zoom: 15,
    });

    // Manejar íconos faltantes
    map.current.on('styleimagemissing', (e) => {
      const id = e.id;
      if (map.current && !map.current.hasImage(id)) {
        map.current.addImage(id, {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0]),
        });
      }
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Marcador para el vehículo
    const el = document.createElement('div');
    el.className = 'pulse-marker';
    el.style.width = '20px';
    el.style.height = '20px';

    marker.current = new maplibregl.Marker({ element: el })
      .setLngLat([-74.78132, 10.96854])
      .addTo(map.current);

    map.current.on('load', () => {
      const style = map.current?.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          const isTextLayer =
            layer.type === 'symbol' &&
            layer.layout &&
            'text-field' in layer.layout;

          if (isTextLayer) {
            map.current?.setLayoutProperty(layer.id, 'text-size', [
              'interpolate',
              ['linear'],
              ['zoom'],
              10, 24,
              14, 16,
              17, 16
            ]);
          }
        });
      }

      // Fuente GeoJSON tipo FeatureCollection para múltiples líneas
      map.current?.addSource('routes-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Capa con expresiones dinámicas para renderizar color, grosor y opacidad por Feature
      map.current?.addLayer({
        id: 'routes-layer',
        type: 'line',
        source: 'routes-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
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

  // 2. Carga de Historial y Conexión WebSocket
  useEffect(() => {
    fetch(`http://localhost:3000/location/history/${routeId}`)
      .then((res) => res.json())
      .then((data: Position[]) => {
        if (data && data.length > 0) {
          const coords: [number, number][] = data.map((p) => [p.lat, p.lng]);
          
          // Guardamos el historial de BD como una ruta previa
          setHistoricRoutes([coords]);

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
      // Los nuevos puntos recibidos en vivo van a la ruta activa
      setActivePath((prev) => [...prev, [data.lat, data.lng]]);
      setLastUpdatedTime(new Date().toLocaleTimeString());
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('locationUpdated');
    };
  }, []);

  // 3. Renderizar y actualizar todas las rutas en MapLibre
  useEffect(() => {
    if (!map.current) return;

    // Actualizar posición del vehículo y centrar
    marker.current?.setLngLat([position.lng, position.lat]);
    map.current.easeTo({ center: [position.lng, position.lat], duration: 1000 });

    const source = map.current.getSource('routes-source') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: maplibregl.GeoJSONFeature[] = [];

    // A. Agregar Rutas Históricas (Oscuras / Atenuadas)
    historicRoutes.forEach((routeCoords, index) => {
      if (routeCoords.length < 2) return;
      features.push({
        type: 'Feature',
        properties: {
          // Si hay varias históricas, podemos ir atenuándolas por antigüedad
          color: index === historicRoutes.length - 1 ? '#475569' : '#1e293b', 
          opacity: 0.6,
          width: 4,
        },
        geometry: {
          type: 'LineString',
          coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
        },
      } as unknown as maplibregl.GeoJSONFeature);
    });

    // B. Agregar Ruta Activa (Azul Vibrante en Vivo)
    if (activePath.length > 1) {
      features.push({
        type: 'Feature',
        properties: {
          color: '#2563eb', // Azul vivo
          opacity: 0.95,
          width: 6,
        },
        geometry: {
          type: 'LineString',
          coordinates: activePath.map(([lat, lng]) => [lng, lat]),
        },
      } as unknown as maplibregl.GeoJSONFeature);
    }

    // Actualizar la fuente de datos del mapa
    source.setData({
      type: 'FeatureCollection',
      features: features as unknown as GeoJSON.Feature[],
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
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>{totalPointsCount}</span>
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

      {/* CONTENEDOR DEL MAPA VECTORIAL */}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

    </div>
  );
};