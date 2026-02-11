// @ts-nocheck
/* eslint-disable */
'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * WEBINAR MASTER P2P (VERSIÓN FINAL SIN LÍMITES)
 * - Video/Audio: PeerJS (Conexión directa entre PCs, gratis e ilimitada).
 * - Sincro PDF: Gun.js (Nodos gratuitos de relevo).
 * - Visor PDF: Google Docs Proxy (Evita bloqueos de Hostinger).
 */

const GUN_CDN = "https://cdn.jsdelivr.net/npm/gun/gun.js";
const PEER_CDN = "https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js";
const GUN_PEERS = [
  'https://gun-manhattan.herokuapp.com/gun',
  'https://relay.peer.ooo/gun'
];

const RAW_PDF_URL = "https://darkturquoise-capybara-951908.hostingersite.com/wp-content/uploads/2026/02/10L-Juanes-2026.pdf";
const getPdfUrl = (page) => `https://docs.google.com/viewer?url=${encodeURIComponent(RAW_PDF_URL)}&embedded=true`;
const TOTAL_PAGES = 30; 

// Iconos en SVG para evitar dependencias de librerías externas que den error
const Icons = {
  Arrow: (dir) => <svg style={{ transform: dir === 'prev' ? 'rotate(180deg)' : 'none' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Share: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  Video: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
};

export default function App() {
  const [isMounted, setIsMounted] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [role, setRole] = useState(null); // 'host' | 'viewer'
  const [pageIndex, setPageIndex] = useState(1);
  const [msg, setMsg] = useState("Cargando sistemas...");
  const [toast, setToast] = useState("");
  const [isLive, setIsLive] = useState(false);

  const gunRef = useRef(null);
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const streamRef = useRef(null);

  // --- 1. CARGA DE SCRIPTS Y LÓGICA DE MONTAJE ---
  useEffect(() => {
    setIsMounted(true);
    
    const loadScript = (src) => new Promise(res => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script'); s.src = src; s.onload = res; document.body.appendChild(s);
    });

    Promise.all([loadScript(GUN_CDN), loadScript(PEER_CDN)]).then(() => {
      if (window.Gun) gunRef.current = window.Gun(GUN_PEERS);
      setMsg("Sistemas P2P Listos.");
      
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setRoomInput(roomParam);
        setMsg(`Invitación para sala: ${roomParam}`);
      }
    });
  }, []);

  // --- 2. SINCRONIZACIÓN DE DATOS (PÁGINA Y VIDEO) ---
  useEffect(() => {
    if (!activeRoom || !gunRef.current) return;
    const room = gunRef.current.get('webinar-v50-stable').get(activeRoom);
    
    // Escuchar cambio de página
    room.get('page').on((data) => {
      if (data && data !== pageIndex) setPageIndex(data);
    });

    // Escuchar quién es el Host para conectarse al video
    room.get('hostPeerId').on((id) => {
      if (id && role === 'viewer' && !isLive) {
        connectToHost(id);
      }
    });

    return () => room.off();
  }, [activeRoom, role, isLive]);

  // --- LÓGICA PEERJS (VIDEO GRATIS) ---
  const initPeer = (roomName, isHost) => {
    const peer = new window.Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (isHost) {
        // El host publica su ID para que los demás lo llamen
        gunRef.current.get('webinar-v50-stable').get(roomName).get('hostPeerId').put(id);
        setMsg("Transmitiendo señal...");
      }
    });

    peer.on('call', (call) => {
      // El host responde con su cámara
      if (streamRef.current) call.answer(streamRef.current);
    });

    peer.on('error', () => setMsg("Error de conexión. Prueba refrescar."));
  };

  const connectToHost = (hostId) => {
    if (!peerRef.current || role !== 'viewer') return;
    setMsg("Sincronizando video...");
    
    // Llamada muda para recibir el video del host
    const call = peerRef.current.call(hostId, new MediaStream());
    call.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        setIsLive(true);
        setMsg("En vivo");
      }
    });
  };

  // --- ACCIONES DEL USUARIO ---
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
        setIsLive(true);
        initPeer(name, true);
      } catch (e) {
        setMsg("Permiso de cámara denegado.");
      }
    } else {
      initPeer(name, false);
      setMsg("Buscando al anfitrión...");
    }
  };

  const changePage = (step) => {
    const newPage = Math.max(1, Math.min(TOTAL_PAGES, pageIndex + step));
    setPageIndex(newPage);
    if (activeRoom && gunRef.current) {
      gunRef.current.get('webinar-v50-stable').get(activeRoom).get('page').put(newPage);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${activeRoom}`;
    navigator.clipboard.writeText(url);
    setToast("¡Enlace copiado! Envíalo a tus invitados.");
    setTimeout(() => setToast(""), 3000);
  };

  if (!isMounted) return null;

  // --- PANTALLA DE INICIO ---
  if (!activeRoom) {
    return (
      <div style={containerStyle} suppressHydrationWarning>
        <style>{`body { margin: 0; background: #020617; font-family: 'Inter', sans-serif; color: white; }`}</style>
        <div style={cardStyle}>
          <div style={{ fontSize: '4.5rem', marginBottom: '10px' }}>🚀</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900 }}>Webinar Pro</h1>
          <p style={{ opacity: 0.6, marginBottom: '40px' }}>Video, Audio y PDF sincronizados (Sin Límites).</p>
          
          <input 
            placeholder="NOMBRE DE LA SALA"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            style={inputStyle}
          />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
            <button onClick={() => handleJoin('host')} style={btnMainStyle}>
               CREAR SALA (HOST)
            </button>
            <button onClick={() => handleJoin('viewer')} style={{ ...btnMainStyle, background: 'transparent', border: '2px solid #3b82f6' }}>
               UNIRSE A SALA (ESPECTADOR)
            </button>
          </div>
          
          <div style={{ marginTop: '30px', fontSize: '13px', color: '#64748b' }}>{msg}</div>
        </div>
      </div>
    );
  }

  // --- PANTALLA DE CONFERENCIA ---
  return (
    <div style={containerStyle} suppressHydrationWarning>
      <style>{`
        body { margin: 0; overflow: hidden; background: #0f172a; }
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #3b82f6; color: white; padding: 12px 24px; border-radius: 12px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.4); font-weight: bold; border: 1px solid rgba(255,255,255,0.2); animation: slideUp 0.3s ease-out; }
        @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>

      {toast && <div className="toast">{toast}</div>}

      {/* CÁMARA FLOTANTE */}
      <div style={{
        position: 'fixed', bottom: '130px', right: '30px', 
        width: isLive ? '320px' : '0', height: isLive ? '240px' : '0',
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
             <span style={{ fontWeight: 900, fontSize: '11px', color: 'white' }}>{role === 'host' ? 'TRANSMITIENDO' : 'MIRANDO'}</span>
          </div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: 'white' }}>SALA: <span style={{ color: '#3b82f6' }}>{activeRoom.toUpperCase()}</span></div>
        </div>
        
        <button onClick={copyLink} style={{ background: '#3b82f6', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '14px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icons.Share /> COPIAR LINK
        </button>
      </div>

      {/* PDF VIEWER */}
      <div style={{ flex: 1, width: '100%', background: '#1e293b', overflow: 'hidden' }}>
        <iframe key={pageIndex} src={getPdfUrl(pageIndex)} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Content" />
      </div>

      {/* FOOTER CONTROLES */}
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