import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import LoadingState from '../../components/common/LoadingState';
import { useToast } from '../../hooks/useToast';
import { clearPermissoesConfigCache } from '../../utils/permissions';
import './ConfigPermissoes.css';

const API_BASE_URL = '/api';

// Mapeamento de páginas principais e suas subpáginas relacionadas
const PAGINAS_PRINCIPAIS_COM_SUBPAGINAS = {
  '/cadastro/clientes': ['/cadastro/cliente'],
  '/cadastro/produtos': ['/cadastro/produto'],
  '/cadastro/tarefas': ['/cadastro/tarefa'],
  '/cadastro/tipo-tarefas': ['/cadastro/tipo-tarefa'],
  '/cadastro/bancos': ['/cadastro/banco'],
  '/cadastro/adquirentes': ['/cadastro/adquirente'],
  '/cadastro/sistemas': ['/cadastro/sistema'],
  '/atribuir-responsaveis': ['/atribuicao/cliente', '/atribuicao/nova'],
  '/base-conhecimento/conteudos-clientes': ['/base-conhecimento/cliente'],
};

// Lista de todas as páginas principais disponíveis no sistema
const TODAS_PAGINAS = [
  // Painéis
  { path: '/painel', label: 'Painel Principal', categoria: 'Painéis' },
  { path: '/painel-colaborador', label: 'Minhas Tarefas', categoria: 'Painéis' },
  
  // Relatórios
  { path: '/relatorios-clientes', label: 'Relatórios de Clientes', categoria: 'Relatórios' },
  { path: '/relatorios-colaboradores', label: 'Relatórios de Colaboradores', categoria: 'Relatórios' },
  { path: '/planilha-horas', label: 'Planilha de Horas', categoria: 'Relatórios' },
  
  // Cadastros
  { path: '/cadastro/clientes', label: 'Cadastro de Clientes', categoria: 'Cadastros' },
  { path: '/cadastro/colaboradores', label: 'Cadastro de Colaboradores', categoria: 'Cadastros' },
  { path: '/cadastro/produtos', label: 'Cadastro de Produtos', categoria: 'Cadastros' },
  { path: '/cadastro/tarefas', label: 'Cadastro de Tarefas', categoria: 'Cadastros' },
  { path: '/cadastro/tipo-tarefas', label: 'Cadastro de Tipo de Tarefas', categoria: 'Cadastros' },
  { path: '/cadastro/bancos', label: 'Cadastro de Bancos', categoria: 'Cadastros' },
  { path: '/cadastro/adquirentes', label: 'Cadastro de Adquirentes', categoria: 'Cadastros' },
  { path: '/cadastro/sistemas', label: 'Cadastro de Sistemas', categoria: 'Cadastros' },
  { path: '/cadastro/sistema', label: 'Cadastro Individual de Sistema', categoria: 'Cadastros' },
  { path: '/cadastro/vinculacoes', label: 'Cadastro de Vinculações', categoria: 'Cadastros' },
  
  // Atribuições
  { path: '/atribuir-responsaveis', label: 'Gestão de Capacidade', categoria: 'Atribuições' },
  { path: '/atribuicao/cliente', label: 'Atribuição de Cliente', categoria: 'Atribuições' },
  { path: '/atribuicao/nova', label: 'Nova Atribuição', categoria: 'Atribuições' },
  
  // Base de Conhecimento
  { path: '/base-conhecimento/conteudos-clientes', label: 'Base de Conhecimento - Conteúdos Clientes', categoria: 'Base de Conhecimento' },
  
  // Configurações
  { path: '/cadastro/custo-colaborador', label: 'Custo Colaborador', categoria: 'Configurações' },
  { path: '/configuracoes/perfil', label: 'Configurações de Perfil', categoria: 'Configurações' },
  { path: '/documentacao-api', label: 'Documentação API', categoria: 'Configurações' },
  { path: '/cadastro/vinculacoes', label: 'Vinculações', categoria: 'Configurações' },
  { path: '/gestao/usuarios', label: 'Gestão de Usuários', categoria: 'Configurações' },
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
          if (item.paginas === null) {
            configsData[item.nivel] = { paginas: null };
          } else {
            // Normalizar páginas: garantir que páginas principais estejam incluídas se suas subpáginas estiverem
            const paginasNormalizadas = normalizarPaginas(Array.isArray(item.paginas) ? item.paginas : []);
            configsData[item.nivel] = { paginas: paginasNormalizadas };
          }
        });

        // Se não houver configuração, usar padrões
        if (!configsData.administrador) {
          configsData.administrador = { paginas: null }; // null = todas as páginas
        }
        if (!configsData.gestor) {
          configsData.gestor = { paginas: null }; // null = todas as páginas
        }
        if (!configsData.colaborador) {
          configsData.colaborador = { 
            paginas: ['/painel-colaborador', '/base-conhecimento/conteudos-clientes']
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

  // Salvar configurações
  const handleSave = async () => {
    if (nivelSelecionado === 'administrador') return; // Administrador não precisa salvar
    
    setSalvando(true);
    try {
      const config = configs[nivelSelecionado];
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
        body: JSON.stringify({ paginas }),
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
                    <select
                      value={nivelSelecionado}
                      onChange={(e) => setNivelSelecionado(e.target.value)}
                      className="nivel-select"
                      disabled={salvando}
                    >
                      <option value="administrador">Administrador</option>
                      <option value="gestor">Gestor</option>
                      <option value="colaborador">Colaborador</option>
                    </select>
                  </div>

                  {/* Lista de páginas */}
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

