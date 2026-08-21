import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export const Register = () => {
  const [name, setName] = useState('');
  const [cedula, setCedula] = useState(''); // 👈 Nuevo campo
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'DRIVER' | 'OTHER'>('DRIVER'); // 👈 Solo DRIVER u OTHER
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, cedula, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al registrar el usuario');
      }

      setSuccess('¡Cuenta creada con éxito! Redirigiendo al login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100vw', padding: '20px 0' }}>
      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '30px', borderRadius: '16px', width: '380px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ color: '#fff', margin: 0, textAlign: 'center' }}>Crear Cuenta</h2>
        
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '10px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '10px', borderRadius: '8px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.4)' }}>{success}</div>}

        <div>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Nombre Completo</label>
          <input
            type="text"
            placeholder="Ej: Carlos Conductor"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Cédula / Documento de Identidad</label>
          <input
            type="text"
            placeholder="Ej: 1040123456"
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Correo Electrónico</label>
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Contraseña</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
          />
        </div>

        <div>
          <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Rol de Usuario</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'DRIVER' | 'OTHER')}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }}
          >
            <option value="DRIVER">DRIVER (Conductor)</option>
            <option value="OTHER">OTHER (Otro Usuario)</option>
          </select>
        </div>

        <button
          type="submit"
          style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '6px' }}
        >
          Registrarse
        </button>

        <p style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', margin: '8px 0 0 0' }}>
          ¿Ya tienes cuenta? <Link to="/login" style={{ color: '#60a5fa', textDecoration: 'none' }}>Inicia sesión aquí</Link>
        </p>
      </form>
    </div>
  );
};