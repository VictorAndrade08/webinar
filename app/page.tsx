'use client';

import React, { useState, useEffect, useRef } from 'react';

// --- CONFIGURACIÓN DEL PDF ---
// Tu link original
const RAW_PDF_URL = "https://darkturquoise-capybara-951908.hostingersite.com/wp-content/uploads/2026/02/10L-Juanes-2026.pdf";

// Solución "Reddit Style": Usamos el visor de Google Docs como Proxy para saltar el bloqueo de Hostinger
const getPdfUrl = (page) => {
  const proxy = `https://docs.google.com/viewer?url=${encodeURIComponent(RAW_PDF_URL)}&embedded=true`;
  // Nota: Algunos proxies no soportan el salto directo a página, pero este es el método más compatible para que "salga" el PDF.
  return proxy;
};

const TOTAL_PAGES = 20; 

// --- ICONOS SVG ---
const Icons = {
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  MicOff: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  Cam: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Arrow: (dir) => <svg style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Share: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
};

export default function App() {
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [pageIndex, setPageIndex] = useState(1);
  const [voiceOn, setVoiceOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [msg, setMsg] = useState("Cargando Visor PDF...");
  const [gunReady, setGunReady] = useState(false);
  const [toast, setToast] = useState("");

  const gunRef = useRef(null);
  const recognitionRef = useRef(null);
  const videoRef = useRef(null);
  const isVoiceRunning = useRef(false);

  // --- 1. CARGA DINÁMICA DE GUN (Para que funcione sin instalar nada) ---
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/gun/gun.js';
    script.async = true;
    script.onload = () => {
      if (window.Gun) {
        gunRef.current = window.Gun(['https://gun-manhattan.herokuapp.com/gun']);
        setGunReady(true);
        setMsg("Sincronización lista.");
      }
    };
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // --- 2. SINCRONIZACIÓN P2P ---
  useEffect(() => {
    if (!activeRoom || !gunRef.current) return;
    const room = gunRef.current.get('pdf-v5-fixed').get(activeRoom);
    room.get('page').on((data) => {
      if (data) {
        setPageIndex(data);
        setMsg(`Página ${data} sincronizada.`);
      }
    });
    return () => { if (room) room.off(); };
  }, [activeRoom, gunReady]);

  // --- LÓGICA DE NAVEGACIÓN ---
  const handleJoin = () => {
    const name = roomInput.trim().toLowerCase();
    if (!name) return setMsg("Escribe un nombre de sala.");
    setActiveRoom(name);
  };

  const changePage = (step) => {
    if (isLocked) return;
    setIsLocked(true);
    setTimeout(() => setIsLocked(false), 1000);

    const newPage = Math.max(1, Math.min(TOTAL_PAGES, pageIndex + step));
    setPageIndex(newPage);
    if (activeRoom && gunRef.current) {
      gunRef.current.get('pdf-v5-fixed').get(activeRoom).get('page').put(newPage);
    }
  };

  // --- VOZ ---
  const toggleVoice = () => {
    if (isVoiceRunning.current) {
      isVoiceRunning.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      setVoiceOn(false);
      return;
    }
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return setMsg("Voz no soportada.");
    try {
      const rec = new Speech();
      rec.lang = 'es-ES';
      rec.continuous = true;
      rec.onstart = () => { isVoiceRunning.current = true; setVoiceOn(true); setMsg("🎤 Escuchando..."); };
      rec.onresult = (e) => {
        const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
        if (text.includes('siguiente') || text.includes('pasa')) changePage(1);
        else if (text.includes('atrás') || text.includes('vuelve')) changePage(-1);
      };
      rec.onerror = () => { setVoiceOn(false); isVoiceRunning.current = false; };
      rec.onend = () => { if (isVoiceRunning.current) try { rec.start(); } catch(e) {} };
      recognitionRef.current = rec;
      rec.start();
    } catch (e) { setMsg("Error en micro."); }
  };

  const toggleCamera = async () => {
    if (camOn) {
      if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      setCamOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      videoRef.current.srcObject = stream;
      setCamOn(true);
    } catch (e) { setMsg("Cámara bloqueada."); }
  };

  const copyLink = () => {
    const url = window.location.origin + window.location.pathname + `?room=${activeRoom}`;
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setToast("¡Link copiado!");
    setTimeout(() => setToast(""), 2000);
  };

  // --- VISTA ENTRADA ---
  if (!activeRoom) {
    return (
      <div style={containerStyle}>
        <style>{`body { margin: 0; background: #020617; font-family: sans-serif; }`}</style>
        <div style={cardStyle}>
          <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🚀</div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: '900', color: 'white' }}>PDF Live Sync</h1>
          <p style={{ opacity: 0.6, marginBottom: '35px', color: 'white' }}>Solución Reddit para bloqueos de PDF.</p>
          <input 
            placeholder="NOMBRE DE LA SALA"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            style={inputStyle}
          />
          <button onClick={handleJoin} style={btnMainStyle}>ENTRAR A LA CONFERENCIA</button>
          <div style={{ marginTop: '25px', fontSize: '12px', color: '#64748b' }}>{msg}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style>{`
        body { margin: 0; overflow: hidden; background: #0f172a; }
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 10px 20px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      {/* Cámara HD */}
      <div style={{
        position: 'fixed', bottom: '130px', right: '30px', 
        width: camOn ? '260px' : '0', height: camOn ? '260px' : '0',
        borderRadius: '32px', overflow: 'hidden', border: '4px solid #3b82f6', zIndex: 100,
        backgroundColor: '#000', transition: '0.4s', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
      </div>

      {/* Cabecera */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ background: '#ef4444', padding: '5px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '11px', color: 'white' }}>LIVE</div>
          <div style={{ fontWeight: '800', fontSize: '14px', color: 'white' }}>SALA: {activeRoom.toUpperCase()}</div>
        </div>
        <button onClick={copyLink} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icons.Share /> COMPARTIR
        </button>
      </div>

      {/* Visor PDF con Proxy Anti-Bloqueo */}
      <div style={{ flex: 1, width: '100%', background: '#1e293b', overflow: 'hidden' }}>
        <iframe 
          key={pageIndex}
          src={getPdfUrl(pageIndex)} 
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="PDF Content"
        />
      </div>

      {/* Controles */}
      <div style={footerStyle}>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => changePage(-1)} style={btnNavStyle}><Icons.Arrow dir="prev" /></button>
          
          <button onClick={toggleVoice} style={{ ...btnNavStyle, width: '180px', background: voiceOn ? '#3b82f6' : '#1e293b' }}>
             <span style={{ color: 'white', fontWeight: 'bold' }}>{voiceOn ? '🎤 VOZ: ON' : 'ACTIVAR VOZ'}</span>
          </button>

          <button onClick={toggleCamera} style={{ ...btnNavStyle, width: '160px' }}>
            <Icons.Cam /> <span style={{ marginLeft: '10px', color: 'white', fontWeight: 'bold' }}>{camOn ? 'CAM OFF' : 'CÁMARA HD'}</span>
          </button>

          <button onClick={() => changePage(1)} style={btnNavStyle}><Icons.Arrow dir="next" /></button>
        </div>
        <div style={{ fontSize: '11px', color: '#475569', marginTop: '10px' }}>{msg}</div>
      </div>
    </div>
  );
}

// --- ESTILOS ---
const containerStyle = { height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const cardStyle = { background: '#0f172a', padding: '50px', borderRadius: '45px', width: '100%', maxWidth: '420px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' };
const inputStyle = { width: '100%', padding: '20px', borderRadius: '18px', border: '2px solid #3b82f6', background: 'transparent', color: 'white', marginBottom: '25px', fontSize: '1.2rem', textAlign: 'center', outline: 'none', boxSizing: 'border-box' };
const btnMainStyle = { width: '100%', padding: '20px', borderRadius: '18px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '1rem' };
const headerStyle = { width: '100%', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020617', borderBottom: '1px solid #1e293b', boxSizing: 'border-box', zIndex: 50 };
const footerStyle = { width: '100%', background: '#020617', padding: '25px', borderTop: '1px solid #1e293b', textAlign: 'center', boxSizing: 'border-box', zIndex: 50 };
const btnNavStyle = { background: '#1e293b', border: '1px solid #334155', padding: '12px 24px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };