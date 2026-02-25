import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Sidebar from './Sidebar';
import TimerAtivo from '../user/TimerAtivo';
import UserProfile from '../user/UserProfile';
import NotificationBell from './NotificationBell';
import CommunicationDrawer from './CommunicationDrawer';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [comunicadoDestaque, setComunicadoDestaque] = useState(null);

  // Carregar comunicado de destaque (avisos importantes)
  const fetchDestaque = useCallback(async () => {
    try {
      const res = await comunicacaoAPI.buscarComunicadoDestaque();
      if (res.success && res.data) {
        setComunicadoDestaque(res.data);
      } else {
        setComunicadoDestaque(null);
      }
    } catch (err) {
      console.error('Erro ao buscar destaque:', err);
    }
  }, []);

  useEffect(() => {
    fetchDestaque();
    // Polling a cada 30 segundos para novos avisos sem precisar recarregar
    const interval = setInterval(fetchDestaque, 30000);

    // Ouvir evento para recarregar destaque imediatamente
    const handleRefresh = () => fetchDestaque();
    window.addEventListener('refresh-comunicado-destaque', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-comunicado-destaque', handleRefresh);
    };
  }, [fetchDestaque]);

  const handleVisualizarDestaque = async () => {
    if (!comunicadoDestaque) return;
    try {
      await comunicacaoAPI.marcarMensagemLida(comunicadoDestaque.id);
      setComunicadoDestaque(null);
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  };

  const handleActionDestaque = () => {
    if (!comunicadoDestaque) return;

    if (comunicadoDestaque.metadata?.origem === 'notas_atualizacao') {
      const notaId = comunicadoDestaque.metadata.nota_id;
      navigate(`/base-conhecimento/notas-atualizacao-apresentacao?id=${notaId}`);
    } else {
      window.dispatchEvent(new CustomEvent('open-communication-drawer', { detail: { tab: 'comunicados' } }));
    }

    // Marcar como lido para sumir o banner após abrir/redirecionar
    handleVisualizarDestaque();
  };
  return (
    <>
      {/* Sidebar Menu */}
      <Sidebar />

      {/* Header azul escuro no topo - Exatamente como no HTML original */}
      <header className="top-header">
        <div className="header-container">
          <div className="header-left">
            <div className="header-logo">
              <img
                src="/assets/images/LOGO DO SISTEMA .png"
                alt="UP Gestão Inteligente"
                className="header-logo-img"
                onError={(e) => {
                  // Fallback se a imagem não for encontrada
                  e.target.style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* Timer ativo, Central de Comunicação e Perfil de usuário no header (apenas desktop) */}
          <div className="header-right">
            <div id="header-extra-content"></div>
            <TimerAtivo />
            <CommunicationDrawer user={usuario} />
            <NotificationBell user={usuario} />
            <div className="header-user-profile">
              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      {children}

      {/* Notificação Flutuante de Comunicado Global */}
      {comunicadoDestaque && createPortal(
        <div className="painel-usuario-aviso-floating" style={{
          position: 'fixed',
          top: '67px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000000,
          background: 'rgba(14, 59, 111, 0.98)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.2)',
          maxWidth: '80vw',
          animation: 'slideDownFade 0.3s ease-out'
        }}>
          <i className={comunicadoDestaque.metadata?.origem === 'notas_atualizacao' ? "fas fa-rocket" : "fas fa-bullhorn"} style={{ color: '#fbbf24', fontSize: '13px' }}></i>
          <div style={{ fontSize: '0.85rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ fontWeight: '800' }}>{comunicadoDestaque.titulo}</span>
          </div>
          <button
            className="view-more-aviso-btn"
            title="Ver mais detalhes"
            onClick={handleActionDestaque}
            style={{
              background: '#2563eb',
              color: 'white',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '11px',
              fontWeight: '600',
              flexShrink: 0
            }}
          >
            Ver mais <i className="fas fa-external-link-alt" style={{ fontSize: '10px' }}></i>
          </button>
        </div>,
        document.body
      )}

      {/* Container de notificações toast */}
      <div id="toastContainer" className="toast-container" aria-live="polite" aria-atomic="true"></div>
    </>
  );
};

export default Layout;

