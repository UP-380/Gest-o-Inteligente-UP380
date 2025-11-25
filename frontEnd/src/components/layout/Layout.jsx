import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      {/* Sidebar Menu - Ordem igual ao HTML original */}
      <nav className="sidebar" id="sidebar">
        <div className="sidebar-content">
          <Link 
            to="/painel" 
            className={`sidebar-item ${isActive('/painel') ? 'active' : ''}`} 
            title="Painel"
          >
            <i className="fas fa-chart-bar"></i>
            <span className="sidebar-text">Painel</span>
          </Link>
          <Link 
            to="/dashboard-clientes" 
            className={`sidebar-item ${isActive('/dashboard-clientes') ? 'active' : ''}`} 
            title="Clientes"
          >
            <i className="fas fa-users"></i>
            <span className="sidebar-text">Clientes</span>
          </Link>
          <Link 
            to="/cadastro-colaboradores" 
            className={`sidebar-item ${isActive('/cadastro-colaboradores') ? 'active' : ''}`} 
            title="Colaboradores"
          >
            <i className="fas fa-user-tie"></i>
            <span className="sidebar-text">Colaboradores</span>
          </Link>
          <button
            type="button"
            className="sidebar-item" 
            title="Sair" 
            onClick={handleLogout}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="sidebar-text">Sair</span>
          </button>
        </div>
      </nav>

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

