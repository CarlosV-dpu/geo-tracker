import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

// Puntos de origen iniciales en Barranquilla (Solo se usan al cargar el panel por primera vez)
const randomStart = [
  { lat: 10.96854, lng: -74.78132 }, // Centro / Sur
  { lat: 11.00410, lng: -74.80705 }, // Alto Prado
  { lat: 10.99020, lng: -74.81530 }, // Riomar
  { lat: 10.94510, lng: -74.77020 }, // Soledad
];

const stepDeltas = [
  { dLat: 0.00646, dLng: 0.00132 },
  { dLat: -0.00300, dLng: 0.01000 },
  { dLat: -0.00700, dLng: -0.00200 },
  { dLat: 0.00354, dLng: -0.00932 },
];

const generateRouteDetails = () => {
  const Data = {
    product: ["Ropa", "Tecnología", "Juguetes", "Productos de belleza", "Accesorios y joyería", "Productos de aseo"],
    brand: ["Nike", "Adidas", "Puma", "Reebok", "New Balance"],
    stock: ["", "Parte 1", "Parte 2", "Parte 3", "Parte 4", "Parte 5"],
  };
  const hoy = new Date();
  const yy = String(hoy.getFullYear()).slice(-2);
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const dd = String(hoy.getDate()).padStart(2, '0');
  const hh = String(hoy.getHours()).padStart(2, '0');
  const mmn = String(hoy.getMinutes()).padStart(2, '0');
  const ss = String(hoy.getSeconds()).padStart(2, '0');

  const date = `${yy}:${mm}:${dd}`;
  const time = `${hh}:${mmn}:${ss}`;

  const prod = Data.product[Math.floor(Math.random() * Data.product.length)];
  const brand = Data.brand[Math.floor(Math.random() * Data.brand.length)];
  const stock = Data.stock[Math.floor(Math.random() * Data.stock.length)];

  return {
    identity: `ruta-${date}::${time}`,
    name: `Envío de ${brand}`.trim(),
    description: ` Cargamento de ${prod} de ${brand} ${stock}`,
  };
};

export const DriverPanel = () => {
  const { token, user, logout } = useAuth();
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Referencia persistente para la ubicación actual del vehículo.
  // Solo la primera ejecución seleccionará un punto aleatorio inicial.
  const currentPosRef = useRef<{ lat: number; lng: number }>(
    randomStart[Math.floor(Math.random() * randomStart.length)]
  );

  const [currentRoute, setCurrentRoute] = useState(generateRouteDetails);
  const [socket, setSocket] = useState<Socket | null>(null);

  const simulationIntervalRef = useRef<number | null>(null);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const newSocket = io(`${API_URL}`, { auth: { token } });
    setSocket(newSocket);

    return () => {
      stopSimulation();
      newSocket.disconnect();
    };
  }, [token]);

  const generateWaypointsFromDeltas = (start: { lat: number; lng: number }) => {
    const points = [{ ...start }];
    let currentLat = start.lat;
    let currentLng = start.lng;

    for (const delta of stepDeltas) {
      currentLat += delta.dLat;
      currentLng += delta.dLng;
      points.push({
        lat: Number(currentLat.toFixed(5)),
        lng: Number(currentLng.toFixed(5)),
      });
    }
    return points;
  };

  const getRoadPath = async (points: { lat: number; lng: number }[]) => {
    const coordinatesString = points.map((p) => `${p.lng},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        return data.routes[0].geometry.coordinates.map((coord: [number, number]) => ({
          lat: coord[1],
          lng: coord[0],
        }));
      }
    } catch (error) {
      console.error('⚠️ Error OSRM, usando trayectoria directa.');
    }
    return points;
  };

  const stopSimulation = () => {
    if (simulationIntervalRef.current !== null) {
      window.clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulating(false);
  };

  const toggleSimulation = async () => {
    if (isTransmitting) {
      const watchId = localStorage.getItem('watchId');
      if (watchId) navigator.geolocation.clearWatch(parseInt(watchId));
      setIsTransmitting(false);
    }

    if (isSimulating) {
      stopSimulation();
      setStatusMessage('🚗 Simulador detenido.');
      return;
    }

    setIsSimulating(true);
    setStatusMessage(`📡 Transmitiendo: "${currentRoute.name}" (${currentRoute.identity})`);

    // Iniciar trazado OSRM usando la posición actual persistente del vehículo
    const waypoints = generateWaypointsFromDeltas(currentPosRef.current);
    const streetPath = await getRoadPath(waypoints);
    let currentIndex = 0;

    simulationIntervalRef.current = window.setInterval(() => {
      if (streetPath.length === 0 || !socket) return;

      const currentPoint = streetPath[currentIndex];
      const speed = Math.floor(20 + Math.random() * 40);

      // Actualizar la última posición alcanzada por el vehículo
      currentPosRef.current = { lat: currentPoint.lat, lng: currentPoint.lng };

      socket.emit('updateLocation', {
        identity: currentRoute.identity,
        name: currentRoute.name,
        description: currentRoute.description,
        driverId: user?.id,
        lat: currentPoint.lat,
        lng: currentPoint.lng,
        speed,
      });

      currentIndex = (currentIndex + 1) % streetPath.length;
    }, 1200);
  };

  const toggleTransmission = () => {
    if (isSimulating) stopSimulation();

    if (!isTransmitting) {
      if ('geolocation' in navigator) {
        const watchId = navigator.geolocation.watchPosition((pos) => {
          // Guardar la ubicación real del GPS en la referencia del vehículo
          currentPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };

          socket?.emit('updateLocation', {
            identity: currentRoute.identity,
            name: currentRoute.name,
            description: currentRoute.description,
            driverId: user?.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: Math.round((pos.coords.speed || 0) * 3.6),
          });
        });
        localStorage.setItem('watchId', watchId.toString());
        setStatusMessage(`📡 Transmitiendo GPS Real: "${currentRoute.name}"`);
      }
    } else {
      const watchId = localStorage.getItem('watchId');
      if (watchId) navigator.geolocation.clearWatch(parseInt(watchId));
      setStatusMessage('🛑 Transmisión GPS real detenida.');
    }
    setIsTransmitting(!isTransmitting);
  };

  const handleFinishDelivery = () => {
    if (!socket) return;

    stopSimulation();
    if (isTransmitting) {
      const watchId = localStorage.getItem('watchId');
      if (watchId) navigator.geolocation.clearWatch(parseInt(watchId));
      setIsTransmitting(false);
    }

    socket.emit('finishRoute', { identity: currentRoute.identity });

    // Generar un nuevo cargamento sin reajustar currentPosRef
    const nextRoute = generateRouteDetails();
    setCurrentRoute(nextRoute);

    setStatusMessage(`📦 ¡Entrega completada! Nueva ruta lista desde el punto actual: "${nextRoute.name}"`);
  };

  return (
    <div className="driver-panel glass-panel" style={{ padding: '24px', maxWidth: '480px', margin: '10% auto' }}>
      <h1>Panel de Conductor</h1>
      <p>Bienvenido, <strong>{user?.name}</strong></p>

      <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155', color: '#38bdf8', fontSize: '13px', marginTop: '10px' }}>
        📌 <strong>Ruta Actual:</strong> {currentRoute.name}<br/>
        🔑 <strong>ID:</strong> {currentRoute.identity}<br/>
        📍 <strong>Ubicación Vehículo:</strong> {currentPosRef.current.lat.toFixed(5)}, {currentPosRef.current.lng.toFixed(5)}
      </div>

      {statusMessage && (
        <div style={{ background: statusMessage.includes('📦') ? '#065f46' : '#1e293b', color: statusMessage.includes('📦') ? '#a7f3d0' : '#e2e8f0', padding: '12px', borderRadius: '8px', marginTop: '12px', fontSize: '13px', textAlign: 'center' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
        <button onClick={toggleTransmission} style={{ background: isTransmitting ? '#ef4444' : '#10b981', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
          {isTransmitting ? '🛑 Detener Transmisión Real' : '📡 Iniciar Transmisión GPS Real'}
        </button>

        <button onClick={toggleSimulation} style={{ background: isSimulating ? '#ef4444' : '#8b5cf6', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>
          {isSimulating ? '🛑 Detener Simulador' : '🚗 Iniciar Simulador GPS'}
        </button>

        <button onClick={handleFinishDelivery} style={{ background: '#f59e0b', color: 'white', padding: '14px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' }}>
          📦 Paquete Entregado (Iniciar Nueva Ruta)
        </button>
      </div>
      
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
          ⚙️ Ir a Administración
        </button>
      )}

      <button onClick={logout} style={{ background: '#334155', color: '#e2e8f0', padding: '12px', borderRadius: '12px', border: 'none', fontSize: '14px', cursor: 'pointer', marginTop: '24px', width: '100%' }}>
        Cerrar Sesión
      </button>
    </div>
  );
};