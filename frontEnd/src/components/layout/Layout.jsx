import React from 'react';
import Sidebar from './Sidebar';
import UserProfile from '../user/UserProfile';
import './Layout.css';

const Layout = ({ children }) => {
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
          
          {/* Perfil de usuário no lado direito */}
          <div className="header-right">
            <UserProfile />
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

