import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  Camera, 
  WifiOff, 
  FileText,
  RotateCcw
} from 'lucide-react';

// Base de conocimiento extraída del Manual de Usuario
const KNOWLEDGE_BASE = [
  {
    keywords: ['escanear', 'codigo', 'barras', 'camara', 'lector', 'leer'],
    response: `📷 **¿Cómo escanear un remito?**
1. Presiona el botón **"Registrar Remito"** o el icono de cámara en la barra inferior.
2. Apunta la cámara directamente hacia el **código de barras 1D** del remito en papel (Code 128 o Code 39).
3. Si estás de noche o en un lugar oscuro, toca el botón de **Linterna**.
4. Al detectar el código, la app emitirá un sonido de confirmación y abrirá la ficha de control.`
  },
  {
    keywords: ['manual', 'ingreso manual', 'roto', 'arrugado', 'no lee', 'dañado'],
    response: `⌨️ **¿Qué hacer si el código está dañado?**
Si el código de barras no se puede leer con la cámara:
1. En la pantalla del escáner, presiona **"Ingreso Manual"**.
2. Escribe el número de comprobante (ej: \`R-0050-00487512\`) o el \`TransaccionId\` de Finnegans.
3. Presiona **"Buscar Remito"** para cargar la ficha.`
  },
  {
    keywords: ['offline', 'señal', 'sin conexion', 'internet', '4g', 'calle', 'sincronizar'],
    response: `📶 **Funcionamiento sin Conexión (Modo Offline):**
* Puedes seguir trabajando normalmente aunque te quedes sin señal en ruta.
* Los remitos controlados y las fotos se guardan en la memoria local segura del teléfono (**IndexedDB**).
* Apenas recuperes señal 4G o WiFi, la app sincronizará automáticamente todos los remitos pendientes.`
  },
  {
    keywords: ['ejemplar', 'original', 'duplicado', 'triplicado', 'cuatriplicado', 'recepcion valorizada'],
    response: `📑 **Selección de Ejemplar:**
Debes seleccionar la copia física que te firmaron:
* ⚪ **Original** (Hoja blanca principal)
* 🟡 **Duplicado** (Copia de color para el cliente)
* 🔵 **Triplicado** (Copia para contabilidad)
* 🟣 **Cuatriplicado** (Copia de transporte)
* 🟢 **Recepción Valorizada** (Documento adjunto con montos)`
  },
  {
    keywords: ['firma', 'firmado', 'rechazado', 'no firmo', 'cliente', 'intermediario'],
    response: `✍️ **Estados de Firma:**
* 🟢 **Firmado por Cliente:** Sellado y firmado por el receptor en el local o supermercado.
* 🔵 **Firmado por Intermediario:** Conformado por un distribuidor u operador logístico.
* 🔴 **No Firmado / Rechazado:** Si el cliente rechazó la entrega o no colocó la firma.`
  },
  {
    keywords: ['foto', 'fotografia', 'camara', 'comprimir', 'sharepoint', 'borrosa'],
    response: `📸 **Captura de Fotografía y Calidad:**
* La app comprime automáticamente la foto al **70% JPEG** antes de enviarla (~150-300 KB) para ahorrar datos móviles.
* La foto se envía automáticamente a SharePoint con el formato: \`FOTO_CAM_CHOFER_<legajo>_<comprobante>_<fecha>.jpg\`.
* Si la foto salió movida, presiona **"Volver a tomar foto"** antes de guardar.`
  },
  {
    keywords: ['tema', 'oscuro', 'claro', 'noche', 'luz', 'pantalla'],
    response: `🌓 **Modo Oscuro / Claro:**
Puedes cambiar el tema tocando el icono de **Sol / Luna** en la esquina superior derecha o desde el menú lateral para descansar la vista en ruta nocturna.`
  },
  {
    keywords: ['hoja de ruta', 'viaje', 'reparto', 'chofer', 'legajo'],
    response: `🚚 **Hojas de Ruta y Viajes:**
Toca el botón **"Viajes"** en la barra inferior o en el Dashboard para consultar las últimas 4 hojas de ruta asignadas con el total de remitos pendientes y conformados.`
  }
];

const QUICK_QUESTIONS = [
  '¿Cómo escaneo un remito?',
  '¿Qué hacer si no tengo señal?',
  '¿Cómo ingresar remito manual?',
  '¿Qué ejemplar debo seleccionar?',
  '¿Cómo tomar la foto correctamente?'
];

export default function HelpChatModal({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! Soy tu asistente virtual de Don Yeyo Logística. ¿En qué puedo ayudarte con la app o el registro de remitos en ruta?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const findAnswer = (query) => {
    const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Buscar coincidencia en la base de conocimiento
    for (const item of KNOWLEDGE_BASE) {
      const match = item.keywords.some((kw) => cleanQuery.includes(kw));
      if (match) {
        return item.response;
      }
    }

    // Respuesta por defecto
    return `ℹ️ No encontré una respuesta exacta a tu consulta, pero te recuerdo las opciones principales:
* Puedes escanear el remito con el botón **Escanear**.
* Puedes ingresar el comprobante a mano con **Ingreso Manual**.
* Todas tus acciones se guardan offline si estás sin cobertura.

Si necesitas asistencia de soporte técnico, comunícate con la central de Logística de Don Yeyo.`;
  };

  const handleSendMessage = (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const answer = findAnswer(query);
      const botMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: answer,
        timestamp: new Date()
      };
      setMessages((prev) => [...prev, botMessage]);
      setIsTyping(false);
    }, 450);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome_reset',
        sender: 'bot',
        text: 'Chat reiniciado. ¿En qué otra duda puedo ayudarte sobre el uso de la aplicación?',
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0'
      }}
      onClick={onClose}
    >
      <div 
        className="glass"
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '88vh',
          maxHeight: '750px',
          background: 'var(--surface)',
          color: 'var(--text)',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Chatbot */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0d2c5c 0%, #1a4b8c 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 10px rgba(13, 44, 92, 0.3)'
            }}>
              <Bot size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text)' }}>
                  Asistente Chofer
                </h3>
                <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '50px', fontWeight: 800 }}>
                  ONLINE
                </span>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Basado en Manual de Usuario Don Yeyo
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleResetChat}
              className="mode-toggle"
              style={{ width: '36px', height: '36px' }}
              title="Reiniciar chat"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClose}
              className="mode-toggle"
              style={{ width: '36px', height: '36px' }}
              title="Cerrar ayuda"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Píldoras de Preguntas Frecuentes (FAQ) */}
        <div style={{
          padding: '10px 16px',
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-hover)'
        }}>
          {QUICK_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '6px 12px',
                borderRadius: '50px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Cuerpo de Mensajes */}
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {messages.map((m) => {
            const isBot = m.sender === 'bot';
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignSelf: isBot ? 'flex-start' : 'flex-end',
                  maxWidth: '88%'
                }}
              >
                {isBot && (
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    background: 'var(--dy-blue)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <Bot size={18} />
                  </div>
                )}

                <div style={{
                  background: isBot ? 'var(--surface-hover)' : 'var(--dy-blue)',
                  color: isBot ? 'var(--text)' : '#ffffff',
                  border: isBot ? '1px solid var(--border)' : 'none',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  borderBottomLeftRadius: isBot ? '4px' : '16px',
                  borderBottomRightRadius: !isBot ? '4px' : '16px',
                  fontSize: '0.88rem',
                  lineHeight: '1.45',
                  boxShadow: 'var(--shadow-sm)',
                  whiteSpace: 'pre-line'
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'var(--dy-blue)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Bot size={18} />
              </div>
              <div style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                padding: '10px 14px',
                borderRadius: '16px',
                fontSize: '0.82rem',
                color: 'var(--text-muted)'
              }}>
                Escribiendo respuesta...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input de Mensaje */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder="Escribe tu consulta o duda..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              height: '46px',
              padding: '0 14px',
              borderRadius: '14px',
              border: '1.5px solid var(--border)',
              background: 'var(--surface-hover)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputValue.trim()}
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              border: 'none',
              background: inputValue.trim() ? 'var(--dy-blue)' : 'var(--border)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: inputValue.trim() ? 'pointer' : 'default',
              transition: 'all 0.15s ease'
            }}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
