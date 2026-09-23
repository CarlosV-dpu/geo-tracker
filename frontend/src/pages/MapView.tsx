import { useEffect, useState, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAuth } from '../context/AuthContext';

const maplibre = maplibregl as any;
if (maplibre.config) {
  maplibre.config.WORKER_URL = '/maplibre-gl-worker.mjs';
}
maplibre.workerUrl = '/maplibre-gl-worker.mjs';

interface IncomingLocation {
  driverId: number;
  driverName: string;
  identity: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  timestamp?: string;
}

interface DriverData {
  driverId: number;
  driverName: string;
  identity: string;
  routeName: string;
  lat: number;
  lng: number;
  speed: number;
  lastUpdatedTime: string;
  color: string;
  activePath: [number, number][];
  historicRoutes: [number, number][][];
}

// Paleta de colores distintivos para asignación automática por driverId
const PALETTE = [
  '#3b82f6', // Azul
  '#10b981', // Verde
  '#f59e0b', // Ambar
  '#8b5cf6', // Purpura
  '#ec4899', // Rosa
  '#06b6d4', // Cian
  '#f97316', // Naranja
  '#14b8a6', // Turquesa
];

const getDriverColor = (id: number): string => {
  return PALETTE[Math.abs(id) % PALETTE.length];
};

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

  // Mapa de referencias de marcadores MapLibre por ID de conductor
  const markersRef = useRef<Map<number, maplibregl.Marker>>(new Map());

  // Estado que agrupa a todos los conductores activos { [driverId]: DriverData }
  const [drivers, setDrivers] = useState<Record<number, DriverData>>({});
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Conductor seleccionado actualmente para la telemetría
  const selectedDriver = useMemo(() => {
    if (selectedDriverId !== null && drivers[selectedDriverId]) {
      return drivers[selectedDriverId];
    }
    const list = Object.values(drivers);
    return list.length > 0 ? list[0] : null;
  }, [drivers, selectedDriverId]);

  const totalDistance = useMemo(() => {
    if (!selectedDriver) return 0;
    const allCoords = [...selectedDriver.historicRoutes.flat(), ...selectedDriver.activePath];
    return calculateTotalDistance(allCoords);
  }, [selectedDriver]);

  const totalPointsCount = useMemo(() => {
    if (!selectedDriver) return 0;
    const historicCount = selectedDriver.historicRoutes.reduce((acc, r) => acc + r.length, 0);
    return historicCount + selectedDriver.activePath.length;
  }, [selectedDriver]);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Inicialización del Mapa Base
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_API_KEY;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v4/style.json?key=${apiKey}`,
      center: [-74.78132, 10.96854],
      zoom: 14,
    });

    map.current = mapInstance;

    mapInstance.setMissingStyleImageResolver((id) => {
      if (!mapInstance.hasImage(id)) {
        // Genera un píxel transparente en canvas para satisfacer la petición de MapLibre
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, 1, 1);
          mapInstance.addImage(id, imageData,{ sdf: true });
        }
      }
    });

    mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right');

    mapInstance.on('load', () => {
      mapInstance?.addSource('routes-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      mapInstance?.addLayer({
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
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      mapInstance.remove();
      map.current = null;
    };
  }, []);

  // Carga inicial de ruta activa REST y Conexión WebSockets
  useEffect(() => {
    if (!token) return;

    fetch(`${API_URL}/location/active`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((routeData) => {
        if (routeData && routeData.positions && routeData.positions.length > 0) {
          const driverId = routeData.driverId || 1;
          const coords: [number, number][] = routeData.positions.map((p: any) => [p.lat, p.lng]);
          const latest = routeData.positions[routeData.positions.length - 1];

          setDrivers((prev) => ({
            ...prev,
            [driverId]: {
              driverId,
              driverName: routeData.driverName || `Conductor #${driverId}`,
              identity: routeData.identity,
              routeName: routeData.name || 'Ruta Activa',
              lat: latest.lat,
              lng: latest.lng,
              speed: latest.speed || 0,
              lastUpdatedTime: new Date().toLocaleTimeString(),
              color: getDriverColor(driverId),
              activePath: coords,
              historicRoutes: [],
            },
          }));
          setSelectedDriverId(driverId);
        }
      })
      .catch((err) => console.error('Error al obtener la ruta activa:', err));

    const socket = io(`${API_URL}`, { auth: { token } });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('locationUpdated', (data: IncomingLocation) => {
      const driverId = data.driverId || 1;
      const now = new Date().toLocaleTimeString();

      setDrivers((prev) => {
        const currentDriver = prev[driverId];
        const color = currentDriver ? currentDriver.color : getDriverColor(driverId);

        let historicRoutes = currentDriver ? [...currentDriver.historicRoutes] : [];
        let activePath: [number, number][] = currentDriver ? [...currentDriver.activePath] : [];

        // Si la ruta cambió para este conductor, archivar la anterior
        if (currentDriver && data.identity && data.identity !== currentDriver.identity) {
          if (activePath.length > 0) {
            historicRoutes.push(activePath);
            activePath = [];
          }
        }

        activePath.push([data.lat, data.lng]);

        return {
          ...prev,
          [driverId]: {
            driverId,
            driverName: data.driverName || `Conductor #${driverId}`,
            identity: data.identity,
            routeName: data.name || 'Ruta sin nombre',
            lat: data.lat,
            lng: data.lng,
            speed: data.speed,
            lastUpdatedTime: now,
            color,
            activePath,
            historicRoutes,
          },
        };
      });

      // Seleccionar automáticamente el primer conductor emitiente si no hay ninguno activo
      setSelectedDriverId((curr) => (curr === null ? driverId : curr));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('locationUpdated');
      socket.disconnect();
    };
  }, [token]);

  // Gestión dinámica de marcadores por conductor en el mapa
  useEffect(() => {
    if (!map.current) return;

    Object.values(drivers).forEach((driver) => {
      let marker = markersRef.current.get(driver.driverId);

      if (!marker) {
        // Elemento contenedor que MapLibre usa para posicionar (translate3d)
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-driver-marker-wrapper';

        // Elemento visual interno sobre el cual aplicaremos el transform: scale()
        const inner = document.createElement('div');
        inner.className = 'custom-driver-marker-inner';
        inner.style.width = '22px';
        inner.style.height = '22px';
        inner.style.borderRadius = '50%';
        inner.style.backgroundColor = driver.color;
        inner.style.border = '3px solid #ffffff';
        inner.style.boxShadow = `0 0 10px ${driver.color}`;
        inner.style.cursor = 'pointer';
        inner.style.transition = 'transform 0.2s ease, border-color 0.2s ease';

        wrapper.appendChild(inner);

        // Selección al hacer clic directo en el marcador
        wrapper.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedDriverId(driver.driverId);
          map.current?.easeTo({ center: [driver.lng, driver.lat], zoom: 16, duration: 800 });
        });

        marker = new maplibregl.Marker({ element: wrapper })
          .setLngLat([driver.lng, driver.lat])
          .addTo(map.current!);

        markersRef.current.set(driver.driverId, marker);
      } else {
        marker.setLngLat([driver.lng, driver.lat]);
      }

      // Se modifica ÚNICAMENTE el hijo interno para no romper la posición 3D de MapLibre
      const wrapperEl = marker.getElement();
      const innerEl = wrapperEl.querySelector('.custom-driver-marker-inner') as HTMLDivElement;

      if (innerEl) {
        if (driver.driverId === selectedDriverId) {
          innerEl.style.transform = 'scale(1.4)';
          innerEl.style.border = '3px solid #ffffff';
          wrapperEl.style.zIndex = '1000';
        } else {
          innerEl.style.transform = 'scale(1.0)';
          innerEl.style.border = '2px solid rgba(255,255,255,0.7)';
          wrapperEl.style.zIndex = '1';
        }
      }
    });
  }, [drivers, selectedDriverId]);

  // Dibujado de capas GeoJSON para todas las trayectorias con degradado de opacidad
  useEffect(() => {
    if (!map.current) return;

    const source = map.current.getSource('routes-source') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: maplibregl.GeoJSONFeature[] = [];
    const MAX_HISTORIC_ROUTES = 5; // Número máximo de rutas pasadas a mostrar

    // Escala de opacidad progresiva (Ruta previa 1 -> Ruta previa 5)
    const OPACITY_DECAY = [0.65, 0.45, 0.30, 0.18, 0.08];

    Object.values(drivers).forEach((driver) => {
      const isSelected = driver.driverId === selectedDriverId;
      const historicCount = driver.historicRoutes.length;

      // 1. Rutas Históricas del Conductor (con degradado según antigüedad)
      driver.historicRoutes.forEach((routeCoords, index) => {
        if (routeCoords.length < 2) return;

        // 0 = la más reciente completada, 1 = la anterior a esa, etc.
        const indexFromLatest = historicCount - 1 - index;

        // Omitir rutas más antiguas que el límite deseado (desaparecen progresivamente)
        if (indexFromLatest >= MAX_HISTORIC_ROUTES) return;

        // Obtener opacidad base decreciente
        const baseOpacity = OPACITY_DECAY[indexFromLatest] || 0.05;

        // Si el conductor está seleccionado mantiene la escala; si no, se atenúa aún más
        const finalOpacity = isSelected ? baseOpacity : baseOpacity * 0.35;
        
        // El grosor de la línea también disminuye con la antigüedad
        const lineWidth = isSelected 
          ? Math.max(2, 4.5 - indexFromLatest * 0.6) 
          : 1.5;

        features.push({
          type: 'Feature',
          properties: {
            color: driver.color,
            opacity: finalOpacity,
            width: lineWidth,
          },
          geometry: {
            type: 'LineString',
            coordinates: routeCoords.map(([lat, lng]) => [lng, lat]),
          },
        } as unknown as maplibregl.GeoJSONFeature);
      });

      // 2. Ruta Activa del Conductor (Máxima opacidad y destacado)
      if (driver.activePath.length > 1) {
        features.push({
          type: 'Feature',
          properties: {
            color: driver.color,
            opacity: isSelected ? 1.0 : 0.4,
            width: isSelected ? 6 : 3,
          },
          geometry: {
            type: 'LineString',
            coordinates: driver.activePath.map(([lat, lng]) => [lng, lat]),
          },
        } as unknown as maplibregl.GeoJSONFeature);
      }
    });

    source.setData({
      type: 'FeatureCollection',
      features: features as unknown as maplibregl.GeoJSONFeature[],
    });
  }, [drivers, selectedDriverId]);

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* PANEL SUPERIOR DE SELECCIÓN Y CONTROLES */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '15px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: 'max-content',               /* Aumenta el ancho relativo al mapa */
          padding: '12px 24px',       /* Aumenta el alto y ancho interno con más relleno */
          display: 'flex',
          alignItems: 'center',
          gap: '20px',                   /* Mayor separación entre secciones */
          borderRadius: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: selectedDriver?.color || '#3b82f6', fontSize: '22px' }}>⚡</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#ffffff' }}>
              GeoTracker <span style={{ fontSize: '11px', background: 'rgba(59,130,246,0.3)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px' }}>PRO</span>
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>
              {selectedDriver ? `Vehículo: ${selectedDriver.driverName} | Ruta: ${selectedDriver.routeName}` : 'Esperando transmisiones...'}
            </p>
          </div>
        </div>

        <div style={{ height: '28px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        {/* SELECTOR DE CONDUCTORES TRANSMITIENDO */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Drivers:</span>
          {Object.values(drivers).map((d) => (
            <button
              key={d.driverId}
              onClick={() => {
                setSelectedDriverId(d.driverId);
                map.current?.easeTo({ center: [d.lng, d.lat], zoom: 16, duration: 800 });
              }}
              style={{
                background: d.driverId === selectedDriverId ? d.color : 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                border: d.driverId === selectedDriverId ? '2px solid #ffffff' : 'none',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {d.driverName}
            </button>
          ))}
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
        </div>

        <div style={{ height: '28px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>          
          {/* Botón condicional para volver al Panel de Administración si el rol es ADMIN o ROOT */}
          {(user?.role === 'ADMIN' || user?.role === 'ROOT') && (
            <button
              onClick={() => (window.location.href = '/admin')}
              style={{
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                padding: '12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '20px',
                width: '100%',
              }}
            >
              ⚙️ Administraión
            </button>
          )}
          <button onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer' }}>
            Salir
          </button>
        </div>

      </div>

      {/* PANEL INFERIOR DE TELEMETRÍA DE VEHÍCULO SELECCIONADO */}
      {selectedDriver && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'max-content',    /* Aumenta el ancho relativo al mapa */
            zIndex: 10,
            padding: '16px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: '28px',
            borderRadius: '18px',
            background: 'rgba(15, 23, 42, 0.92)',
            borderLeft: `6px solid ${selectedDriver.color}`,
          }}
        >
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block' }}>Velocidad</span>
            <span style={{ fontSize: '32px', fontWeight: '900', fontFamily: 'monospace', color: selectedDriver.color }}>
              {selectedDriver.speed} <span style={{ fontSize: '12px', color: '#94a3b8' }}>km/h</span>
            </span>
          </div>

          <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

          <div style={{ fontFamily: 'monospace' }}>
            <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Distancia Recorrida</span><strong>{totalDistance.toFixed(2)} km</strong></div>
            <div><span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>Puntos GPS</span><strong>{totalPointsCount}</strong></div>
          </div>

          <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

          <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#f1f5f9' }}>
            <div><span style={{ color: '#64748b' }}>LAT:</span> {selectedDriver.lat.toFixed(5)}</div>
            <div><span style={{ color: '#64748b' }}>LNG:</span> {selectedDriver.lng.toFixed(5)}</div>
          </div>

          <div style={{ height: '40px', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>

          <div style={{ textAlign: 'right', fontFamily: 'monospace' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '800', display: 'block' }}>Último Paquete</span>
            <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#38bdf8' }}>{selectedDriver.lastUpdatedTime}</span>
          </div>
        </div>
      )}

      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};