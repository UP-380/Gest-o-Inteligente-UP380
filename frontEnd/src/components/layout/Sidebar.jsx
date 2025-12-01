import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
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

  const menuItems = [
    {
      path: '/painel',
      icon: 'fa-chart-bar',
      label: 'Painel',
      title: 'Painel'
    },
    {
      path: '/relatorios-clientes',
      icon: 'fa-users',
      label: 'Relatórios de Clientes',
      title: 'Relatórios de Clientes'
    },
    {
      path: '/relatorios-colaboradores',
      icon: 'fa-user-tie',
      label: 'Relatórios de Colaboradores',
      title: 'Relatórios de Colaboradores'
    }
  ];

  return (
    <nav className="sidebar" id="sidebar">
      <div className="sidebar-content">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            title={item.title}
          >
            <i className={`fas ${item.icon}`}></i>
            <span className="sidebar-text">{item.label}</span>
          </Link>
        ))}
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
  );
};

export default Sidebar;

