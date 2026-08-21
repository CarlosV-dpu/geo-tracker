import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const DriverPanel = () => {
  const { token, user, logout } = useAuth();
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Conectamos Socket.io adjuntando el JWT en el Handshake
    const newSocket = io('http://localhost:3000', {
      auth: { token },
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const toggleTransmission = () => {
    if (!isTransmitting) {
      // Iniciar transmisión de GPS usando la API nativa del navegador
      if ('geolocation' in navigator) {
        const watchId = navigator.geolocation.watchPosition((pos) => {
          socket?.emit('updateLocation', {
            routeId: 'ruta-1',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: Math.round((pos.coords.speed || 0) * 3.6), // Convertir m/s a km/h
          });
        });
        localStorage.setItem('watchId', watchId.toString());
      }
    } else {
      const watchId = localStorage.getItem('watchId');
      if (watchId) navigator.geolocation.clearWatch(parseInt(watchId));
    }
    setIsTransmitting(!isTransmitting);
  };

  return (
    <div className="driver-panel glass-panel">
      <h1>Panel de Conductor</h1>
      <p>Bienvenido, <strong>{user?.name}</strong></p>
      
      <button 
        onClick={toggleTransmission} 
        style={{ background: isTransmitting ? '#ef4444' : '#10b981', color: 'white', padding: '16px', borderRadius: '12px' }}
      >
        {isTransmitting ? '🛑 Detener Transmisión' : '📡 Iniciar Transmisión GPS'}
      </button>

      <button onClick={logout} style={{ marginTop: '20px' }}>Cerrar Sesión</button>
    </div>
  );
};