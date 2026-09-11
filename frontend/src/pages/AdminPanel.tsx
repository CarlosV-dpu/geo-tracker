import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface UserItem {
  id: number;
  name: string;
  cedula: string;
  email: string;
  role: 'ROOT' | 'ADMIN' | 'SUPERVISOR' | 'DRIVER';
  createdAt?: string;
  updatedAt?: string;
}

interface PositionItem {
  lat: number;
  lng: number;
  timestamp: string;
}

interface RouteItem {
  id: number;
  identity: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  Visible: number;
  positions?: PositionItem[];
  driver?: { id: number; name: string; cedula?: string };
  _count?: { positions: number };
}

export const AdminPanel = () => {
  const { token, user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'routes'>('users');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // Estado para la ventana modal de rastreo de ruta
  const [selectedRouteForTracking, setSelectedRouteForTracking] = useState<RouteItem | null>(null);
  // Estado para la edición en línea de usuarios
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    cedula: string;
    email: string;
    role: UserItem['role'];
  }>({ name: '', cedula: '', email: '', role: 'DRIVER' });

  // Estado para la ventana modal de edición de rutas
  const [selectedRouteForEditing, setSelectedRouteForEditing] = useState<RouteItem | null>(null);
  const [routeEditForm, setRouteEditForm] = useState<{
    identity: string;
    name: string;
    description: string;
    driverId: number | null;
    isActive: boolean;
  }>({
    identity: '',
    name: '',
    description: '',
    driverId: null,
    isActive: true,
  });
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    }
  };

  const fetchRoutes = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/routes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setRoutes(data);
    } catch (err) {
      console.error('Error al cargar rutas:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchRoutes()]).finally(() => setLoading(false));
  }, [token]);

  const handleStartEdit = (u: UserItem) => {
    setEditingId(u.id);
    setEditForm({
      name: u.name,
      cedula: u.cedula,
      email: u.email,
      role: u.role,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveUser = async (userId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });

      const updatedUser = await res.json();

      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...updatedUser } : u))
        );
        setEditingId(null);
      } else {
        alert(updatedUser.message || 'Error al guardar los cambios');
      }
    } catch (err) {
      console.error('Error al actualizar usuario:', err);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    const confirmDelete = window.confirm(`¿Estás seguro de eliminar al usuario "${u.name}"?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setUsers((prev) => prev.filter((item) => item.id !== u.id));
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Error al eliminar usuario.');
      }
    } catch (err) {
      console.error('Error al ocultar usuario:', err);
    }
  };

  // Manejo de edición de rutas
  const handleStartEditRoute = (r: RouteItem) => {
    setSelectedRouteForEditing(r);
    setRouteEditForm({
      identity: r.identity,
      name: r.name,
      description: r.description || '',
      driverId: r.driver?.id || null,
      isActive: r.isActive,
    });
  };

  const handleSaveRoute = async () => {
    if (!selectedRouteForEditing) return;

    try {
      const res = await fetch(`${API_URL}/admin/routes/${selectedRouteForEditing.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(routeEditForm),
      });

      const updatedRoute = await res.json();

      if (res.ok) {
        setRoutes((prev) =>
          prev.map((r) => (r.id === selectedRouteForEditing.id ? { ...r, ...updatedRoute } : r))
        );
        setSelectedRouteForEditing(null);
      } else {
        alert(updatedRoute.message || 'Error al actualizar la ruta');
      }
    } catch (err) {
      console.error('Error al actualizar la ruta:', err);
    }
  };

  const handleDeleteRoute = async (r: RouteItem) => {
    const confirmDelete = window.confirm(`¿Estás seguro de eliminar la ruta "${r.name}" (${r.identity})?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/admin/routes/${r.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        // Remueve la ruta de la lista local inmediatamente
        setRoutes((prev) => prev.filter((item) => item.id !== r.id));
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Error al eliminar la ruta.');
      }
    } catch (err) {
      console.error('Error al ocultar ruta:', err);
    }
  };

  // Obtener conductores disponibles y asegurar que el conductor actual asignado no sea filtrado
  const getAvailableDrivers = () => {
    const driversList = users.filter((u) => u.role === 'DRIVER');
    
    // Si la ruta seleccionada para editar tiene un conductor que no está en driversList, se agrega
    if (
      selectedRouteForEditing?.driver &&
      !driversList.some((d) => d.id === selectedRouteForEditing.driver?.id)
    ) {
      driversList.push({
        id: selectedRouteForEditing.driver.id,
        name: selectedRouteForEditing.driver.name,
        cedula: selectedRouteForEditing.driver.cedula || '',
        email: '',
        role: 'DRIVER',
      });
    }
    return driversList;
  };

  const inputStyle = {
    background: '#1e293b',
    color: '#f8fafc',
    border: '1px solid #38bdf8',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  const modalInputStyle = {
    background: '#0f172a',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '8px 12px',
    borderRadius: '6px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  // Estilo reutilizable con Scrollbar Vertical + Horizontal
  const tableContainerStyle = {
    padding: '20px',
    overflowX: 'auto' as const,
    overflowY: 'auto' as const,
    maxHeight: 'calc(100vh - 220px)',
    borderRadius: '12px',
  };

  // Estilo para fijar la cabecera arriba al hacer scroll
  const stickyHeaderStyle = {
    position: 'sticky' as const,
    top: 0,
    backgroundColor: '#0f172a',
    zIndex: 2,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    color: '#38bdf8',
  };

  return (
    <div style={{ padding: '30px', height: '100vh', boxSizing: 'border-box', backgroundColor: '#0f172a', color: '#f8fafc', overflow: 'hidden' }}>
      {/* CABECERA DE NAVEGACIÓN */}
      <header className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#38bdf8' }}>Panel de Administración</h1>
          <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Usuario actual: {user?.name} ({user?.role})</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.href = '/map'} 
            style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#60a5fa', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            Ir a Monitoreo
          </button>
          {/* NUEVO BOTÓN PARA IR AL DRIVER PANEL */}
          <button 
            onClick={() => window.location.href = '/driver'} 
            style={{ background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: '#a78bfa', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            Ir a Conductor
          </button>
          <button onClick={logout} style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* TABS DE SELECCIÓN */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'users' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Usuarios ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'routes' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Historial de Rutas ({routes.length})
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL CON SCROLLBAR */}
      {loading ? (
        <p style={{ color: '#94a3b8' }}>Cargando información del sistema...</p>
      ) : activeTab === 'users' ? (
        <div className="glass-panel" style={tableContainerStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={stickyHeaderStyle}>
                <th style={{ padding: '12px' }}>Nombre</th>
                <th style={{ padding: '12px' }}>Cédula</th>
                <th style={{ padding: '12px' }}>Email</th>
                <th style={{ padding: '12px' }}>Rol Asignado</th>
                <th style={{ padding: '12px' }}>Fecha Creación</th>
                <th style={{ padding: '12px' }}>Fecha Actualización</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isEditing = editingId === u.id;

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          style={inputStyle}
                        />
                      ) : (
                        u.name
                      )}
                    </td>

                    <td style={{ padding: '12px', color: '#94a3b8' }}>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.cedula}
                          onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })}
                          style={inputStyle}
                        />
                      ) : (
                        u.cedula
                      )}
                    </td>

                    <td style={{ padding: '12px', color: '#94a3b8' }}>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          style={inputStyle}
                        />
                      ) : (
                        u.email
                      )}
                    </td>

                    <td style={{ padding: '12px' }}>
                      {isEditing ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                          disabled={u.role === 'ROOT'}
                          style={inputStyle}
                        >
                          <option value="SUPERVISOR">SUPERVISOR</option>
                          <option value="DRIVER">DRIVER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="ROOT" disabled>ROOT</option>
                        </select>
                      ) : (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {u.role}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                      {u.updatedAt ? new Date(u.updatedAt).toLocaleString() : 'N/A'}
                    </td>

                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleSaveUser(u.id)}
                            style={{ background: '#10b981', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Guardar
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{ background: '#64748b', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            onClick={() => handleStartEdit(u)}
                            style={{
                              background: u.role === 'ROOT' ? 'rgba(255,255,255,0.05)' : 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid #38bdf8',
                              color: u.role === 'ROOT' ? '#64748b' : '#38bdf8',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: u.role === 'ROOT' ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.role === 'ROOT'}
                            style={{
                              background: u.role === 'ROOT' ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid #ef4444',
                              color: u.role === 'ROOT' ? '#64748b' : '#f87171',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              cursor: u.role === 'ROOT' ? 'not-allowed' : 'pointer',
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="glass-panel" style={tableContainerStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', whiteSpace: 'nowrap' }}>
            <thead>
              <tr style={stickyHeaderStyle}>
                <th style={{ padding: '12px' }}>ID Ruta</th>
                <th style={{ padding: '12px' }}>Nombre</th>
                <th style={{ padding: '12px' }}>Conductor</th>
                <th style={{ padding: '12px' }}>Estado Paquete</th>
                <th style={{ padding: '12px' }}>Puntos Registrados</th>
                <th style={{ padding: '12px' }}>Fecha Creación</th>
                <th style={{ padding: '12px' }}>Fecha Actualización</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>{r.identity}</td>
                  <td style={{ padding: '12px' }}>{r.name}</td>
                  <td style={{ padding: '12px' }}>{r.driver?.name || 'Sin asignar'}</td>
                  
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: r.isActive ? 'rgba(234, 179, 8, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: r.isActive ? '#fde047' : '#34d399',
                        border: r.isActive ? '1px solid #eab308' : '1px solid #10b981',
                      }}
                    >
                      {r.isActive ? 'En Camino' : 'Entregado'}
                    </span>
                  </td>

                  <td style={{ padding: '12px', color: '#10b981' }}>{r._count?.positions || 0} pts</td>
                  
                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : 'N/A'}
                  </td>

                  <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px' }}>
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : 'N/A'}
                  </td>

                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleStartEditRoute(r)}
                      style={{
                        background: 'rgba(234, 179, 8, 0.15)',
                        border: '1px solid #eab308',
                        color: '#fde047',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                      >
                      Editar
                    </button>
                    <button
                      onClick={() => setSelectedRouteForTracking(r)}
                      style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid #38bdf8',
                        color: '#38bdf8',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      Rastrear
                    </button>
                    <button
                        onClick={() => handleDeleteRoute(r)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid #ef4444',
                          color: '#f87171',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                        }}
                      >
                        Eliminar
                      </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ventana Modal para Rastrear Ruta */}
      {selectedRouteForTracking && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #38bdf8',
              borderRadius: '12px',
              padding: '24px',
              width: '420px',
              maxWidth: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#38bdf8' }}>Última Ubicación</h3>
              <button
                onClick={() => setSelectedRouteForTracking(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '2px' }}>ID DE LA RUTA</span>
                <strong style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedRouteForTracking.identity}</strong>
              </div>

              <div>
                <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '2px' }}>UBICACIÓN REGISTRADA (LAT, LNG)</span>
                <div style={{ background: '#0f172a', padding: '10px 12px', borderRadius: '6px', fontFamily: 'monospace', color: '#10b981', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {selectedRouteForTracking.positions && selectedRouteForTracking.positions.length > 0
                    ? `${selectedRouteForTracking.positions[0].lat}, ${selectedRouteForTracking.positions[0].lng}`
                    : 'Sin posiciones registradas'}
                </div>
              </div>

              <div>
                <span style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '2px' }}>FECHA Y HORA</span>
                <span style={{ color: '#f8fafc' }}>
                  {selectedRouteForTracking.positions && selectedRouteForTracking.positions.length > 0
                    ? new Date(selectedRouteForTracking.positions[0].timestamp).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedRouteForTracking(null)}
                style={{
                  background: '#38bdf8',
                  color: '#0f172a',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VENTANA EMERGENTE (MODAL) DE EDICIÓN DE RUTA */}
      {selectedRouteForEditing && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#1e293b',
              border: '1px solid #eab308',
              borderRadius: '12px',
              padding: '24px',
              width: '450px',
              maxWidth: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#fde047' }}>Editar Ruta</h3>
              <button
                onClick={() => setSelectedRouteForEditing(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Identity / Código de Ruta
                </label>
                <input
                  type="text"
                  value={routeEditForm.identity}
                  onChange={(e) => setRouteEditForm({ ...routeEditForm, identity: e.target.value })}
                  style={modalInputStyle}
                />
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Nombre de la Ruta
                </label>
                <input
                  type="text"
                  value={routeEditForm.name}
                  onChange={(e) => setRouteEditForm({ ...routeEditForm, name: e.target.value })}
                  style={modalInputStyle}
                />
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Descripción
                </label>
                <textarea
                  value={routeEditForm.description}
                  onChange={(e) => setRouteEditForm({ ...routeEditForm, description: e.target.value })}
                  style={{ ...modalInputStyle, resize: 'vertical', minHeight: '60px' }}
                />
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Conductor Asignado
                </label>
                <select
                  value={routeEditForm.driverId !== null ? String(routeEditForm.driverId) : ''}
                  onChange={(e) =>
                    setRouteEditForm({
                      ...routeEditForm,
                      driverId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  style={modalInputStyle}
                >
                  <option value="">-- Sin Asignar --</option>
                  {getAvailableDrivers().map((driver) => (
                    <option key={driver.id} value={String(driver.id)}>
                      {driver.name} {driver.cedula ? `(${driver.cedula})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  Estado del Paquete / Entrega
                </label>
                <select
                  value={routeEditForm.isActive ? 'true' : 'false'}
                  onChange={(e) =>
                    setRouteEditForm({
                      ...routeEditForm,
                      isActive: e.target.value === 'true',
                    })
                  }
                  style={modalInputStyle}
                >
                  <option value="true">En Camino</option>
                  <option value="false">Entregado</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setSelectedRouteForEditing(null)}
                style={{
                  background: '#64748b',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRoute}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};