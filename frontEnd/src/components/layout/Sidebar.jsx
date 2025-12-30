import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VERSAO_SISTEMA } from '../../config/versao';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const [relatoriosExpanded, setRelatoriosExpanded] = useState(false);
  const [cadastrosExpanded, setCadastrosExpanded] = useState(false);
  const [configuracoesExpanded, setConfiguracoesExpanded] = useState(false);
  const [baseConhecimentoExpanded, setBaseConhecimentoExpanded] = useState(false);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isRelatoriosActive = () => {
    return isActive('/relatorios-clientes') || isActive('/relatorios-colaboradores');
  };

  const isCadastrosActive = () => {
    return isActive('/cadastro/clientes') || 
           isActive('/cadastro/colaboradores') || 
           isActive('/cadastro/produtos') || location.pathname.startsWith('/cadastro/produto') || 
           isActive('/cadastro/tarefas') || location.pathname.startsWith('/cadastro/tarefa') || 
           isActive('/cadastro/subtarefas') || location.pathname.startsWith('/cadastro/subtarefa') ||
           isActive('/cadastro/tipo-tarefas') || location.pathname.startsWith('/cadastro/tipo-tarefa') || 
           isActive('/cadastro/bancos') ||
           isActive('/cadastro/banco') ||
           isActive('/cadastro/adquirentes') ||
           isActive('/cadastro/sistemas') || location.pathname.startsWith('/cadastro/sistema');
  };

  const isConfiguracoesActive = () => {
    return isActive('/cadastro/custo-colaborador') || 
           isActive('/cadastro/vinculacoes') ||
           isActive('/documentacao-api');
  };

  const isBaseConhecimentoActive = () => {
    return isActive('/base-conhecimento/conteudos-clientes') || 
           location.pathname.startsWith('/base-conhecimento/cliente/');
  };

  // Expandir automaticamente o menu Relatórios se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isRelatoriosActive = location.pathname === '/relatorios-clientes' || location.pathname === '/relatorios-colaboradores';
    if (isRelatoriosActive) {
      setRelatoriosExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Cadastros se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isCadastrosActive = location.pathname === '/cadastro/clientes' || 
                              location.pathname === '/cadastro/colaboradores' || 
                              (location.pathname === '/cadastro/produtos' || location.pathname.startsWith('/cadastro/produto')) || 
                              (location.pathname === '/cadastro/tarefas' || location.pathname.startsWith('/cadastro/tarefa')) || 
                              (location.pathname === '/cadastro/subtarefas' || location.pathname.startsWith('/cadastro/subtarefa')) ||
                              (location.pathname === '/cadastro/tipo-tarefas' || location.pathname.startsWith('/cadastro/tipo-tarefa')) || 
                              location.pathname === '/cadastro/bancos' ||
                              location.pathname === '/cadastro/banco' ||
                              (location.pathname === '/cadastro/adquirentes' || location.pathname.startsWith('/cadastro/adquirente')) ||
                              (location.pathname === '/cadastro/sistemas' || location.pathname.startsWith('/cadastro/sistema'));
    if (isCadastrosActive) {
      setCadastrosExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Configurações se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isConfiguracoesActive = location.pathname === '/cadastro/custo-colaborador' ||
                                   location.pathname === '/cadastro/vinculacoes' ||
                                   location.pathname === '/documentacao-api';
    if (isConfiguracoesActive) {
      setConfiguracoesExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Base de Conhecimento se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isBaseConhecimentoActive = location.pathname === '/base-conhecimento/conteudos-clientes' ||
                                      location.pathname.startsWith('/base-conhecimento/cliente/');
    if (isBaseConhecimentoActive) {
      setBaseConhecimentoExpanded(true);
    }
  }, [location.pathname]);

  const toggleRelatorios = (e) => {
    e.preventDefault();
    setRelatoriosExpanded(!relatoriosExpanded);
  };

  const toggleCadastros = (e) => {
    e.preventDefault();
    setCadastrosExpanded(!cadastrosExpanded);
  };

  const toggleConfiguracoes = (e) => {
    e.preventDefault();
    setConfiguracoesExpanded(!configuracoesExpanded);
  };

  const toggleBaseConhecimento = (e) => {
    e.preventDefault();
    setBaseConhecimentoExpanded(!baseConhecimentoExpanded);
  };

  const menuItems = [
    {
      path: '/painel',
      icon: 'fa-chart-bar',
      label: 'Painel',
      title: 'Painel'
    },
    {
      path: '/painel-usuario',
      icon: 'fa-th-large',
      label: 'Painel do Usuário',
      title: 'Painel do Usuário'
    },
    {
      path: '/atribuir-responsaveis',
      icon: 'fa-user-check',
      label: 'Atribuir Responsáveis',
      title: 'Atribuir Responsáveis'
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

  const cadastrosSubItems = [
    {
      path: '/cadastro/clientes',
      icon: 'fa-briefcase',
      label: 'Clientes',
      title: 'Clientes'
    },
    {
      path: '/cadastro/colaboradores',
      icon: 'fa-user-cog',
      label: 'Colaboradores',
      title: 'Colaboradores'
    },
    {
      path: '/cadastro/produtos',
      icon: 'fa-box',
      label: 'Produtos',
      title: 'Cadastro de Produtos'
    },
    {
      path: '/cadastro/tarefas',
      icon: 'fa-tasks',
      label: 'Tarefas',
      title: 'Cadastro de Tarefas'
    },
    {
      path: '/cadastro/subtarefas',
      icon: 'fa-list-ul',
      label: 'Subtarefas',
      title: 'Cadastro de Subtarefas'
    },
    {
      path: '/cadastro/tipo-tarefas',
      icon: 'fa-list-alt',
      label: 'Tipo de Tarefas',
      title: 'Cadastro de Tipo de Tarefas'
    },
    {
      path: '/cadastro/bancos',
      icon: 'fa-university',
      label: 'Banco',
      title: 'Cadastro de Banco'
    },
    {
      path: '/cadastro/adquirentes',
      icon: 'fa-credit-card',
      label: 'Adquirente',
      title: 'Cadastro de Adquirente'
    },
    {
      path: '/cadastro/sistemas',
      icon: 'fa-server',
      label: 'Sistemas',
      title: 'Cadastro de Sistemas'
    }
  ];

  const configuracoesSubItems = [
    {
      path: '/cadastro/custo-colaborador',
      icon: 'fa-dollar-sign',
      label: 'Custo Colaborador',
      title: 'Custo Colaborador'
    },
    {
      path: '/cadastro/vinculacoes',
      icon: 'fa-link',
      label: 'Vinculações',
      title: 'Vinculações'
    },
    {
      path: '/documentacao-api',
      icon: 'fa-code',
      label: 'Documentação API',
      title: 'Documentação API'
    }
  ];

  const baseConhecimentoSubItems = [
    {
      path: '/base-conhecimento/conteudos-clientes',
      icon: 'fa-briefcase',
      label: 'Conteúdos Clientes',
      title: 'Conteúdos Clientes'
    }
  ];

  return (
    <nav className="sidebar" id="sidebar">
      <div className="sidebar-content">
        <div className="sidebar-menu-wrapper">
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

          {/* Menu Cadastros com Submenu */}
          <div className="sidebar-menu-group">
            <button
              type="button"
              className={`sidebar-item sidebar-menu-toggle ${isCadastrosActive() ? 'active' : ''}`}
              title="Cadastros"
              onClick={toggleCadastros}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <i className="fas fa-database"></i>
              <span className="sidebar-text">Cadastros</span>
              <i className={`fas fa-chevron-right sidebar-chevron ${cadastrosExpanded ? 'expanded' : ''}`}></i>
            </button>
            
            <div className={`sidebar-submenu ${cadastrosExpanded ? 'open' : ''}`}>
              {cadastrosSubItems.map((subItem) => (
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

          {/* Menu Base de Conhecimento com Submenu */}
          <div className="sidebar-menu-group">
            <button
              type="button"
              className={`sidebar-item sidebar-menu-toggle ${isBaseConhecimentoActive() ? 'active' : ''}`}
              title="Base de Conhecimento"
              onClick={toggleBaseConhecimento}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <i className="fas fa-book"></i>
              <span className="sidebar-text">Base de Conhecimento</span>
              <i className={`fas fa-chevron-right sidebar-chevron ${baseConhecimentoExpanded ? 'expanded' : ''}`}></i>
            </button>
            
            <div className={`sidebar-submenu ${baseConhecimentoExpanded ? 'open' : ''}`}>
              {baseConhecimentoSubItems.map((subItem) => (
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
        </div>

        {/* Rodapé do Menu */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-content">
            {/* Versão e Copyright */}
            <div className="sidebar-footer-meta">
              <div className="sidebar-footer-version-info">
                <i className="fas fa-code-branch"></i>
                <span className="marca-dagua-texto">v{VERSAO_SISTEMA}</span>
              </div>
              <div className="sidebar-footer-copyright">
                <span>2025 UP Gestão Inteligente</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Sidebar;

