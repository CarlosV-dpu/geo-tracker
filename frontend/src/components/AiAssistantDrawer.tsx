// src/components/AiAssistantDrawer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

export const AiAssistantDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: 'ai',
      text: '¡Hola! Soy el asistente de GeoTracker PRO. Pregúntame sobre el estado de la flota, excesos de velocidad o métricas de conductores.',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: userText }),
      });

      const data = await res.json();
      const aiResponse = data.message || data.response || 'No se pudo obtener una respuesta.';
      
      setMessages((prev) => [...prev, { sender: 'ai', text: aiResponse }]);
    } catch (error) {
      console.error('Error al consultar IA:', error);
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: 'Ocurrió un error al procesar tu consulta. Inténtalo de nuevo.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 1000 }}>
      
      {/* TARJETA FLOTANTE DEL CHAT */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            bottom: '60px',
            left: '0',
            width: '380px',
            height: '500px',
            maxHeight: 'calc(100vh - 140px)',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ENCABEZADO DEL CHAT */}
          <div
            style={{
              padding: '14px 18px',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  boxShadow: '0 0 10px rgba(14, 165, 233, 0.4)',
                }}
              >
                🤖
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#f8fafc' }}>
                  GeoTracker AI
                </h3>
                <span style={{ fontSize: '10px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                  Analítica en vivo
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              ✕
            </button>
          </div>

          {/* CUERPO DEL CHAT (HISTORIAL DE MENSAJES) */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '10px 14px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  backgroundColor:
                    msg.sender === 'user'
                      ? '#0284c7'
                      : 'rgba(30, 41, 59, 0.85)',
                  color: '#ffffff',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  border: msg.sender === 'ai' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.text}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 14px',
                  borderRadius: '16px 16px 16px 2px',
                  backgroundColor: 'rgba(30, 41, 59, 0.85)',
                  color: '#38bdf8',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                ⚡ Consultando base de datos...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* FORMULARIO DE ENTRADA */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '12px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              placeholder="Pregunta algo sobre la flota..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                backgroundColor: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '10px 14px',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: input.trim() && !loading ? '#0ea5e9' : 'rgba(51, 65, 85, 0.6)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
              }}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      {/* BOTÓN FLOTANTE PRINCIPAL (TRIGGER) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '30px',
          fontSize: '14px',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(56, 189, 248, 0.2)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.4), 0 0 15px rgba(56, 189, 248, 0.2)';
        }}
      >
        <span style={{ fontSize: '18px' }}>✨</span>
        <span>Asistente IA</span>
      </button>
    </div>
  );
};