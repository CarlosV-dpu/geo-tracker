import 'leaflet/dist/leaflet.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // 👈 1. Importamos el enrutador
import { AuthProvider } from './context/AuthContext'; // 👈 2. Importamos el contexto de autenticación
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Contenedor principal de rutas */}
    <BrowserRouter>
      {/* Proveedor del estado global de Login y Roles */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);