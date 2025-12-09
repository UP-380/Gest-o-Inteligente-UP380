import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [relatoriosExpanded, setRelatoriosExpanded] = useState(false);
  const [gestaoExpanded, setGestaoExpanded] = useState(false);
  const [configuracoesExpanded, setConfiguracoesExpanded] = useState(false);
  const [referenciasExpanded, setReferenciasExpanded] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isRelatoriosActive = () => {
    return isActive('/relatorios-clientes') || isActive('/relatorios-colaboradores');
  };

  const isGestaoActive = () => {
    return isActive('/gestao-clientes') || isActive('/gestao-colaboradores');
  };

  const isConfiguracoesActive = () => {
    return isActive('/configuracoes/custo-colaborador');
  };

  const isReferenciasActive = () => {
    return isActive('/catalogo/atividades') || isActive('/catalogo/produtos') || isActive('/catalogo/tipo-atividades') || isActive('/catalogo/vinculacoes');
  };

  // Expandir automaticamente o menu Relatórios se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isRelatoriosActive = location.pathname === '/relatorios-clientes' || location.pathname === '/relatorios-colaboradores';
    if (isRelatoriosActive) {
      setRelatoriosExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Gestão se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isGestaoActive = location.pathname === '/gestao-clientes' || location.pathname === '/gestao-colaboradores';
    if (isGestaoActive) {
      setGestaoExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Configurações se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isConfiguracoesActive = location.pathname === '/configuracoes/custo-colaborador';
    if (isConfiguracoesActive) {
      setConfiguracoesExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Gestão de Referências se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isReferenciasActive = location.pathname === '/catalogo/atividades' || location.pathname === '/catalogo/produtos' || location.pathname === '/catalogo/tipo-atividades' || location.pathname === '/catalogo/vinculacoes';
    if (isReferenciasActive) {
      setReferenciasExpanded(true);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleRelatorios = (e) => {
    e.preventDefault();
    setRelatoriosExpanded(!relatoriosExpanded);
  };

  const toggleGestao = (e) => {
    e.preventDefault();
    setGestaoExpanded(!gestaoExpanded);
  };

  const toggleConfiguracoes = (e) => {
    e.preventDefault();
    setConfiguracoesExpanded(!configuracoesExpanded);
  };

  const toggleReferencias = (e) => {
    e.preventDefault();
    setReferenciasExpanded(!referenciasExpanded);
  };

  const menuItems = [
    {
      path: '/painel',
      icon: 'fa-chart-bar',
      label: 'Painel',
      title: 'Painel'
    }
  ];

  const relatoriosSubItems = [
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

  const gestaoSubItems = [
    {
      path: '/gestao-clientes',
      icon: 'fa-briefcase',
      label: 'Gestão de Clientes',
      title: 'Gestão de Clientes'
    },
    {
      path: '/gestao-colaboradores',
      icon: 'fa-user-cog',
      label: 'Gestão de Colaboradores',
      title: 'Gestão de Colaboradores'
    }
  ];

  const configuracoesSubItems = [
    {
      path: '/configuracoes/custo-colaborador',
      icon: 'fa-dollar-sign',
      label: 'Custo Colaborador',
      title: 'Custo Colaborador'
    }
  ];

  const referenciasSubItems = [
    {
      path: '/catalogo/atividades',
      icon: 'fa-tasks',
      label: 'Atividades',
      title: 'Cadastro de Atividades'
    },
    {
      path: '/catalogo/produtos',
      icon: 'fa-box',
      label: 'Produtos',
      title: 'Cadastro de Produtos'
    },
    {
      path: '/catalogo/tipo-atividades',
      icon: 'fa-list-alt',
      label: 'Tipo de Atividades',
      title: 'Cadastro de Tipo de Atividades'
    },
    {
      path: '/catalogo/vinculacoes',
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

        {/* Menu Relatórios com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isRelatoriosActive() ? 'active' : ''}`}
            title="Relatórios"
            onClick={toggleRelatorios}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-file-alt"></i>
            <span className="sidebar-text">Relatórios</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${relatoriosExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${relatoriosExpanded ? 'open' : ''}`}>
            {relatoriosSubItems.map((subItem) => (
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

        {/* Menu Gestão com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isGestaoActive() ? 'active' : ''}`}
            title="Gestão"
            onClick={toggleGestao}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-briefcase"></i>
            <span className="sidebar-text">Gestão</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${gestaoExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${gestaoExpanded ? 'open' : ''}`}>
            {gestaoSubItems.map((subItem) => (
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

        {/* Menu Configurações com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isConfiguracoesActive() ? 'active' : ''}`}
            title="Configurações"
            onClick={toggleConfiguracoes}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-cog"></i>
            <span className="sidebar-text">Configurações</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${configuracoesExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${configuracoesExpanded ? 'open' : ''}`}>
            {configuracoesSubItems.map((subItem) => (
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

        {/* Menu Gestão de Referências com Submenu */}
        <div className="sidebar-menu-group">
          <button
            type="button"
            className={`sidebar-item sidebar-menu-toggle ${isReferenciasActive() ? 'active' : ''}`}
            title="Gestão de Referências"
            onClick={toggleReferencias}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <i className="fas fa-database"></i>
            <span className="sidebar-text">Gestão de Referências</span>
            <i className={`fas fa-chevron-right sidebar-chevron ${referenciasExpanded ? 'expanded' : ''}`}></i>
          </button>
          
          <div className={`sidebar-submenu ${referenciasExpanded ? 'open' : ''}`}>
            {referenciasSubItems.map((subItem) => (
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

