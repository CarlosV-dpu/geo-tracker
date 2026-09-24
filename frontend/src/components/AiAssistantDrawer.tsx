// frontend/src/components/AiAssistantDrawer.tsx
import React, { useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';

interface Message {
  sender: 'user' | 'ai';
  text: string;
  data?: any;
}

export const AiAssistantDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: '¡Hola! Soy el asistente de GeoTracker PRO. Pregúntame sobre el estado de la flota, excesos de velocidad o métricas de conductores.' },
  ]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ prompt: userMessage }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: data.textResponse,
          data: data.dataPayload,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [...prev, { sender: 'ai', text: 'Ocurrió un error al procesar tu solicitud.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-full shadow-lg transition-all"
        >
          <Sparkles className="w-5 h-5" />
          <span className="font-medium text-sm">Asistente IA</span>
        </button>
      )}

      {isOpen && (
        <div className="w-96 h-[500px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
          {/* Header */}
          <div className="p-4 bg-slate-800 flex justify-between items-center border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-sm">GeoTracker AI Analytics</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`p-3 rounded-xl max-w-[85%] ${
                    msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Si la IA retornó datos, mostramos un resumen rápido */}
                {msg.data && (
                  <div className="mt-2 w-full bg-slate-950 p-2 rounded-lg border border-slate-800 font-mono text-[10px] overflow-x-auto text-emerald-400">
                    <pre>{JSON.stringify(msg.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="text-slate-500 italic text-xs">Analizando datos de telemetría...</div>}
          </div>

          {/* Input Box */}
          <div className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ej. ¿Qué conductores superaron 80 km/h?"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <button onClick={handleSend} className="bg-indigo-600 hover:bg-indigo-700 p-2 rounded-lg text-white">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};