import React, { useState, useEffect } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import PageHeader from '../../components/common/PageHeader';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import LoadingState from '../../components/common/LoadingState';
import { useToast } from '../../hooks/useToast';
import { clearPermissoesConfigCache } from '../../utils/permissions';
import './ConfigPermissoes.css';

const API_BASE_URL = '/api';

// Lista de todas as páginas disponíveis no sistema
const TODAS_PAGINAS = [
  { path: '/painel', label: 'Painel Principal', categoria: 'Painéis' },
  { path: '/painel-colaborador', label: 'Painel Colaborador', categoria: 'Painéis' },
  { path: '/relatorios-clientes', label: 'Relatórios de Clientes', categoria: 'Relatórios' },
  { path: '/relatorios-colaboradores', label: 'Relatórios de Colaboradores', categoria: 'Relatórios' },
  { path: '/planilha-horas', label: 'Planilha de Horas', categoria: 'Relatórios' },
  { path: '/cadastro/clientes', label: 'Cadastro de Clientes', categoria: 'Cadastros' },
  { path: '/cadastro/cliente', label: 'Cadastro Individual de Cliente', categoria: 'Cadastros' },
  { path: '/cadastro/colaboradores', label: 'Cadastro de Colaboradores', categoria: 'Cadastros' },
  { path: '/cadastro/produtos', label: 'Cadastro de Produtos', categoria: 'Cadastros' },
  { path: '/cadastro/produto', label: 'Cadastro Individual de Produto', categoria: 'Cadastros' },
  { path: '/cadastro/tarefas', label: 'Cadastro de Tarefas', categoria: 'Cadastros' },
  { path: '/cadastro/tarefa', label: 'Cadastro Individual de Tarefa', categoria: 'Cadastros' },
  { path: '/cadastro/tipo-tarefas', label: 'Cadastro de Tipo de Tarefas', categoria: 'Cadastros' },
  { path: '/cadastro/tipo-tarefa', label: 'Cadastro Individual de Tipo de Tarefa', categoria: 'Cadastros' },
  { path: '/cadastro/bancos', label: 'Cadastro de Bancos', categoria: 'Cadastros' },
  { path: '/cadastro/banco', label: 'Cadastro Individual de Banco', categoria: 'Cadastros' },
  { path: '/cadastro/adquirentes', label: 'Cadastro de Adquirentes', categoria: 'Cadastros' },
  { path: '/cadastro/adquirente', label: 'Cadastro Individual de Adquirente', categoria: 'Cadastros' },
  { path: '/cadastro/sistemas', label: 'Cadastro de Sistemas', categoria: 'Cadastros' },
  { path: '/cadastro/sistema', label: 'Cadastro Individual de Sistema', categoria: 'Cadastros' },
  { path: '/cadastro/vinculacoes', label: 'Cadastro de Vinculações', categoria: 'Cadastros' },
  { path: '/atribuir-responsaveis', label: 'Atribuir Responsáveis', categoria: 'Atribuições' },
  { path: '/atribuicao/cliente', label: 'Atribuição de Cliente', categoria: 'Atribuições' },
  { path: '/atribuicao/nova', label: 'Nova Atribuição', categoria: 'Atribuições' },
  { path: '/base-conhecimento/conteudos-clientes', label: 'Base de Conhecimento - Conteúdos Clientes', categoria: 'Base de Conhecimento' },
  { path: '/base-conhecimento/cliente', label: 'Base de Conhecimento - Cliente', categoria: 'Base de Conhecimento' },
  { path: '/cadastro/custo-colaborador', label: 'Custo Colaborador', categoria: 'Configurações' },
  { path: '/configuracoes/perfil', label: 'Configurações de Perfil', categoria: 'Configurações' },
  { path: '/documentacao-api', label: 'Documentação API', categoria: 'Configurações' },
];

const ConfigPermissoes = () => {
  const showToast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [configs, setConfigs] = useState({
    gestor: { paginas: null, todasPaginas: true },
    colaborador: { paginas: [], todasPaginas: false }
  });

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
          configsData[item.nivel] = {
            paginas: item.paginas,
            todasPaginas: item.paginas === null
          };
        });

        // Se não houver configuração, usar padrões
        if (!configsData.gestor) {
          configsData.gestor = { paginas: null, todasPaginas: true };
        }
        if (!configsData.colaborador) {
          configsData.colaborador = { 
            paginas: ['/painel-colaborador', '/base-conhecimento/conteudos-clientes', '/base-conhecimento/cliente'],
            todasPaginas: false
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
  const handleSave = async (nivel) => {
    setSalvando(true);
    try {
      const config = configs[nivel];
      const paginas = config.todasPaginas ? null : config.paginas;

      const response = await fetch(`${API_BASE_URL}/permissoes-config/${nivel}`, {
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
        showToast('success', `Permissões do ${nivel === 'gestor' ? 'Gestor' : 'Colaborador'} atualizadas com sucesso!`);
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

  // Toggle "Todas as Páginas"
  const handleToggleTodasPaginas = (nivel) => {
    setConfigs(prev => ({
      ...prev,
      [nivel]: {
        ...prev[nivel],
        todasPaginas: !prev[nivel].todasPaginas,
        paginas: !prev[nivel].todasPaginas ? [] : prev[nivel].paginas
      }
    }));
  };

  // Toggle página individual
  const handleTogglePagina = (nivel, path) => {
    setConfigs(prev => {
      const config = prev[nivel];
      if (config.todasPaginas) return prev;

      const paginas = config.paginas || [];
      const index = paginas.indexOf(path);
      
      let novasPaginas;
      if (index > -1) {
        novasPaginas = paginas.filter(p => p !== path);
      } else {
        novasPaginas = [...paginas, path];
      }

      return {
        ...prev,
        [nivel]: {
          ...prev[nivel],
          paginas: novasPaginas
        }
      };
    });
  };

  // Selecionar todas as páginas de uma categoria
  const handleSelectCategoria = (nivel, categoria) => {
    setConfigs(prev => {
      const config = prev[nivel];
      if (config.todasPaginas) return prev;

      const paginasCategoria = TODAS_PAGINAS
        .filter(p => p.categoria === categoria)
        .map(p => p.path);

      const paginasAtuais = config.paginas || [];
      const todasSelecionadas = paginasCategoria.every(p => paginasAtuais.includes(p));

      let novasPaginas;
      if (todasSelecionadas) {
        // Desmarcar todas da categoria
        novasPaginas = paginasAtuais.filter(p => !paginasCategoria.includes(p));
      } else {
        // Marcar todas da categoria
        novasPaginas = [...new Set([...paginasAtuais, ...paginasCategoria])];
      }

      return {
        ...prev,
        [nivel]: {
          ...prev[nivel],
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

  const renderNivelConfig = (nivel, label) => {
    const config = configs[nivel];
    const paginasSelecionadas = config.paginas || [];

    return (
      <div key={nivel} className="nivel-config-card">
        <div className="nivel-header">
          <h3>{label}</h3>
          <div className="nivel-actions">
            <label className="toggle-todas">
              <input
                type="checkbox"
                checked={config.todasPaginas}
                onChange={() => handleToggleTodasPaginas(nivel)}
                disabled={salvando}
              />
              <span>Todas as Páginas</span>
            </label>
            <ButtonPrimary
              onClick={() => handleSave(nivel)}
              disabled={salvando || config.todasPaginas}
            >
              {salvando ? 'Salvando...' : 'Salvar'}
            </ButtonPrimary>
          </div>
        </div>

        {config.todasPaginas ? (
          <div className="todas-paginas-info">
            <i className="fas fa-info-circle"></i>
            <span>Este nível tem acesso a todas as páginas do sistema</span>
          </div>
        ) : (
          <div className="paginas-list">
            {Object.entries(paginasPorCategoria).map(([categoria, paginas]) => {
              const paginasCategoria = paginas.map(p => p.path);
              const todasSelecionadas = paginasCategoria.every(p => paginasSelecionadas.includes(p));
              const algumasSelecionadas = paginasCategoria.some(p => paginasSelecionadas.includes(p));

              return (
                <div key={categoria} className="categoria-group">
                  <div className="categoria-header">
                    <h4>{categoria}</h4>
                    <button
                      className="btn-select-categoria"
                      onClick={() => handleSelectCategoria(nivel, categoria)}
                      disabled={salvando}
                    >
                      {todasSelecionadas ? 'Desmarcar Todas' : 'Marcar Todas'}
                    </button>
                  </div>
                  <div className="paginas-grid">
                    {paginas.map(pagina => {
                      const isSelected = paginasSelecionadas.includes(pagina.path);
                      return (
                        <label key={pagina.path} className={`pagina-checkbox ${isSelected ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleTogglePagina(nivel, pagina.path)}
                            disabled={salvando}
                          />
                          <span>{pagina.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="config-permissoes-section">
              <PageHeader
                title="Configuração de Permissões"
                subtitle="Defina quais páginas cada nível de permissão pode acessar"
              />

              {loading ? (
                <LoadingState message="Carregando configurações..." />
              ) : (
                <div className="permissoes-config-container">
                  {renderNivelConfig('gestor', 'Gestor')}
                  {renderNivelConfig('colaborador', 'Colaborador')}
                  
                  <div className="info-box">
                    <i className="fas fa-info-circle"></i>
                    <div>
                      <strong>Nota:</strong> O nível <strong>Administrador</strong> sempre tem acesso total a todas as páginas e não pode ser configurado.
                    </div>
                  </div>
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

