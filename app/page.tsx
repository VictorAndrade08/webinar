'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * CONFIGURACIÓN DE SINCRONIZACIÓN (Yjs + WebRTC)
 * Usamos señalización pública para conectar a usuarios en cualquier lugar del mundo.
 */
const SIGNALING_SERVERS = ['wss://signaling.yjs.dev', 'wss://y-webrtc-signaling-eu.herokuapp.com'];

// --- CONFIGURACIÓN DEL PDF ---
const RAW_PDF_URL = "https://darkturquoise-capybara-951908.hostingersite.com/wp-content/uploads/2026/02/10L-Juanes-2026.pdf";

const getPdfUrl = (page: number) => {
  // Proxy de Google para saltar bloqueos de Vercel/Hostinger
  return `https://docs.google.com/viewer?url=${encodeURIComponent(RAW_PDF_URL)}&embedded=true`;
};

const TOTAL_PAGES = 30; 

const Icons = {
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Cam: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Arrow: (dir: 'prev' | 'next') => <svg style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Share: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  Live: () => <circle cx="12" cy="12" r="10" fill="#ef4444" className="animate-pulse" />
};

export default function App() {
  const [isMounted, setIsMounted] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [voiceOn, setVoiceOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [msg, setMsg] = useState("Conectando...");
  const [toast, setToast] = useState("");

  // Referencias para la sincronización Yjs
  const ydocRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const sharedStateRef = useRef<any>(null);

  const recognitionRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- 1. INICIALIZACIÓN DE SCRIPTS Y AUTO-JOIN ---
  useEffect(() => {
    setIsMounted(true);
    
    // Carga dinámica de librerías para evitar errores de compilación en entornos locales sin instalar
    const loadLibs = async () => {
      try {
        const Y = await import('yjs');
        const { WebrtcProvider } = await import('y-webrtc');
        
        ydocRef.current = new Y.Doc();
        
        // Verificamos si hay una sala en la URL para entrar de inmediato (Magic Link)
        const params = new URLSearchParams(window.location.search);
        const roomParam = params.get('room');
        if (roomParam) {
          handleJoin(roomParam, false);
        } else {
          setMsg("Listo. Crea o únete a una sala.");
        }
      } catch (e) {
        setMsg("Cargando dependencias en tiempo real...");
      }
    };
    loadLibs();
  }, []);

  // --- 2. LOGICA DE SINCRONIZACIÓN (SALA) ---
  const handleJoin = async (roomName?: string, isNew: boolean = false) => {
    const name = (roomName || roomInput).trim().toLowerCase();
    if (!name) return setMsg("Escribe un nombre de sala.");

    // Evitar duplicados si ya estamos conectando
    if (activeRoom === name) return;

    try {
      const { WebrtcProvider } = await import('y-webrtc');
      
      // Limpiamos conexión anterior si existe
      if (providerRef.current) providerRef.current.destroy();

      providerRef.current = new WebrtcProvider(name, ydocRef.current, {
        signaling: SIGNALING_SERVERS
      });

      sharedStateRef.current = ydocRef.current.getMap('state');
      
      // Si estamos creando una sala nueva, podemos resetear el estado inicial
      if (isNew) {
        sharedStateRef.current.set('page', 1);
      }

      // Escuchamos cambios de otros usuarios en la sala
      sharedStateRef.current.observe(() => {
        const newPage = sharedStateRef.current.get('page');
        if (newPage && newPage !== pageIndex) {
          setPageIndex(newPage);
          setMsg(`Sincronizado: Página ${newPage}`);
        }
      });

      setActiveRoom(name);
      setMsg(isNew ? `Sala creada: ${name}` : `Unido a: ${name}`);
    } catch (err) {
      setMsg("Error al conectar. Reintenta.");
    }
  };

  const changePage = (step: number) => {
    if (isLocked) return;
    setIsLocked(true);
    setTimeout(() => setIsLocked(false), 1000);

    const newPage = Math.max(1, Math.min(TOTAL_PAGES, pageIndex + step));
    setPageIndex(newPage);
    
    // Actualizamos el estado compartido para que todos lo vean instantáneamente
    if (sharedStateRef.current) {
      sharedStateRef.current.set('page', newPage);
    }
  };

  // --- CONTROLES DE VOZ ---
  const toggleVoice = () => {
    if (voiceOn) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setVoiceOn(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return setMsg("Voz no compatible.");

    try {
      const rec = new SpeechRec();
      rec.lang = 'es-ES';
      rec.continuous = true;
      rec.onstart = () => { setVoiceOn(true); setMsg("🎤 Escuchando..."); };
      rec.onresult = (e: any) => {
        const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
        if (text.includes('siguiente') || text.includes('pasa')) changePage(1);
        else if (text.includes('atrás') || text.includes('vuelve')) changePage(-1);
      };
      rec.onerror = () => setVoiceOn(false);
      recognitionRef.current = rec;
      rec.start();
    } catch (e) { setMsg("Error en micrófono."); }
  };

  const toggleCamera = async () => {
    if (camOn) {
      if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      setCamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCamOn(true);
      }
    } catch (e) { setMsg("Cámara bloqueada."); }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${activeRoom}`;
    navigator.clipboard.writeText(url);
    setToast("¡Enlace copiado! Envíalo a tus invitados.");
    setTimeout(() => setToast(""), 3000);
  };

  if (!isMounted) return null;

  // --- VISTA INICIAL (LOGIN) ---
  if (!activeRoom) {
    return (
      <div style={containerStyle} suppressHydrationWarning>
        <style>{`body { margin: 0; background: #020617; font-family: 'Inter', sans-serif; }`}</style>
        <div style={cardStyle}>
          <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🚀</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'white' }}>PDF Live Sync</h1>
          <p style={{ opacity: 0.6, marginBottom: '40px', color: 'white' }}>Sincronización P2P instantánea.</p>
          
          <input 
            placeholder="NOMBRE DE LA SALA"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            style={inputStyle}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
            <button onClick={() => handleJoin(undefined, true)} style={btnMainStyle}>
              CREAR SALA NUEVA
            </button>
            <button onClick={() => handleJoin(undefined, false)} style={{ ...btnMainStyle, background: 'transparent', border: '2px solid #3b82f6' }}>
              UNIRSE A SALA
            </button>
          </div>
          
          <div style={{ marginTop: '30px', fontSize: '13px', color: '#64748b', fontFamily: 'monospace' }}>
            {msg}
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA PRESENTACIÓN ---
  return (
    <div style={containerStyle} suppressHydrationWarning>
      <style>{`
        body { margin: 0; overflow: hidden; background: #0f172a; }
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 12px 24px; border-radius: 12px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.4); font-weight: bold; border: 1px solid rgba(255,255,255,0.2); animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      {/* Orador HD Flotante */}
      <div style={{
        position: 'fixed', bottom: '130px', right: '30px', 
        width: camOn ? '280px' : '0', height: camOn ? '280px' : '0',
        borderRadius: '32px', overflow: 'hidden', border: '4px solid #3b82f6', zIndex: 100,
        backgroundColor: '#000', transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
      }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      </div>

      {/* Header Premium */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ef4444', padding: '6px 12px', borderRadius: '10px' }}>
             <span style={{ fontWeight: 900, fontSize: '12px', color: 'white' }}>LIVE</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>SALA: <span style={{ color: '#3b82f6' }}>{activeRoom.toUpperCase()}</span></div>
        </div>
        
        <button onClick={copyLink} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icons.Share /> COMPARTIR LINK
        </button>
      </div>

      {/* Visor PDF (Bypass de Google) */}
      <div style={{ flex: 1, width: '100%', background: '#1e293b', overflow: 'hidden', position: 'relative' }}>
        <iframe 
          key={pageIndex}
          src={getPdfUrl(pageIndex)} 
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="PDF Content"
        />
      </div>

      {/* Footer de Control */}
      <div style={footerStyle}>
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => changePage(-1)} style={btnNavStyle}>{Icons.Arrow('prev')}</button>
          
          <button onClick={toggleVoice} style={{ ...btnNavStyle, width: '200px', background: voiceOn ? '#3b82f6' : '#1e293b' }}>
             <span style={{ color: 'white', fontWeight: 'bold' }}>{voiceOn ? '🎤 VOZ ACTIVA' : 'ACTIVAR VOZ'}</span>
          </button>

          <button onClick={toggleCamera} style={{ ...btnNavStyle, width: '180px' }}>
            <Icons.Cam /> <span style={{ marginLeft: '12px', color: 'white', fontWeight: 'bold' }}>{camOn ? 'CAM OFF' : 'CÁMARA HD'}</span>
          </button>

          <button onClick={() => changePage(1)} style={btnNavStyle}>{Icons.Arrow('next')}</button>
        </div>
        <div style={{ fontSize: '12px', color: '#475569', marginTop: '15px', fontWeight: 'bold' }}>{msg}</div>
      </div>
    </div>
  );
}

// --- ESTILOS ---
const containerStyle: any = { height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const cardStyle: any = { background: '#0f172a', padding: '60px', borderRadius: '50px', width: '100%', maxWidth: '440px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' };
const inputStyle: any = { width: '100%', padding: '22px', borderRadius: '20px', border: '2px solid #3b82f6', background: 'transparent', color: 'white', marginBottom: '25px', fontSize: '1.2rem', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontWeight: 'bold' };
const btnMainStyle: any = { width: '100%', padding: '22px', borderRadius: '20px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 900, cursor: 'pointer', fontSize: '1.1rem' };
const headerStyle: any = { width: '100%', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020617', borderBottom: '1px solid #1e293b', boxSizing: 'border-box', zIndex: 50 };
const footerStyle: any = { width: '100%', background: '#020617', padding: '30px', borderTop: '1px solid #1e293b', textAlign: 'center', boxSizing: 'border-box', zIndex: 50 };
const btnNavStyle: any = { background: '#1e293b', border: 'none', padding: '16px 28px', borderRadius: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' };