import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import LoadingState from '../../components/common/LoadingState';
import { useToast } from '../../hooks/useToast';
import { clearPermissoesConfigCache } from '../../utils/permissions';
import './ConfigPermissoes.css';
import { NOTIFICATION_TYPES, NOTIFICATION_DESCRIPTIONS } from '../../constants/notificationTypes';

const API_BASE_URL = '/api';

// Mapeamento de páginas principais e suas subpáginas relacionadas
// Mapeamento de páginas principais e suas subpáginas relacionadas
const PAGINAS_PRINCIPAIS_COM_SUBPAGINAS = {
  '/cadastro/clientes': ['/cadastro/cliente', '/cadastro/contato-cliente'],
  '/cadastro/produtos': ['/cadastro/produto'],
  '/cadastro/tarefas': ['/cadastro/tarefa'],
  '/cadastro/subtarefas': ['/cadastro/subtarefa'],
  '/cadastro/tipo-tarefas': ['/cadastro/tipo-tarefa'],
  '/cadastro/bancos': ['/cadastro/banco'],
  '/cadastro/adquirentes': ['/cadastro/adquirente'],
  '/cadastro/sistemas': ['/cadastro/sistema'],
  '/cadastro/vinculacoes': ['/cadastro/vinculacao', '/vinculacoes/nova'],
  '/atribuir-responsaveis': [
    '/atribuicao/cliente',
    '/atribuicao/nova',
    '/atribuir-responsaveis/historico',
    '/aprovacoes-pendentes',
    '/atribuicoes/pendentes/aprovacao'
  ],
  '/base-conhecimento': [
    '/base-conhecimento/conteudos-clientes',
    '/base-conhecimento/cliente'
  ],
  // Adicionando página de edição de cliente explicitamente para UI
  '/cadastro/cliente': ['/cadastro/cliente'],
};

// Mapeamento de ícones para cada categoria
const ICONES_CATEGORIAS = {
  'Painéis': 'fa-clipboard-list',
  'Relatórios': 'fa-file-alt',
  'Cadastros': 'fa-database',
  'Atribuições': 'fa-user-check',
  'Base de Conhecimento': 'fa-book',
  'Configurações': 'fa-cog'
};

// Lista de todas as páginas principais disponíveis no sistema
const TODAS_PAGINAS = [
  // Painéis
  { path: '/painel-colaborador', label: 'Minhas Tarefas', categoria: 'Painéis' },
  { path: '/notificacoes', label: 'Notificações', categoria: 'Painéis' },

  // Relatórios
  { path: '/relatorios-clientes', label: 'Relatórios de Clientes', categoria: 'Relatórios' },
  { path: '/relatorios-colaboradores', label: 'Relatórios de Colaboradores', categoria: 'Relatórios' },
  { path: '/planilha-horas', label: 'Planilha de Horas', categoria: 'Relatórios' },

  // Cadastros
  { path: '/cadastro/clientes', label: 'Clientes', categoria: 'Cadastros' },
  { path: '/cadastro/produtos', label: 'Produtos', categoria: 'Cadastros' },
  { path: '/cadastro/tarefas', label: 'Tarefas', categoria: 'Cadastros' },
  { path: '/cadastro/subtarefas', label: 'Subtarefas', categoria: 'Cadastros' },
  { path: '/cadastro/tipo-tarefas', label: 'Tipos de Tarefa', categoria: 'Cadastros' },
  { path: '/cadastro/bancos', label: 'Bancos', categoria: 'Cadastros' },
  { path: '/cadastro/adquirentes', label: 'Adquirentes', categoria: 'Cadastros' },
  { path: '/cadastro/sistemas', label: 'Sistemas', categoria: 'Cadastros' },
  { path: '/cadastro/vinculacoes', label: 'Vinculações', categoria: 'Cadastros' },

  // Atribuições
  { path: '/atribuir-responsaveis', label: 'Gestão de Capacidade', categoria: 'Atribuições' },
  { path: '/atribuir-responsaveis/historico', label: 'Histórico de Atribuições', categoria: 'Atribuições' },
  { path: '/aprovacoes-pendentes', label: 'Aprovações Pendentes', categoria: 'Atribuições' },

  // Base de Conhecimento
  { path: '/base-conhecimento', label: 'Início', categoria: 'Base de Conhecimento' },
  { path: '/base-conhecimento/conteudos-clientes', label: 'Conteúdos Clientes', categoria: 'Base de Conhecimento' },
  // Adicionando explicitamente a página de edição (que redireciona para cadastro, mas é acessada via base conhecimento)
  { path: '/cadastro/cliente', label: 'Edição de Cliente (Base Conhecimento)', categoria: 'Base de Conhecimento' },

  // Configurações
  { path: '/cadastro/colaboradores', label: 'Colaboradores', categoria: 'Configurações' },
  { path: '/cadastro/custo-colaborador', label: 'Custo Colaborador', categoria: 'Configurações' },
  { path: '/gestao/usuarios', label: 'Gestão de Usuários', categoria: 'Configurações' },
  { path: '/gestao/permissoes', label: 'Permissões', categoria: 'Configurações' },
  { path: '/configuracoes/perfil', label: 'Perfil', categoria: 'Configurações' },
  { path: '/documentacao-api', label: 'Documentação API', categoria: 'Configurações' },
];

const ConfigPermissoes = () => {
  const showToast = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [nivelSelecionado, setNivelSelecionado] = useState('gestor');
  const [categoriasExpandidas, setCategoriasExpandidas] = useState({});
  const [configs, setConfigs] = useState({
    administrador: { paginas: null },
    gestor: { paginas: null },
    colaborador: { paginas: [] }
  });
  const [isModalNovoNivelOpen, setIsModalNovoNivelOpen] = useState(false);
  const [novoNivelNome, setNovoNivelNome] = useState('');
  const [criandoNivel, setCriandoNivel] = useState(false);
  const [activeTab, setActiveTab] = useState('paginas'); // 'paginas' ou 'notificacoes'

  // Obter subpáginas de uma página principal
  const getSubpaginas = (paginaPrincipal) => {
    return PAGINAS_PRINCIPAIS_COM_SUBPAGINAS[paginaPrincipal.path] || [];
  };

  // Normalizar páginas: se uma subpágina estiver selecionada, garantir que a página principal também esteja
  const normalizarPaginas = (paginas) => {
    if (!paginas || paginas === null) return null;

    const paginasNormalizadas = [...paginas];

    // Para cada página principal, verificar se alguma de suas subpáginas está selecionada
    Object.entries(PAGINAS_PRINCIPAIS_COM_SUBPAGINAS).forEach(([paginaPrincipal, subpaginas]) => {
      const temSubpaginaSelecionada = subpaginas.some(sub => paginas.includes(sub));
      if (temSubpaginaSelecionada && !paginasNormalizadas.includes(paginaPrincipal)) {
        paginasNormalizadas.push(paginaPrincipal);
      }
    });

    return paginasNormalizadas;
  };

  // Carregar configurações
  const loadConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/permissoes-config`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        const configsData = {};
        result.data.forEach(item => {
          // Normalizar páginas
          let paginasNormalizadas = null;
          if (item.paginas !== null) {
            paginasNormalizadas = normalizarPaginas(Array.isArray(item.paginas) ? item.paginas : []);
          }

          // Normalizar notificações
          let notificacoes = [];
          if (item.notificacoes) {
            notificacoes = Array.isArray(item.notificacoes) ? item.notificacoes : [];
          }

          configsData[item.nivel] = {
            paginas: paginasNormalizadas,
            notificacoes: notificacoes
          };
        });

        // Se não houver configuração, usar padrões
        if (!configsData.administrador) {
          configsData.administrador = { paginas: null, notificacoes: [] };
        }
        if (!configsData.gestor) {
          configsData.gestor = { paginas: null, notificacoes: [] };
        }
        if (!configsData.colaborador) {
          configsData.colaborador = {
            paginas: [
              '/painel-colaborador',
              '/notificacoes',
              '/base-conhecimento',
              '/base-conhecimento/conteudos-clientes',
              '/configuracoes/perfil'
            ],
            notificacoes: [NOTIFICATION_TYPES.PLUG_RAPIDO]
          };
        }

        setConfigs(configsData);
      } else {
        throw new Error(result.error || 'Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      showToast('error', error.message || 'Erro ao carregar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Criar novo nível
  const handleCriarNovoNivel = async () => {
    if (!novoNivelNome.trim()) {
      showToast('error', 'O nome do nível é obrigatório');
      return;
    }

    const nomeNormalizado = novoNivelNome.toLowerCase().trim();
    if (configs[nomeNormalizado] || nomeNormalizado === 'administrador') {
      showToast('error', 'Este nível já existe');
      return;
    }

    setCriandoNivel(true);
    try {
      // Salvar o novo nível inicialmente com nenhuma página selecionada
      // Usamos a mesma API de update, pois o backend cria se não existir
      const response = await fetch(`${API_BASE_URL}/permissoes-config/${nomeNormalizado}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ paginas: [] }),
      });

      const result = await response.json();

      if (result.success) {
        showToast('success', `Nível "${novoNivelNome}" criado com sucesso!`);

        // Atualizar estado local
        setConfigs(prev => ({
          ...prev,
          [nomeNormalizado]: { paginas: [] }
        }));

        // Selecionar o novo nível
        setNivelSelecionado(nomeNormalizado);

        // Fechar modal e limpar
        setIsModalNovoNivelOpen(false);
        setNovoNivelNome('');

        // Recarregar configs para garantir sincronização
        await loadConfigs();
      } else {
        throw new Error(result.error || 'Erro ao criar nível');
      }
    } catch (error) {
      console.error('Erro ao criar nível:', error);
      showToast('error', error.message || 'Erro ao criar nível. Tente novamente.');
    } finally {
      setCriandoNivel(false);
    }
  };

  // Salvar configurações
  const handleSave = async () => {
    if (nivelSelecionado === 'administrador') return; // Administrador não precisa salvar

    setSalvando(true);
    try {
      const config = configs[nivelSelecionado];
      // Preparar notificações
      const notificacoes = config.notificacoes || [];
      // Se todas as páginas estão selecionadas (incluindo subpáginas), enviar null (acesso total)
      const todasPaginas = TODAS_PAGINAS.map(p => p.path);
      const todasSubpaginas = [];
      TODAS_PAGINAS.forEach(p => {
        const subpaginas = getSubpaginas(p);
        todasSubpaginas.push(...subpaginas);
      });
      const todasPaginasCompletas = [...todasPaginas, ...todasSubpaginas];
      const todasSelecionadas = config.paginas !== null &&
        config.paginas.length === todasPaginasCompletas.length &&
        todasPaginasCompletas.every(p => config.paginas.includes(p));
      const paginas = todasSelecionadas ? null : config.paginas;

      const response = await fetch(`${API_BASE_URL}/permissoes-config/${nivelSelecionado}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ paginas, notificacoes }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', `Permissões do ${nivelSelecionado === 'gestor' ? 'Gestor' : 'Colaborador'} atualizadas com sucesso!`);
        // Limpar cache para forçar recarregamento
        clearPermissoesConfigCache();
        await loadConfigs(); // Recarregar para garantir sincronização
      } else {
        throw new Error(result.error || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      showToast('error', error.message || 'Erro ao salvar configurações. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  // Toggle página principal (inclui automaticamente suas subpáginas)
  const handleTogglePagina = (paginaPrincipal) => {
    setConfigs(prev => {
      const config = prev[nivelSelecionado];
      const subpaginas = getSubpaginas(paginaPrincipal);
      const todasPaginasDaPrincipal = [paginaPrincipal.path, ...subpaginas];

      // Se paginas é null, significa que tem acesso a todas
      if (config.paginas === null) {
        // Ao desmarcar uma página quando tem acesso total, criar lista com todas exceto essa e suas subpáginas
        const todasPaginas = TODAS_PAGINAS.map(p => p.path);
        const todasSubpaginas = [];
        TODAS_PAGINAS.forEach(p => {
          const subpaginas = getSubpaginas(p);
          todasSubpaginas.push(...subpaginas);
        });
        const todasPaginasCompletas = [...todasPaginas, ...todasSubpaginas];
        const novasPaginas = todasPaginasCompletas.filter(p => !todasPaginasDaPrincipal.includes(p));
        return {
          ...prev,
          [nivelSelecionado]: {
            paginas: novasPaginas
          }
        };
      }

      const paginas = config.paginas || [];
      const todasSelecionadas = todasPaginasDaPrincipal.every(p => paginas.includes(p));

      let novasPaginas;
      if (todasSelecionadas) {
        // Desmarcar página principal e todas suas subpáginas
        novasPaginas = paginas.filter(p => !todasPaginasDaPrincipal.includes(p));
      } else {
        // Marcar página principal e todas suas subpáginas
        novasPaginas = [...new Set([...paginas, ...todasPaginasDaPrincipal])];
      }

      return {
        ...prev,
        [nivelSelecionado]: {
          paginas: novasPaginas
        }
      };
    });
  };

  // Selecionar todas as páginas de uma categoria (incluindo subpáginas)
  const handleSelectCategoria = (categoria) => {
    setConfigs(prev => {
      const config = prev[nivelSelecionado];

      const paginasPrincipaisCategoria = TODAS_PAGINAS.filter(p => p.categoria === categoria);

      // Coletar todas as páginas (principais + subpáginas) da categoria
      const todasPaginasCategoria = [];
      paginasPrincipaisCategoria.forEach(pagina => {
        todasPaginasCategoria.push(pagina.path);
        const subpaginas = getSubpaginas(pagina);
        todasPaginasCategoria.push(...subpaginas);
      });

      // Se paginas é null, significa que tem acesso a todas
      if (config.paginas === null) {
        // Ao desmarcar uma categoria quando tem acesso total, criar lista com todas exceto essa categoria
        const todasPaginas = TODAS_PAGINAS.map(p => p.path);
        const todasSubpaginas = [];
        TODAS_PAGINAS.forEach(p => {
          const subpaginas = getSubpaginas(p);
          todasSubpaginas.push(...subpaginas);
        });
        const todasPaginasCompletas = [...todasPaginas, ...todasSubpaginas];
        const novasPaginas = todasPaginasCompletas.filter(p => !todasPaginasCategoria.includes(p));
        return {
          ...prev,
          [nivelSelecionado]: {
            paginas: novasPaginas
          }
        };
      }

      const paginasAtuais = config.paginas || [];
      const todasSelecionadas = todasPaginasCategoria.every(p => paginasAtuais.includes(p));

      let novasPaginas;
      if (todasSelecionadas) {
        // Desmarcar todas da categoria (principais + subpáginas)
        novasPaginas = paginasAtuais.filter(p => !todasPaginasCategoria.includes(p));
      } else {
        // Marcar todas da categoria (principais + subpáginas)
        novasPaginas = [...new Set([...paginasAtuais, ...todasPaginasCategoria])];
      }

      return {
        ...prev,
        [nivelSelecionado]: {
          paginas: novasPaginas
        }
      };
    });
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  // Agrupar páginas por categoria
  const paginasPorCategoria = TODAS_PAGINAS.reduce((acc, pagina) => {
    if (!acc[pagina.categoria]) {
      acc[pagina.categoria] = [];
    }
    acc[pagina.categoria].push(pagina);
    return acc;
  }, {});

  // Verificar se uma página principal está selecionada (incluindo suas subpáginas)
  const isPaginaPrincipalSelecionada = (paginaPrincipal, paginasSelecionadas) => {
    const subpaginas = getSubpaginas(paginaPrincipal);
    const todasPaginas = [paginaPrincipal.path, ...subpaginas];
    return todasPaginas.some(p => paginasSelecionadas.includes(p));
  };

  // Toggle expandir/colapsar categoria
  const toggleCategoria = (categoria) => {
    setCategoriasExpandidas(prev => ({
      ...prev,
      [categoria]: !prev[categoria]
    }));
  };

  // Toggle Notificação
  const handleToggleNotificacao = (tipo) => {
    setConfigs(prev => {
      const config = prev[nivelSelecionado];
      const current = config.notificacoes || [];
      let newNotifs;
      if (current.includes(tipo)) {
        newNotifs = current.filter(t => t !== tipo);
      } else {
        newNotifs = [...current, tipo];
      }
      return {
        ...prev,
        [nivelSelecionado]: {
          ...config,
          notificacoes: newNotifs
        }
      };
    });
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="config-permissoes-section">
              <div className="form-header">
                <div>
                  <h2 className="form-title">
                    <i className="fas fa-shield-alt" style={{ color: '#0e3b6f' }}></i>
                    Configuração de Permissões
                  </h2>
                  <p className="form-subtitle">
                    Selecione as páginas que cada nível de permissão pode acessar
                  </p>
                </div>
                <button
                  className="btn-secondary config-permissoes-back-btn"
                  onClick={() => navigate('/gestao/usuarios')}
                >
                  <i className="fas fa-arrow-left"></i>
                  Voltar
                </button>
              </div>

              {loading ? (
                <LoadingState message="Carregando configurações..." />
              ) : (
                <div className="permissoes-config-container">
                  {/* Select para escolher o nível */}
                  <div className="nivel-select-container">
                    <label className="nivel-select-label">
                      <i className="fas fa-shield-alt" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
                      Nível de Permissão
                    </label>
                    <div className="nivel-select-wrapper">
                      <select
                        value={nivelSelecionado}
                        onChange={(e) => setNivelSelecionado(e.target.value)}
                        className="nivel-select"
                        disabled={salvando}
                      >
                        {Object.keys(configs).map(nivel => (
                          <option key={nivel} value={nivel}>
                            {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn-add-nivel"
                        onClick={() => setIsModalNovoNivelOpen(true)}
                        disabled={salvando}
                        title="Criar novo nível de permissão"
                      >
                        <i className="fas fa-plus"></i>
                      </button>
                    </div>
                  </div>

                  {/* Abas de Configuração */}
                  <div className="config-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                    <button
                      onClick={() => setActiveTab('paginas')}
                      style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: activeTab === 'paginas' ? '#0e3b6f' : 'transparent',
                        color: activeTab === 'paginas' ? 'white' : '#666',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'paginas' ? 'bold' : 'normal'
                      }}
                    >
                      <i className="fas fa-columns" style={{ marginRight: '5px' }}></i> Acesso a Páginas
                    </button>
                    <button
                      onClick={() => setActiveTab('notificacoes')}
                      style={{
                        padding: '8px 16px',
                        border: 'none',
                        background: activeTab === 'notificacoes' ? '#0e3b6f' : 'transparent',
                        color: activeTab === 'notificacoes' ? 'white' : '#666',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontWeight: activeTab === 'notificacoes' ? 'bold' : 'normal'
                      }}
                    >
                      <i className="fas fa-bell" style={{ marginRight: '5px' }}></i> Notificações
                    </button>
                  </div>

                  {/* Modal de Novo Nível */}
                  {isModalNovoNivelOpen && (
                    <div className="modal-novo-nivel-overlay">
                      <div className="modal-novo-nivel-content">
                        <div className="modal-novo-nivel-header">
                          <h3>Novo Nível de Permissão</h3>
                          <button
                            className="btn-icon"
                            onClick={() => {
                              setIsModalNovoNivelOpen(false);
                              setNovoNivelNome('');
                            }}
                            disabled={criandoNivel}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <div className="modal-novo-nivel-body">
                          <label htmlFor="novo-nivel-nome">Nome da Categoria Customizada</label>
                          <input
                            id="novo-nivel-nome"
                            type="text"
                            className="modal-novo-nivel-input"
                            placeholder="Ex: Supervisor, Financeiro, etc..."
                            value={novoNivelNome}
                            onChange={(e) => setNovoNivelNome(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleCriarNovoNivel()}
                            disabled={criandoNivel}
                            autoFocus
                          />
                        </div>
                        <div className="modal-novo-nivel-footer">
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setIsModalNovoNivelOpen(false);
                              setNovoNivelNome('');
                            }}
                            disabled={criandoNivel}
                          >
                            Cancelar
                          </button>
                          <button
                            className="btn-primary"
                            onClick={handleCriarNovoNivel}
                            disabled={criandoNivel || !novoNivelNome.trim()}
                          >
                            {criandoNivel ? 'Criando...' : 'Criar Categoria'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lista de páginas */}
                  {activeTab === 'paginas' && (
                    <div className="paginas-list">
                      {Object.entries(paginasPorCategoria).map(([categoria, paginas]) => {
                        const config = configs[nivelSelecionado];
                        // Se paginas é null ou é administrador, significa acesso total
                        const todasPaginas = TODAS_PAGINAS.map(p => p.path);
                        const todasSubpaginas = [];
                        TODAS_PAGINAS.forEach(p => {
                          const subpaginas = getSubpaginas(p);
                          todasSubpaginas.push(...subpaginas);
                        });
                        const todasPaginasCompletas = [...todasPaginas, ...todasSubpaginas];
                        const paginasSelecionadas = (config.paginas === null || nivelSelecionado === 'administrador')
                          ? todasPaginasCompletas
                          : (config.paginas || []);

                        // Verificar se todas as páginas da categoria estão selecionadas (incluindo subpáginas)
                        const todasPaginasCategoria = [];
                        paginas.forEach(pagina => {
                          todasPaginasCategoria.push(pagina.path);
                          const subpaginas = getSubpaginas(pagina);
                          todasPaginasCategoria.push(...subpaginas);
                        });
                        const todasSelecionadas = todasPaginasCategoria.every(p => paginasSelecionadas.includes(p));

                        // Verificar estado da checkbox da categoria (todas, nenhuma, ou algumas)
                        const algumasSelecionadas = todasPaginasCategoria.some(p => paginasSelecionadas.includes(p)) &&
                          !todasSelecionadas;
                        const checkboxIndeterminada = algumasSelecionadas;

                        // Por padrão, todas as categorias começam fechadas (colapsadas)
                        const isExpanded = categoriasExpandidas[categoria] === true;

                        return (
                          <div key={categoria} className="categoria-group">
                            <div
                              className="categoria-header"
                              onClick={() => toggleCategoria(categoria)}
                            >
                              <div className="categoria-checkbox-wrapper">
                                <input
                                  type="checkbox"
                                  checked={todasSelecionadas}
                                  ref={(el) => {
                                    if (el) el.indeterminate = checkboxIndeterminada;
                                  }}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleSelectCategoria(categoria);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={salvando || nivelSelecionado === 'administrador'}
                                  className="categoria-checkbox"
                                />
                                <i className={`fas ${ICONES_CATEGORIAS[categoria] || 'fa-circle'}`} style={{ marginRight: '8px', fontSize: '16px', color: '#0e3b6f' }}></i>
                                <h4>{categoria}</h4>
                              </div>
                              <button
                                type="button"
                                className="categoria-expand-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCategoria(categoria);
                                }}
                                aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                              >
                                <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`}></i>
                              </button>
                            </div>
                            {isExpanded && (
                              <div className="paginas-grid">
                                {paginas.map(pagina => {
                                  const isSelected = isPaginaPrincipalSelecionada(pagina, paginasSelecionadas);

                                  return (
                                    <label key={pagina.path} className={`pagina-checkbox ${isSelected ? 'selected' : ''}`}>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleTogglePagina(pagina)}
                                        disabled={salvando || nivelSelecionado === 'administrador'}
                                      />
                                      <span>{pagina.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'notificacoes' && (
                    <div className="notificacoes-list fade-in">
                      <div className="info-box" style={{ marginBottom: '20px' }}>
                        <i className="fas fa-info-circle"></i>
                        <div>Selecione quais tipos de notificações os usuários deste cargo devem receber.</div>
                        {nivelSelecionado === 'administrador' && <div style={{ marginTop: '5px' }}><strong>Nota:</strong> Administradores recebem todas as notificações.</div>}
                      </div>
                      <div className="notificacoes-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
                        {Object.values(NOTIFICATION_TYPES).map(tipo => {
                          const desc = NOTIFICATION_DESCRIPTIONS[tipo] || { label: tipo, description: '' };
                          const config = configs[nivelSelecionado];
                          const isChecked = nivelSelecionado === 'administrador' || (config.notificacoes && config.notificacoes.includes(tipo));

                          return (
                            <div key={tipo}
                              onClick={() => { if (nivelSelecionado !== 'administrador') handleToggleNotificacao(tipo); }}
                              style={{
                                border: isChecked ? '1px solid #0e3b6f' : '1px solid #ddd',
                                borderRadius: '8px',
                                padding: '15px',
                                cursor: nivelSelecionado !== 'administrador' ? 'pointer' : 'default',
                                backgroundColor: isChecked ? '#f0f7ff' : 'white',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '10px'
                              }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => { }}
                                disabled={nivelSelecionado === 'administrador'}
                                style={{ marginTop: '3px' }}
                              />
                              <div>
                                <strong style={{ display: 'block', color: '#333' }}>{desc.label}</strong>
                                <span style={{ fontSize: '13px', color: '#666' }}>{desc.description}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Botão de salvar */}
                  {nivelSelecionado !== 'administrador' && (
                    <div className="save-container">
                      <ButtonPrimary
                        onClick={handleSave}
                        disabled={salvando}
                      >
                        {salvando ? 'Salvando...' : 'Salvar Permissões'}
                      </ButtonPrimary>
                    </div>
                  )}

                  {nivelSelecionado === 'administrador' && (
                    <div className="info-box">
                      <i className="fas fa-info-circle"></i>
                      <div>
                        <strong>Nota:</strong> O nível <strong>Administrador</strong> sempre tem acesso total a todas as páginas do sistema.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContainer>
        </main>
      </div>
    </Layout>
  );
};

export default ConfigPermissoes;

