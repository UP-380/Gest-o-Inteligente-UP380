import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [clientesExpanded, setClientesExpanded] = useState(false);
  const [colaboradoresExpanded, setColaboradoresExpanded] = useState(false);
  const [catalogosExpanded, setCatalogosExpanded] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isClientesActive = () => {
    return isActive('/relatorios-clientes') || isActive('/gestao-clientes');
  };

  const isColaboradoresActive = () => {
    return isActive('/relatorios-colaboradores') || isActive('/gestao-colaboradores') || isActive('/configuracoes/custo-colaborador');
  };

  const isCatalogosActive = () => {
    return isActive('/cadastro/atividades') || isActive('/cadastro/produtos') || isActive('/cadastro/tipo-atividades') || isActive('/cadastro/vinculacoes');
  };

  // Expandir automaticamente o menu Clientes se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isClientesActive = location.pathname === '/relatorios-clientes' || location.pathname === '/gestao-clientes';
    if (isClientesActive) {
      setClientesExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Colaboradores se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isColaboradoresActive = location.pathname === '/relatorios-colaboradores' || location.pathname === '/gestao-colaboradores' || location.pathname === '/configuracoes/custo-colaborador';
    if (isColaboradoresActive) {
      setColaboradoresExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Catálogos se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isCatalogosActive = location.pathname === '/cadastro/atividades' || location.pathname === '/cadastro/produtos' || location.pathname === '/cadastro/tipo-atividades' || location.pathname === '/cadastro/vinculacoes';
    if (isCatalogosActive) {
      setCatalogosExpanded(true);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleClientes = (e) => {
    e.preventDefault();
    setClientesExpanded(!clientesExpanded);
  };

  const toggleColaboradores = (e) => {
    e.preventDefault();
    setColaboradoresExpanded(!colaboradoresExpanded);
  };

  const toggleCatalogos = (e) => {
    e.preventDefault();
    setCatalogosExpanded(!catalogosExpanded);
  };

  const menuItems = [
    {
      path: '/painel',
      icon: 'fa-chart-bar',
      label: 'Painel',
      title: 'Painel'
    }
  ];

  const clientesSubItems = [
    {
      path: '/relatorios-clientes',
      icon: 'fa-file-alt',
      label: 'Relatórios de Clientes',
      title: 'Relatórios de Clientes'
    },
    {
      path: '/gestao-clientes',
      icon: 'fa-briefcase',
      label: 'Gestão de Clientes',
      title: 'Gestão de Clientes'
    }
  ];

  const colaboradoresSubItems = [
    {
      path: '/relatorios-colaboradores',
      icon: 'fa-file-alt',
      label: 'Relatórios de Colaboradores',
      title: 'Relatórios de Colaboradores'
    },
    {
      path: '/gestao-colaboradores',
      icon: 'fa-briefcase',
      label: 'Gestão de Colaboradores',
      title: 'Gestão de Colaboradores'
    },
    {
      path: '/configuracoes/custo-colaborador',
      icon: 'fa-cog',
      label: 'Custo Colaborador',
      title: 'Custo Colaborador'
    }
  ];

  const catalogosSubItems = [
    {
      path: '/cadastro/atividades',
      icon: 'fa-tasks',
      label: 'Atividades',
      title: 'Cadastro de Atividades'
    },
    {
      path: '/cadastro/produtos',
      icon: 'fa-box',
      label: 'Produtos',
      title: 'Cadastro de Produtos'
    },
    {
      path: '/cadastro/tipo-atividades',
      icon: 'fa-list-alt',
      label: 'Tipo de Atividades',
      title: 'Cadastro de Tipo de Atividades'
    },
    {
      path: '/cadastro/vinculacoes',
      icon: 'fa-link',
      label: 'Vinculações',
      title: 'Vinculações'
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

        {/* Menu Clientes com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isClientesActive() ? 'active' : ''}`}
            title="Clientes"
            onClick={toggleClientes}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-users"></i>
            <span className="sidebar-text">Clientes</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${clientesExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${clientesExpanded ? 'open' : ''}`}>
            {clientesSubItems.map((subItem) => (
              <Link
                key={subItem.path}
                to={subItem.path}
                className={`sidebar-item sidebar-submenu-item ${isActive(subItem.path) ? 'active' : ''}`}
                title={subItem.title}
              >
                <i className={`fas ${subItem.icon}`}></i>
                <span className="sidebar-text">{subItem.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Menu Colaboradores com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isColaboradoresActive() ? 'active' : ''}`}
            title="Colaboradores"
            onClick={toggleColaboradores}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-user-tie"></i>
            <span className="sidebar-text">Colaboradores</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${colaboradoresExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${colaboradoresExpanded ? 'open' : ''}`}>
            {colaboradoresSubItems.map((subItem) => (
              <Link
                key={subItem.path}
                to={subItem.path}
                className={`sidebar-item sidebar-submenu-item ${isActive(subItem.path) ? 'active' : ''}`}
                title={subItem.title}
              >
                <i className={`fas ${subItem.icon}`}></i>
                <span className="sidebar-text">{subItem.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Menu Catálogos com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isCatalogosActive() ? 'active' : ''}`}
            title="Catálogos"
            onClick={toggleCatalogos}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-book"></i>
            <span className="sidebar-text">Catálogos</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${catalogosExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${catalogosExpanded ? 'open' : ''}`}>
            {catalogosSubItems.map((subItem) => (
              <Link
                key={subItem.path}
                to={subItem.path}
                className={`sidebar-item sidebar-submenu-item ${isActive(subItem.path) ? 'active' : ''}`}
                title={subItem.title}
              >
                <i className={`fas ${subItem.icon}`}></i>
                <span className="sidebar-text">{subItem.label}</span>
              </Link>
            ))}
          </div>
        </div>

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

