import { Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { DriverPanel } from './pages/DriverPanel';
import { AdminPanel } from './pages/AdminPanel';
import { MapView } from './pages/MapView'; // 👈 Se mantiene tu archivo MapView4
import { ProtectedRoute } from './components/ProtectedRoute';

export const AppRouter = () => {

  {/*
    const { user, token } = useAuth();
    if (!token) {
      return (
        <Routes>
          { 1. Ruta Pública para Iniciar Sesión y Registrarse }
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          { 5. Redirección por defecto si el usuario escribe cualquier otra URL }
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }*/
  }
  

  return (
    <Routes>

      {/* 1. Ruta Pública para Iniciar Sesión y Registrarse */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 2. Ruta administrativa Protegida para Administradores (ADMIN y ROOT) */}
      {/*(user?.role === 'ADMIN' || user?.role === 'ROOT') && ( <Route path="/admin" element={<AdminPanel />} />)*/} 
      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ROOT']} />}>
        <Route path="/admin" element={<AdminPanel />} />
      </Route>

      {/* 3. Ruta de simulación Protegida para Conductores (DRIVER, ADMIN y ROOT) */}
      <Route element={<ProtectedRoute allowedRoles={['DRIVER', 'ADMIN', 'ROOT']} />}>
        <Route path="/driver" element={<DriverPanel />} />
      </Route>

      {/* 4. Ruta de telemetría y Mapa Protegida para el (SUPERVISOR, ADMIN y ROOT) */}
      <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'ROOT', 'ADMIN']} />}>
        <Route path="/map" element={<MapView />} />
      </Route>

      {/* 5. Redirección por defecto si el usuario escribe cualquier otra URL */}
      <Route path="*" element={<Navigate to="/login" replace />} />
      
    </Routes>
  );
}

export default AppRouter;