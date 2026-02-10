import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VERSAO_SISTEMA } from '../../config/versao';
import { usePermissions } from '../../hooks/usePermissions';
import UserProfile from '../user/UserProfile';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const { canAccessRoute, isAdmin } = usePermissions();
  const [relatoriosExpanded, setRelatoriosExpanded] = useState(false);
  const [cadastrosExpanded, setCadastrosExpanded] = useState(false);
  const [cadastrosTarefasExpanded, setCadastrosTarefasExpanded] = useState(false);
  const [cadastrosClientesExpanded, setCadastrosClientesExpanded] = useState(false);
  const [configuracoesExpanded, setConfiguracoesExpanded] = useState(false);
  const [baseConhecimentoExpanded, setBaseConhecimentoExpanded] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    // Verificar se está no cliente (browser) antes de acessar window
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 600;
    }
    return false;
  });
  const [isOpening, setIsOpening] = useState(false); // Flag para evitar fechar imediatamente após abrir
  const [showOverlay, setShowOverlay] = useState(false); // Controlar quando mostrar overlay
  const touchStartTime = useRef(0); // Para detectar se foi toque ou clique

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isRelatoriosActive = () => {
    return isActive('/relatorios-clientes') || isActive('/relatorios-colaboradores') || isActive('/planilha-horas') || isActive('/relatorio-tempo') || isActive('/relatorios/vigencias');
  };

  const isCadastrosActive = () => {
    return isActive('/cadastro/clientes') ||
      isActive('/cadastro/contato-cliente') ||
      isActive('/cadastro/colaboradores') ||
      isActive('/cadastro/produtos') || location.pathname.startsWith('/cadastro/produto') ||
      isActive('/cadastro/tipo-tarefas') || location.pathname.startsWith('/cadastro/tipo-tarefa') ||
      isActive('/cadastro/tarefas') || location.pathname.startsWith('/cadastro/tarefa') ||
      isActive('/cadastro/subtarefas') || location.pathname.startsWith('/cadastro/subtarefa') ||
      isActive('/cadastro/bancos') ||
      isActive('/cadastro/banco') ||
      isActive('/cadastro/adquirentes') ||
      isActive('/cadastro/sistemas') || location.pathname.startsWith('/cadastro/sistema');
  };

  const isConfiguracoesActive = () => {
    return isActive('/cadastro/custo-colaborador') ||
      isActive('/cadastro/vinculacoes') ||
      isActive('/documentacao-api') ||
      isActive('/gestao/usuarios');
  };

  const isBaseConhecimentoActive = () => {
    return isActive('/base-conhecimento/conteudos-clientes') ||
      location.pathname.startsWith('/base-conhecimento/cliente/');
  };

  // Expandir automaticamente o menu Relatórios se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isRelatoriosActive = location.pathname === '/relatorios-clientes' || location.pathname === '/relatorios-colaboradores' || location.pathname === '/planilha-horas' || location.pathname === '/relatorio-tempo' || location.pathname === '/relatorios/vigencias';
    if (isRelatoriosActive) {
      setRelatoriosExpanded(true);
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Cadastros se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isCadastrosActive = location.pathname === '/cadastro/clientes' ||
      location.pathname === '/cadastro/contato-cliente' ||
      location.pathname === '/cadastro/colaboradores' ||
      (location.pathname === '/cadastro/produtos' || location.pathname.startsWith('/cadastro/produto')) ||
      (location.pathname === '/cadastro/tipo-tarefas' || location.pathname.startsWith('/cadastro/tipo-tarefa')) ||
      (location.pathname === '/cadastro/tarefas' || location.pathname.startsWith('/cadastro/tarefa')) ||
      (location.pathname === '/cadastro/subtarefas' || location.pathname.startsWith('/cadastro/subtarefa')) ||
      location.pathname === '/cadastro/bancos' ||
      location.pathname === '/cadastro/banco' ||
      (location.pathname === '/cadastro/adquirentes' || location.pathname.startsWith('/cadastro/adquirente')) ||
      (location.pathname === '/cadastro/sistemas' || location.pathname.startsWith('/cadastro/sistema'));
    if (isCadastrosActive) {
      setCadastrosExpanded(true);
      // Se for uma página de tarefas, expandir também o submenu Tarefas
      const isTarefasPage = (location.pathname === '/cadastro/tipo-tarefas' || location.pathname.startsWith('/cadastro/tipo-tarefa')) ||
        (location.pathname === '/cadastro/tarefas' || location.pathname.startsWith('/cadastro/tarefa')) ||
        (location.pathname === '/cadastro/subtarefas' || location.pathname.startsWith('/cadastro/subtarefa'));
      if (isTarefasPage) {
        setCadastrosTarefasExpanded(true);
      }
      // Se for uma página de clientes, expandir também o submenu Clientes
      const isClientesPage = location.pathname === '/cadastro/clientes' || location.pathname === '/cadastro/contato-cliente';
      if (isClientesPage) {
        setCadastrosClientesExpanded(true);
      }
    }
  }, [location.pathname]);

  // Expandir automaticamente o menu Configurações se estiver em uma das páginas relacionadas
  useEffect(() => {
    const isConfiguracoesActive = location.pathname === '/cadastro/custo-colaborador' ||
      location.pathname === '/cadastro/vinculacoes' ||
      location.pathname === '/documentacao-api' ||
      location.pathname === '/gestao/usuarios';
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

  // Detectar mudanças no tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 600;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    // Verificar na montagem
    handleResize();

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize); // Para mudanças de orientação

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Guardar pathname anterior para detectar mudanças reais
  const prevPathname = useRef(location.pathname);
  const menuOpenTime = useRef(0);

  // Fechar menu mobile ao clicar em um link (apenas quando a rota realmente mudar)
  useEffect(() => {
    // Ignorar se for a primeira renderização (pathname ainda não mudou)
    if (prevPathname.current === location.pathname) {
      return;
    }

    // Se o menu acabou de abrir (menos de 800ms), não fechar ainda
    const timeSinceOpen = Date.now() - menuOpenTime.current;
    if (timeSinceOpen < 800) {
      prevPathname.current = location.pathname;
      return;
    }

    // Só fechar se a rota realmente mudou E o menu está aberto E estamos no mobile
    if (isMobile && isMobileMenuOpen) {
      prevPathname.current = location.pathname;
      // Pequeno delay para garantir que não feche imediatamente após abrir
      const timer = setTimeout(() => {
        setShowOverlay(false);
        setIsMobileMenuOpen(false);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Atualizar referência mesmo se não fechar o menu
      prevPathname.current = location.pathname;
    }
  }, [location.pathname, isMobile, isMobileMenuOpen]);

  const toggleRelatorios = (e) => {
    e.preventDefault();
    setRelatoriosExpanded(!relatoriosExpanded);
  };

  const toggleCadastros = (e) => {
    e.preventDefault();
    setCadastrosExpanded(!cadastrosExpanded);
  };

  const toggleCadastrosTarefas = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCadastrosTarefasExpanded(!cadastrosTarefasExpanded);
  };

  const toggleCadastrosClientes = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCadastrosClientesExpanded(!cadastrosClientesExpanded);
  };

  const toggleConfiguracoes = (e) => {
    e.preventDefault();
    setConfiguracoesExpanded(!configuracoesExpanded);
  };

  const toggleBaseConhecimento = (e) => {
    e.preventDefault();
    setBaseConhecimentoExpanded(!baseConhecimentoExpanded);
  };

  // Filtrar itens do menu baseado em permissões
  const menuItems = useMemo(() => {
    const allItems = [
      {
        path: '/painel-colaborador',
        icon: 'fa-clipboard-list',
        label: 'Minhas Tarefas',
        title: 'Minhas Tarefas'
      },
      {
        path: '/gestao-capacidade',
        icon: 'fa-user-check',
        label: 'Gestão de Capacidade',
        title: 'Gestão de Capacidade'
      }
    ];
    return allItems.filter(item => canAccessRoute(item.path));
  }, [canAccessRoute]);

  const relatoriosSubItems = useMemo(() => {
    const allItems = [
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
      },
      {
        path: '/planilha-horas',
        icon: 'fa-calendar-alt',
        label: 'Planilha de Horas',
        title: 'Planilha de Horas'
      },
      {
        path: '/relatorio-tempo',
        icon: 'fa-chart-pie',
        label: 'Relatório de Tempo',
        title: 'Relatório de Tempo'
      },
      {
        path: '/relatorios/vigencias',
        icon: 'fa-calendar-check',
        label: 'Relatório de Vigências',
        title: 'Relatório de Vigências'
      }
    ];
    return allItems.filter(item => canAccessRoute(item.path));
  }, [canAccessRoute]);

  const cadastrosSubItems = useMemo(() => {
    const allItems = [
      {
        label: 'Clientes',
        icon: 'fa-briefcase',
        title: 'Clientes',
        subItems: [
          {
            path: '/cadastro/clientes',
            icon: 'fa-building',
            label: 'Empresas',
            title: 'Cadastro de Empresas'
          },
          {
            path: '/cadastro/contato-cliente',
            icon: 'fa-address-book',
            label: 'Contatos',
            title: 'Contatos dos Clientes'
          }
        ]
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
        label: 'Tarefas',
        icon: 'fa-tasks',
        title: 'Tarefas',
        subItems: [
          {
            path: '/cadastro/tipo-tarefas',
            icon: 'fa-list-alt',
            label: 'Tipo de Tarefas',
            title: 'Cadastro de Tipo de Tarefas'
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
          }
        ]
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
    // Filtrar itens: se tiver path, verificar permissão; se tiver subItems, filtrar subItems e manter se houver algum acessível
    return allItems.map(item => {
      if (item.subItems) {
        // Filtrar subItems por permissão
        const filteredSubItems = item.subItems.filter(subItem => canAccessRoute(subItem.path));
        // Retornar item apenas se houver subItems acessíveis
        if (filteredSubItems.length > 0) {
          return { ...item, subItems: filteredSubItems };
        }
        return null; // Item será filtrado depois
      }
      return item;
    }).filter(item => {
      // Filtrar itens: se tiver path, verificar permissão; se for null (subItems vazio), remover
      if (!item) return false;
      if (item.path) {
        return canAccessRoute(item.path);
      }
      return true; // Item com subItems já foi filtrado acima
    });
  }, [canAccessRoute]);

  const configuracoesSubItems = useMemo(() => {
    const allItems = [
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
      },
      // Só mostrar gestão de usuários para administradores
      ...(isAdmin ? [
        {
          path: '/gestao/usuarios',
          icon: 'fa-users-cog',
          label: 'Gestão de Usuários',
          title: 'Gestão de Usuários'
        }
      ] : [])
    ];
    return allItems.filter(item => canAccessRoute(item.path));
  }, [canAccessRoute]);

  const baseConhecimentoSubItems = useMemo(() => {
    const allItems = [
      {
        path: '/base-conhecimento/conteudos-clientes',
        icon: 'fa-briefcase',
        label: 'Conteúdos Clientes',
        title: 'Conteúdos Clientes'
      }
    ];
    return allItems.filter(item => canAccessRoute(item.path));
  }, [canAccessRoute]);

  return (
    <>
      {/* Botão hambúrguer para mobile - sempre renderizado, visível apenas no mobile via CSS */}
      <button
        className="mobile-menu-toggle"
        onTouchStart={(e) => {
          // Marcar início do toque
          touchStartTime.current = Date.now();
        }}
        onTouchEnd={(e) => {
          // Se foi um toque rápido (menos de 300ms), tratar como toque
          const touchDuration = Date.now() - touchStartTime.current;
          if (touchDuration < 300) {
            e.preventDefault();
            e.stopPropagation();
            const newState = !isMobileMenuOpen;
            if (newState) {
              setIsOpening(true);
              setIsMobileMenuOpen(newState);
              menuOpenTime.current = Date.now(); // Registrar hora de abertura
              // Mostrar overlay após um pequeno delay para não interferir na abertura
              setTimeout(() => {
                setShowOverlay(true);
                setTimeout(() => {
                  setIsOpening(false);
                }, 200);
              }, 150);
            } else {
              setShowOverlay(false);
              setIsMobileMenuOpen(newState);
              menuOpenTime.current = 0;
            }
          }
        }}
        onClick={(e) => {
          // Só processar clique se não foi um toque (mouse/desktop)
          const timeSinceTouch = Date.now() - touchStartTime.current;
          if (timeSinceTouch > 300) {
            e.preventDefault();
            e.stopPropagation();
            const newState = !isMobileMenuOpen;
            if (newState) {
              setIsOpening(true);
              setIsMobileMenuOpen(newState);
              menuOpenTime.current = Date.now(); // Registrar hora de abertura
              // Mostrar overlay após um pequeno delay
              setTimeout(() => {
                setShowOverlay(true);
                setTimeout(() => {
                  setIsOpening(false);
                }, 200);
              }, 100);
            } else {
              setShowOverlay(false);
              setIsMobileMenuOpen(newState);
              menuOpenTime.current = 0;
            }
          } else {
            // Se foi toque, prevenir o clique
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isMobileMenuOpen}
        type="button"
      >
        <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* Overlay para fechar menu no mobile - só mostrar após delay */}
      {isMobileMenuOpen && showOverlay && (
        <div
          className="sidebar-overlay"
          onTouchEnd={(e) => {
            // Só fechar se tocar diretamente no overlay e não estiver abrindo
            if (e.target === e.currentTarget && !isOpening) {
              e.preventDefault();
              e.stopPropagation();
              setShowOverlay(false);
              setIsMobileMenuOpen(false);
            }
          }}
          onClick={(e) => {
            // Só fechar se clicar diretamente no overlay e não estiver abrindo
            if (e.target === e.currentTarget && !isOpening) {
              e.preventDefault();
              e.stopPropagation();
              setShowOverlay(false);
              setIsMobileMenuOpen(false);
            }
          }}
        ></div>
      )}

      <nav
        className={`sidebar ${isMobile ? (isMobileMenuOpen ? 'mobile-open' : 'mobile-closed') : ''}`}
        id="sidebar"
        onClick={(e) => {
          // Prevenir que cliques no sidebar propaguem para o overlay
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          // Prevenir que toques no sidebar propaguem para o overlay
          e.stopPropagation();
        }}
        style={{
          // Garantir que o sidebar tenha pointer-events quando aberto
          pointerEvents: isMobile && isMobileMenuOpen ? 'auto' : 'auto'
        }}
      >
        <div className="sidebar-content">
          <div className="sidebar-menu-wrapper">
            {/* Perfil de usuário integrado como item da sidebar */}
            <div className="sidebar-user-item">
              <UserProfile />
            </div>

            {/* Separador sutil */}
            <div className="sidebar-divider"></div>
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

            {/* Menu Relatórios com Submenu - Só exibir se houver itens */}
            {relatoriosSubItems.length > 0 && (
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
            )}

            {/* Menu Cadastros com Submenu - Só exibir se houver itens */}
            {cadastrosSubItems.length > 0 && (
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
                  {cadastrosSubItems.map((subItem) => {
                    // Se o item tiver subItems, renderizar como um submenu aninhado
                    if (subItem.subItems) {
                      // Determinar qual toggle usar baseado no label
                      const isTarefas = subItem.label === 'Tarefas';
                      const isClientes = subItem.label === 'Clientes';
                      const isExpanded = isTarefas ? cadastrosTarefasExpanded : (isClientes ? cadastrosClientesExpanded : false);
                      const toggleFunction = isTarefas ? toggleCadastrosTarefas : (isClientes ? toggleCadastrosClientes : null);

                      return (
                        <div key={subItem.label} className="sidebar-nested-menu-group">
                          <button
                            type="button"
                            className={`sidebar-item sidebar-submenu-item sidebar-nested-toggle ${isExpanded ? 'expanded' : ''}`}
                            title={subItem.title}
                            onClick={toggleFunction}
                            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                          >
                            <i className={`fas ${subItem.icon}`}></i>
                            <span className="sidebar-text">{subItem.label}</span>
                            <i className={`fas fa-chevron-right sidebar-chevron ${isExpanded ? 'expanded' : ''}`}></i>
                          </button>
                          <div className={`sidebar-nested-submenu ${isExpanded ? 'open' : ''}`}>
                            {subItem.subItems.map((nestedItem) => (
                              <Link
                                key={nestedItem.path}
                                to={nestedItem.path}
                                className={`sidebar-item sidebar-submenu-item sidebar-nested-item ${isActive(nestedItem.path) ? 'active' : ''}`}
                                title={nestedItem.title}
                              >
                                <i className={`fas ${nestedItem.icon}`}></i>
                                <span className="sidebar-text">{nestedItem.label}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    // Item normal sem submenu
                    return (
                      <Link
                        key={subItem.path}
                        to={subItem.path}
                        className={`sidebar-item sidebar-submenu-item ${isActive(subItem.path) ? 'active' : ''}`}
                        title={subItem.title}
                      >
                        <i className={`fas ${subItem.icon}`}></i>
                        <span className="sidebar-text">{subItem.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Menu Base de Conhecimento com Submenu - Só exibir se houver itens */}
            {baseConhecimentoSubItems.length > 0 && (
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
            )}

            {/* Menu Configurações com Submenu - Só exibir se houver itens */}
            {configuracoesSubItems.length > 0 && (
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
            )}
          </div>

          {/* Rodapé do Menu */}
          <div className="sidebar-footer">
            <div className="sidebar-footer-content">
              {/* Versão e Copyright */}
              <div className="sidebar-footer-meta">
                <div className="sidebar-footer-version-info">
                  <i className="fas fa-code-branch"></i>
                  <span className="marca-dagua-texto">v1.0.5</span>
                </div>
                <div className="sidebar-footer-copyright">
                  <span>2025 UP Gestão Inteligente</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;

