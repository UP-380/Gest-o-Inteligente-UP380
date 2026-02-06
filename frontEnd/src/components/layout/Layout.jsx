import React from 'react';
import Sidebar from './Sidebar';
import TimerAtivo from '../user/TimerAtivo';
import UserProfile from '../user/UserProfile';
import NotificationBell from './NotificationBell';
import CommunicationDrawer from './CommunicationDrawer';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const { usuario } = useAuth();
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

      {/* Container de notificações toast */}
      <div id="toastContainer" className="toast-container" aria-live="polite" aria-atomic="true"></div>
    </>
  );
};

export default Layout;

