// @ts-nocheck
/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * WEBINAR PRO P2P (SIN LÍMITES)
 * - Video/Audio: PeerJS (Conexión directa, ilimitada y gratis).
 * - Sincronización: Gun.js (Nodos de relevo gratuitos).
 * - Visor PDF: Google Proxy (Bypass de seguridad).
 */

const GUN_CDN = "https://cdn.jsdelivr.net/npm/gun/gun.js";
const PEER_CDN = "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";
const GUN_PEERS = ['https://gun-manhattan.herokuapp.com/gun', 'https://relay.peer.ooo/gun'];

const RAW_PDF_URL = "https://darkturquoise-capybara-951908.hostingersite.com/wp-content/uploads/2026/02/10L-Juanes-2026.pdf";
const getPdfUrl = (page) => `https://docs.google.com/viewer?url=${encodeURIComponent(RAW_PDF_URL)}&embedded=true`;
const TOTAL_PAGES = 30; 

const Icons = {
  Arrow: (dir) => <svg style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Share: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  Video: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
};

export default function App() {
  const [isMounted, setIsMounted] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [role, setRole] = useState(null); // 'host' | 'viewer'
  const [pageIndex, setPageIndex] = useState(1);
  const [msg, setMsg] = useState("Cargando sistemas P2P...");
  const [toast, setToast] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const gunRef = useRef(null);
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    setIsMounted(true);
    const loadScript = (src) => new Promise(res => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; document.body.appendChild(s);
    });

    Promise.all([loadScript(GUN_CDN), loadScript(PEER_CDN)]).then(() => {
      if (window.Gun) gunRef.current = window.Gun(GUN_PEERS);
      setMsg("Sistemas listos. Sin límites.");
      
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setRoomInput(roomParam);
        setMsg(`Invitación detectada: ${roomParam}`);
      }
    });
  }, []);

  // --- SINCRONIZACIÓN DE DATOS (PÁGINA Y VIDEO ID) ---
  useEffect(() => {
    if (!activeRoom || !gunRef.current) return;
    const room = gunRef.current.get('webinar-v40-final').get(activeRoom);
    
    // Escuchar cambio de página
    room.get('page').on((data) => {
      if (data && data !== pageIndex) setPageIndex(data);
    });

    // Escuchar ID del anfitrión para conectar el video
    room.get('hostPeerId').on((id) => {
      if (id && role === 'viewer') {
        connectToHost(id);
      }
    });

    return () => room.off();
  }, [activeRoom, role]);

  const initPeer = (roomName, amIHost) => {
    const peer = new window.Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (amIHost) {
        gunRef.current.get('webinar-v40-final').get(roomName).get('hostPeerId').put(id);
        setMsg("Transmitiendo señal...");
      }
    });

    peer.on('call', (call) => {
      if (streamRef.current) {
        call.answer(streamRef.current);
      }
    });

    peer.on('error', () => setMsg("Error de conexión. Reintenta."));
  };

  const connectToHost = (hostId) => {
    if (!peerRef.current || role !== 'viewer' || isStreaming) return;
    setMsg("Conectando con el video del ponente...");
    const call = peerRef.current.call(hostId, new MediaStream());
    call.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setIsStreaming(true);
        setMsg("En vivo");
      }
    });
  };

  const handleJoin = async (selectedRole) => {
    const name = roomInput.trim().toLowerCase();
    if (!name) return setMsg("Ingresa un nombre de sala.");
    
    setRole(selectedRole);
    setActiveRoom(name);

    if (selectedRole === 'host') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsStreaming(true);
        initPeer(name, true);
      } catch (e) {
        setMsg("Permiso de cámara denegado.");
      }
    } else {
      initPeer(name, false);
      setMsg("Esperando al anfitrión...");
    }
  };

  const changePage = (step) => {
    const newPage = Math.max(1, Math.min(TOTAL_PAGES, pageIndex + step));
    setPageIndex(newPage);
    if (activeRoom && gunRef.current) {
      gunRef.current.get('webinar-v40-final').get(activeRoom).get('page').put(newPage);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${activeRoom}`;
    navigator.clipboard.writeText(url);
    setToast("¡Enlace copiado! Envíalo a otros.");
    setTimeout(() => setToast(""), 3000);
  };

  if (!isMounted) return null;

  if (!activeRoom) {
    return (
      <div style={containerStyle} suppressHydrationWarning>
        <style>{`body { margin: 0; background: #020617; font-family: 'Inter', sans-serif; color: white; }`}</style>
        <div style={cardStyle}>
          <div style={{ fontSize: '4.5rem', marginBottom: '10px' }}>🚀</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '5px' }}>Webinar Libre</h1>
          <p style={{ opacity: 0.6, marginBottom: '40px' }}>Sin límites de 5 minutos. Sin Firebase.</p>
          
          <input 
            placeholder="NOMBRE DE LA SALA"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            style={inputStyle}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
            <button onClick={() => handleJoin('host')} style={btnMainStyle}>CREAR COMO ANFITRIÓN</button>
            <button onClick={() => handleJoin('viewer')} style={{ ...btnMainStyle, background: 'transparent', border: '2px solid #3b82f6' }}>UNIRSE COMO ESPECTADOR</button>
          </div>
          
          <div style={{ marginTop: '35px', fontSize: '13px', color: '#64748b', fontWeight: '600' }}>{msg}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle} suppressHydrationWarning>
      <style>{`
        body { margin: 0; overflow: hidden; background: #0f172a; }
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #10b981; color: white; padding: 12px 24px; border-radius: 12px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.4); font-weight: bold; border: 1px solid rgba(255,255,255,0.2); animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      {/* VIDEO FLOTANTE P2P */}
      <div style={{
        position: 'fixed', bottom: '130px', right: '30px', 
        width: isStreaming ? '320px' : '0', height: isStreaming ? '240px' : '0',
        borderRadius: '24px', overflow: 'hidden', border: '4px solid #3b82f6', zIndex: 100,
        backgroundColor: '#000', transition: 'all 0.5s ease', boxShadow: '0 20px 60px rgba(0,0,0,0.7)'
      }}>
        {role === 'host' ? 
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} /> :
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        }
      </div>

      <div style={headerStyle}>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ background: role === 'host' ? '#ef4444' : '#3b82f6', padding: '6px 14px', borderRadius: '10px' }}>
             <span style={{ fontWeight: 900, fontSize: '11px', color: 'white' }}>{role === 'host' ? 'ANFITRIÓN' : 'ESPECTADOR'}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>SALA: <span style={{ color: '#3b82f6' }}>{activeRoom.toUpperCase()}</span></div>
        </div>
        
        <button onClick={copyLink} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icons.Share /> COPIAR LINK
        </button>
      </div>

      <div style={{ flex: 1, width: '100%', background: '#1e293b', overflow: 'hidden' }}>
        <iframe key={pageIndex} src={getPdfUrl(pageIndex)} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF" />
      </div>

      <div style={footerStyle}>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center' }}>
          <button onClick={() => changePage(-1)} style={btnNavStyle}><Icons.Arrow dir="prev" /></button>
          
          <div style={{ color: 'white', fontWeight: 900, background: '#1e293b', padding: '12px 25px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1.1rem' }}>
            PÁGINA {pageIndex}
          </div>

          <button onClick={() => changePage(1)} style={btnNavStyle}><Icons.Arrow dir="next" /></button>
        </div>
        <div style={{ fontSize: '12px', color: '#475569', marginTop: '15px', fontWeight: '600' }}>{msg}</div>
      </div>
    </div>
  );
}

// --- ESTILOS ---
const containerStyle = { height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' };
const cardStyle = { background: '#0f172a', padding: '70px', borderRadius: '60px', width: '100%', maxWidth: '460px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 50px 120px rgba(0,0,0,0.8)' };
const inputStyle = { width: '100%', padding: '24px', borderRadius: '22px', border: '2px solid #3b82f6', background: 'transparent', color: 'white', marginBottom: '30px', fontSize: '1.2rem', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontWeight: 'bold' };
const btnMainStyle = { width: '100%', padding: '22px', borderRadius: '22px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 900, cursor: 'pointer', fontSize: '1rem', transition: 'all 0.2s ease' };
const headerStyle = { width: '100%', padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#020617', borderBottom: '1px solid #1e293b', boxSizing: 'border-box', zIndex: 50 };
const footerStyle = { width: '100%', background: '#020617', padding: '35px', borderTop: '1px solid #1e293b', textAlign: 'center', boxSizing: 'border-box', zIndex: 50 };
const btnNavStyle = { background: '#1e293b', border: 'none', padding: '18px 32px', borderRadius: '20px', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };