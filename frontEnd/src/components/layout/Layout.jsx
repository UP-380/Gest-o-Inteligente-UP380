import React from 'react';
import Sidebar from './Sidebar';
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
        </div>
      </header>
      
      {/* Conteúdo principal */}
      {children}
    </>
  );
};

export default Layout;

