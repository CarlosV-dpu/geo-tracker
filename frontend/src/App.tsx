import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DriverPanel } from './pages/DriverPanel';
import { MapView } from './pages/MapView4'; // 👈 Se mantiene tu archivo MapView4
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Routes>
      {/* 1. Ruta Pública para Iniciar Sesión y Registrarse */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 2. Ruta Protegida para Conductores (DRIVER y ROOT) */}
      <Route element={<ProtectedRoute allowedRoles={['DRIVER', 'ROOT']} />}>
        <Route path="/driver" element={<DriverPanel />} />
      </Route>

      {/* 3. Ruta Protegida para el Mapa de Monitoreo (ADMIN y ROOT) */}
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ROOT']} />}>
        <Route path="/map" element={<MapView />} />
      </Route>

      {/* 4. Redirección por defecto si el usuario escribe cualquier otra URL */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;