import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import { colaboradoresAPI } from '../../services/api';
import ClienteTempoInfo from './components/ClienteTempoInfo';
import Avatar from '../../components/user/Avatar';
import IconButton from '../../components/common/IconButton';
import DetailSideCard from '../../components/clients/DetailSideCard';
import { DEFAULT_AVATAR } from '../../utils/avatars';
import './PainelUsuario.css';
import '../../pages/ConteudosClientes/ConteudosClientes.css';
import ModalPlugRapido from '../../components/ModalPlugRapido';
import '../../components/user/TimerAtivo.css'; // Garantir estilos se necessário
import TimerButton from '../../components/common/TimerButton';
import '../../components/ModalPlugRapido.css';
import '../../components/common/Tooltip.css';
import { comunicacaoAPI } from '../../services/comunicacao.service';

const API_BASE_URL = '/api';

// Componente React para renderizar cards de clientes (mesmo que ConteudosClientes)
const ClienteKnowledgeCards = ({ clientes, informacoesCache, onOpenContas, onOpenSistemas, onOpenAdquirentes, onViewKnowledge, selectedClienteId, onSelectCliente }) => {
  const aplicarMascaraCpfCnpj = (valor) => {
    if (!valor) return '';
    const apenasNumeros = valor.replace(/\D/g, '');
    const numeroLimitado = apenasNumeros.substring(0, 14);
    return numeroLimitado
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const renderClientCard = (cliente) => {
    // Priorizar nome_amigavel, depois nome_fantasia, depois razao_social
    const nomeExibicao = cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome || 'Sem nome';
    const cnpj = cliente.cpf_cnpj || cliente.cnpj || '';
    const status = cliente.status || '';
    const isAtivo = status === 'ativo';
    // Cor azul do sistema: #0e3b6f, Cor laranja: #ff9800, Cor cinza claro: #d1d5db
    const titleColor = isAtivo ? '#0e3b6f' : '#ff9800';
    const iconColor = isAtivo ? '#0e3b6f' : '#ff9800';
    const iconHoverColor = isAtivo ? '#144577' : '#f97316';

    // Verificar cache de informações de completude
    const cacheInfo = informacoesCache[cliente.id];
    const temConta = cacheInfo ? cacheInfo.temConta : null; // null = ainda não verificado, false = sem dados, true = com dados
    const temSistema = cacheInfo ? cacheInfo.temSistema : null;
    const temAdquirente = cacheInfo ? cacheInfo.temAdquirente : null;

    // Cores dos ícones: cinza claro se não houver dados (false), cor normal se houver (true) ou ainda não verificado (null)
    const contaIconColor = temConta === false ? '#d1d5db' : iconColor;
    const sistemaIconColor = temSistema === false ? '#d1d5db' : iconColor;
    const adquirenteIconColor = temAdquirente === false ? '#d1d5db' : iconColor;

    // Desabilitar botões quando não houver dados confirmados
    const contaDisabled = temConta === false;
    const sistemaDisabled = temSistema === false;
    const adquirenteDisabled = temAdquirente === false;

    // Verificar se este cliente está selecionado (seleção única)
    const isSelected = selectedClienteId && String(selectedClienteId).trim() === String(cliente.id).trim();
    // Verificar se há algum cliente selecionado (para aplicar estilo apagado nos não selecionados)
    const hasAnySelected = selectedClienteId !== null && selectedClienteId !== undefined;

    return (
      <div
        key={cliente.id}
        className="cliente-knowledge-card"
        style={{
          // Simplesmente mudar a cor da borda quando selecionado - mesma espessura, não altera tamanho
          border: isSelected ? '1px solid #0e3b6f' : '1px solid #e5e7eb',
          boxShadow: isSelected
            ? '0 4px 12px rgba(14, 59, 111, 0.2)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
          cursor: onSelectCliente ? 'pointer' : 'default',
          // Aplicar estilo apagado quando há seleção mas este não está selecionado
          opacity: hasAnySelected && !isSelected ? 0.5 : 1,
          filter: hasAnySelected && !isSelected ? 'grayscale(0.3)' : 'none',
          transition: 'opacity 0.2s ease, filter 0.2s ease'
        }}
        onClick={onSelectCliente ? (e) => {
          // Não disparar seleção se clicar nos botões
          if (e.target.closest('button') || e.target.closest('.cliente-knowledge-icon-button') || e.target.closest('.icon-button')) {
            return;
          }
          onSelectCliente(cliente.id);
        } : undefined}
      >
        <div className="cliente-knowledge-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <Avatar
              avatarId={
                cliente.foto_perfil && cliente.foto_perfil.startsWith('custom-') && !cliente.foto_perfil_path
                  ? DEFAULT_AVATAR
                  : (cliente.foto_perfil || DEFAULT_AVATAR)
              }
              nomeUsuario={nomeExibicao}
              size="medium"
              customImagePath={cliente.foto_perfil_path || null}
            />
            <h3
              className="cliente-knowledge-card-title"
              style={{ color: titleColor, flex: 1 }}
            >
              {nomeExibicao}
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {status && (
              <span className={`cliente-knowledge-status-badge ${status === 'ativo' ? 'active' : 'inactive'}`}>
                {status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            )}
            {/* Checkbox de seleção - no canto superior direito */}
            {onSelectCliente && (
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  minWidth: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #0e3b6f',
                  borderRadius: '4px',
                  backgroundColor: isSelected ? '#0e3b6f' : 'transparent',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCliente(cliente.id);
                }}
              >
                {isSelected && (
                  <i className="fas fa-check" style={{ color: '#fff', fontSize: '12px' }}></i>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="cliente-knowledge-card-body">
          {cliente.razao_social && (
            <div className="cliente-knowledge-card-field">
              <label>Razão Social</label>
              <div className="cliente-knowledge-card-value">{cliente.razao_social}</div>
            </div>
          )}
          {cnpj && (
            <div className="cliente-knowledge-card-field">
              <label>CNPJ</label>
              <div className="cliente-knowledge-card-value">{aplicarMascaraCpfCnpj(cnpj)}</div>
            </div>
          )}
        </div>
        <div className="cliente-knowledge-card-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            {/* Botões de ação (ícones) */}
            <div className="cliente-knowledge-icons-row">
              <button
                className={`cliente-knowledge-icon-button ${contaDisabled ? 'disabled-icon' : ''}`}
                onClick={(e) => !contaDisabled && onOpenContas(cliente, e)}
                disabled={contaDisabled}
                title={contaDisabled ? "Nenhuma conta bancária cadastrada" : "Gerenciar Contas Bancárias"}
                style={{ color: contaIconColor }}
              >
                <i className="fas fa-university"></i>
              </button>
              <button
                className={`cliente-knowledge-icon-button ${sistemaDisabled ? 'disabled-icon' : ''}`}
                onClick={(e) => !sistemaDisabled && onOpenSistemas(cliente, e)}
                disabled={sistemaDisabled}
                title={sistemaDisabled ? "Nenhum sistema cadastrado" : "Gerenciar Sistemas"}
                style={{ color: sistemaIconColor }}
              >
                <i className="fas fa-server"></i>
              </button>
              <button
                className={`cliente-knowledge-icon-button ${adquirenteDisabled ? 'disabled-icon' : ''}`}
                onClick={(e) => !adquirenteDisabled && onOpenAdquirentes(cliente, e)}
                disabled={adquirenteDisabled}
                title={adquirenteDisabled ? "Nenhum adquirente cadastrado" : "Gerenciar Adquirentes"}
                style={{ color: adquirenteIconColor }}
              >
                <i className="fas fa-credit-card"></i>
              </button>
            </div>
            {/* Botão Visualizar */}
            <IconButton
              icon="fa-eye"
              onClick={(e) => {
                e.stopPropagation();
                onViewKnowledge(cliente);
              }}
              title="Visualizar Base de Conhecimento"
              color={iconColor}
              hoverColor={iconHoverColor}
            />
          </div>
        </div>
      </div>
    );
  };

  if (!clientes || clientes.length === 0) return null;

  return (
    <div className="clientes-knowledge-grid" style={{ marginBottom: '24px' }}>
      {clientes.map(cliente => renderClientCard(cliente))}
    </div>
  );
};

/**
 * Componente PainelUsuario
 * Tela de visualização de tarefas do usuário
 * Exibe tarefas atribuídas ao usuário logado
 */
const PainelUsuario = () => {
  const { usuario } = useAuth();
  const tarefasContainerRef = useRef(null);
  const [carregandoTarefas, setCarregandoTarefas] = useState(false);
  const [tarefasAgrupadas, setTarefasAgrupadas] = useState([]);
  const [tarefasRegistros, setTarefasRegistros] = useState([]);
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
  const [clientesExpandidosLista, setClientesExpandidosLista] = useState(new Set()); // para controlar expansão de clientes na lista
  const [timetracksExpandidos, setTimetracksExpandidos] = useState(new Set()); // para controlar expansão de timetracks individuais
  const timetracksExpandidosRef = useRef(new Set()); // Ref para acesso síncrono ao estado de expansão
  const [timetracksData, setTimetracksData] = useState(new Map()); // Map<chave, registros[]> - cache de registros de tempo
  const timetracksDataRef = useRef(new Map()); // Ref para acesso síncrono aos dados
  const [dataTarefasSelecionada, setDataTarefasSelecionada] = useState(new Date()); // Data selecionada para exibir tarefas (inicia com hoje)
  const carregarMinhasTarefasRef = useRef(null); // Ref para a função de carregar tarefas

  // --- PLUG RÁPIDO & PENDENTES ---
  const [modalPlugRapidoOpen, setModalPlugRapidoOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('minhas'); // 'minhas' | 'pendentes'
  const [pendentes, setPendentes] = useState([]);

  const fetchPendentes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/minhas`);
      const json = await res.json();
      if (json.success) {
        setPendentes(json.data || []);
      }
    } catch (e) { console.error('Erro ao buscar pendentes', e); }
  }, []);

  useEffect(() => {
    // Buscar sempre para saber se existem pendências e mostrar a tab
    fetchPendentes();

    let interval;
    if (activeTab === 'pendentes') {
      // Polling simples para atualizar tempo de timers ativos nos pendentes (apenas quando visível)
      interval = setInterval(fetchPendentes, 60000);
    }

    // Sincronizar com eventos do Timer Global (TimerAtivo) - Sempre ouvir para manter contador atualizado
    const handleUpdate = () => {
      setTimeout(fetchPendentes, 200); // Pequeno delay para garantir consistência do backend
    };

    window.addEventListener('registro-tempo-finalizado', handleUpdate);
    window.addEventListener('registro-tempo-iniciado', handleUpdate);
    window.addEventListener('registro-tempo-atualizado', handleUpdate);
    window.addEventListener('registro-tempo-deletado', handleUpdate);

    return () => {
      if (interval) clearInterval(interval);
      window.removeEventListener('registro-tempo-finalizado', handleUpdate);
      window.removeEventListener('registro-tempo-iniciado', handleUpdate);
      window.removeEventListener('registro-tempo-atualizado', handleUpdate);
      window.removeEventListener('registro-tempo-deletado', handleUpdate);
    };
  }, [activeTab, fetchPendentes]);

  const handleStopTimerPendente = async (pendenteId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/parar-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atribuicao_pendente_id: pendenteId })
      });
      if (res.ok) {
        fetchPendentes();
      }
    } catch (e) { console.error(e); }
  };

  const handleStartTimerPendente = async (pendenteId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/iniciar-timer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atribuicao_pendente_id: pendenteId })
      });
      if (res.ok) {
        fetchPendentes();
      }
    } catch (e) { console.error(e); }
  };
  // -------------------------------

  // ID fixo para o card de tarefas (não usa mais grid, então só um card)
  const CARD_ID_TAREFAS = 'tarefas-card-1';



  const [modoVisualizacao, setModoVisualizacao] = useState({ [CARD_ID_TAREFAS]: 'quadro' }); // objeto com { cardId: 'quadro' | 'lista' }
  const preferenciaCarregadaRef = useRef(false); // Ref para controlar se a preferência já foi carregada
  const modoVisualizacaoRef = useRef({ [CARD_ID_TAREFAS]: 'quadro' }); // Ref para preservar o modo atual mesmo durante re-renderizações

  // Carregar preferência de visualização do servidor apenas na primeira montagem (quando a página é recarregada)
  // O valor vem da coluna "view_modelo_painel" da tabela "usuarios"
  // Não recarregar quando desplugar para manter o modo atual
  useEffect(() => {
    if (preferenciaCarregadaRef.current) return; // Já carregou uma vez, não recarregar

    const carregarPreferenciaVisualizacao = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/preferencia-view-mode`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const modo = result.data.modo || 'quadro';
            // Na primeira montagem, sempre usar o valor do banco (view_modelo_painel)
            setModoVisualizacao({ [CARD_ID_TAREFAS]: modo });
            modoVisualizacaoRef.current = { [CARD_ID_TAREFAS]: modo };
          }
        }
        preferenciaCarregadaRef.current = true;
      } catch (error) {
        // Em caso de erro, usar padrão 'quadro'
        preferenciaCarregadaRef.current = true;
        setModoVisualizacao({ [CARD_ID_TAREFAS]: 'quadro' });
        modoVisualizacaoRef.current = { [CARD_ID_TAREFAS]: 'quadro' };
      }
    };

    carregarPreferenciaVisualizacao();
  }, []);
  const [nomesCache, setNomesCache] = useState({
    produtos: {},
    tarefas: {},
    clientes: {},
    colaboradores: {}
  });
  const nomesCacheRef = useRef({
    produtos: {},
    tarefas: {},
    clientes: {},
    colaboradores: {}
  });
  const [clientesListaCache, setClientesListaCache] = useState(null);
  const [colaboradoresCache, setColaboradoresCache] = useState([]);

  // Sincronizar ref com estado do cache
  useEffect(() => {
    nomesCacheRef.current = nomesCache;
  }, [nomesCache]);
  const tarefasRegistrosRef = useRef([]);
  const [registrosAtivos, setRegistrosAtivos] = useState(new Map()); // Map<tempo_estimado_id, { registro_id, data_inicio }>
  const registrosAtivosRef = useRef(new Map()); // Ref para acesso em funções não-hook
  const [temposRealizados, setTemposRealizados] = useState(new Map()); // Map<chave, tempo_realizado_ms>
  const temposRealizadosRef = useRef(new Map()); // Ref para acesso em funções não-hook

  // Cache de subtarefas vinculadas por tarefa_id
  const fetchingNamesRef = useRef(new Set()); // IDs de clientes sendo buscados
  const failedNamesRef = useRef(new Set());   // IDs de clientes que falharam (para não tentar novamente)

  const fetchingTimesRef = useRef(new Set()); // Chaves de tempo sendo buscadas

  // Refs para controle de requisições de subtarefas
  const fetchingSubtarefasRef = useRef(new Set());
  const failedSubtarefasRef = useRef(new Set());

  // Refs para controle de nomes relacionados (produtos, tarefas)
  const fetchingProductsRef = useRef(new Set());
  const failedProductsRef = useRef(new Set());
  const fetchingTasksRef = useRef(new Set());
  const failedTasksRef = useRef(new Set());


  // --- SHORTCUT INTERNA UP ---
  // Helper para verificar se a data é hoje (duplicado da lista para uso no header)
  const isTaskToday = (dateValue) => {
    if (!dateValue) return true;
    const hoje = new Date();
    const hojePart = hoje.getFullYear() + '-' +
      String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
      String(hoje.getDate()).padStart(2, '0');

    if (typeof dateValue === 'string') {
      return dateValue.split('T')[0] === hojePart;
    }
    try {
      const d = new Date(dateValue);
      const dPart = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      return dPart === hojePart;
    } catch (e) { return true; }
  };

  const [internaUpTaskIds, setInternaUpTaskIds] = useState(new Set());
  const [shortcutTask, setShortcutTask] = useState(null);

  useEffect(() => {
    const fetchInternaUpIds = async () => {
      try {
        const respTipo = await fetch('/api/tipo-tarefa?limit=1000', {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });
        if (!respTipo.ok) return;
        const dadosTipo = await respTipo.json();
        const tipoInternaUp = dadosTipo?.data?.find(t => t.nome && t.nome.trim() === 'Interna UP');
        if (!tipoInternaUp) return;

        const tipoId = parseInt(tipoInternaUp.id, 10);

        const respVinculados = await fetch('/api/vinculados?filtro_tipo_atividade=true&limit=1000', {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });
        if (!respVinculados.ok) return;
        const dadosVinculados = await respVinculados.json();

        const ids = new Set();
        (dadosVinculados.data || []).forEach(v => {
          if (v.tarefa_id && parseInt(v.tarefa_tipo_id, 10) === tipoId) {
            ids.add(String(v.tarefa_id).trim());
          }
        });
        setInternaUpTaskIds(ids);
      } catch (e) { console.error('Error fetching Interna UP tasks', e); }
    };
    fetchInternaUpIds();
  }, []);

  useEffect(() => {
    if (tarefasRegistros.length > 0 && internaUpTaskIds.size > 0) {
      const found = tarefasRegistros.find(t => internaUpTaskIds.has(String(t.tarefa_id).trim()));
      setShortcutTask(found || null);
    } else {
      setShortcutTask(null);
    }
  }, [tarefasRegistros, internaUpTaskIds]);
  const [subtarefasCache, setSubtarefasCache] = useState(new Map()); // Map<tarefa_id, subtarefas[]>
  const subtarefasCacheRef = useRef(new Map()); // Ref para acesso síncrono
  // Estado para controlar subtarefas concluídas: Map<chave, Set<subtarefa_id>>
  const [subtarefasConcluidas, setSubtarefasConcluidas] = useState(new Map());
  const subtarefasConcluidasRef = useRef(new Map()); // Ref para acesso síncrono
  // Estado para controlar expansão de subtarefas: Set<chave>
  const [subtarefasExpandidas, setSubtarefasExpandidas] = useState(new Set());
  const subtarefasExpandidasRef = useRef(new Set()); // Ref para acesso síncrono
  // Estado para controlar descrições de subtarefas expandidas: Set<subtarefa_id>
  const [descricoesSubtarefasExpandidas, setDescricoesSubtarefasExpandidas] = useState(new Set());
  const descricoesSubtarefasExpandidasRef = useRef(new Set()); // Ref para acesso síncrono

  const toggleTarefa = useCallback((agrupadorId, tarefaId) => {
    setTarefasExpandidas((prev) => {
      const key = `${agrupadorId}_${tarefaId}`;
      const novo = new Set(prev);
      if (novo.has(key)) {
        novo.delete(key);
      } else {
        novo.add(key);
      }
      return novo;
    });
  }, []);

  const formatarData = (dataInput) => {
    if (!dataInput) return '—';
    try {
      let date;
      if (dataInput instanceof Date) {
        date = dataInput;
      } else if (typeof dataInput === 'string') {
        const dataStr = dataInput.split('T')[0];
        const [ano, mes, dia] = dataStr.split('-');
        date = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      } else {
        date = new Date(dataInput);
      }
      if (isNaN(date.getTime())) return '—';
      const dia = String(date.getDate()).padStart(2, '0');
      const mes = String(date.getMonth() + 1).padStart(2, '0');
      const ano = date.getFullYear();
      return `${dia}/${mes}/${ano}`;
    } catch (e) {
      return '—';
    }
  };

  const formatarPeriodo = (dataInicio, dataFim) => {
    if (!dataInicio || !dataFim) return '—';
    return `${formatarData(dataInicio)} até ${formatarData(dataFim)}`;
  };

  const [comunicadoDestaque, setComunicadoDestaque] = useState(null);

  const getNomeProduto = (id) => nomesCache.produtos[String(id)] || 'Produto';
  const getNomeTarefa = (id, registro = null) => {
    const idStr = String(id);
    // Primeiro tentar usar o nome do registro se disponível (mais confiável)
    if (registro && registro.tarefa_nome) {
      return registro.tarefa_nome;
    }
    // Depois tentar o cache (usar ref para garantir valor atualizado)
    const cacheAtual = nomesCacheRef.current;
    if (cacheAtual.tarefas && cacheAtual.tarefas[idStr]) {
      return cacheAtual.tarefas[idStr];
    }
    // Também tentar o estado (para compatibilidade)
    if (nomesCache.tarefas && nomesCache.tarefas[idStr]) {
      return nomesCache.tarefas[idStr];
    }
    // Fallback
    return 'Tarefa';
  };

  // Função para buscar nome do cliente usando o endpoint de base-conhecimento
  const buscarNomeCliente = useCallback(async (clienteId) => {
    if (!clienteId) return null;

    const idStr = String(clienteId).trim();

    // Verificar se já está buscando ou se já falhou
    if (fetchingNamesRef.current.has(idStr) || failedNamesRef.current.has(idStr)) {
      return null;
    }

    try {
      fetchingNamesRef.current.add(idStr); // Marcar como buscando

      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${idStr}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        failedNamesRef.current.add(idStr); // Marcar como falha
        return null;
      }

      if (!response.ok) {
        failedNamesRef.current.add(idStr); // Marcar como falha
        return null;
      }

      const result = await response.json();
      if (result.success && result.data && result.data.cliente) {
        const cliente = result.data.cliente;
        // Priorizar: nome > nome_amigavel > nome_fantasia > razao_social
        const nome = cliente.nome ||
          cliente.nome_amigavel ||
          cliente.amigavel ||
          cliente.nome_fantasia ||
          cliente.fantasia ||
          cliente.razao_social ||
          cliente.razao ||
          null;

        if (nome) {
          // Atualizar cache
          const novos = { ...nomesCacheRef.current };
          novos.clientes[idStr] = nome;
          nomesCacheRef.current = novos;
          setNomesCache(novos);

          return nome;
        }
      }
      failedNamesRef.current.add(idStr); // Marcar como falha se não achou nome
      return null;
    } catch (error) {
      failedNamesRef.current.add(idStr); // Marcar como falha
      return null;
    } finally {
      fetchingNamesRef.current.delete(idStr); // Desmarcar busca
    }
  }, []);

  // Função síncrona para obter nome do cliente (retorna do cache ou string vazia)
  const getNomeCliente = (id) => {
    if (!id) return '';
    const idStr = String(id).trim();
    const cacheAtual = nomesCacheRef.current;

    // Se já temos o nome no cache, retornar
    if (cacheAtual.clientes && cacheAtual.clientes[idStr]) {
      return cacheAtual.clientes[idStr];
    }

    // Se já falhou anteriormente, retornar "Cliente" para não tentar ficar buscando infinitamente
    if (failedNamesRef.current.has(idStr)) {
      return 'Cliente';
    }

    // Se não estiver no cache e não estiver buscando e não falhou, disparar busca assíncrona
    if (!fetchingNamesRef.current.has(idStr)) {
      buscarNomeCliente(idStr).catch(() => { });
    }

    return ''; // Retornar string vazia enquanto carrega
  };

  const getNomeColaborador = (id) => nomesCache.colaboradores[String(id)] || 'Colaborador';

  const formatarTempoComCusto = (tempo, responsavelId) => {
    const valor = Number(tempo) || 0;
    // Se for milissegundos, usa formatarTempoHMS diretamente
    if (valor >= 1000) {
      return formatarTempoHMS(valor);
    }
    // Se for horas decimais, converte para milissegundos primeiro
    const milissegundos = valor * 3600000;
    return formatarTempoHMS(milissegundos);
  };

  // Função para formatar milissegundos em formato legível (ex: "2min 25s" ou "1h 2min 25s")
  const formatarTempoHMS = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0s';

    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;

    const partes = [];

    if (horas > 0) {
      partes.push(`${horas}h`);
    }

    if (minutos > 0) {
      partes.push(`${minutos}min`);
    }

    if (segundos > 0 || partes.length === 0) {
      partes.push(`${segundos}s`);
    }

    return partes.join(' ');
  };

  // Helper: Criar chave de registro (cliente_id + tarefa_id)
  const criarChaveRegistro = useCallback((clienteId, tarefaId, data = null) => {
    const clienteIdStr = String(clienteId).trim();
    const tarefaIdStr = String(tarefaId).trim();

    // Se data for fornecida, incluir na chave
    if (data) {
      let dataStr;
      if (data instanceof Date) {
        const yyyy = data.getFullYear();
        const mm = String(data.getMonth() + 1).padStart(2, '0');
        const dd = String(data.getDate()).padStart(2, '0');
        dataStr = `${yyyy}-${mm}-${dd}`;
      } else if (typeof data === 'string') {
        // Se já é string, usar apenas a parte da data (sem hora)
        dataStr = data.split('T')[0];
      } else {
        dataStr = String(data);
      }
      return `${clienteIdStr}_${tarefaIdStr}_${dataStr}`;
    }

    // Fallback: chave sem data (para compatibilidade)
    return `${clienteIdStr}_${tarefaIdStr}`;
  }, []);

  // Sincronizar refs do cache de subtarefas
  useEffect(() => {
    subtarefasCacheRef.current = subtarefasCache;
    subtarefasConcluidasRef.current = subtarefasConcluidas;
    subtarefasExpandidasRef.current = subtarefasExpandidas;
    descricoesSubtarefasExpandidasRef.current = descricoesSubtarefasExpandidas;
  }, [subtarefasCache, subtarefasConcluidas, subtarefasExpandidas, descricoesSubtarefasExpandidas]);

  // Helper: Criar chave de tempo (cliente_id + tarefa_id + tempo_estimado_id)
  const criarChaveTempo = useCallback((reg) => {
    const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
    if (!tempoEstimadoId) return null;
    return `${String(reg.cliente_id).trim()}_${String(reg.tarefa_id).trim()}_${String(tempoEstimadoId).trim()}`;
  }, []);

  // Buscar subtarefas vinculadas a uma tarefa
  const buscarSubtarefas = useCallback(async (tarefaId) => {
    if (!tarefaId) return [];

    const tarefaIdStr = String(tarefaId);

    // Verificar se já está no cache
    if (subtarefasCacheRef.current.has(tarefaIdStr)) {
      return subtarefasCacheRef.current.get(tarefaIdStr);
    }

    // Verificar se já está buscando ou se já falhou
    if (fetchingSubtarefasRef.current.has(tarefaIdStr) || failedSubtarefasRef.current.has(tarefaIdStr)) {
      return [];
    }

    try {
      fetchingSubtarefasRef.current.add(tarefaIdStr);

      const response = await fetch(`${API_BASE_URL}/subtarefas-por-tarefa?tarefaId=${tarefaId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401 || response.status === 503) {
        failedSubtarefasRef.current.add(tarefaIdStr);
        return [];
      }

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const subtarefas = result.data || [];
          // Atualizar cache
          const novoCache = new Map(subtarefasCacheRef.current);
          novoCache.set(tarefaIdStr, subtarefas);
          setSubtarefasCache(novoCache);
          return subtarefas;
        }
      }

      // Se falhou (mas não crítico), não marcamos como falha permanente, mas não temos dados
      return [];
    } catch (error) {
      // Erro crítico, marcar como falha para não tentar novamente
      failedSubtarefasRef.current.add(tarefaIdStr);
      console.error('Erro ao buscar subtarefas:', error);
      return [];
    } finally {
      fetchingSubtarefasRef.current.delete(tarefaIdStr);
    }
  }, []);

  // Criar chave única para subtarefas (USAR ID DA INSTÂNCIA para isolamento total por dia/contexto)
  const criarChaveSubtarefas = useCallback((reg) => {
    // O reg.id é o ID Virtual (Hash de Regra+Data) ou ID único que garante unicidade da instância
    // Fallback para cliente_tarefa apenas se não tiver ID (não deve ocorrer em tarefas reais)
    if (reg.id) return String(reg.id).trim();
    return `${String(reg.cliente_id || '').trim()}_${String(reg.tarefa_id).trim()}`;
  }, []);

  // Buscar status das subtarefas no backend (persistência)
  const carregarStatusChecklist = useCallback(async (instanciaId) => {
    if (!instanciaId) return;

    console.log('[Checklist] Carregando status para:', instanciaId);

    // Evitar recarregar se já tiver sido carregado recentemente? 
    // Por enquanto, sempre carrega ao abrir para garantir sincronia, ou podemos confiar no estado local se já existir
    // Vamos carregar sempre para garantir (ex: abriu em outra aba)

    try {
      const response = await fetch(`${API_BASE_URL}/checklist/status/${instanciaId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.concluidas)) {
          console.log('[Checklist] Resultado para', instanciaId, ':', result.concluidas);
          // Atualizar o estado local com o que veio do banco
          const novoSet = new Set(result.concluidas.map(String));

          // ATUALIZAÇÃO SÍNCRONA DO REF para garantir que o renderizador use os dados novos imediatamente
          setSubtarefasConcluidas(prev => {
            const novoMap = new Map(prev);
            novoMap.set(instanciaId, novoSet);
            // Atualizar ref também dentro do set para garantir consistência
            subtarefasConcluidasRef.current = novoMap;
            return novoMap;
          });

          // Forçar atualização do REF imediatamente antes de retornar (para uso síncrono no await)
          const mapAtual = new Map(subtarefasConcluidasRef.current);
          mapAtual.set(instanciaId, novoSet);
          // ATUALIZAR CONTADOR NA INTERFACE
          // Procurar elementos que exibem o contador para esta chave
          const wrapper = document.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${instanciaId}"]`);
          if (wrapper) {
            const item = wrapper.closest('.painel-usuario-tarefa-item-lista, .painel-usuario-tarefa-card');
            if (item) {
              const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
              if (countElement) {
                // Precisamos das subtarefas para contar. Tentar pegar do cache.
                // Como não temos acesso fácil ao tarefaId aqui, vamos tentar inferir ou deixar para o chamador
                // Se não conseguirmos atualizar aqui, o renderizador principal atualizará depois
                // Melhor abordagem: disparar um evento customizado ou forçar atualização se possível

                // Tenta pegar subtarefas do wrapper se já estiver renderizado
                const totalSubtarefasElements = wrapper.querySelectorAll('.painel-usuario-subtarefa-item').length;
                if (totalSubtarefasElements > 0) {
                  const pendentes = totalSubtarefasElements - novoSet.size;
                  countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                  countElement.style.color = pendentes === 0 ? '#10b981' : '#f59e0b';
                }
              }
            }
          }

          return novoSet;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar status do checklist:', error);
    }
    return null;
  }, []);

  // Salvar status no backend
  const salvarStatusChecklist = useCallback(async (instanciaId, subtarefaId, concluida) => {
    try {
      console.log('[Checklist] Salvando:', { instanciaId, subtarefaId, concluida });
      await fetch(`${API_BASE_URL}/checklist/toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idInstancia: instanciaId,
          subtarefaId: subtarefaId,
          concluida: concluida
        })
      });
    } catch (error) {
      console.error('Erro ao salvar status do checklist:', error);
      // Opcional: Reverter estado local em caso de erro (complexo de fazer aqui sem context, mas idealmente faria)
    }
  }, []);

  // Contar subtarefas pendentes
  const contarSubtarefasPendentes = useCallback((subtarefas, chave) => {
    if (!subtarefas || subtarefas.length === 0) return 0;
    const concluidas = subtarefasConcluidasRef.current.get(chave) || new Set();
    return subtarefas.length - concluidas.size;
  }, []);

  // Renderizar lista de subtarefas como checklist com bolinhas
  const renderizarSubtarefas = useCallback((subtarefas, tarefaId, chave) => {
    if (!subtarefas || subtarefas.length === 0) {
      return '';
    }

    const concluidas = subtarefasConcluidasRef.current.get(chave) || new Set();

    const subtarefasHtml = subtarefas.map((subtarefa) => {
      const isConcluida = concluidas.has(String(subtarefa.id));
      const temDescricao = subtarefa.descricao && subtarefa.descricao.trim() !== '';
      const descricaoExpandida = descricoesSubtarefasExpandidasRef.current.has(String(subtarefa.id));
      // Remover tags HTML da descrição mas manter quebras de linha
      const descricaoTexto = temDescricao ? subtarefa.descricao
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n\n+/g, '\n')
        .trim() : '';
      return `
        <div class="painel-usuario-subtarefa-item" data-subtarefa-id="${subtarefa.id}" data-chave="${chave}">
          <div 
            class="painel-usuario-subtarefa-bolinha ${isConcluida ? 'concluida' : ''}"
            data-tarefa-id="${tarefaId}"
            data-subtarefa-id="${subtarefa.id}"
            data-chave="${chave}"
          ></div>
          <div class="painel-usuario-subtarefa-content">
            <div class="painel-usuario-subtarefa-nome-row">
              <span class="painel-usuario-subtarefa-nome ${isConcluida ? 'concluida' : ''}">${subtarefa.nome || 'Sem nome'}</span>
              ${temDescricao ? `
                <button 
                  type="button"
                  class="painel-usuario-subtarefa-descricao-btn"
                  data-subtarefa-id="${subtarefa.id}"
                  title="${descricaoExpandida ? 'Ocultar descrição' : 'Ver descrição'}"
                >
                  <i class="fas fa-chevron-${descricaoExpandida ? 'down' : 'right'}"></i>
                </button>
              ` : ''}
            </div>
            ${temDescricao && descricaoExpandida ? `
              <div class="painel-usuario-subtarefa-descricao ${isConcluida ? 'concluida' : ''}">${descricaoTexto}</div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="painel-usuario-subtarefas-list">
        ${subtarefasHtml}
      </div>
    `;
  }, []);

  // Helper: Atualizar renderização de todas as tarefas
  const atualizarRenderizacaoTarefas = useCallback(() => {
    if (tarefasRegistrosRef.current.length > 0 && tarefasContainerRef.current) {
      renderTarefasNoCard(tarefasRegistrosRef.current, tarefasContainerRef.current, dataTarefasSelecionada);
    }
  }, [dataTarefasSelecionada]);

  // Efeito para atualizar renderização quando nomes de clientes forem carregados
  useEffect(() => {
    // Atualizar renderização quando o cache de nomes de clientes mudar
    if (tarefasRegistrosRef.current.length > 0 && tarefasContainerRef.current) {
      atualizarRenderizacaoTarefas();
    }
  }, [nomesCache.clientes, atualizarRenderizacaoTarefas]);

  // Helper: Atualizar apenas o botão de um tempo estimado específico
  // Cada tempo estimado é totalmente independente
  const atualizarBotaoTempoEstimado = useCallback((tempoEstimadoId, isAtivo) => {
    if (!tempoEstimadoId) {
      return;
    }

    const tempoEstimadoIdStr = String(tempoEstimadoId).trim();

    // Buscar APENAS o botão deste tempo estimado específico
    const botoes = document.querySelectorAll(
      `button[data-tempo-estimado-id="${tempoEstimadoIdStr}"]`
    );

    botoes.forEach((btn) => {
      if (!btn) return;

      const icon = btn.querySelector('i');
      if (!icon) return;

      // Atualizar classes e atributos imediatamente
      if (isAtivo) {
        // Estado ativo: botão de parar
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.className = 'painel-usuario-stop-btn';
        icon.className = 'fas fa-stop';
        btn.setAttribute('data-action', 'parar');
        btn.setAttribute('title', 'Parar registro de tempo');
      } else {
        // Estado inativo: botão de play
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.className = 'painel-usuario-play-btn';
        icon.className = 'fas fa-play';
        btn.setAttribute('data-action', 'iniciar');
        btn.setAttribute('title', 'Iniciar registro de tempo');
      }
    });
  }, []);

  // Helper: Obter estado atual do botão de um tempo estimado
  const obterEstadoBotaoTempoEstimado = useCallback((tempoEstimadoId) => {
    if (!tempoEstimadoId) return { isAtivo: false, registroAtivo: null };
    const tempoEstimadoIdStr = String(tempoEstimadoId).trim();
    const registroAtivo = registrosAtivosRef.current.get(tempoEstimadoIdStr);
    return {
      isAtivo: !!registroAtivo,
      registroAtivo: registroAtivo || null
    };
  }, []);

  // Helper: Sincronizar TODOS os botões com o estado atual dos registros ativos
  const sincronizarTodosBotoes = useCallback(() => {
    // Atualizar todos os botões baseado no estado atual
    tarefasRegistrosRef.current.forEach((reg) => {
      const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
      if (tempoEstimadoId) {
        const estado = obterEstadoBotaoTempoEstimado(tempoEstimadoId);
        atualizarBotaoTempoEstimado(tempoEstimadoId, estado.isAtivo);
      }
    });
  }, [obterEstadoBotaoTempoEstimado, atualizarBotaoTempoEstimado]);

  // Função para obter tempo realizado formatado de uma tarefa
  const obterTempoRealizadoFormatado = useCallback((reg) => {
    const chaveTempo = criarChaveTempo(reg);
    if (!chaveTempo) return '0s';

    const tempoRealizadoMs = temposRealizadosRef.current.get(chaveTempo) || 0;
    return formatarTempoHMS(tempoRealizadoMs);
  }, [criarChaveTempo]);

  // Função para obter tempo realizado em milissegundos
  const obterTempoRealizadoMs = useCallback((reg) => {
    const chaveTempo = criarChaveTempo(reg);
    if (!chaveTempo) return 0;

    return temposRealizadosRef.current.get(chaveTempo) || 0;
  }, [criarChaveTempo]);

  // Função para atualizar tempo realizado e barra de progresso no DOM
  const atualizarTempoRealizadoEBarraProgresso = useCallback((reg, tempoRealizadoMs) => {
    const chaveTempo = criarChaveTempo(reg);
    if (!chaveTempo) return;

    const tempoFormatado = formatarTempoHMS(tempoRealizadoMs);
    const tarefaIdStr = String(reg.tarefa_id).trim();
    const clienteIdStr = String(reg.cliente_id).trim();

    // Atualizar todos os pills de tempo realizado desta tarefa
    const tempoPills = document.querySelectorAll(
      `.painel-usuario-realizado-pill[data-tarefa-id="${tarefaIdStr}"][data-cliente-id="${clienteIdStr}"]`
    );
    tempoPills.forEach((pill) => {
      pill.textContent = tempoFormatado;
    });

    // Atualizar barra de progresso
    const tempoEstimado = reg.tempo_estimado_dia || reg.tempo_estimado_total || 0;
    if (tempoEstimado > 0) {
      const porcentagem = (tempoRealizadoMs / tempoEstimado) * 100;
      const porcentagemLimitada = Math.min(100, porcentagem);
      const porcentagemExcessoBruta = porcentagem > 100 ? porcentagem - 100 : 0;
      const porcentagemExcesso = porcentagemExcessoBruta > 0 ? Math.min(8, porcentagemExcessoBruta) : 0;
      const corBarra = porcentagem > 100 ? '#dc2626' : '#f59e0b';
      const porcentagemFormatada = porcentagem.toFixed(0);

      // Buscar pelos pills e encontrar a barra próxima
      tempoPills.forEach((pill) => {
        const itemTarefa = pill.closest('.painel-usuario-tarefa-item-lista, .painel-usuario-tarefa-card');
        if (itemTarefa) {
          const barraContainer = itemTarefa.querySelector('.painel-usuario-barra-progresso-container');
          if (barraContainer) {
            const barraBase = barraContainer.querySelector('.painel-usuario-barra-progresso-base');
            const barraFill = barraBase?.querySelector('.painel-usuario-barra-progresso-fill');
            const barraFillExcesso = barraBase?.querySelector('.painel-usuario-barra-progresso-fill-excesso');
            const barraLabel = barraContainer.querySelector('.painel-usuario-barra-progresso-label');

            if (barraFill) {
              barraFill.style.width = `${porcentagemLimitada}%`;
              barraFill.style.background = corBarra;
            }

            if (porcentagemExcesso > 0) {
              // No modo quadro, usar tamanho fixo para garantir visibilidade
              const isQuadro = barraBase?.classList.contains('painel-usuario-barra-progresso-base-quadro');
              const excedenteWidth = isQuadro ? '25px' : `${porcentagemExcesso}%`;

              if (!barraFillExcesso) {
                // Criar elemento de excesso se não existir
                const excessoEl = document.createElement('div');
                excessoEl.className = 'painel-usuario-barra-progresso-fill-excesso';
                excessoEl.style.width = excedenteWidth;
                excessoEl.style.background = '#dc2626';
                excessoEl.style.left = '100%';
                excessoEl.style.position = 'absolute';
                excessoEl.style.height = '100%';
                if (barraBase) {
                  barraBase.appendChild(excessoEl);
                }
              } else {
                barraFillExcesso.style.width = excedenteWidth;
              }
            } else if (barraFillExcesso) {
              // Remover elemento de excesso se não houver mais excesso
              barraFillExcesso.remove();
            }

            if (barraLabel) {
              barraLabel.textContent = `${porcentagemFormatada}%`;
              barraLabel.style.color = porcentagemFormatada > 100 ? '#dc2626' : '#6b7280';
            }
          }
        }
      });
    }
  }, [criarChaveTempo]);

  // Sincronizar refs com estados
  useEffect(() => {
    timetracksDataRef.current = timetracksData;
  }, [timetracksData]);

  useEffect(() => {
    timetracksExpandidosRef.current = timetracksExpandidos;
  }, [timetracksExpandidos]);

  // Função para buscar registros de tempo individuais de uma tarefa
  const buscarRegistrosTimetrack = useCallback(async (reg) => {
    if (!usuario?.id || !reg.tarefa_id || !reg.cliente_id) return [];

    const chaveTimetrack = criarChaveTempo(reg);
    if (!chaveTimetrack) return [];

    // Verificar se já está no cache (usar ref para acesso síncrono)
    if (timetracksDataRef.current.has(chaveTimetrack)) {
      return timetracksDataRef.current.get(chaveTimetrack);
    }

    try {
      // Extrair data do registro
      let dataParam = '';
      if (reg.data) {
        const dataReg = typeof reg.data === 'string' ? reg.data : reg.data.toISOString();
        const dataStr = dataReg.includes('T') ? dataReg.split('T')[0] : dataReg;
        dataParam = `&data=${dataStr}`;
      }

      // Usar os mesmos critérios do buscarTempoRealizado
      const response = await fetch(
        `/api/registro-tempo/por-tempo-estimado?usuario_id=${usuario.id}&tarefa_id=${reg.tarefa_id}&cliente_id=${reg.cliente_id}${dataParam}`,
        {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const registros = result.data.map(r => {
            let tempo = r.tempo_realizado;
            if (!tempo && r.data_inicio && r.data_fim) {
              const inicio = new Date(r.data_inicio).getTime();
              const fim = new Date(r.data_fim).getTime();
              tempo = Math.max(0, fim - inicio);
            }
            return {
              id: r.id,
              tempo_realizado: tempo || 0,
              data_inicio: r.data_inicio,
              data_fim: r.data_fim,
              created_at: r.created_at
            };
          });

          // Armazenar no cache (tanto no estado quanto na ref)
          const novoMap = new Map(timetracksDataRef.current);
          novoMap.set(chaveTimetrack, registros);
          timetracksDataRef.current = novoMap;
          setTimetracksData(novoMap);

          return registros;
        }
      }
      return [];
    } catch (error) {
      return [];
    }
  }, [criarChaveTempo, usuario]);

  // Função para renderizar lista de timetracks individuais
  const renderizarTimetracksIndividuais = useCallback((reg) => {
    const chaveTimetrack = criarChaveTempo(reg);
    if (!chaveTimetrack) return '';

    // Usar ref para garantir acesso aos dados mais recentes
    const registros = timetracksDataRef.current.get(chaveTimetrack) || [];

    if (registros.length === 0) {
      return '<div style="padding: 8px 0; color: #9ca3af; font-size: 11px; font-style: italic;">Nenhum registro de tempo encontrado</div>';
    }

    return `
      <div class="painel-usuario-timetracks-list" style="display: flex; flex-direction: column; gap: 6px; padding-left: 24px; margin-top: 4px; border-left: 2px solid #ffd8a8;">
        ${registros.map((registro, idx) => {
      const tempoRealizado = Number(registro.tempo_realizado) || 0;
      let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
      if (tempoMs > 0 && tempoMs < 1000) tempoMs = 1000;
      const tempoFormatado = formatarTempoHMS(tempoMs);
      const tempoDecimal = (tempoMs / 3600000).toFixed(2);

      let dataRegistro = null;
      if (registro.data_inicio) {
        dataRegistro = new Date(registro.data_inicio);
      } else if (registro.created_at) {
        dataRegistro = new Date(registro.created_at);
      }

      const dataFormatada = dataRegistro
        ? dataRegistro.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        : '—';

      return `
            <div class="painel-usuario-registro-item-simples" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 6px 8px; color: #374151;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fas fa-play-circle" style="color: #94a3b8;"></i>
                <span class="painel-usuario-registro-tempo-badge" title="${tempoDecimal}h" style="background: #fff4e6; border: 1px solid #ffd8a8; color: #fd7e14; padding: 2px 6px; border-radius: 999px; font-size: 11px; font-weight: 500;">${tempoFormatado}</span>
              </div>
              ${dataFormatada !== '—' ? `<div style="color: #6b7280;">${dataFormatada}</div>` : ''}
            </div>
          `;
    }).join('')}
      </div>
    `;
  }, [timetracksData, formatarTempoHMS, criarChaveTempo]);

  // Função para renderizar barra de progresso de uma tarefa
  const renderizarBarraProgressoTarefa = useCallback((reg, modo = 'quadro') => {
    const tempoEstimado = reg.tempo_estimado_dia || reg.tempo_estimado_total || 0;
    const tempoRealizado = obterTempoRealizadoMs(reg);

    if (tempoEstimado <= 0) {
      return ''; // Não mostrar barra se não houver tempo estimado
    }

    // Calcular porcentagem (realizado / estimado * 100)
    const porcentagem = (tempoRealizado / tempoEstimado) * 100;
    const porcentagemLimitada = Math.min(100, porcentagem); // Limitar a 100% para a barra base
    // Calcular o excedente: se > 100%, mostrar uma barra vermelha adicional
    const porcentagemExcessoBruta = porcentagem > 100 ? porcentagem - 100 : 0;
    const porcentagemExcesso = porcentagemExcessoBruta > 0 ? Math.min(8, porcentagemExcessoBruta) : 0;

    // Cor: laranja padrão (#f59e0b) se <= 100%, vermelho se > 100%
    const corBarra = porcentagem > 100 ? '#dc2626' : '#f59e0b';

    const porcentagemFormatada = porcentagem.toFixed(0);

    if (modo === 'quadro') {
      // No modo quadro, usar tamanho fixo em pixels para o excedente para garantir visibilidade
      // O CSS vai limitar o máximo para não sobrepor a porcentagem
      const excedenteWidth = porcentagemExcessoBruta > 0 ? '25px' : '0px';

      // Modo quadro: barra abaixo do nome
      return `
        <div class="painel-usuario-barra-progresso-wrapper painel-usuario-barra-progresso-quadro" style="margin-top: 8px;">
          <div class="painel-usuario-barra-progresso-container">
            <div class="painel-usuario-barra-progresso-base painel-usuario-barra-progresso-base-quadro">
              <div 
                class="painel-usuario-barra-progresso-fill" 
                style="width: ${porcentagemLimitada}%; background: ${corBarra};"
              ></div>
              ${porcentagemExcessoBruta > 0 ? `
                <div 
                  class="painel-usuario-barra-progresso-fill-excesso" 
                  style="width: ${excedenteWidth}; background: #dc2626; left: 100%;"
                ></div>
              ` : ''}
            </div>
            <div class="painel-usuario-barra-progresso-label" style="color: ${porcentagem > 100 ? '#dc2626' : '#6b7280'};">
              ${porcentagemFormatada}%
            </div>
          </div>
        </div>
      `;
    } else {
      // Modo lista: barra ao lado do tempo realizado
      return `
        <div class="painel-usuario-barra-progresso-wrapper painel-usuario-barra-progresso-lista">
          <div class="painel-usuario-barra-progresso-container">
            <div class="painel-usuario-barra-progresso-base">
              <div 
                class="painel-usuario-barra-progresso-fill" 
                style="width: ${porcentagemLimitada}%; background: ${corBarra};"
              ></div>
              ${porcentagemExcesso > 0 ? `
                <div 
                  class="painel-usuario-barra-progresso-fill-excesso" 
                  style="width: ${porcentagemExcesso}%; background: #dc2626; left: 100%;"
                ></div>
              ` : ''}
            </div>
            <div class="painel-usuario-barra-progresso-label" style="color: ${porcentagem > 100 ? '#dc2626' : '#6b7280'};">
              ${porcentagemFormatada}%
            </div>
          </div>
        </div>
      `;
    }
  }, [obterTempoRealizadoMs]);

  // Função para buscar tempo realizado de uma tarefa específica
  const buscarTempoRealizado = useCallback(async (reg) => {
    if (!usuario?.id) return 0;
    if (!reg.tarefa_id || !reg.cliente_id) return 0;

    // Criar uma chave única para a requisição de tempo
    // Usar cliente_id + tarefa_id como identificador base
    // Incluir data se houver, para diferenciar dias
    let dataPart = '';
    if (reg.data) {
      const dataReg = typeof reg.data === 'string' ? reg.data : reg.data.toISOString();
      dataPart = dataReg.includes('T') ? dataReg.split('T')[0] : dataReg;
    }
    const requestKey = `${reg.cliente_id}_${reg.tarefa_id}_${dataPart}`;

    // Verificar se já está buscando para evitar duplicidade
    if (fetchingTimesRef.current.has(requestKey)) {
      return 0; // Retornar 0 enquanto carrega em outra request
    }

    try {
      fetchingTimesRef.current.add(requestKey);

      // Extrair data do registro
      let dataParam = '';
      if (dataPart) {
        dataParam = `&data=${dataPart}`;
      }

      const response = await fetch(
        `/api/registro-tempo/realizado?usuario_id=${usuario.id}&tarefa_id=${reg.tarefa_id}&cliente_id=${reg.cliente_id}${dataParam}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          return result.data.tempo_realizado_ms || 0;
        }
      }
      return 0;
    } catch (error) {
      return 0;
    } finally {
      fetchingTimesRef.current.delete(requestKey);
    }
  }, [usuario]);

  // Função para iniciar registro de tempo
  const iniciarRegistroTempo = useCallback(async (reg) => {
    if (!usuario?.id) {
      alert('Usuário não encontrado');
      return;
    }

    // Obter o ID do tempo estimado - este é o identificador único
    const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
    if (!tempoEstimadoId) {
      alert('Erro: ID do tempo estimado não encontrado');
      return;
    }

    const tempoEstimadoIdStr = String(tempoEstimadoId).trim();

    // Verificar se já existe registro ativo para este tempo estimado
    if (registrosAtivosRef.current.has(tempoEstimadoIdStr)) {
      return; // Já existe registro ativo para este tempo estimado
    }

    // Atualizar botão imediatamente para estado ativo (sem loading)
    // IMPORTANTE: Atualizar ANTES de fazer a requisição para feedback visual imediato
    atualizarBotaoTempoEstimado(tempoEstimadoId, true);

    try {
      // ANTES DE INICIAR: Parar qualquer registro ativo anterior
      // Não é permitido ter mais de um registro ativo ao mesmo tempo
      if (registrosAtivosRef.current.size > 0) {
        // Encontrar o primeiro registro ativo
        const [tempoEstimadoIdAtivo, registroAtivo] = Array.from(registrosAtivosRef.current.entries())[0];

        // Buscar o registro completo nas tarefas registradas pelo tempo_estimado_id
        const regAtivo = tarefasRegistrosRef.current.find(r => {
          const id = r.id || r.tempo_estimado_id;
          return String(id).trim() === String(tempoEstimadoIdAtivo).trim();
        });

        // Se encontrou o registro completo, parar o registro ativo
        if (regAtivo && registroAtivo?.registro_id) {
          try {
            const response = await fetch(`/api/registro-tempo/finalizar/${registroAtivo.registro_id}`, {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify({
                tarefa_id: String(regAtivo.tarefa_id).trim(),
                usuario_id: parseInt(usuario.id, 10)
              })
            });

            const result = await response.json();

            if (response.ok && result.success) {
              // Remover do estado de registros ativos
              const novoRegistrosAtivos = new Map(registrosAtivosRef.current);
              novoRegistrosAtivos.delete(tempoEstimadoIdAtivo);
              registrosAtivosRef.current = novoRegistrosAtivos;
              setRegistrosAtivos(novoRegistrosAtivos);

              // Atualizar botão do tempo estimado anterior para estado inativo
              atualizarBotaoTempoEstimado(tempoEstimadoIdAtivo, false);

              // Atualizar tempo realizado da tarefa anterior
              const chaveTempoAnterior = criarChaveTempo(regAtivo);
              if (chaveTempoAnterior) {
                const tempoRealizado = await buscarTempoRealizado(regAtivo);
                const novosTempos = new Map(temposRealizadosRef.current);
                novosTempos.set(chaveTempoAnterior, tempoRealizado);
                temposRealizadosRef.current = novosTempos;
                setTemposRealizados(novosTempos);
              }
            }
          } catch (error) {
            // Continua mesmo se houver erro ao parar o anterior
          }
        }
      }

      const response = await fetch('/api/registro-tempo/iniciar', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tarefa_id: String(reg.tarefa_id).trim(),
          cliente_id: String(reg.cliente_id).trim(),
          usuario_id: parseInt(usuario.id, 10),
          produto_id: reg.produto_id ? String(reg.produto_id).trim() : null
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Se o erro for "já existe registro ativo", buscar esse registro e atualizar o botão
        if (result.error && result.error.includes('Já existe um registro de tempo ativo')) {
          // Buscar o registro ativo existente
          try {
            const params = new URLSearchParams({
              usuario_id: usuario.id,
              tarefa_id: reg.tarefa_id,
              cliente_id: reg.cliente_id
            });

            const responseAtivo = await fetch(
              `/api/registro-tempo/ativo?${params}`,
              {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              }
            );

            if (responseAtivo.ok) {
              const resultAtivo = await responseAtivo.json();
              if (resultAtivo.success && resultAtivo.data) {
                // Atualizar estado com o registro ativo existente
                const novoRegistrosAtivos = new Map(registrosAtivosRef.current);
                novoRegistrosAtivos.set(tempoEstimadoIdStr, {
                  registro_id: resultAtivo.data.id,
                  data_inicio: resultAtivo.data.data_inicio
                });
                registrosAtivosRef.current = novoRegistrosAtivos;
                setRegistrosAtivos(novoRegistrosAtivos);

                // Atualizar botão para estado ativo (stop)
                atualizarBotaoTempoEstimado(tempoEstimadoId, true);
                return;
              }
            }
          } catch (error) {
            // Se não conseguir buscar, apenas mostrar o erro
          }
        }

        alert(result.error || 'Erro ao iniciar registro de tempo');
        // Reverter estado do botão apenas se não encontrou registro ativo
        atualizarBotaoTempoEstimado(tempoEstimadoId, false);
        return;
      }

      // Log do ID do registro conforme solicitado


      if (reg.produto_id) {
        // console.log('📦 Produto da tarefa:', reg.produto_id, `(${getNomeProduto(reg.produto_id)})`);
      } else {
        console.warn('⚠️ Tarefa sem produto_id no frontend:', reg.tarefa_id);
      }

      // Atualizar estado com o registro ativo usando tempo_estimado_id como chave
      const novoRegistrosAtivos = new Map(registrosAtivosRef.current);
      novoRegistrosAtivos.set(tempoEstimadoIdStr, {
        registro_id: result.data.id,
        data_inicio: result.data.data_inicio
      });
      registrosAtivosRef.current = novoRegistrosAtivos;
      setRegistrosAtivos(novoRegistrosAtivos);

      // Atualizar apenas o botão específico deste tempo estimado
      atualizarBotaoTempoEstimado(tempoEstimadoId, true);

      // Atualizar tempo realizado
      const chaveTempo = criarChaveTempo(reg);
      if (chaveTempo) {
        const tempoRealizado = await buscarTempoRealizado(reg);
        const novosTempos = new Map(temposRealizadosRef.current);
        novosTempos.set(chaveTempo, tempoRealizado);
        temposRealizadosRef.current = novosTempos;
        setTemposRealizados(novosTempos);
      }

      // Disparar evento para atualizar timer no header
      window.dispatchEvent(new CustomEvent('registro-tempo-iniciado'));

      // [NOVO] Sincronizar todos os registros ativos para garantir que apenas um botão mostre "Stop"
      verificarRegistrosAtivos();
    } catch (error) {
      alert('Erro ao iniciar registro de tempo');
      // Reverter estado do botão em caso de erro
      const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
      if (tempoEstimadoId) {
        atualizarBotaoTempoEstimado(tempoEstimadoId, false);
      }
    }
  }, [usuario, criarChaveTempo, buscarTempoRealizado, atualizarBotaoTempoEstimado]);

  // Função para parar registro de tempo
  const pararRegistroTempo = useCallback(async (reg) => {
    if (!usuario?.id) {
      alert('Usuário não encontrado');
      return;
    }

    // Obter o ID do tempo estimado - este é o identificador único
    const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
    if (!tempoEstimadoId) {
      return;
    }

    const tempoEstimadoIdStr = String(tempoEstimadoId).trim();
    const registroAtivo = registrosAtivosRef.current.get(tempoEstimadoIdStr);

    if (!registroAtivo?.registro_id) {
      return; // Nenhum registro ativo encontrado
    }

    // Atualizar botão imediatamente para estado inativo (sem loading)
    atualizarBotaoTempoEstimado(tempoEstimadoId, false);

    try {
      const response = await fetch(`/api/registro-tempo/finalizar/${registroAtivo.registro_id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tarefa_id: String(reg.tarefa_id).trim(),
          usuario_id: parseInt(usuario.id, 10)
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || 'Erro ao finalizar registro de tempo');
        // Reverter estado do botão
        atualizarBotaoTempoEstimado(tempoEstimadoId, true);
        return;
      }

      // Remover do estado de registros ativos usando tempo_estimado_id
      const novoRegistrosAtivos = new Map(registrosAtivosRef.current);
      novoRegistrosAtivos.delete(tempoEstimadoIdStr);
      registrosAtivosRef.current = novoRegistrosAtivos;
      setRegistrosAtivos(novoRegistrosAtivos);

      // Atualizar apenas o botão específico deste tempo estimado
      atualizarBotaoTempoEstimado(tempoEstimadoId, false);

      // Atualizar tempo realizado
      const chaveTempo = criarChaveTempo(reg);
      if (chaveTempo) {
        const tempoRealizado = await buscarTempoRealizado(reg);
        const novosTempos = new Map(temposRealizadosRef.current);
        novosTempos.set(chaveTempo, tempoRealizado);
        temposRealizadosRef.current = novosTempos;
        setTemposRealizados(novosTempos);

        // Atualizar imediatamente o tempo realizado e a barra de progresso no DOM
        atualizarTempoRealizadoEBarraProgresso(reg, tempoRealizado);
      }

      // Atualizar tempos realizados totais nos headers dos clientes
      atualizarTemposRealizadosHeaders();

      // Disparar evento para atualizar timer no header
      window.dispatchEvent(new CustomEvent('registro-tempo-finalizado'));

      // [NOVO] Sincronizar todos os registros ativos
      verificarRegistrosAtivos();
    } catch (error) {
      alert('Erro ao finalizar registro de tempo');
      // Reverter estado do botão em caso de erro
      const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
      if (tempoEstimadoId) {
        atualizarBotaoTempoEstimado(tempoEstimadoId, true);
      }
    }
  }, [usuario, criarChaveTempo, buscarTempoRealizado, atualizarBotaoTempoEstimado]);

  // Função auxiliar para atualizar tempos realizados totais nos headers dos clientes
  const atualizarTemposRealizadosHeaders = useCallback(() => {
    const temposAtuais = temposRealizadosRef.current;

    // Atualizar headers no modo LISTA
    const headersClientes = document.querySelectorAll('.painel-usuario-grupo-cliente-header');
    headersClientes.forEach((header) => {
      const clienteCard = header.closest('.painel-usuario-cliente-card');
      if (!clienteCard) return;

      // Encontrar todas as tarefas deste cliente
      const tarefasDoCliente = Array.from(clienteCard.querySelectorAll('.painel-usuario-tarefa-item-lista'));
      if (tarefasDoCliente.length === 0) return;

      // Calcular tempo realizado total do cliente
      let tempoRealizadoTotal = 0;
      tarefasDoCliente.forEach((tarefaItem) => {
        const btn = tarefaItem.querySelector('[data-tarefa-id]');
        if (!btn) return;

        const tarefaId = btn.getAttribute('data-tarefa-id');
        const clienteId = btn.getAttribute('data-cliente-id');

        // Encontrar o registro completo para obter tempo_estimado_id
        const reg = tarefasRegistrosRef.current.find(r =>
          String(r.tarefa_id).trim() === tarefaId &&
          String(r.cliente_id).trim() === clienteId
        );

        if (reg) {
          const chaveTempo = criarChaveTempo(reg);
          if (chaveTempo) {
            const tempoRealizado = temposAtuais.get(chaveTempo) || 0;
            tempoRealizadoTotal += tempoRealizado;
          }
        }
      });

      // Atualizar ou criar o elemento de tempo realizado no header
      let tempoRealizadoElement = header.querySelector('.painel-usuario-grupo-tempo-realizado');
      if (tempoRealizadoTotal > 0) {
        const tempoRealizadoFormatado = formatarTempoHMS(tempoRealizadoTotal);
        if (tempoRealizadoElement) {
          // Atualizar elemento existente
          tempoRealizadoElement.innerHTML = `<i class="fas fa-play-circle painel-usuario-realizado-icon-inline" style="margin-right: 4px;"></i>${tempoRealizadoFormatado}`;
        } else {
          // Criar novo elemento
          tempoRealizadoElement = document.createElement('span');
          tempoRealizadoElement.className = 'painel-usuario-grupo-tempo-realizado';
          tempoRealizadoElement.innerHTML = `<i class="fas fa-play-circle painel-usuario-realizado-icon-inline" style="margin-right: 4px;"></i>${tempoRealizadoFormatado}`;

          // Inserir após o tempo estimado (se existir) ou antes do count
          const tempoTotalElement = header.querySelector('.painel-usuario-grupo-tempo-total');
          const countElement = header.querySelector('.painel-usuario-grupo-count');
          if (tempoTotalElement && tempoTotalElement.nextSibling) {
            tempoTotalElement.parentNode.insertBefore(tempoRealizadoElement, tempoTotalElement.nextSibling);
          } else if (countElement) {
            countElement.parentNode.insertBefore(tempoRealizadoElement, countElement);
          } else {
            header.querySelector('.painel-usuario-grupo-cliente-header-left').appendChild(tempoRealizadoElement);
          }
        }
      } else if (tempoRealizadoElement) {
        // Remover elemento se não houver tempo realizado
        tempoRealizadoElement.remove();
      }
    });

    // Atualizar headers no modo QUADRO (colunas)
    const colunas = document.querySelectorAll('.painel-usuario-coluna');
    colunas.forEach((coluna) => {
      const colunaHeader = coluna.querySelector('div[style*="padding: 10px 12px"]');
      if (!colunaHeader) return;

      // Obter o nome do cliente do header
      const clienteNomeEl = colunaHeader.querySelector('div:first-child');
      if (!clienteNomeEl) return;
      const clienteNome = clienteNomeEl.textContent.trim();

      // Encontrar todas as tarefas desta coluna
      const tarefasCards = Array.from(coluna.querySelectorAll('.painel-usuario-tarefa-card'));
      if (tarefasCards.length === 0) return;

      // Calcular tempo realizado total do cliente
      let tempoRealizadoTotal = 0;
      tarefasCards.forEach((tarefaCard) => {
        const btn = tarefaCard.querySelector('[data-tempo-estimado-id]');
        if (!btn) return;

        const tempoEstimadoId = btn.getAttribute('data-tempo-estimado-id');
        if (!tempoEstimadoId) return;

        // Encontrar o registro completo
        const reg = tarefasRegistrosRef.current.find(r =>
          String(r.id || r.tempo_estimado_id).trim() === tempoEstimadoId
        );

        if (reg) {
          const chaveTempo = criarChaveTempo(reg);
          if (chaveTempo) {
            const tempoRealizado = temposAtuais.get(chaveTempo) || 0;
            tempoRealizadoTotal += tempoRealizado;
          }
        }
      });

      // Atualizar o componente React ClienteTempoInfo que está no tempoInfoContainer
      const tempoInfoContainer = colunaHeader.querySelector('div[style*="margin-left: auto"]');
      if (tempoInfoContainer) {
        // O componente React já está renderizado, precisamos re-renderizá-lo com os novos dados
        // Mas como é React, vamos atualizar via DOM direto ou re-renderizar
        // Por enquanto, vamos atualizar diretamente o elemento de tempo realizado se existir
        const tempoRealizadoEl = tempoInfoContainer.querySelector('.painel-usuario-grupo-tempo-realizado');
        if (tempoRealizadoTotal > 0) {
          const tempoRealizadoFormatado = formatarTempoHMS(tempoRealizadoTotal);
          if (tempoRealizadoEl) {
            // Atualizar apenas o texto do tempo, mantendo a estrutura React
            const tempoValorEl = tempoRealizadoEl.querySelector('span:not(.painel-usuario-realizado-icon-inline)');
            if (tempoValorEl) {
              tempoValorEl.textContent = tempoRealizadoFormatado;
            }
          }
        }
      }
    });
  }, [criarChaveTempo, formatarTempoHMS]);

  // Função para buscar tempos realizados de todas as tarefas
  const buscarTemposRealizados = useCallback(async () => {
    if (!usuario?.id || tarefasRegistrosRef.current.length === 0) {
      return;
    }

    try {
      const novosTempos = new Map();

      await Promise.all(
        tarefasRegistrosRef.current.map(async (reg) => {
          const chaveTempo = criarChaveTempo(reg);
          if (!chaveTempo) return;

          const tempoRealizado = await buscarTempoRealizado(reg);
          novosTempos.set(chaveTempo, tempoRealizado);
        })
      );

      temposRealizadosRef.current = novosTempos;
      setTemposRealizados(novosTempos);

      // Atualizar headers dos clientes
      atualizarTemposRealizadosHeaders();
    } catch (error) {
      // Erro ao buscar tempos realizados
    }
  }, [usuario, buscarTempoRealizado, criarChaveTempo, atualizarTemposRealizadosHeaders]);

  // Função para verificar registros ativos ao carregar tarefas
  const verificarRegistrosAtivos = useCallback(async () => {
    if (!usuario?.id || tarefasRegistrosRef.current.length === 0) {
      return;
    }

    try {
      // Otimização: Buscar TODOS os registros ativos do usuário de uma vez só
      const response = await fetch(
        `/api/registro-tempo/ativos?usuario_id=${usuario.id}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const novosRegistrosAtivos = new Map();

          // Mapear os registros ativos retornados pelo backend para as tarefas do frontend
          result.data.forEach(regAtivo => {
            // Encontrar qual(is) registro(s) de tempo estimado correspondem a esta tarefa+cliente
            const tarefaIdAtiva = String(regAtivo.tarefa_id).trim();
            const clienteIdAtivo = String(regAtivo.cliente_id).trim();

            tarefasRegistrosRef.current.forEach(tarefaReg => {
              if (String(tarefaReg.tarefa_id).trim() === tarefaIdAtiva &&
                String(tarefaReg.cliente_id).trim() === clienteIdAtivo) {

                const tempoEstimadoId = tarefaReg.id || tarefaReg.tempo_estimado_id;
                if (tempoEstimadoId) {
                  novosRegistrosAtivos.set(String(tempoEstimadoId).trim(), {
                    registro_id: regAtivo.id,
                    data_inicio: regAtivo.data_inicio
                  });
                }
              }
            });
          });

          registrosAtivosRef.current = novosRegistrosAtivos;
          setRegistrosAtivos(novosRegistrosAtivos);

          // Sincronizar todos os botões após verificar registros ativos
          sincronizarTodosBotoes();
        }
      }
    } catch (error) {
      console.error('Erro ao verificar registros ativos:', error);
    }
  }, [usuario, sincronizarTodosBotoes]);

  const normalizeText = (str) =>
    (str || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const mostrarLoadingNoAlvo = (target) => {
    if (!target) return;
    target.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:13px;">
        Carregando suas tarefas de hoje...
      </div>
    `;
  };

  const obterCardId = () => {
    return CARD_ID_TAREFAS;
  };

  const obterModoVisualizacao = () => {
    // Usar ref para garantir que sempre retorna o modo atual, mesmo durante re-renderizações
    return modoVisualizacaoRef.current[CARD_ID_TAREFAS] || modoVisualizacao[CARD_ID_TAREFAS] || 'quadro';
  };

  // Sincronizar ref com estado sempre que o modo mudar
  useEffect(() => {
    modoVisualizacaoRef.current = modoVisualizacao;
  }, [modoVisualizacao]);

  const alternarModoVisualizacao = useCallback(async (modoDesejado = null) => {
    const cardId = CARD_ID_TAREFAS;

    // Calcular o novo modo
    const modoAtual = modoVisualizacao[cardId] || 'quadro';
    const novoModo = modoDesejado || (modoAtual === 'lista' ? 'quadro' : 'lista');

    // Atualizar o estado do modo imediatamente
    setModoVisualizacao((prev) => {
      return { ...prev, [cardId]: novoModo };
    });

    // Salvar preferência no servidor
    try {
      const response = await fetch(`${API_BASE_URL}/auth/preferencia-view-mode`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modo: novoModo }),
      });

      if (!response.ok) {
        // Erro ao salvar preferência - não crítico
      }
    } catch (error) {
      // Erro ao salvar preferência - não crítico
    }

    // Re-renderizar tarefas imediatamente (sem afetar cards de clientes)
    const card = tarefasContainerRef.current;
    if (card) {
      // Encontrar o wrapper existente
      const wrapper = card.querySelector('div[style*="flex-direction: column"]');
      if (wrapper && tarefasRegistrosRef.current.length > 0) {
        // Obter a data atual do header se disponível
        const header = wrapper.querySelector('.painel-usuario-header-board');
        let dataParaUsar = dataTarefasSelecionada || new Date();

        if (header) {
          const dataDoHeader = obterDataDoHeader(header);
          if (dataDoHeader) {
            dataParaUsar = dataDoHeader;
          }
        }

        // Normalizar a data
        dataParaUsar = new Date(dataParaUsar);
        dataParaUsar.setHours(0, 0, 0, 0);

        // Filtrar registros por clientes selecionados
        // Não usar clientesSelecionadosIds diretamente aqui para evitar dependência
        // A filtragem será feita em renderTarefasNoCard ou será renderizado sem filtro aqui
        let registrosFiltrados = tarefasRegistrosRef.current;

        // Remover containers antigos de tarefas
        const listaContainer = wrapper.querySelector('.painel-usuario-lista-container');
        let boardContainer = null;
        const wrapperChildren = Array.from(wrapper.children);
        for (const child of wrapperChildren) {
          if (child.classList && child.classList.contains('painel-usuario-header-board')) continue;
          const clientesGrid = child.querySelector('.clientes-knowledge-grid');
          if (clientesGrid) continue;
          const style = window.getComputedStyle(child);
          if (style.display === 'flex' && style.gap && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
            boardContainer = child;
            break;
          }
        }

        if (listaContainer) listaContainer.remove();
        if (boardContainer) boardContainer.remove();

        // Atualizar toggle no header IMEDIATAMENTE
        if (header) {
          const toggleView = header.querySelector('.painel-usuario-toggle-view');
          if (toggleView) {
            const btnQuadro = toggleView.querySelector('button[data-mode="quadro"]');
            const btnLista = toggleView.querySelector('button[data-mode="lista"]');

            if (btnQuadro && btnLista) {
              if (novoModo === 'quadro') {
                btnQuadro.classList.add('active');
                btnLista.classList.remove('active');
              } else {
                btnQuadro.classList.remove('active');
                btnLista.classList.add('active');
              }
            }
          }
        }

        // Renderizar tarefas no novo modo IMEDIATAMENTE
        if (novoModo === 'lista') {
          renderTarefasEmLista(registrosFiltrados, wrapper, dataParaUsar);
        } else {
          renderTarefasEmQuadro(registrosFiltrados, wrapper, dataParaUsar);
        }
      } else if (tarefasRegistrosRef.current.length > 0) {
        // Se não encontrar wrapper, fazer renderização completa
        renderTarefasNoCard(tarefasRegistrosRef.current, card, dataTarefasSelecionada);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataTarefasSelecionada, modoVisualizacao]);

  // Função auxiliar para verificar se uma data é hoje
  const ehHoje = (data) => {
    if (!data) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataComparar = new Date(data);
    dataComparar.setHours(0, 0, 0, 0);
    return dataComparar.getTime() === hoje.getTime();
  };

  // Função auxiliar para formatar data para exibição
  const formatarDataExibicao = (data) => {
    if (!data) return 'hoje';
    if (ehHoje(data)) return 'hoje';

    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  // Função para navegar para data anterior
  const navegarDataAnterior = useCallback(() => {
    setDataTarefasSelecionada((dataAtual) => {
      const novaData = new Date(dataAtual);
      novaData.setDate(novaData.getDate() - 1);
      return novaData;
    });
  }, []);

  // Função para navegar para próxima data
  const navegarDataProxima = useCallback(() => {
    setDataTarefasSelecionada((dataAtual) => {
      const novaData = new Date(dataAtual);
      novaData.setDate(novaData.getDate() + 1);
      return novaData;
    });
  }, []);

  // Função auxiliar para obter a data atual do header
  const obterDataDoHeader = (headerElement) => {
    // Tentar obter do atributo data do header
    let dataAtualStr = headerElement.getAttribute('data-data-selecionada');

    // Se não encontrar, tentar obter do elemento dataDisplay (span com a data)
    if (!dataAtualStr) {
      const dataDisplay = headerElement.querySelector('span[data-data-selecionada]');
      if (dataDisplay) {
        dataAtualStr = dataDisplay.getAttribute('data-data-selecionada');
      }
    }

    if (dataAtualStr) {
      return new Date(dataAtualStr);
    }

    // Tentar extrair do texto do elemento dataDisplay
    const dataDisplay = headerElement.querySelector('span[style*="min-width: 80px"]');
    if (dataDisplay) {
      const texto = dataDisplay.textContent || '';
      // Se contém "hoje", retornar hoje
      if (texto.toLowerCase().includes('hoje')) {
        return new Date();
      }
      // Tentar extrair data do formato DD/MM/AAAA
      const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (match) {
        const [, dia, mes, ano] = match;
        return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
      }
    }

    // Fallback: usar estado ou hoje
    return dataTarefasSelecionada || new Date();
  };

  const navigate = useNavigate();

  // Estados para DetailSideCard de clientes
  const [detailCardCliente, setDetailCardCliente] = useState(null);
  const [detailCardClientePosition, setDetailCardClientePosition] = useState(null);

  // Estado para cache de informações de completude dos clientes
  const [informacoesCacheClientes, setInformacoesCacheClientes] = useState({});

  // Estado para cliente selecionado para filtrar tarefas (seleção única)
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState(null);

  // Função para buscar clientes por IDs
  const buscarClientesPorIds = useCallback(async (clienteIds) => {
    if (!clienteIds || clienteIds.length === 0) return [];

    try {
      // Buscar todos os clientes e filtrar pelos IDs
      const response = await fetch('/api/clientes?page=1&limit=10000', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const idsSet = new Set(clienteIds.map(id => String(id).trim()));
          return result.data.filter(cliente => idsSet.has(String(cliente.id).trim()));
        }
      }
    } catch (error) {
      // Erro ao buscar clientes - não crítico
    }
    return [];
  }, []);

  // Carregar informações de completude para múltiplos clientes
  const carregarInformacoesCompletudeClientes = useCallback(async (clientesArray) => {
    if (!clientesArray || clientesArray.length === 0) return;

    const promises = clientesArray.map(async (cliente) => {
      try {
        const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${cliente.id}`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 401) {
          return null;
        }

        if (!response.ok) {
          return null;
        }

        const result = await response.json();
        if (result.success && result.data) {
          return {
            clienteId: cliente.id,
            temConta: (result.data.contasBancarias || []).length > 0,
            temSistema: (result.data.sistemas || []).length > 0,
            temAdquirente: (result.data.adquirentes || []).length > 0
          };
        }
        return null;
      } catch (error) {
        return null;
      }
    });

    const resultados = await Promise.all(promises);
    const novoCache = {};
    resultados.forEach(result => {
      if (result) {
        novoCache[result.clienteId] = {
          temConta: result.temConta,
          temSistema: result.temSistema,
          temAdquirente: result.temAdquirente
        };
      }
    });

    setInformacoesCacheClientes(prev => ({
      ...prev,
      ...novoCache
    }));
  }, []);

  // Buscar dados para o DetailSideCard
  const loadDadosParaCardCliente = useCallback(async (clienteId, tipo) => {
    try {
      const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${clienteId}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Atualizar cache de informações de completude
        setInformacoesCacheClientes(prev => ({
          ...prev,
          [clienteId]: {
            temConta: (result.data.contasBancarias || []).length > 0,
            temSistema: (result.data.sistemas || []).length > 0,
            temAdquirente: (result.data.adquirentes || []).length > 0
          }
        }));

        return result.data;
      }
      return null;
    } catch (error) {
      return null;
    }
  }, []);

  // Handlers para DetailSideCard
  const handleOpenContasCliente = useCallback(async (cliente, e) => {
    const cacheInfo = informacoesCacheClientes[cliente.id];
    if (cacheInfo && cacheInfo.temConta === false) {
      return;
    }

    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;

      setDetailCardClientePosition({
        left: documentLeft + rect.width + 20,
        top: documentTop
      });
    }

    const dados = await loadDadosParaCardCliente(cliente.id, 'contas-bancarias');
    if (dados && dados.contasBancarias && dados.contasBancarias.length > 0) {
      setDetailCardCliente({
        clienteId: cliente.id,
        tipo: 'contas-bancarias',
        dados: { contasBancarias: dados.contasBancarias || [] }
      });
    }
  }, [informacoesCacheClientes, loadDadosParaCardCliente]);

  const handleOpenSistemasCliente = useCallback(async (cliente, e) => {
    const cacheInfo = informacoesCacheClientes[cliente.id];
    if (cacheInfo && cacheInfo.temSistema === false) {
      return;
    }

    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;

      setDetailCardClientePosition({
        left: documentLeft + rect.width + 20,
        top: documentTop
      });
    }

    const dados = await loadDadosParaCardCliente(cliente.id, 'sistemas');
    if (dados && dados.sistemas && dados.sistemas.length > 0) {
      setDetailCardCliente({
        clienteId: cliente.id,
        tipo: 'sistemas',
        dados: { sistemas: dados.sistemas || [] }
      });
    }
  }, [informacoesCacheClientes, loadDadosParaCardCliente]);

  const handleOpenAdquirentesCliente = useCallback(async (cliente, e) => {
    const cacheInfo = informacoesCacheClientes[cliente.id];
    if (cacheInfo && cacheInfo.temAdquirente === false) {
      return;
    }

    if (e) {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const documentLeft = rect.left + scrollLeft;
      const documentTop = rect.top + scrollTop;

      setDetailCardClientePosition({
        left: documentLeft + rect.width + 20,
        top: documentTop
      });
    }

    const dados = await loadDadosParaCardCliente(cliente.id, 'adquirentes');
    if (dados && dados.adquirentes && dados.adquirentes.length > 0) {
      setDetailCardCliente({
        clienteId: cliente.id,
        tipo: 'adquirentes',
        dados: { adquirentes: dados.adquirentes || [] }
      });
    }
  }, [informacoesCacheClientes, loadDadosParaCardCliente]);

  const handleViewKnowledgeCliente = useCallback((cliente) => {
    navigate(`/base-conhecimento/cliente/${cliente.id}`);
  }, [navigate]);

  const handleCloseDetailCliente = useCallback(() => {
    setDetailCardCliente(null);
    setDetailCardClientePosition(null);
  }, []);

  // Handler para selecionar/deselecionar cliente para filtrar tarefas (seleção única)
  const handleSelectCliente = useCallback((clienteId) => {
    setClienteSelecionadoId((prev) => {
      // Se já está selecionado, deselecionar (toggle)
      if (prev && String(prev).trim() === String(clienteId).trim()) {
        return null;
      }
      // Caso contrário, selecionar o novo cliente
      return clienteId;
    });
  }, []);


  // Refs para armazenar dados dos cards de clientes
  const clientesCardsRootRef = useRef(null);
  const clientesCardsContainerRef = useRef(null);
  const clientesCardsDataRef = useRef(null);

  // Função para renderizar cards de clientes usando React
  const renderizarCardsClientes = useCallback((clientes, container) => {
    if (!clientes || clientes.length === 0) {
      if (clientesCardsRootRef.current) {
        try {
          clientesCardsRootRef.current.unmount();
        } catch (e) {
          // Ignorar erros
        }
        clientesCardsRootRef.current = null;
      }
      clientesCardsContainerRef.current = null;
      clientesCardsDataRef.current = null;
      if (container && container.parentNode) {
        container.innerHTML = '';
      }
      return;
    }

    // Verificar se o container ainda está no DOM
    if (!container || !container.parentNode) {
      return;
    }

    // Salvar referências
    clientesCardsContainerRef.current = container;
    clientesCardsDataRef.current = clientes;

    // Limpar root anterior se existir (mas manter o container)
    if (clientesCardsRootRef.current) {
      try {
        clientesCardsRootRef.current.unmount();
      } catch (e) {
        // Ignorar erros ao desmontar
      }
      clientesCardsRootRef.current = null;
    }

    // Limpar apenas o conteúdo HTML, mas manter o container
    container.innerHTML = '';

    // Criar novo root para React
    try {
      const root = createRoot(container);
      clientesCardsRootRef.current = root;

      // Renderizar componente React
      root.render(
        <ClienteKnowledgeCards
          clientes={clientes}
          informacoesCache={informacoesCacheClientes}
          onOpenContas={handleOpenContasCliente}
          onOpenSistemas={handleOpenSistemasCliente}
          onOpenAdquirentes={handleOpenAdquirentesCliente}
          onViewKnowledge={handleViewKnowledgeCliente}
          selectedClienteId={clienteSelecionadoId}
          onSelectCliente={handleSelectCliente}
        />
      );

      // Carregar informações de completude após renderizar
      carregarInformacoesCompletudeClientes(clientes);
    } catch (error) {
      // Erro ao renderizar cards de clientes - não crítico
    }
  }, [informacoesCacheClientes, handleOpenContasCliente, handleOpenSistemasCliente, handleOpenAdquirentesCliente, handleViewKnowledgeCliente, carregarInformacoesCompletudeClientes, clienteSelecionadoId, handleSelectCliente]);

  // Atualizar componente quando cache ou seleção mudar
  useEffect(() => {
    if (clientesCardsRootRef.current && clientesCardsDataRef.current) {
      clientesCardsRootRef.current.render(
        <ClienteKnowledgeCards
          clientes={clientesCardsDataRef.current}
          informacoesCache={informacoesCacheClientes}
          onOpenContas={handleOpenContasCliente}
          onOpenSistemas={handleOpenSistemasCliente}
          onOpenAdquirentes={handleOpenAdquirentesCliente}
          onViewKnowledge={handleViewKnowledgeCliente}
          selectedClienteId={clienteSelecionadoId}
          onSelectCliente={handleSelectCliente}
        />
      );
    }
  }, [informacoesCacheClientes, handleOpenContasCliente, handleOpenSistemasCliente, handleOpenAdquirentesCliente, handleViewKnowledgeCliente, clienteSelecionadoId, handleSelectCliente]);

  // Função para atualizar apenas as tarefas (sem recriar cards de clientes)
  const atualizarApenasTarefas = useCallback((registros, wrapper, dataSelecionada = null) => {
    // Filtrar registros por cliente selecionado (seleção única)
    let registrosFiltrados = registros;
    if (clienteSelecionadoId) {
      const selectedId = String(clienteSelecionadoId).trim();
      registrosFiltrados = registros.filter(reg => {
        const regClienteId = String(reg.cliente_id || '').trim();
        return regClienteId === selectedId;
      });
    }

    // Remover containers antigos de tarefas (preservar header e container de clientes)
    const wrapperChildren = Array.from(wrapper.children);
    const clientesContainerRef = clientesCardsContainerRef.current;

    wrapperChildren.forEach(child => {
      // Preservar header
      if (child.classList && child.classList.contains('painel-usuario-header-board')) return;

      // Preservar container de clientes (o container passado para React, não o div interno)
      if (clientesContainerRef && child === clientesContainerRef) return;

      // Verificar se é container de tarefas (lista ou board)
      const isListaContainer = child.classList && child.classList.contains('painel-usuario-lista-container');
      const style = window.getComputedStyle(child);
      const isBoardContainer = style.display === 'flex' && style.gap && (style.overflowY === 'auto' || style.overflowY === 'scroll');

      if (isListaContainer || isBoardContainer) {
        child.remove();
      }
    });

    // Atualizar contador no header - buscar de forma mais robusta
    const header = wrapper.querySelector('.painel-usuario-header-board');
    if (header) {
      const headerLeft = header.firstElementChild; // Primeiro filho deve ser o headerLeft
      if (headerLeft) {
        // Procurar o subtitle (último filho do headerLeft que tem marginLeft: auto)
        const children = Array.from(headerLeft.children);
        const subtitle = children.find(child => {
          const style = child.style.cssText || window.getComputedStyle(child).cssText;
          return style.includes('margin-left: auto') || style.includes('marginLeft: auto') || child.style.marginLeft === 'auto';
        });

        if (subtitle) {
          // Atualizar apenas o texto, preservando o botão e seus event listeners
          const btnLimpar = subtitle.querySelector('button');

          // Remover apenas os nós de texto
          const textNodes = Array.from(subtitle.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
          textNodes.forEach(node => node.remove());

          // Adicionar o novo texto
          if (btnLimpar) {
            // Se houver botão, adicionar texto após o botão
            subtitle.insertBefore(document.createTextNode(`${registrosFiltrados.length} tarefa(s)`), btnLimpar.nextSibling);
          } else {
            // Se não houver botão, adicionar texto no final
            subtitle.appendChild(document.createTextNode(`${registrosFiltrados.length} tarefa(s)`));
          }
        }
      }

      // Atualizar o toggle para refletir o modo atual
      const toggleView = header.querySelector('.painel-usuario-toggle-view');
      if (toggleView) {
        const modo = obterModoVisualizacao();
        const btnQuadro = toggleView.querySelector('button[data-mode="quadro"]');
        const btnLista = toggleView.querySelector('button[data-mode="lista"]');

        if (btnQuadro && btnLista) {
          // Atualizar classes active
          if (modo === 'quadro') {
            btnQuadro.classList.add('active');
            btnLista.classList.remove('active');
          } else {
            btnQuadro.classList.remove('active');
            btnLista.classList.add('active');
          }
        }
      }
    }

    // Renderizar tarefas novamente
    const modo = obterModoVisualizacao();
    const dataParaRenderizar = dataSelecionada || dataTarefasSelecionada || new Date();

    if (modo === 'lista') {
      renderTarefasEmLista(registrosFiltrados, wrapper, dataParaRenderizar);
    } else {
      renderTarefasEmQuadro(registrosFiltrados, wrapper, dataParaRenderizar);
    }
  }, [clienteSelecionadoId]);

  const renderTarefasNoCard = (registros, target, dataSelecionada = null) => {
    const card = target || tarefasContainerRef.current;
    if (!card) {
      return;
    }

    card.classList.add('painel-usuario-tarefas-content');

    // Verificar se já existe um wrapper com cards de clientes
    let wrapper = card.querySelector('div[style*="flex-direction: column"]');
    let clientesContainer = null;

    if (wrapper) {
      // Se o wrapper já existe, preservar o container de clientes
      // Procurar pelo container que contém os cards de clientes (tem a classe clientes-knowledge-grid)
      const clientesGrid = wrapper.querySelector('.clientes-knowledge-grid');
      if (clientesGrid && clientesGrid.parentNode) {
        clientesContainer = clientesGrid.parentNode;
      } else {
        // Se não encontrar pelo grid, procurar pelo primeiro div que não é header
        clientesContainer = wrapper.querySelector('div[style*="width: 100%"]:not(.painel-usuario-header-board)');
      }

      // Remover apenas o header e as tarefas, mantendo os cards de clientes
      const header = wrapper.querySelector('.painel-usuario-header-board');
      const listaContainer = wrapper.querySelector('.painel-usuario-lista-container');

      // Para o board, procurar de forma mais específica
      let boardContainer = null;
      const wrapperChildren = Array.from(wrapper.children);
      for (const child of wrapperChildren) {
        if (child.classList && child.classList.contains('painel-usuario-header-board')) continue;
        if (child === clientesContainer) continue;
        const style = window.getComputedStyle(child);
        if (style.display === 'flex' && style.gap && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
          boardContainer = child;
          break;
        }
      }

      if (header) header.remove();
      if (listaContainer) listaContainer.remove();
      if (boardContainer) boardContainer.remove();
    } else {
      // Se não existe wrapper, criar um novo (primeira renderização)
      card.innerHTML = '';

      wrapper = document.createElement('div');
      wrapper.style.width = '100%';
      wrapper.style.minHeight = '600px';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '12px';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.minWidth = '0';

      // Criar container para cards de clientes
      clientesContainer = document.createElement('div');
      clientesContainer.style.width = '100%';
      wrapper.appendChild(clientesContainer);
      card.appendChild(wrapper);
    }

    const cardId = obterCardId();
    const modo = obterModoVisualizacao();

    // Filtrar registros por cliente selecionado (seleção única)
    let registrosFiltrados = registros;
    if (clienteSelecionadoId) {
      const selectedId = String(clienteSelecionadoId).trim();
      registrosFiltrados = registros.filter(reg => {
        const regClienteId = String(reg.cliente_id || '').trim();
        return regClienteId === selectedId;
      });
    }

    // Renderizar cards de clientes ANTES das tarefas (apenas se não existirem)
    if (!clientesContainer || !clientesContainer.querySelector('.clientes-knowledge-grid')) {
      // Sempre mostrar todos os clientes que têm tarefas (não filtrar os cards, apenas as tarefas)
      const clientesIdsSet = new Set();
      registros.forEach(reg => {
        if (reg.cliente_id) {
          clientesIdsSet.add(String(reg.cliente_id).trim());
        }
      });

      // Se não existe container, criar um novo
      if (!clientesContainer) {
        clientesContainer = document.createElement('div');
        clientesContainer.style.width = '100%';
        wrapper.insertBefore(clientesContainer, wrapper.firstChild);
      }

      // Buscar e renderizar clientes apenas se ainda não foram renderizados
      if (clientesIdsSet.size > 0 && (!clientesCardsRootRef.current || !clientesCardsDataRef.current)) {
        const clientesIdsArray = Array.from(clientesIdsSet);
        buscarClientesPorIds(clientesIdsArray).then(clientes => {
          // Verificar se o container ainda existe no DOM antes de renderizar
          if (clientes && clientes.length > 0 && clientesContainer && clientesContainer.parentNode) {
            renderizarCardsClientes(clientes, clientesContainer);
          }
        }).catch(error => {
          // Erro ao buscar clientes - não crítico
        });
      }
    }

    const header = document.createElement('div');
    header.className = 'painel-usuario-header-board';

    // Calcular data para exibir ANTES de criar os botões
    const dataParaExibir = dataSelecionada || dataTarefasSelecionada || new Date();
    const dataParaExibirCopy = new Date(dataParaExibir);
    dataParaExibirCopy.setHours(0, 0, 0, 0); // Normalizar para início do dia
    // Armazenar a data no header ANTES de criar os botões
    header.setAttribute('data-data-selecionada', dataParaExibirCopy.toISOString());

    const headerLeft = document.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.flexDirection = 'row';
    headerLeft.style.alignItems = 'center';
    headerLeft.style.gap = '12px';
    headerLeft.style.flex = '1';

    // Título fixo "Minhas tarefas"
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.color = '#111827';
    title.style.fontSize = '14px';
    title.textContent = 'Minhas tarefas';
    headerLeft.appendChild(title);

    // Container para navegação de data (setas + data)
    const navContainer = document.createElement('div');
    navContainer.style.display = 'inline-flex';
    navContainer.style.alignItems = 'center';
    navContainer.style.gap = '6px';

    // Botão de navegação anterior
    const btnAnterior = document.createElement('button');
    btnAnterior.type = 'button';
    btnAnterior.className = 'painel-usuario-nav-date-btn';
    btnAnterior.innerHTML = '<i class="fas fa-chevron-left"></i>';
    btnAnterior.title = 'Data anterior';
    btnAnterior.style.cssText = `
      background: transparent;
      border: none;
      padding: 4px 6px;
      cursor: pointer;
      color: #9ca3af;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-size: 10px;
      border-radius: 4px;
    `;
    btnAnterior.addEventListener('mouseenter', () => {
      btnAnterior.style.background = '#f3f4f6';
      btnAnterior.style.color = '#6b7280';
    });
    btnAnterior.addEventListener('mouseleave', () => {
      btnAnterior.style.background = 'transparent';
      btnAnterior.style.color = '#9ca3af';
    });
    btnAnterior.addEventListener('click', (e) => {
      e.stopPropagation();
      // Obter a data atual sendo exibida no header
      const dataAtual = obterDataDoHeader(header);
      // Calcular data anterior
      const novaData = new Date(dataAtual);
      novaData.setDate(novaData.getDate() - 1);
      novaData.setHours(0, 0, 0, 0); // Normalizar para início do dia
      setDataTarefasSelecionada(novaData);
      // Recarregar tarefas imediatamente usando a ref (sem await para não bloquear)
      if (carregarMinhasTarefasRef.current) {
        carregarMinhasTarefasRef.current(card, novaData);
      }
    });
    navContainer.appendChild(btnAnterior);

    // Função auxiliar para formatar data para input
    function formatDateForInput(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Container para data e calendário
    const dataContainer = document.createElement('div');
    dataContainer.style.position = 'relative';
    dataContainer.style.display = 'inline-block';

    // Data exibida entre as setas
    const dataDisplay = document.createElement('span');
    dataDisplay.style.fontSize = '12px';
    dataDisplay.style.color = '#6b7280';
    dataDisplay.style.fontWeight = '500';
    dataDisplay.style.textAlign = 'center';
    dataDisplay.style.padding = '0 4px';
    dataDisplay.style.display = 'inline-block';
    const textoData = formatarDataExibicao(dataParaExibirCopy);
    dataDisplay.textContent = textoData;
    // Armazenar a data no elemento para uso nos botões
    dataDisplay.setAttribute('data-data-selecionada', dataParaExibirCopy.toISOString());
    navContainer.appendChild(dataDisplay);

    // Botão de calendário
    const btnCalendario = document.createElement('button');
    btnCalendario.type = 'button';
    btnCalendario.className = 'painel-usuario-nav-date-btn';
    btnCalendario.innerHTML = '<i class="fas fa-calendar-alt"></i>';
    btnCalendario.title = 'Selecionar data';
    btnCalendario.style.cssText = `
      background: transparent;
      border: none;
      padding: 4px 6px;
      cursor: pointer;
      color: #9ca3af;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-size: 10px;
      border-radius: 4px;
    `;
    btnCalendario.addEventListener('mouseenter', () => {
      btnCalendario.style.background = '#f3f4f6';
      btnCalendario.style.color = '#6b7280';
    });
    btnCalendario.addEventListener('mouseleave', () => {
      btnCalendario.style.background = 'transparent';
      btnCalendario.style.color = '#9ca3af';
    });

    // Container para o DatePicker (será renderizado via React)
    const datePickerContainer = document.createElement('div');
    datePickerContainer.style.position = 'absolute';
    datePickerContainer.style.top = 'calc(100% + 4px)';
    datePickerContainer.style.left = '50%';
    datePickerContainer.style.transform = 'translateX(-50%)';
    datePickerContainer.style.zIndex = '1000';
    datePickerContainer.style.width = '280px';
    datePickerContainer.style.visibility = 'hidden';
    datePickerContainer.style.opacity = '0';
    datePickerContainer.style.pointerEvents = 'none';
    datePickerContainer.style.transition = 'opacity 0.2s ease, visibility 0.2s ease';

    // Renderizar apenas o calendário (sem o campo de input)
    const datePickerRoot = createRoot(datePickerContainer);

    // Componente customizado que renderiza apenas o calendário (sem periodo-select-display)
    const CalendarOnly = ({ value, onChange, onClose }) => {
      const [currentMonth, setCurrentMonth] = useState(() => {
        if (value) {
          const dateObj = new Date(value + 'T00:00:00');
          if (!isNaN(dateObj.getTime())) {
            return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
          }
        }
        return new Date();
      });

      const formatDateForInput = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const isSameDay = (date1, date2) => {
        return date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate();
      };

      const handleDateClick = (date) => {
        const dateStr = formatDateForInput(date);
        if (onChange) {
          onChange({ target: { value: dateStr } });
        }
        if (onClose) {
          onClose();
        }
      };

      const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
      };

      const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
      };

      const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
          'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        const monthYear = `${monthNames[month]} de ${year}`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days = [];

        // Dias vazios do início
        for (let i = 0; i < firstDayWeekday; i++) {
          days.push(React.createElement('div', { key: `empty-${i}`, className: 'periodo-calendar-day empty' }));
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = new Date(year, month, day);
          let dayClasses = 'periodo-calendar-day';

          // Verificar se é a data selecionada
          if (value) {
            const selectedDate = new Date(value + 'T00:00:00');
            const selectedDateObj = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
            const isSelected = isSameDay(currentDate, selectedDateObj);

            if (isSelected) {
              dayClasses += ' selected';
            }
          }

          days.push(
            React.createElement('div', {
              key: day,
              className: dayClasses,
              onClick: () => handleDateClick(currentDate)
            }, day)
          );
        }

        return { monthYear, days };
      };

      const { monthYear, days } = renderCalendar();

      return React.createElement('div', {
        className: 'periodo-dropdown',
        onClick: (e) => e.stopPropagation(),
        style: { position: 'relative', display: 'block' }
      }, React.createElement('div', { className: 'periodo-dropdown-content' },
        React.createElement('div', { style: { padding: '12px' } },
          React.createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }
          },
            React.createElement('i', {
              className: 'fas fa-calendar-alt',
              style: { color: '#4b5563', fontSize: '14px' }
            }),
            React.createElement('span', {
              style: { fontWeight: 600, color: '#111827', fontSize: '13px' }
            }, 'Selecionar data')
          ),
          React.createElement('div', { className: 'periodo-calendar-container' },
            React.createElement('div', { className: 'periodo-calendar-header' },
              React.createElement('button', {
                className: 'periodo-calendar-nav',
                type: 'button',
                onClick: handlePrevMonth
              }, React.createElement('i', { className: 'fas fa-chevron-left' })),
              React.createElement('span', { className: 'periodo-calendar-month-year' }, monthYear),
              React.createElement('button', {
                className: 'periodo-calendar-nav',
                type: 'button',
                onClick: handleNextMonth
              }, React.createElement('i', { className: 'fas fa-chevron-right' }))
            ),
            React.createElement('div', { className: 'periodo-calendar-weekdays' },
              React.createElement('div', null, 'D'),
              React.createElement('div', null, 'S'),
              React.createElement('div', null, 'T'),
              React.createElement('div', null, 'Q'),
              React.createElement('div', null, 'Q'),
              React.createElement('div', null, 'S'),
              React.createElement('div', null, 'S')
            ),
            React.createElement('div', { className: 'periodo-calendar-days' }, days)
          )
        )
      ));
    };

    // Função para atualizar o calendário
    const updateCalendar = (dataAtual) => {
      const dataStrAtual = formatDateForInput(dataAtual);
      datePickerRoot.render(
        React.createElement(CalendarOnly, {
          value: dataStrAtual,
          onChange: (e) => {
            const novaDataStr = e.target.value;
            const novaData = new Date(novaDataStr + 'T00:00:00');
            novaData.setHours(0, 0, 0, 0);
            setDataTarefasSelecionada(novaData);
            if (carregarMinhasTarefasRef.current) {
              carregarMinhasTarefasRef.current(card, novaData);
            }
            datePickerContainer.style.visibility = 'hidden';
            datePickerContainer.style.opacity = '0';
            datePickerContainer.style.pointerEvents = 'none';
          },
          onClose: () => {
            datePickerContainer.style.visibility = 'hidden';
            datePickerContainer.style.opacity = '0';
            datePickerContainer.style.pointerEvents = 'none';
          }
        })
      );
    };

    // Renderizar inicialmente
    updateCalendar(dataParaExibirCopy);

    // Ao clicar no botão de calendário, mostrar o DatePicker
    let closeHandler = null;
    btnCalendario.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = datePickerContainer.style.visibility !== 'hidden';
      if (!isVisible) {
        // Atualizar com a data atual antes de mostrar
        const dataAtual = obterDataDoHeader(header);
        updateCalendar(dataAtual);
        datePickerContainer.style.visibility = 'visible';
        datePickerContainer.style.opacity = '1';
        datePickerContainer.style.pointerEvents = 'auto';

        // Remover handler anterior se existir
        if (closeHandler) {
          document.removeEventListener('mousedown', closeHandler);
        }

        // Fechar ao clicar fora
        closeHandler = (event) => {
          if (!dataContainer.contains(event.target) && !datePickerContainer.contains(event.target)) {
            datePickerContainer.style.visibility = 'hidden';
            datePickerContainer.style.opacity = '0';
            datePickerContainer.style.pointerEvents = 'none';
            document.removeEventListener('mousedown', closeHandler);
            closeHandler = null;
          }
        };
        setTimeout(() => {
          document.addEventListener('mousedown', closeHandler);
        }, 100);
      } else {
        datePickerContainer.style.visibility = 'hidden';
        datePickerContainer.style.opacity = '0';
        datePickerContainer.style.pointerEvents = 'none';
        if (closeHandler) {
          document.removeEventListener('mousedown', closeHandler);
          closeHandler = null;
        }
      }
    });

    navContainer.appendChild(btnCalendario);

    dataContainer.appendChild(datePickerContainer);
    navContainer.appendChild(dataContainer);

    // Botão de navegação próxima
    const btnProxima = document.createElement('button');
    btnProxima.type = 'button';
    btnProxima.className = 'painel-usuario-nav-date-btn';
    btnProxima.innerHTML = '<i class="fas fa-chevron-right"></i>';
    btnProxima.title = 'Próxima data';
    btnProxima.style.cssText = `
      background: transparent;
      border: none;
      padding: 4px 6px;
      cursor: pointer;
      color: #9ca3af;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-size: 10px;
      border-radius: 4px;
    `;
    btnProxima.addEventListener('mouseenter', () => {
      btnProxima.style.background = '#f3f4f6';
      btnProxima.style.color = '#6b7280';
    });
    btnProxima.addEventListener('mouseleave', () => {
      btnProxima.style.background = 'transparent';
      btnProxima.style.color = '#9ca3af';
    });
    btnProxima.addEventListener('click', (e) => {
      e.stopPropagation();
      // Obter a data atual sendo exibida no header
      const dataAtual = obterDataDoHeader(header);
      // Calcular próxima data
      const novaData = new Date(dataAtual);
      novaData.setDate(novaData.getDate() + 1);
      novaData.setHours(0, 0, 0, 0); // Normalizar para início do dia
      setDataTarefasSelecionada(novaData);
      // Recarregar tarefas imediatamente usando a ref (sem await para não bloquear)
      if (carregarMinhasTarefasRef.current) {
        carregarMinhasTarefasRef.current(card, novaData);
      }
    });
    navContainer.appendChild(btnProxima);

    headerLeft.appendChild(navContainer);

    // Subtítulo com quantidade de tarefas (na mesma linha)
    const subtitle = document.createElement('div');
    subtitle.style.fontSize = '12px';
    subtitle.style.color = '#6b7280';
    subtitle.style.display = 'flex';
    subtitle.style.alignItems = 'center';
    subtitle.style.gap = '8px';
    subtitle.style.marginLeft = 'auto';

    subtitle.appendChild(document.createTextNode(`${registrosFiltrados.length} tarefa(s)`));
    headerLeft.appendChild(subtitle);

    header.appendChild(headerLeft);

    const toggleView = document.createElement('div');
    toggleView.className = 'painel-usuario-toggle-view';

    const btnQuadro = document.createElement('button');
    btnQuadro.type = 'button';
    btnQuadro.className = `painel-usuario-toggle-btn ${modo === 'quadro' ? 'active' : ''}`;
    btnQuadro.setAttribute('data-mode', 'quadro');
    btnQuadro.title = 'Visualização em Quadro';
    btnQuadro.innerHTML = '<i class="fas fa-th-large"></i><span>Quadro</span>';
    btnQuadro.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarModoVisualizacao('quadro');
    });
    toggleView.appendChild(btnQuadro);

    const btnLista = document.createElement('button');
    btnLista.type = 'button';
    btnLista.className = `painel-usuario-toggle-btn ${modo === 'lista' ? 'active' : ''}`;
    btnLista.setAttribute('data-mode', 'lista');
    btnLista.title = 'Visualização em Lista';
    btnLista.innerHTML = '<i class="fas fa-list"></i><span>Lista</span>';
    btnLista.addEventListener('click', (e) => {
      e.stopPropagation();
      alternarModoVisualizacao('lista');
    });
    toggleView.appendChild(btnLista);

    header.appendChild(toggleView);

    // Inserir header após o container de clientes (se existir) ou no início
    if (clientesContainer && clientesContainer.parentNode === wrapper) {
      wrapper.insertBefore(header, clientesContainer.nextSibling);
    } else {
      wrapper.appendChild(header);
    }

    // Renderizar baseado no modo (usar registros filtrados)
    const dataParaRenderizar = dataSelecionada || dataTarefasSelecionada || new Date();
    if (modo === 'lista') {
      renderTarefasEmLista(registrosFiltrados, wrapper, dataParaRenderizar);
    } else {
      renderTarefasEmQuadro(registrosFiltrados, wrapper, dataParaRenderizar);
    }

    // Garantir que o wrapper está no card (apenas se for primeira renderização)
    if (!card.contains(wrapper)) {
      card.appendChild(wrapper);
    }
  };

  const toggleClienteLista = useCallback((clienteNome) => {
    const estavaExpandido = clientesExpandidosLista.has(clienteNome);

    setClientesExpandidosLista((prev) => {
      const novo = new Set(prev);
      if (novo.has(clienteNome)) {
        novo.delete(clienteNome);
      } else {
        novo.add(clienteNome);
      }
      return novo;
    });

    // Se está expandindo (não estava expandido antes), fazer scroll suave para o header
    if (!estavaExpandido) {
      // Aguardar um pouco para o DOM atualizar após a expansão
      setTimeout(() => {
        // Encontrar o header pelo texto do título
        const headers = document.querySelectorAll('.painel-usuario-grupo-cliente-header');
        let targetHeader = null;
        headers.forEach((header) => {
          const titleElement = header.querySelector('.painel-usuario-grupo-title');
          if (titleElement && titleElement.textContent.trim() === clienteNome) {
            targetHeader = header;
          }
        });

        if (targetHeader) {
          // Encontrar o container scrollável (lista-container)
          const listaContainer = targetHeader.closest('.painel-usuario-lista-container');
          if (listaContainer) {
            const headerRect = targetHeader.getBoundingClientRect();
            const containerRect = listaContainer.getBoundingClientRect();

            // Calcular a posição do header relativa ao container
            const headerTopRelative = targetHeader.offsetTop;
            const containerScrollTop = listaContainer.scrollTop;
            const containerHeight = listaContainer.clientHeight;

            // Se o header está fora da área visível (acima ou muito abaixo), fazer scroll
            const headerVisibleTop = headerTopRelative - containerScrollTop;
            const headerVisibleBottom = headerVisibleTop + headerRect.height;

            if (headerVisibleTop < 0 || headerVisibleBottom > containerHeight) {
              // Fazer scroll para mostrar o header com uma margem de 20px do topo
              listaContainer.scrollTo({
                top: Math.max(0, headerTopRelative - 20),
                behavior: 'smooth'
              });
            }
          }
        }
      }, 150); // Aguardar um pouco mais para garantir que o DOM foi atualizado
    }
  }, [clientesExpandidosLista]);

  const renderTarefasEmLista = (registros, wrapper, dataSelecionada = null) => {
    const lista = document.createElement('div');
    lista.className = 'painel-usuario-lista-container';
    lista.style.flex = '1';
    lista.style.display = 'flex';
    lista.style.flexDirection = 'column';
    lista.style.gap = '0';

    if (registros.length === 0) {
      const vazio = document.createElement('div');
      vazio.style.color = '#6b7280';
      vazio.style.fontSize = '13px';
      vazio.style.textAlign = 'center';
      vazio.style.padding = '20px';
      const dataParaExibir = dataSelecionada || dataTarefasSelecionada || new Date();
      const textoData = formatarDataExibicao(dataParaExibir);
      if (textoData === 'hoje') {
        vazio.textContent = 'Nenhuma tarefa para hoje.';
      } else {
        vazio.textContent = `Sem tarefas para ${textoData}.`;
      }
      lista.appendChild(vazio);
    } else {
      // Agrupar por cliente
      const gruposPorCliente = registros.reduce((acc, reg) => {
        const clienteNome = reg.cliente_nome || reg.cliente || getNomeCliente(reg.cliente_id);
        // Só agrupar se tiver um nome válido (não vazio e não contém "#")
        if (clienteNome && clienteNome.trim() && !clienteNome.includes('#')) {
          if (!acc[clienteNome]) acc[clienteNome] = [];
          acc[clienteNome].push(reg);
        } else if (reg.cliente_id) {
          // Se não tiver nome ainda, disparar busca e usar um grupo temporário
          buscarNomeCliente(reg.cliente_id).catch(() => { });
          const tempKey = `_loading_${reg.cliente_id}`;
          if (!acc[tempKey]) acc[tempKey] = [];
          acc[tempKey].push(reg);
        }
        return acc;
      }, {});

      Object.entries(gruposPorCliente).forEach(([clienteNome, items]) => {
        // Pular grupos temporários de carregamento
        if (clienteNome.startsWith('_loading_')) return;
        const isExpanded = clientesExpandidosLista.has(clienteNome);

        // Calcular tempo estimado total do cliente
        const tempoTotal = items.reduce((sum, reg) => {
          const tempo = reg.tempo_estimado_dia || reg.tempo_estimado_total || 0;
          const valor = Number(tempo) || 0;
          return sum + (valor >= 1000 ? valor / 3600000 : valor);
        }, 0);
        // Converter horas decimais para milissegundos e formatar em hora/minuto
        const tempoTotalMs = tempoTotal * 3600000;
        const tempoTotalFormatado = formatarTempoHMS(tempoTotalMs);

        // Calcular tempo realizado total do cliente
        const tempoRealizadoTotal = items.reduce((sum, reg) => {
          const chaveTempo = criarChaveTempo(reg);
          if (!chaveTempo) return sum;
          const tempoRealizadoMs = temposRealizadosRef.current.get(chaveTempo) || 0;
          return sum + tempoRealizadoMs;
        }, 0);
        const tempoRealizadoFormatado = formatarTempoHMS(tempoRealizadoTotal);

        // Card wrapper para o grupo de cliente
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'painel-usuario-cliente-card';

        // Grupo de cliente
        const grupoDiv = document.createElement('div');
        grupoDiv.className = 'painel-usuario-grupo-cliente';

        // Header do grupo
        const header = document.createElement('div');
        header.className = 'painel-usuario-grupo-cliente-header';
        header.style.cursor = 'pointer';
        header.style.pointerEvents = 'auto';
        header.innerHTML = `
          <div class="painel-usuario-grupo-cliente-header-left">
            <i class="fas fa-chevron-${isExpanded ? 'down' : 'right'}" style="color: #64748b; font-size: 12px; width: 16px; display: flex; align-items: center; justify-content: center;"></i>
            <span class="painel-usuario-grupo-badge-orange">CLIENTE</span>
            <h3 class="painel-usuario-grupo-title">${clienteNome}</h3>
            ${tempoTotal > 0 ? `<span class="painel-usuario-grupo-tempo-total"><i class="fas fa-clock" style="color: #0e3b6f; font-size: 12px; margin-right: 4px;"></i>${tempoTotalFormatado}</span>` : ''}
            ${tempoRealizadoTotal > 0 ? `<span class="painel-usuario-grupo-tempo-realizado"><i class="fas fa-play-circle painel-usuario-realizado-icon-inline" style="margin-right: 4px;"></i>${tempoRealizadoFormatado}</span>` : ''}
            <span class="painel-usuario-grupo-count">Tarefas: ${items.length}</span>
          </div>
        `;
        // Garantir que o header capture cliques corretamente
        header.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          toggleClienteLista(clienteNome);
        });
        // Também adicionar no mousedown para garantir
        header.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
        grupoDiv.appendChild(header);

        // Conteúdo expandido
        if (isExpanded) {
          const content = document.createElement('div');
          content.className = 'painel-usuario-grupo-cliente-content';
          content.style.background = '#ffffff';
          // Garantir que o content não bloqueie cliques no header
          content.style.pointerEvents = 'auto';

          // Limitar a 6 tarefas visíveis e adicionar scroll se houver mais
          const maxTarefasVisiveis = 6;
          const temMaisTarefas = items.length > maxTarefasVisiveis;

          if (temMaisTarefas) {
            // Adicionar classe para scroll interno
            content.classList.add('painel-usuario-grupo-cliente-content-scroll');
          }

          // Buscar todas as subtarefas em paralelo antes de renderizar
          const tarefaIdsUnicos = [...new Set(items.map(reg => reg.tarefa_id).filter(id => id))];
          const promessasSubtarefas = tarefaIdsUnicos.map(tarefaId =>
            buscarSubtarefas(tarefaId).catch(err => {
              console.error(`Erro ao buscar subtarefas para tarefa ${tarefaId}:`, err);
              return [];
            })
          );

          // Iniciar busca em paralelo (não aguardar para renderizar)
          Promise.all(promessasSubtarefas).then(() => {
            // Após todas as buscas, atualizar contadores de todos os items
            items.forEach((reg) => {
              const chaveSubtarefas = criarChaveSubtarefas(reg);
              const subtarefas = subtarefasCacheRef.current.get(String(reg.tarefa_id));
              if (subtarefas && subtarefas.length > 0) {
                const pendentes = contarSubtarefasPendentes(subtarefas, chaveSubtarefas);
                // Buscar o item pelo wrapper de subtarefas que tem o data-tarefa-id
                const itemElement = content.querySelector(`.painel-usuario-subtarefas-wrapper[data-tarefa-id="${reg.tarefa_id}"]`)?.closest('.painel-usuario-tarefa-item-lista');
                if (itemElement) {
                  const countElement = itemElement.querySelector(`.painel-usuario-subtarefas-count`);
                  if (countElement) {
                    countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                    if (pendentes === 0) {
                      countElement.style.color = '#10b981';
                    } else {
                      countElement.style.color = '#f59e0b';
                    }
                  }
                }
              }
            });
          });

          // Renderizar todas as tarefas, mas o CSS vai limitar a altura
          items.forEach((reg, index) => {
            const item = document.createElement('div');
            item.className = 'painel-usuario-tarefa-item-lista';
            item.style.border = '1px solid rgb(238, 242, 247)';
            item.style.borderRadius = '12px';
            item.style.padding = '12px';
            item.style.margin = '8px 20px';
            item.style.background = '#ffffff';
            // Garantir que o item não capture cliques que devem ir para o header
            item.style.pointerEvents = 'auto';
            // CRÍTICO: Cada tempo estimado é totalmente independente
            // Usar o ID do tempo estimado como identificador único
            const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
            if (!tempoEstimadoId) {
              return; // Pular este registro se não tiver ID
            }

            const tempoEstimadoIdStr = String(tempoEstimadoId).trim();
            const registroAtivo = registrosAtivosRef.current.get(tempoEstimadoIdStr);
            const isAtivo = !!registroAtivo;
            // Verificar se é tarefa de outra data
            const checkDataHoje = () => {
              if (!reg.data) return true;
              const hoje = new Date();

              if (typeof reg.data === 'string') {
                // Tentar extrair YYYY-MM-DD para evitar problemas de fuso horário
                const dataPart = reg.data.split('T')[0];
                const hojePart = hoje.getFullYear() + '-' +
                  String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
                  String(hoje.getDate()).padStart(2, '0');
                return dataPart === hojePart;
              }

              const dataTarefa = new Date(reg.data);
              return dataTarefa.getDate() === hoje.getDate() &&
                dataTarefa.getMonth() === hoje.getMonth() &&
                dataTarefa.getFullYear() === hoje.getFullYear();
            };

            const isHoje = checkDataHoje();

            // Se não for hoje, bloqueia sempre
            const isBloqueado = !isHoje;

            // Só exibe como ativo (botão stop) se for hoje E estiver ativo
            const mostrarComoAtivo = isHoje && isAtivo;

            const btnClass = mostrarComoAtivo
              ? 'painel-usuario-stop-btn'
              : (isBloqueado ? 'painel-usuario-play-btn painel-usuario-btn-disabled' : 'painel-usuario-play-btn');

            const btnIcon = mostrarComoAtivo ? 'fa-stop' : 'fa-play';

            const btnTitle = mostrarComoAtivo
              ? 'Parar registro de tempo'
              : (isBloqueado ? 'Não é possível plugar em tarefas de outra data' : 'Iniciar registro de tempo');

            const btnAction = mostrarComoAtivo ? 'parar' : 'iniciar';

            // Verificar se é uma tarefa "Interna UP"
            const isInternaUp = internaUpTaskIds.has(String(reg.tarefa_id).trim());

            // Só aplica o verde se for "Interna UP" E não estiver bloqueado
            // Se estiver bloqueado ("isBloqueado" = true), deve continuar cinza, como já definido no `btnStyle` original
            let btnStyle = isBloqueado ? 'background-color: #e5e7eb; color: #9ca3af; cursor: not-allowed; border-color: #d1d5db;' : '';
            if (isInternaUp && !isBloqueado) {
              btnStyle = 'background-color: #28a745 !important; color: #fff; border: none; border-radius: 50%; width: 21px; height: 21px; min-width: 21px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 0;';
            }

            const btnDisabledAttr = isBloqueado ? 'disabled="disabled"' : '';

            item.innerHTML = `
              <div class="painel-usuario-tarefa-item-lista-content">
                <div class="painel-usuario-tarefa-item-lista-main">
                  <div class="painel-usuario-tarefa-item-lista-left">
                    <div class="painel-usuario-tarefa-nome">
                      ${getNomeTarefa(reg.tarefa_id, reg)}
                      ${reg.produto_id ? `<span class="painel-usuario-tarefa-produto"> - ${getNomeProduto(reg.produto_id)}</span>` : ''}
                      ${reg.is_plug_rapido ? `<span style="background-color: #ecfdf5; color: #059669; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid #a7f3d0; margin-left: 8px; display: inline-block; vertical-align: middle;" title="Tarefa criada via Plug Rápido">Plug Rápido</span>` : ''}
                    </div>
                    ${renderizarBarraProgressoTarefa(reg, 'lista')}
                  </div>
                  <div style="display: flex; gap: 6px; align-items: center;">
              <button
                type="button"
                style="${btnStyle}"
                class="${btnClass}"
                title="${btnTitle}"
                data-tempo-estimado-id="${tempoEstimadoIdStr}"
                data-action="${btnAction}"
                ${btnDisabledAttr}
              >
                    <i class="fas ${btnIcon}" style="${isInternaUp && !isBloqueado ? 'color: #fff;' : ''}"></i>
                  </button>
                  </div>
                </div>
                <div class="painel-usuario-tarefa-tags painel-usuario-tarefa-tags-lista">
                  <span class="painel-usuario-badge-estimado">
                    <i class="fas fa-clock painel-usuario-estimado-icon-inline"></i>
                    <span class="painel-usuario-estimado-label">Estimado:</span>
                    <span class="painel-usuario-estimado-pill">
                      ${formatarTempoComCusto(reg.tempo_estimado_dia || reg.tempo_estimado_total || 0)}
                    </span>
                  </span>
                  <span class="painel-usuario-badge-realizado">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <i class="fas fa-play-circle painel-usuario-realizado-icon-inline"></i>
                      <span class="painel-usuario-realizado-label">Realizado:</span>
                      <span class="painel-usuario-realizado-pill" data-tarefa-id="${reg.tarefa_id}" data-cliente-id="${reg.cliente_id}">${obterTempoRealizadoFormatado(reg)}</span>
                      ${(() => {
                const chaveTimetrack = criarChaveTempo(reg);
                const isTimetrackExpanded = timetracksExpandidos.has(chaveTimetrack);
                return `
                          <i
                            class="fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'} painel-usuario-timetrack-arrow"
                            data-chave-timetrack="${chaveTimetrack}"
                            style="cursor: pointer; color: #64748b; font-size: 10px; margin-left: 4px; transition: transform 0.2s ease; display: inline-block;"
                            title="${isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais'}"
                          ></i>
                        `;
              })()}
                    </div>
                    ${(() => {
                const chaveSubtarefas = criarChaveSubtarefas(reg);
                const subtarefas = subtarefasCacheRef.current.get(String(reg.tarefa_id));
                const pendentes = subtarefas ? contarSubtarefasPendentes(subtarefas, chaveSubtarefas) : (subtarefas && subtarefas.length > 0 ? subtarefas.length : 0);
                const isSubtarefasExpanded = subtarefasExpandidasRef.current.has(chaveSubtarefas);
                // Sempre mostrar o contador, mesmo que seja 0 ou ainda não tenha carregado
                return `
                        <div class="painel-usuario-subtarefas-info">
                          <span class="painel-usuario-subtarefas-count" style="color: ${pendentes === 0 && subtarefas ? '#10b981' : '#f59e0b'};" data-tarefa-id="${reg.tarefa_id}">${subtarefas ? `${pendentes} pendente${pendentes !== 1 ? 's' : ''}` : '...'}</span>
                          <i
                            class="fas fa-chevron-${isSubtarefasExpanded ? 'down' : 'right'} painel-usuario-subtarefas-arrow"
                            data-chave-subtarefas="${chaveSubtarefas}"
                            data-tarefa-id="${reg.tarefa_id}"
                            style="cursor: pointer; color: #64748b; font-size: 10px; transition: transform 0.2s ease; display: inline-block;"
                            title="${isSubtarefasExpanded ? 'Ocultar subtarefas' : 'Ver subtarefas'}"
                          ></i>
                        </div>
                  `;
              })()}
              </span>
            </div>
            <div class="painel-usuario-timetracks-container">
              ${(() => {
                const chaveTimetrack = criarChaveTempo(reg);
                const isTimetrackExpanded = timetracksExpandidos.has(chaveTimetrack);
                return isTimetrackExpanded ? renderizarTimetracksIndividuais(reg) : '';
              })()}
            </div>
            <div class="painel-usuario-subtarefas-wrapper" data-chave-subtarefas="${criarChaveSubtarefas(reg)}" data-tarefa-id="${reg.tarefa_id}" style="display: none;">
            </div>
              </div>
            `;

            // Verificar se já temos subtarefas no cache e atualizar contador imediatamente
            const chaveSubtarefas = criarChaveSubtarefas(reg);
            const subtarefasNoCache = subtarefasCacheRef.current.get(String(reg.tarefa_id));
            if (subtarefasNoCache && subtarefasNoCache.length > 0) {
              const pendentes = contarSubtarefasPendentes(subtarefasNoCache, chaveSubtarefas);
              const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
              if (countElement) {
                countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                if (pendentes === 0) {
                  countElement.style.color = '#10b981';
                } else {
                  countElement.style.color = '#f59e0b';
                }
              }
            }

            // Configurar wrapper de subtarefas
            const subtarefasWrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chaveSubtarefas}"]`);
            if (subtarefasWrapper) {
              // Função helper para alternar estado de uma subtarefa
              const alternarSubtarefa = (subtarefaId, chave, tarefaIdVal, subtarefasVal) => {
                // Sempre pegar o estado mais atualizado do ref
                const estadoAtual = subtarefasConcluidasRef.current.get(chave) || new Set();
                const concluidas = new Set(estadoAtual); // Criar uma cópia
                const subtarefaIdStr = String(subtarefaId);

                // Alternar apenas esta subtarefa específica
                if (concluidas.has(subtarefaIdStr)) {
                  concluidas.delete(subtarefaIdStr);
                  salvarStatusChecklist(chave, subtarefaIdStr, false);
                } else {
                  concluidas.add(subtarefaIdStr);
                  salvarStatusChecklist(chave, subtarefaIdStr, true);
                }

                // Atualizar o estado e o ref simultaneamente
                const novoMap = new Map(subtarefasConcluidasRef.current);
                novoMap.set(chave, concluidas);
                subtarefasConcluidasRef.current = novoMap; // Atualizar ref imediatamente
                setSubtarefasConcluidas(novoMap);

                // Atualizar renderização
                const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chave}"]`);
                if (wrapper) {
                  wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chave);
                  // Reaplicar listeners
                  adicionarListenersBolinhas(wrapper, tarefaIdVal, chave, subtarefasVal);
                }

                // Atualizar contador
                const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
                if (countElement) {
                  const pendentes = contarSubtarefasPendentes(subtarefasVal, chave);
                  countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                  if (pendentes === 0) {
                    countElement.style.color = '#10b981';
                  } else {
                    countElement.style.color = '#f59e0b';
                  }
                }
              };

              // Função helper para adicionar listeners nas bolinhas, nomes e botões de descrição
              const adicionarListenersBolinhas = (wrapperEl, tarefaIdVal, chaveVal, subtarefasVal) => {
                // Listeners nas bolinhas
                wrapperEl.querySelectorAll('.painel-usuario-subtarefa-bolinha').forEach(bolinha => {
                  bolinha.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const subtarefaId = this.getAttribute('data-subtarefa-id');
                    alternarSubtarefa(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                  });
                });

                // Listeners nos nomes
                wrapperEl.querySelectorAll('.painel-usuario-subtarefa-nome').forEach(nome => {
                  nome.style.cursor = 'pointer';
                  nome.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const itemEl = this.closest('.painel-usuario-subtarefa-item');
                    if (itemEl) {
                      const subtarefaId = itemEl.getAttribute('data-subtarefa-id');
                      alternarSubtarefa(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                    }
                  });
                });

                // Listeners nos botões de descrição
                wrapperEl.querySelectorAll('.painel-usuario-subtarefa-descricao-btn').forEach(btn => {
                  btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const subtarefaId = this.getAttribute('data-subtarefa-id');
                    const subtarefaIdStr = String(subtarefaId);
                    const estavaExpandida = descricoesSubtarefasExpandidasRef.current.has(subtarefaIdStr);
                    const novoExpandidas = new Set(descricoesSubtarefasExpandidasRef.current);

                    if (estavaExpandida) {
                      novoExpandidas.delete(subtarefaIdStr);
                    } else {
                      novoExpandidas.add(subtarefaIdStr);
                    }

                    descricoesSubtarefasExpandidasRef.current = novoExpandidas;
                    setDescricoesSubtarefasExpandidas(novoExpandidas);

                    // Re-renderizar as subtarefas para atualizar a descrição
                    const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chaveVal}"]`);
                    if (wrapper) {
                      wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chaveVal);
                      adicionarListenersBolinhas(wrapper, tarefaIdVal, chaveVal, subtarefasVal);
                    }
                  });
                });
              };

              // Verificar se já temos subtarefas e renderizar se expandido
              const subtarefas = subtarefasCacheRef.current.get(String(reg.tarefa_id));
              if (subtarefas && subtarefas.length > 0) {
                const isExpanded = subtarefasExpandidasRef.current.has(chaveSubtarefas);
                if (isExpanded) {
                  subtarefasWrapper.innerHTML = renderizarSubtarefas(subtarefas, reg.tarefa_id, chaveSubtarefas);
                  subtarefasWrapper.style.display = 'block';
                  adicionarListenersBolinhas(subtarefasWrapper, reg.tarefa_id, chaveSubtarefas, subtarefas);
                } else {
                  subtarefasWrapper.style.display = 'none';
                }
              }
            }

            // Atualizar contador quando as subtarefas forem carregadas (se ainda não estiverem no cache)
            (async () => {
              const subtarefas = await buscarSubtarefas(reg.tarefa_id);

              // Atualizar contador quando subtarefas forem carregadas
              if (subtarefas && subtarefas.length > 0) {
                const pendentes = contarSubtarefasPendentes(subtarefas, chaveSubtarefas);
                const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
                if (countElement) {
                  countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                  if (pendentes === 0) {
                    countElement.style.color = '#10b981';
                  } else {
                    countElement.style.color = '#f59e0b';
                  }
                }
              }
            })();

            // Adicionar event listener à setinha de subtarefas
            const subtarefasArrow = item.querySelector('.painel-usuario-subtarefas-arrow');
            if (subtarefasArrow) {
              const arrowClone = subtarefasArrow.cloneNode(true);
              subtarefasArrow.parentNode.replaceChild(arrowClone, subtarefasArrow);

              arrowClone.addEventListener('click', async (e) => {
                e.stopPropagation();
                const chave = arrowClone.getAttribute('data-chave-subtarefas');
                const tarefaId = arrowClone.getAttribute('data-tarefa-id');
                if (!chave) return;

                const estavaExpandido = subtarefasExpandidasRef.current.has(chave);
                const novoExpandidos = new Set(subtarefasExpandidasRef.current);

                if (estavaExpandido) {
                  novoExpandidos.delete(chave);
                } else {
                  novoExpandidos.add(chave);
                  await carregarStatusChecklist(chave);
                }

                subtarefasExpandidasRef.current = novoExpandidos;
                setSubtarefasExpandidas(novoExpandidos);

                const isExpanded = novoExpandidos.has(chave);
                const subtarefasWrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chave}"]`);

                if (isExpanded) {
                  let subtarefas = subtarefasCacheRef.current.get(String(tarefaId));
                  if (!subtarefas) {
                    subtarefas = await buscarSubtarefas(tarefaId);
                  }
                  if (subtarefas && subtarefas.length > 0) {
                    subtarefasWrapper.innerHTML = renderizarSubtarefas(subtarefas, tarefaId, chave);
                    subtarefasWrapper.style.display = 'block';

                    // Função helper para alternar estado de uma subtarefa (lista - expandir)
                    const alternarSubtarefaArrow = (subtarefaId, chave, tarefaIdVal, subtarefasVal) => {
                      // Sempre pegar o estado mais atualizado do ref
                      const estadoAtual = subtarefasConcluidasRef.current.get(chave) || new Set();
                      const concluidas = new Set(estadoAtual); // Criar uma cópia
                      const subtarefaIdStr = String(subtarefaId);

                      // Alternar apenas esta subtarefa específica
                      if (concluidas.has(subtarefaIdStr)) {
                        concluidas.delete(subtarefaIdStr);
                        salvarStatusChecklist(chave, subtarefaIdStr, false);
                      } else {
                        concluidas.add(subtarefaIdStr);
                        salvarStatusChecklist(chave, subtarefaIdStr, true);
                      }

                      // Atualizar o estado e o ref simultaneamente
                      const novoMap = new Map(subtarefasConcluidasRef.current);
                      novoMap.set(chave, concluidas);
                      subtarefasConcluidasRef.current = novoMap; // Atualizar ref imediatamente
                      setSubtarefasConcluidas(novoMap);

                      const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chave}"]`);
                      if (wrapper) {
                        wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chave);
                        adicionarListenersBolinhasArrow(wrapper, tarefaIdVal, chave, subtarefasVal);
                      }

                      // Atualizar contador
                      const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
                      if (countElement) {
                        const pendentes = contarSubtarefasPendentes(subtarefasVal, chave);
                        countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                        if (pendentes === 0) {
                          countElement.style.color = '#10b981';
                        } else {
                          countElement.style.color = '#f59e0b';
                        }
                      }
                    };

                    // Função helper para adicionar listeners nas bolinhas, nomes e botões de descrição (lista - expandir)
                    const adicionarListenersBolinhasArrow = (wrapperEl, tarefaIdVal, chaveVal, subtarefasVal) => {
                      // Listeners nas bolinhas
                      wrapperEl.querySelectorAll('.painel-usuario-subtarefa-bolinha').forEach(bolinha => {
                        bolinha.addEventListener('click', function (e) {
                          e.stopPropagation();
                          const subtarefaId = this.getAttribute('data-subtarefa-id');
                          alternarSubtarefaArrow(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                        });
                      });

                      // Listeners nos nomes
                      wrapperEl.querySelectorAll('.painel-usuario-subtarefa-nome').forEach(nome => {
                        nome.style.cursor = 'pointer';
                        nome.addEventListener('click', function (e) {
                          e.stopPropagation();
                          const itemEl = this.closest('.painel-usuario-subtarefa-item');
                          if (itemEl) {
                            const subtarefaId = itemEl.getAttribute('data-subtarefa-id');
                            alternarSubtarefaArrow(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                          }
                        });
                      });

                      // Listeners nos botões de descrição
                      wrapperEl.querySelectorAll('.painel-usuario-subtarefa-descricao-btn').forEach(btn => {
                        btn.addEventListener('click', function (e) {
                          e.stopPropagation();
                          const subtarefaId = this.getAttribute('data-subtarefa-id');
                          const subtarefaIdStr = String(subtarefaId);
                          const estavaExpandida = descricoesSubtarefasExpandidasRef.current.has(subtarefaIdStr);
                          const novoExpandidas = new Set(descricoesSubtarefasExpandidasRef.current);

                          if (estavaExpandida) {
                            novoExpandidas.delete(subtarefaIdStr);
                          } else {
                            novoExpandidas.add(subtarefaIdStr);
                          }

                          descricoesSubtarefasExpandidasRef.current = novoExpandidas;
                          setDescricoesSubtarefasExpandidas(novoExpandidas);

                          // Re-renderizar as subtarefas para atualizar a descrição
                          const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chaveVal}"]`);
                          if (wrapper) {
                            wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chaveVal);
                            adicionarListenersBolinhasArrow(wrapper, tarefaIdVal, chaveVal, subtarefasVal);
                          }
                        });
                      });
                    };

                    adicionarListenersBolinhasArrow(subtarefasWrapper, tarefaId, chave, subtarefas);
                  }
                } else {
                  subtarefasWrapper.style.display = 'none';
                }

                // Atualizar ícone da setinha
                arrowClone.className = `fas fa-chevron-${isExpanded ? 'down' : 'right'} painel-usuario-subtarefas-arrow`;
                arrowClone.setAttribute('title', isExpanded ? 'Ocultar subtarefas' : 'Ver subtarefas');
              });
            }

            // Adicionar event listener ao botão play/stop
            const btn = item.querySelector(`button[data-action]`);
            if (btn) {
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const action = btn.getAttribute('data-action');
                // Obter o tempo_estimado_id do botão - este é o identificador único
                const tempoEstimadoIdDoBotao = btn.getAttribute('data-tempo-estimado-id');
                if (!tempoEstimadoIdDoBotao) {
                  return;
                }
                // Garantir que o reg tenha o tempo_estimado_id correto
                const regComTempoEstimado = {
                  ...reg,
                  id: tempoEstimadoIdDoBotao,
                  tempo_estimado_id: tempoEstimadoIdDoBotao
                };
                if (action === 'iniciar') {
                  iniciarRegistroTempo(regComTempoEstimado);
                } else if (action === 'parar') {
                  pararRegistroTempo(regComTempoEstimado);
                }
              });
            }

            // Adicionar event listener à setinha de expandir timetrack
            const expandArrow = item.querySelector('.painel-usuario-timetrack-arrow');
            if (expandArrow) {
              // Remover listeners anteriores para evitar duplicação
              const newExpandArrow = expandArrow.cloneNode(true);
              expandArrow.parentNode.replaceChild(newExpandArrow, expandArrow);

              newExpandArrow.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const chave = newExpandArrow.getAttribute('data-chave-timetrack');
                if (!chave) return;

                // Usar ref para verificar estado atual (mais confiável)
                const estavaExpandido = timetracksExpandidosRef.current.has(chave);
                const novoExpandidos = new Set(timetracksExpandidosRef.current);

                if (estavaExpandido) {
                  novoExpandidos.delete(chave);
                } else {
                  novoExpandidos.add(chave);
                }

                // Atualizar ref imediatamente
                timetracksExpandidosRef.current = novoExpandidos;
                // Atualizar estado (para sincronizar com React)
                setTimetracksExpandidos(novoExpandidos);

                const isTimetrackExpanded = novoExpandidos.has(chave);

                // Se está expandindo, buscar dados se necessário
                if (isTimetrackExpanded && !timetracksDataRef.current.has(chave)) {
                  await buscarRegistrosTimetrack(reg);
                  await new Promise(resolve => setTimeout(resolve, 10));
                }

                // Renderizar timetracks
                const timetracksHtml = isTimetrackExpanded ? renderizarTimetracksIndividuais(reg) : '';

                // Encontrar o container de timetracks dentro do item-lista-content
                const itemContent = item.querySelector('.painel-usuario-tarefa-item-lista-content');
                let timetracksContainer = itemContent ? itemContent.querySelector('.painel-usuario-timetracks-container') : null;

                if (!timetracksContainer && itemContent) {
                  // Se não existe, criar e adicionar após os tags, mas antes das subtarefas
                  timetracksContainer = document.createElement('div');
                  timetracksContainer.className = 'painel-usuario-timetracks-container';
                  const tagsContainer = itemContent.querySelector('.painel-usuario-tarefa-tags');
                  const subtarefasWrapper = itemContent.querySelector('.painel-usuario-subtarefas-wrapper');

                  if (tagsContainer && tagsContainer.parentNode) {
                    // Se existe subtarefas wrapper, inserir antes dele, senão inserir após tags
                    if (subtarefasWrapper && subtarefasWrapper.parentNode) {
                      subtarefasWrapper.parentNode.insertBefore(timetracksContainer, subtarefasWrapper);
                    } else {
                      tagsContainer.parentNode.insertBefore(timetracksContainer, tagsContainer.nextSibling);
                    }
                  } else {
                    itemContent.appendChild(timetracksContainer);
                  }
                }

                if (timetracksContainer) {
                  timetracksContainer.innerHTML = timetracksHtml;
                }

                // Atualizar ícone da setinha
                newExpandArrow.className = `fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'} painel-usuario-timetrack-arrow`;
                newExpandArrow.setAttribute('title', isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais');
              });
            }

            // Garantir que cliques no item não bloqueiem o header
            item.addEventListener('click', (e) => {
              // Se não foi o botão que foi clicado, não fazer nada (deixar propagar)
              if (e.target !== btn && !btn.contains(e.target) && !newExpandArrow.contains(e.target)) {
                // Não fazer nada - deixar o evento propagar normalmente
                return;
              }
            });

            content.appendChild(item);
          });

          grupoDiv.appendChild(content);
        }

        cardWrapper.appendChild(grupoDiv);
        lista.appendChild(cardWrapper);
      });
    }

    wrapper.appendChild(lista);
  };

  const renderTarefasEmQuadro = (registros, target, dataSelecionada = null) => {
    // Se receber o card principal, encontrar o wrapper interno
    let wrapper = target;
    if (target && target.classList && target.classList.contains('painel-usuario-tarefas-content')) {
      wrapper = target.querySelector('div[style*="flex-direction: column"]');
    }

    // Se ainda não tiver wrapper, usar renderTarefasNoCard que cria a estrutura correta
    if (!wrapper) {
      renderTarefasNoCard(registros, target, dataSelecionada);
      return;
    }

    // Remover boardContainer existente para evitar duplicação
    const wrapperChildren = Array.from(wrapper.children);
    for (const child of wrapperChildren) {
      if (child.classList && child.classList.contains('painel-usuario-header-board')) continue;
      const clientesGrid = child.querySelector('.clientes-knowledge-grid');
      if (clientesGrid) continue;
      const style = window.getComputedStyle(child);
      if (style.display === 'flex' && style.gap && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
        child.remove();
        break;
      }
    }

    const board = document.createElement('div');
    board.style.flex = '1';
    board.style.overflowY = 'auto';
    board.style.overflowX = 'auto'; // Permite scroll horizontal quando há muitos clientes
    board.style.display = 'flex';
    board.style.gap = '12px';
    board.style.alignItems = 'flex-start';

    if (registros.length === 0) {
      const vazio = document.createElement('div');
      vazio.style.color = '#6b7280';
      vazio.style.fontSize = '13px';
      vazio.style.textAlign = 'center';
      vazio.style.padding = '10px';
      const dataParaExibir = dataSelecionada || dataTarefasSelecionada || new Date();
      const textoData = formatarDataExibicao(dataParaExibir);
      if (textoData === 'hoje') {
        vazio.textContent = 'Nenhuma tarefa para hoje.';
      } else {
        vazio.textContent = `Sem tarefas para ${textoData}.`;
      }
      board.appendChild(vazio);
    } else {
      // Agrupar por cliente
      const gruposPorCliente = registros.reduce((acc, reg) => {
        const clienteNome = reg.cliente_nome || reg.cliente || getNomeCliente(reg.cliente_id);
        // Só agrupar se tiver um nome válido (não vazio e não contém "#")
        if (clienteNome && clienteNome.trim() && !clienteNome.includes('#')) {
          if (!acc[clienteNome]) acc[clienteNome] = [];
          acc[clienteNome].push(reg);
        } else if (reg.cliente_id) {
          // Se não tiver nome ainda, disparar busca e usar um grupo temporário
          buscarNomeCliente(reg.cliente_id).catch(() => { });
          const tempKey = `_loading_${reg.cliente_id}`;
          if (!acc[tempKey]) acc[tempKey] = [];
          acc[tempKey].push(reg);
        }
        return acc;
      }, {});

      Object.entries(gruposPorCliente).forEach(([clienteNome, items]) => {
        // Pular grupos temporários de carregamento
        if (clienteNome.startsWith('_loading_')) return;
        // Calcular tempo estimado total do cliente
        const tempoTotal = items.reduce((sum, reg) => {
          const tempo = reg.tempo_estimado_dia || reg.tempo_estimado_total || 0;
          const valor = Number(tempo) || 0;
          return sum + (valor >= 1000 ? valor / 3600000 : valor);
        }, 0);

        // Calcular tempo realizado total do cliente
        const tempoRealizadoTotal = items.reduce((sum, reg) => {
          const chaveTempo = criarChaveTempo(reg);
          if (!chaveTempo) return sum;
          const tempoRealizadoMs = temposRealizadosRef.current.get(chaveTempo) || 0;
          return sum + tempoRealizadoMs;
        }, 0);

        const coluna = document.createElement('div');
        coluna.className = 'painel-usuario-coluna';
        coluna.style.minWidth = '240px';
        coluna.style.maxWidth = 'none'; // Permitir expansão total para caber nome e dados
        coluna.style.flex = '0 0 auto'; // Mudar para auto para permitir expansão baseada no conteúdo
        coluna.style.width = 'auto'; // Permitir largura automática até o máximo
        coluna.style.display = 'flex';
        coluna.style.flexDirection = 'column';

        const colunaHeader = document.createElement('div');
        colunaHeader.style.padding = '10px 12px';
        colunaHeader.style.borderBottom = '1px solid #e5e7eb';
        colunaHeader.style.fontWeight = '700';
        colunaHeader.style.fontSize = '13px';
        colunaHeader.style.color = '#111827';
        colunaHeader.style.display = 'flex';
        colunaHeader.style.flexDirection = 'row';
        colunaHeader.style.alignItems = 'center';
        colunaHeader.style.justifyContent = 'space-between';
        colunaHeader.style.gap = '12px';
        colunaHeader.style.flexWrap = 'nowrap'; // Mudar para nowrap para manter tudo na mesma linha
        colunaHeader.style.minWidth = '0'; // Permitir que o flex item encolha se necessário

        // Nome do cliente
        const clienteNomeEl = document.createElement('div');
        clienteNomeEl.textContent = clienteNome;
        clienteNomeEl.style.flex = '1'; // Permitir que o nome ocupe o espaço disponível
        clienteNomeEl.style.minWidth = '0'; // Necessário para flex item
        clienteNomeEl.style.whiteSpace = 'nowrap'; // Não quebrar o nome
        // clienteNomeEl.style.overflow = 'hidden'; // Removido para não truncar
        // clienteNomeEl.style.textOverflow = 'ellipsis'; // Removido para não truncar
        colunaHeader.appendChild(clienteNomeEl);

        // Container para as informações de tempo (na mesma linha, alinhado à direita)
        const tempoInfoContainer = document.createElement('div');
        tempoInfoContainer.style.display = 'flex';
        tempoInfoContainer.style.alignItems = 'center';
        tempoInfoContainer.style.gap = '8px';
        tempoInfoContainer.style.flexWrap = 'nowrap'; // Mudar para nowrap para manter tudo na mesma linha
        tempoInfoContainer.style.marginLeft = '8px'; // Margem fixa em relação ao nome
        tempoInfoContainer.style.flexShrink = '0'; // Não encolher o container de tempo
        colunaHeader.appendChild(tempoInfoContainer);

        // Renderizar componente React de informações de tempo
        const root = createRoot(tempoInfoContainer);
        root.render(
          <ClienteTempoInfo
            tempoEstimadoTotal={tempoTotal}
            tempoRealizadoTotal={tempoRealizadoTotal}
            quantidadeTarefas={items.length}
            formatarTempoHMS={formatarTempoHMS}
            modoQuadro={true}
          />
        );

        coluna.appendChild(colunaHeader);

        const colunaBody = document.createElement('div');
        colunaBody.className = 'painel-usuario-coluna-body';
        colunaBody.style.padding = '10px';
        colunaBody.style.display = 'flex';
        colunaBody.style.flexDirection = 'column';
        colunaBody.style.gap = '8px';

        items.forEach((reg) => {
          const item = document.createElement('div');
          item.className = 'painel-usuario-tarefa-card';
          // CRÍTICO: Cada tempo estimado é totalmente independente
          // Usar o ID do tempo estimado como identificador único
          const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
          if (!tempoEstimadoId) {
            return; // Pular este registro se não tiver ID
          }

          const tempoEstimadoIdStr = String(tempoEstimadoId).trim();
          const registroAtivo = registrosAtivosRef.current.get(tempoEstimadoIdStr);
          const isAtivo = !!registroAtivo;

          // Verificar se é tarefa de outra data
          const checkDataHoje = () => {
            if (!reg.data) return true;
            const hoje = new Date();

            if (typeof reg.data === 'string') {
              const dataPart = reg.data.split('T')[0];
              const hojePart = hoje.getFullYear() + '-' +
                String(hoje.getMonth() + 1).padStart(2, '0') + '-' +
                String(hoje.getDate()).padStart(2, '0');
              return dataPart === hojePart;
            }

            const dataTarefa = new Date(reg.data);
            return dataTarefa.getDate() === hoje.getDate() &&
              dataTarefa.getMonth() === hoje.getMonth() &&
              dataTarefa.getFullYear() === hoje.getFullYear();
          };

          const isHoje = checkDataHoje();

          // Se não for hoje, bloqueia sempre
          const isBloqueado = !isHoje;

          // Só exibe como ativo (botão stop) se for hoje E estiver ativo
          const mostrarComoAtivo = isHoje && isAtivo;

          const btnClass = mostrarComoAtivo
            ? 'painel-usuario-stop-btn'
            : (isBloqueado ? 'painel-usuario-play-btn painel-usuario-btn-disabled' : 'painel-usuario-play-btn');

          const btnIcon = mostrarComoAtivo ? 'fa-stop' : 'fa-play';

          const btnTitle = mostrarComoAtivo
            ? 'Parar registro de tempo'
            : (isBloqueado ? 'Não é possível plugar em tarefas de outra data' : 'Iniciar registro de tempo');

          const btnAction = mostrarComoAtivo ? 'parar' : 'iniciar';

          // Verificar se é uma tarefa "Interna UP"
          const isInternaUp = internaUpTaskIds.has(String(reg.tarefa_id).trim());

          // Só aplica o verde se for "Interna UP" E não estiver bloqueado
          let btnStyle = isBloqueado ? 'background-color: #e5e7eb; color: #9ca3af; cursor: not-allowed; border-color: #d1d5db;' : '';
          if (isInternaUp && !isBloqueado) {
            btnStyle = 'background-color: #28a745 !important; color: #fff; border: none; border-radius: 50%; width: 21px; height: 21px; min-width: 21px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); padding: 0;';
          }

          const btnDisabledAttr = isBloqueado ? 'disabled="disabled"' : '';

          const chaveTimetrack = criarChaveTempo(reg);
          const isTimetrackExpanded = timetracksExpandidos.has(chaveTimetrack);

          item.innerHTML = `
            <div class="painel-usuario-tarefa-top">
              <div class="painel-usuario-tarefa-nome">
                ${getNomeTarefa(reg.tarefa_id, reg)}
                ${reg.produto_id ? `<span class="painel-usuario-tarefa-produto"> - ${getNomeProduto(reg.produto_id)}</span>` : ''}
                ${reg.is_plug_rapido ? `<span style="background-color: #ecfdf5; color: #059669; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid #a7f3d0; margin-left: 8px; display: inline-block; vertical-align: middle;" title="Tarefa criada via Plug Rápido">Plug Rápido</span>` : ''}
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
              <button
                type="button"
                style="${btnStyle}"
                class="${btnClass}"
                title="${btnTitle}"
                data-tempo-estimado-id="${tempoEstimadoIdStr}"
                data-action="${btnAction}"
                ${btnDisabledAttr}
              >
                      <i class="fas ${btnIcon}" style="${isInternaUp && !isBloqueado ? 'color: #fff;' : ''}"></i>
                    </button>
            </div>
            </div>
            ${renderizarBarraProgressoTarefa(reg, 'quadro')}
            <div class="painel-usuario-tarefa-tags">
              <span class="painel-usuario-badge-estimado">
                <i class="fas fa-clock painel-usuario-estimado-icon-inline"></i>
                <span class="painel-usuario-estimado-label">Estimado:</span>
                <span class="painel-usuario-estimado-pill">
                  ${formatarTempoComCusto(reg.tempo_estimado_dia || reg.tempo_estimado_total || 0)}
                </span>
              </span>
              <span class="painel-usuario-badge-realizado">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <i class="fas fa-play-circle painel-usuario-realizado-icon-inline"></i>
                  <span class="painel-usuario-realizado-label">Realizado:</span>
                  <span class="painel-usuario-realizado-pill" data-tarefa-id="${reg.tarefa_id}" data-cliente-id="${reg.cliente_id}">${obterTempoRealizadoFormatado(reg)}</span>
                  <i 
                    class="fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'} painel-usuario-timetrack-arrow"
                    data-chave-timetrack="${chaveTimetrack}"
                    style="cursor: pointer; color: #64748b; font-size: 10px; margin-left: 4px; transition: transform 0.2s ease; display: inline-block;"
                    title="${isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais'}"
                  ></i>
                </div>
                ${(() => {
              const chaveSubtarefas = criarChaveSubtarefas(reg);
              const subtarefas = subtarefasCacheRef.current.get(String(reg.tarefa_id));
              const pendentes = subtarefas ? contarSubtarefasPendentes(subtarefas, chaveSubtarefas) : (subtarefas && subtarefas.length > 0 ? subtarefas.length : 0);
              const isSubtarefasExpanded = subtarefasExpandidasRef.current.has(chaveSubtarefas);
              // Sempre mostrar o contador, mesmo que seja 0 ou ainda não tenha carregado
              return `
                    <div class="painel-usuario-subtarefas-info">
                      <span class="painel-usuario-subtarefas-count" style="color: ${pendentes === 0 && subtarefas ? '#10b981' : '#f59e0b'};" data-tarefa-id="${reg.tarefa_id}">${subtarefas ? `${pendentes} pendente${pendentes !== 1 ? 's' : ''}` : '...'}</span>
                      <i 
                        class="fas fa-chevron-${isSubtarefasExpanded ? 'down' : 'right'} painel-usuario-subtarefas-arrow"
                        data-chave-subtarefas="${chaveSubtarefas}"
                        data-tarefa-id="${reg.tarefa_id}"
                        style="cursor: pointer; color: #64748b; font-size: 10px; transition: transform 0.2s ease; display: inline-block;"
                        title="${isSubtarefasExpanded ? 'Ocultar subtarefas' : 'Ver subtarefas'}"
                      ></i>
                    </div>
                  `;
            })()}
              </span>
            </div>
            <div class="painel-usuario-timetracks-container">
              ${isTimetrackExpanded ? renderizarTimetracksIndividuais(reg) : ''}
            </div>
            <div class="painel-usuario-subtarefas-wrapper" data-chave-subtarefas="${criarChaveSubtarefas(reg)}" data-tarefa-id="${reg.tarefa_id}" style="display: none;">
            </div>
          `;

          // Buscar e renderizar subtarefas após criar o item
          const chaveSubtarefas = criarChaveSubtarefas(reg);
          (async () => {
            const subtarefas = await buscarSubtarefas(reg.tarefa_id);

            // Atualizar contador quando subtarefas forem carregadas
            if (subtarefas && subtarefas.length > 0) {
              const pendentes = contarSubtarefasPendentes(subtarefas, chaveSubtarefas);
              const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
              if (countElement) {
                countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                if (pendentes === 0) {
                  countElement.style.color = '#10b981';
                } else {
                  countElement.style.color = '#f59e0b';
                }
              }
            }

            const subtarefasWrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chaveSubtarefas}"]`);
            if (subtarefasWrapper && subtarefas && subtarefas.length > 0) {
              const isExpanded = subtarefasExpandidasRef.current.has(chaveSubtarefas);
              if (isExpanded) {
                subtarefasWrapper.innerHTML = renderizarSubtarefas(subtarefas, reg.tarefa_id, chaveSubtarefas);
                subtarefasWrapper.style.display = 'block';
              } else {
                subtarefasWrapper.style.display = 'none';
              }

              // Função helper para alternar estado de uma subtarefa (quadro)
              const alternarSubtarefaQuadro = (subtarefaId, chave, tarefaIdVal, subtarefasVal) => {
                // Sempre pegar o estado mais atualizado do ref
                const estadoAtual = subtarefasConcluidasRef.current.get(chave) || new Set();
                const concluidas = new Set(estadoAtual); // Criar uma cópia
                const subtarefaIdStr = String(subtarefaId);

                // Alternar apenas esta subtarefa específica
                if (concluidas.has(subtarefaIdStr)) {
                  concluidas.delete(subtarefaIdStr);
                  salvarStatusChecklist(chave, subtarefaIdStr, false);
                } else {
                  concluidas.add(subtarefaIdStr);
                  salvarStatusChecklist(chave, subtarefaIdStr, true);
                }

                // Atualizar o estado e o ref simultaneamente
                const novoMap = new Map(subtarefasConcluidasRef.current);
                novoMap.set(chave, concluidas);
                subtarefasConcluidasRef.current = novoMap; // Atualizar ref imediatamente
                setSubtarefasConcluidas(novoMap);

                const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chave}"]`);
                if (wrapper) {
                  wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chave);
                  adicionarListenersBolinhasQuadro(wrapper, tarefaIdVal, chave, subtarefasVal);
                }

                // Atualizar contador
                const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
                if (countElement) {
                  const pendentes = contarSubtarefasPendentes(subtarefasVal, chave);
                  countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                  if (pendentes === 0) {
                    countElement.style.color = '#10b981';
                  } else {
                    countElement.style.color = '#f59e0b';
                  }
                }
              };

              // Função helper para adicionar listeners nas bolinhas, nomes e botões de descrição (visualização quadro)
              const adicionarListenersBolinhasQuadro = (wrapperEl, tarefaIdVal, chaveVal, subtarefasVal) => {
                // Listeners nas bolinhas
                wrapperEl.querySelectorAll('.painel-usuario-subtarefa-bolinha').forEach(bolinha => {
                  bolinha.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const subtarefaId = this.getAttribute('data-subtarefa-id');
                    alternarSubtarefaQuadro(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                  });
                });

                // Listeners nos nomes
                wrapperEl.querySelectorAll('.painel-usuario-subtarefa-nome').forEach(nome => {
                  nome.style.cursor = 'pointer';
                  nome.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const itemEl = this.closest('.painel-usuario-subtarefa-item');
                    if (itemEl) {
                      const subtarefaId = itemEl.getAttribute('data-subtarefa-id');
                      alternarSubtarefaQuadro(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                    }
                  });
                });

                // Listeners nos botões de descrição
                wrapperEl.querySelectorAll('.painel-usuario-subtarefa-descricao-btn').forEach(btn => {
                  btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    const subtarefaId = this.getAttribute('data-subtarefa-id');
                    const subtarefaIdStr = String(subtarefaId);
                    const estavaExpandida = descricoesSubtarefasExpandidasRef.current.has(subtarefaIdStr);
                    const novoExpandidas = new Set(descricoesSubtarefasExpandidasRef.current);

                    if (estavaExpandida) {
                      novoExpandidas.delete(subtarefaIdStr);
                    } else {
                      novoExpandidas.add(subtarefaIdStr);
                    }

                    descricoesSubtarefasExpandidasRef.current = novoExpandidas;
                    setDescricoesSubtarefasExpandidas(novoExpandidas);

                    // Re-renderizar as subtarefas para atualizar a descrição
                    const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chaveVal}"]`);
                    if (wrapper) {
                      wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chaveVal);
                      adicionarListenersBolinhasQuadro(wrapper, tarefaIdVal, chaveVal, subtarefasVal);
                    }
                  });
                });
              };

              adicionarListenersBolinhasQuadro(subtarefasWrapper, reg.tarefa_id, chaveSubtarefas, subtarefas);
            }
          })();

          // Adicionar event listener à setinha de subtarefas
          const subtarefasArrow = item.querySelector('.painel-usuario-subtarefas-arrow');
          if (subtarefasArrow) {
            const arrowClone = subtarefasArrow.cloneNode(true);
            subtarefasArrow.parentNode.replaceChild(arrowClone, subtarefasArrow);

            arrowClone.addEventListener('click', async (e) => {
              e.stopPropagation();
              const chave = arrowClone.getAttribute('data-chave-subtarefas');
              const tarefaId = arrowClone.getAttribute('data-tarefa-id');
              if (!chave) return;

              const estavaExpandido = subtarefasExpandidasRef.current.has(chave);
              const novoExpandidos = new Set(subtarefasExpandidasRef.current);

              if (estavaExpandido) {
                novoExpandidos.delete(chave);
              } else {
                novoExpandidos.add(chave);
                await carregarStatusChecklist(chave);
              }

              subtarefasExpandidasRef.current = novoExpandidos;
              setSubtarefasExpandidas(novoExpandidos);

              const isExpanded = novoExpandidos.has(chave);
              const subtarefasWrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chave}"]`);

              if (isExpanded) {
                let subtarefas = subtarefasCacheRef.current.get(String(tarefaId));
                if (!subtarefas) {
                  subtarefas = await buscarSubtarefas(tarefaId);
                }
                if (subtarefas && subtarefas.length > 0) {
                  subtarefasWrapper.innerHTML = renderizarSubtarefas(subtarefas, tarefaId, chave);
                  subtarefasWrapper.style.display = 'block';

                  // Função helper para alternar estado de uma subtarefa (expandir quadro)
                  const alternarSubtarefaExpandQuadro = (subtarefaId, chave, tarefaIdVal, subtarefasVal) => {
                    // Sempre pegar o estado mais atualizado do ref
                    const estadoAtual = subtarefasConcluidasRef.current.get(chave) || new Set();
                    const concluidas = new Set(estadoAtual); // Criar uma cópia
                    const subtarefaIdStr = String(subtarefaId);

                    // Alternar apenas esta subtarefa específica
                    if (concluidas.has(subtarefaIdStr)) {
                      concluidas.delete(subtarefaIdStr);
                      salvarStatusChecklist(chave, subtarefaIdStr, false);
                    } else {
                      concluidas.add(subtarefaIdStr);
                      salvarStatusChecklist(chave, subtarefaIdStr, true);
                    }

                    // Atualizar o estado e o ref simultaneamente
                    const novoMap = new Map(subtarefasConcluidasRef.current);
                    novoMap.set(chave, concluidas);
                    subtarefasConcluidasRef.current = novoMap; // Atualizar ref imediatamente
                    setSubtarefasConcluidas(novoMap);

                    const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chave}"]`);
                    if (wrapper) {
                      wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chave);
                      adicionarListenersBolinhasExpandQuadro(wrapper, tarefaIdVal, chave, subtarefasVal);
                    }

                    // Atualizar contador
                    const countElement = item.querySelector(`.painel-usuario-subtarefas-count`);
                    if (countElement) {
                      const pendentes = contarSubtarefasPendentes(subtarefasVal, chave);
                      countElement.textContent = `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`;
                      if (pendentes === 0) {
                        countElement.style.color = '#10b981';
                      } else {
                        countElement.style.color = '#f59e0b';
                      }
                    }
                  };

                  // Função helper para adicionar listeners nas bolinhas, nomes e botões de descrição (expandir quadro)
                  const adicionarListenersBolinhasExpandQuadro = (wrapperEl, tarefaIdVal, chaveVal, subtarefasVal) => {
                    // Listeners nas bolinhas
                    wrapperEl.querySelectorAll('.painel-usuario-subtarefa-bolinha').forEach(bolinha => {
                      bolinha.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const subtarefaId = this.getAttribute('data-subtarefa-id');
                        alternarSubtarefaExpandQuadro(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                      });
                    });

                    // Listeners nos nomes
                    wrapperEl.querySelectorAll('.painel-usuario-subtarefa-nome').forEach(nome => {
                      nome.style.cursor = 'pointer';
                      nome.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const itemEl = this.closest('.painel-usuario-subtarefa-item');
                        if (itemEl) {
                          const subtarefaId = itemEl.getAttribute('data-subtarefa-id');
                          alternarSubtarefaExpandQuadro(subtarefaId, chaveVal, tarefaIdVal, subtarefasVal);
                        }
                      });
                    });

                    // Listeners nos botões de descrição
                    wrapperEl.querySelectorAll('.painel-usuario-subtarefa-descricao-btn').forEach(btn => {
                      btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        const subtarefaId = this.getAttribute('data-subtarefa-id');
                        const subtarefaIdStr = String(subtarefaId);
                        const estavaExpandida = descricoesSubtarefasExpandidasRef.current.has(subtarefaIdStr);
                        const novoExpandidas = new Set(descricoesSubtarefasExpandidasRef.current);

                        if (estavaExpandida) {
                          novoExpandidas.delete(subtarefaIdStr);
                        } else {
                          novoExpandidas.add(subtarefaIdStr);
                        }

                        descricoesSubtarefasExpandidasRef.current = novoExpandidas;
                        setDescricoesSubtarefasExpandidas(novoExpandidas);

                        // Re-renderizar as subtarefas para atualizar a descrição
                        const wrapper = item.querySelector(`.painel-usuario-subtarefas-wrapper[data-chave-subtarefas="${chaveVal}"]`);
                        if (wrapper) {
                          wrapper.innerHTML = renderizarSubtarefas(subtarefasVal, tarefaIdVal, chaveVal);
                          adicionarListenersBolinhasExpandQuadro(wrapper, tarefaIdVal, chaveVal, subtarefasVal);
                        }
                      });
                    });
                  };

                  adicionarListenersBolinhasExpandQuadro(subtarefasWrapper, tarefaId, chave, subtarefas);
                }
              } else {
                subtarefasWrapper.style.display = 'none';
              }

              // Atualizar ícone da setinha
              arrowClone.className = `fas fa-chevron-${isExpanded ? 'down' : 'right'} painel-usuario-subtarefas-arrow`;
              arrowClone.setAttribute('title', isExpanded ? 'Ocultar subtarefas' : 'Ver subtarefas');
            });
          }

          // Adicionar event listener ao botão play/stop
          const btn = item.querySelector(`button[data-action]`);
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const action = btn.getAttribute('data-action');
              // Obter o tempo_estimado_id do botão - este é o identificador único
              const tempoEstimadoIdDoBotao = btn.getAttribute('data-tempo-estimado-id');
              if (!tempoEstimadoIdDoBotao) {
                return;
              }
              // Garantir que o reg tenha o tempo_estimado_id correto
              const regComTempoEstimado = {
                ...reg,
                id: tempoEstimadoIdDoBotao,
                tempo_estimado_id: tempoEstimadoIdDoBotao
              };
              if (action === 'iniciar') {
                iniciarRegistroTempo(regComTempoEstimado);
              } else if (action === 'parar') {
                pararRegistroTempo(regComTempoEstimado);
              }
            });
          }

          // Adicionar event listener à setinha de expandir timetrack
          const expandArrow = item.querySelector('.painel-usuario-timetrack-arrow');
          if (expandArrow) {
            // Remover listeners anteriores para evitar duplicação
            const newExpandArrow = expandArrow.cloneNode(true);
            expandArrow.parentNode.replaceChild(newExpandArrow, expandArrow);

            newExpandArrow.addEventListener('click', async (e) => {
              e.stopPropagation();
              const chave = newExpandArrow.getAttribute('data-chave-timetrack');
              if (!chave) return;

              // Usar ref para verificar estado atual (mais confiável)
              const estavaExpandido = timetracksExpandidosRef.current.has(chave);
              const novoExpandidos = new Set(timetracksExpandidosRef.current);

              if (estavaExpandido) {
                novoExpandidos.delete(chave);
              } else {
                novoExpandidos.add(chave);
              }

              // Atualizar ref imediatamente
              timetracksExpandidosRef.current = novoExpandidos;
              // Atualizar estado (para sincronizar com React)
              setTimetracksExpandidos(novoExpandidos);

              const isTimetrackExpanded = novoExpandidos.has(chave);

              // Se está expandindo, buscar dados se necessário
              if (isTimetrackExpanded && !timetracksDataRef.current.has(chave)) {
                await buscarRegistrosTimetrack(reg);
                await new Promise(resolve => setTimeout(resolve, 10));
              }

              // Renderizar timetracks
              const timetracksHtml = isTimetrackExpanded ? renderizarTimetracksIndividuais(reg) : '';

              // Encontrar o container de timetracks ou criar um novo
              let timetracksContainer = item.querySelector('.painel-usuario-timetracks-container');
              if (!timetracksContainer) {
                timetracksContainer = document.createElement('div');
                timetracksContainer.className = 'painel-usuario-timetracks-container';
                item.appendChild(timetracksContainer);
              }
              timetracksContainer.innerHTML = timetracksHtml;

              // Atualizar ícone da setinha
              newExpandArrow.className = `fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'} painel-usuario-timetrack-arrow`;
              newExpandArrow.setAttribute('title', isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais');
            });
          }

          colunaBody.appendChild(item);
        });

        coluna.appendChild(colunaBody);
        board.appendChild(coluna);
      });
    }

    wrapper.appendChild(board);
  };

  const carregarNomesRelacionados = async (registros) => {
    const produtosIds = new Set();
    const tarefasIds = new Set();
    const clientesIds = new Set();
    const colaboradoresIds = new Set();

    registros.forEach((reg) => {
      if (reg.produto_id) {
        produtosIds.add(String(reg.produto_id));
        if (reg.produto_nome) {
          novos.produtos[String(reg.produto_id)] = reg.produto_nome;
        }
      }
      if (reg.tarefa_id) {
        tarefasIds.add(String(reg.tarefa_id));
        if (reg.tarefa_nome) {
          novos.tarefas[String(reg.tarefa_id)] = reg.tarefa_nome;
        }
      }
      if (reg.cliente_id) {
        clientesIds.add(String(reg.cliente_id));
        if (reg.cliente_nome) {
          novos.clientes[String(reg.cliente_id)] = reg.cliente_nome;
        }
      }
      if (reg.responsavel_id) colaboradoresIds.add(String(reg.responsavel_id));
    });

    const novos = { ...nomesCache };

    // Buscar tarefas/atividades em lote usando a rota de múltiplos IDs
    if (tarefasIds.size > 0) {
      try {
        const tarefasIdsArray = Array.from(tarefasIds);
        // Filtrar tarefas faltando QUE NÃO estão sendo buscadas e NEM falharam antes
        const tarefasFaltando = tarefasIdsArray.filter(id =>
          !novos.tarefas[id] &&
          !fetchingTasksRef.current.has(id) &&
          !failedTasksRef.current.has(id)
        );

        if (tarefasFaltando.length > 0) {
          // Marcar como buscando
          tarefasFaltando.forEach(id => fetchingTasksRef.current.add(id));

          // Usar a rota de múltiplos IDs para buscar todas as tarefas de uma vez
          const idsParam = tarefasFaltando.join(',');

          const response = await fetch(`/api/tarefas-por-ids?ids=${idsParam}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });

          if (response.status === 401 || response.status === 503) {
            tarefasFaltando.forEach(id => failedTasksRef.current.add(id));
          }

          if (response.ok) {
            const result = await response.json();

            if (result.success && result.data) {
              // result.data é um objeto { id: nome }
              // Os IDs podem vir como números ou strings, garantir que sejam strings
              Object.entries(result.data).forEach(([id, nome]) => {
                const idStr = String(id);
                if (nome && nome.trim()) {
                  novos.tarefas[idStr] = nome.trim();
                } else {
                  novos.tarefas[idStr] = `tarefa #${idStr}`;
                }
              });
            }
          }

          // Limpar estado de buscando
          tarefasFaltando.forEach(id => fetchingTasksRef.current.delete(id));

          // Para tarefas que não foram encontradas na busca em lote, usar fallback
          // Se falhou a requisição, já marcamos no failedTasksRef, então não precisa fallback imediato, ou pode usar fallback
          // Se deu OK mas não voltou o nome, usa fallback
          if (response.ok) {
            tarefasFaltando.forEach(id => {
              const idStr = String(id);
              if (!novos.tarefas[idStr]) {
                novos.tarefas[idStr] = `tarefa #${idStr}`;
              }
            });
          }
        }
      } catch (err) {
        // Em caso de erro, usar fallback para todas as tarefas faltando
        Array.from(tarefasIds).forEach(id => {
          if (!novos.tarefas[id]) {
            // Se já tem no cache, ok. Se não, marca falha ou fallback
            failedTasksRef.current.add(id);
          }
        });
      }
    }

    // Buscar produtos em lote usando a rota de múltiplos IDs
    if (produtosIds.size > 0) {
      try {
        const produtosIdsArray = Array.from(produtosIds);
        // Filtrar produtos faltando QUE NÃO estão sendo buscadas e NEM falharam antes
        const produtosFaltando = produtosIdsArray.filter(id =>
          !novos.produtos[id] &&
          !fetchingProductsRef.current.has(id) &&
          !failedProductsRef.current.has(id)
        );

        if (produtosFaltando.length > 0) {
          // Marcar como buscando
          produtosFaltando.forEach(id => fetchingProductsRef.current.add(id));

          // Usar a rota de múltiplos IDs para buscar todas os produtos de uma vez
          const idsParam = produtosFaltando.join(',');
          const response = await fetch(`/api/produtos-por-ids-numericos?ids=${idsParam}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });

          if (response.status === 401 || response.status === 503) {
            produtosFaltando.forEach(id => failedProductsRef.current.add(id));
          }

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              // result.data é um objeto { id: nome }
              Object.entries(result.data).forEach(([id, nome]) => {
                if (nome) {
                  novos.produtos[String(id)] = nome;
                } else {
                  novos.produtos[String(id)] = `produto #${id}`;
                }
              });
            }
          }

          // Limpar estado de buscando
          produtosFaltando.forEach(id => fetchingProductsRef.current.delete(id));

          // Para produtos que não foram encontrados na busca em lote, usar fallback
          if (response.ok) {
            produtosFaltando.forEach(id => {
              if (!novos.produtos[id]) {
                novos.produtos[id] = `produto #${id}`;
              }
            });
          }
        }
      } catch (err) {
        // Em caso de erro
        Array.from(produtosIds).forEach(id => {
          if (!novos.produtos[id]) {
            failedProductsRef.current.add(id);
          }
        });
      }
    }

    // Para clientes, usar o endpoint de base-conhecimento para buscar nomes
    if (clientesIds.size > 0) {
      const clientesIdsArray = Array.from(clientesIds);
      const clientesFaltando = clientesIdsArray.filter(id => !novos.clientes[id]);

      if (clientesFaltando.length > 0) {
        // Buscar nomes em paralelo usando o endpoint de base-conhecimento
        const promessasBusca = clientesFaltando.map(async (id) => {
          try {
            const response = await fetch(`${API_BASE_URL}/base-conhecimento/cliente/${id}`, {
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data && result.data.cliente) {
                const cliente = result.data.cliente;
                // Priorizar: nome > nome_amigavel > nome_fantasia > razao_social
                const nome = cliente.nome ||
                  cliente.nome_amigavel ||
                  cliente.amigavel ||
                  cliente.nome_fantasia ||
                  cliente.fantasia ||
                  cliente.razao_social ||
                  cliente.razao ||
                  null;

                if (nome) {
                  return { id: String(id), nome };
                }
              }
            }
          } catch (error) {
            // Erro ao buscar nome do cliente - não crítico
          }
          return null;
        });

        const resultados = await Promise.all(promessasBusca);
        resultados.forEach((resultado) => {
          if (resultado && resultado.nome) {
            novos.clientes[resultado.id] = resultado.nome;
          }
        });
      }
    }

    // Buscar colaboradores individualmente
    if (colaboradoresIds.size > 0) {
      const colaboradoresIdsArray = Array.from(colaboradoresIds);
      const colaboradoresFaltando = colaboradoresIdsArray.filter(id => !novos.colaboradores[id]);

      if (colaboradoresFaltando.length > 0) {
        try {
          const colaboradoresLista = await carregarColaboradores();
          if (colaboradoresLista && Array.isArray(colaboradoresLista)) {
            colaboradoresFaltando.forEach(id => {
              const colaborador = colaboradoresLista.find(c => String(c.id) === String(id));
              if (colaborador) {
                novos.colaboradores[id] = colaborador.nome || `colaborador #${id}`;
              } else {
                novos.colaboradores[id] = `colaborador #${id}`;
              }
            });
          } else {
            colaboradoresFaltando.forEach(id => {
              novos.colaboradores[id] = `colaborador #${id}`;
            });
          }
        } catch (err) {
          colaboradoresFaltando.forEach(id => {
            novos.colaboradores[id] = `colaborador #${id}`;
          });
        }
      }
    }

    // Atualizar tanto o estado quanto a ref
    nomesCacheRef.current = novos;
    setNomesCache(novos);
  };

  const carregarColaboradores = useCallback(async () => {
    if (colaboradoresCache.length > 0) return colaboradoresCache;
    try {
      const result = await colaboradoresAPI.getAll(false);
      if (result.success && Array.isArray(result.data)) {
        setColaboradoresCache(result.data);
        return result.data;
      }
    } catch (e) {
      // Erro ao carregar colaboradores
    }
    return [];
  }, [colaboradoresCache]);

  const carregarClientesLista = useCallback(async () => {
    if (clientesListaCache) return clientesListaCache;
    try {
      const resp = await fetch('/api/clientes?page=1&limit=1000', {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result.success && Array.isArray(result.data)) {
          const mapa = {};
          result.data.forEach((c) => {
            const id = String(c.id || c.cliente_id || '').trim();
            // Priorizar: nome > nome_amigavel > nome_fantasia > razao_social
            // NUNCA exibir ID do cliente
            const nome =
              c.nome ||
              c.nome_amigavel ||
              c.nome_fantasia ||
              c.razao_social ||
              c.cliente_nome ||
              c.nome_cliente ||
              null; // Retornar null em vez de "Cliente #${id}"
            if (id && nome) mapa[id] = nome;
          });
          setClientesListaCache(mapa);
          return mapa;
        }
      }
    } catch (e) {
      // Erro ao carregar lista de clientes
    }
    return null;
  }, [clientesListaCache]);

  const descobrirResponsavelId = useCallback(async () => {
    if (!usuario) return null;
    const colaboradores = await carregarColaboradores();

    const matchDireto = colaboradores.find(
      (c) => String(c.usuario_id || '').trim() === String(usuario.id || '').trim()
    );
    if (matchDireto && matchDireto.id) return String(matchDireto.id);

    const emailBusca = normalizeText(usuario.email_usuario || '');
    const nomeBusca = normalizeText(
      usuario.nome ||
      usuario.nome_usuario ||
      usuario.nomecompleto ||
      usuario.nome_completo ||
      ''
    );

    const matchEmail = colaboradores.find(
      (c) => normalizeText(c.email || c.email_usuario || c.emailcolaborador || '') === emailBusca
    );
    if (matchEmail && matchEmail.id) return String(matchEmail.id);

    const matchNome = colaboradores.find((c) =>
      normalizeText(c.nome || c.nomecolaborador || '').includes(nomeBusca)
    );
    if (matchNome && matchNome.id) return String(matchNome.id);

    return null;
  }, [carregarColaboradores, usuario]);

  const agruparRegistros = (registros) => {
    const grupos = new Map();

    registros.forEach((registro) => {
      const agrupadorId = registro.agrupador_id || 'sem-grupo';
      if (!grupos.has(agrupadorId)) {
        grupos.set(agrupadorId, {
          agrupador_id: agrupadorId,
          registros: [],
          primeiroRegistro: registro,
          quantidade: 0,
          dataInicio: null,
          dataFim: null
        });
      }
      const grupo = grupos.get(agrupadorId);
      grupo.registros.push(registro);
      grupo.quantidade = grupo.registros.length;

      const datas = grupo.registros
        .map((r) => {
          if (!r.data) return null;
          const dataStr = typeof r.data === 'string' ? r.data.split('T')[0] : r.data;
          const [ano, mes, dia] = dataStr.split('-');
          return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        })
        .filter((d) => d !== null)
        .sort((a, b) => a - b);

      if (datas.length > 0) {
        grupo.dataInicio = datas[0];
        grupo.dataFim = datas[datas.length - 1];
      }
    });

    setTarefasAgrupadas(Array.from(grupos.values()));
  };

  const carregarMinhasTarefas = useCallback(async (alvoManual = null, dataSelecionada = null) => {
    if (!usuario || !usuario.id) {
      return;
    }
    const alvoReferencia = alvoManual || tarefasContainerRef.current;
    setCarregandoTarefas(true);
    try {
      // Usar data selecionada ou dataTarefasSelecionada do estado, ou hoje como fallback
      const dataParaUsar = dataSelecionada || dataTarefasSelecionada || new Date();
      const yyyy = dataParaUsar.getFullYear();
      const mm = String(dataParaUsar.getMonth() + 1).padStart(2, '0');
      const dd = String(dataParaUsar.getDate()).padStart(2, '0');
      const dataStr = `${yyyy}-${mm}-${dd}`;

      const params = new URLSearchParams();
      params.append('filtro_responsavel', 'true');

      // Tentar coletar todos os possíveis IDs do usuário
      const usuarioStorage = (() => {
        try {
          return JSON.parse(localStorage.getItem('usuario') || '{}');
        } catch {
          return {};
        }
      })();

      const coletarIds = (obj) => {
        const ids = [];
        Object.entries(obj || {}).forEach(([k, v]) => {
          if (!v) return;
          const keyLower = k.toLowerCase();
          const isIdKey =
            keyLower.includes('id') ||
            keyLower.includes('membro') ||
            keyLower.includes('colaborador') ||
            keyLower.includes('usuario');
          if (isIdKey) {
            if (typeof v === 'number') ids.push(String(v));
            if (typeof v === 'string' && v.trim()) ids.push(v.trim());
          }
        });
        return ids;
      };

      const idsPossiveisBase = [...coletarIds(usuario), ...coletarIds(usuarioStorage)];
      const responsavelIdDescoberto = await descobrirResponsavelId();
      const idsPossiveis = [
        ...idsPossiveisBase,
        responsavelIdDescoberto
      ].filter(Boolean);

      const nomesPossiveis = [
        normalizeText(
          usuario?.nome ||
          usuario?.nome_usuario ||
          usuario?.nomecompleto ||
          usuario?.nome_completo ||
          ''
        )
      ].filter(Boolean);

      const idsUnicos = Array.from(new Set(idsPossiveis));
      if (idsUnicos.length > 0) {
        idsUnicos.forEach((id) => params.append('responsavel_id', id));
      }

      // IMPORTANTE: Enviar apenas a data selecionada para otimizar a busca
      // O backend deve retornar APENAS os registros desta data específica
      params.append('data_inicio', dataStr);
      params.append('data_fim', dataStr);
      // Limite maior para garantir que não perdemos dados, mas o backend deve filtrar pela data
      params.append('limit', '100');
      params.append('page', '1');

      const response = await fetch(`/api/tempo-estimado?${params}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      let registros = [];

      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          registros = result.data;
        }
      }

      // --- INJECT PENDING TASKS (PLUG RÁPIDO) ---
      try {
        const resPendentes = await fetch(`${API_BASE_URL}/atribuicoes-pendentes/minhas`);
        if (resPendentes.ok) {
          const jsonPendentes = await resPendentes.json();
          if (jsonPendentes.success && Array.isArray(jsonPendentes.data)) {
            // Filter pending tasks for the selected date
            const pendentesDoDia = jsonPendentes.data.filter(p => {
              try {
                if (!p.data_inicio) return false;
                const d = new Date(p.data_inicio);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const pDateStr = `${yyyy}-${mm}-${dd}`;
                return pDateStr === dataStr;
              } catch { return false; }
            });

            const pendentesMapeados = pendentesDoDia.map(p => ({
              id: p.id,
              tempo_estimado_id: p.id,
              tarefa_id: p.tarefa_id,
              cliente_id: p.cliente_id,
              produto_id: p.produto_id,
              data: p.data_inicio,
              tempo_estimado_dia: p.tempo_estimado_dia,
              tempo_estimado_total: p.tempo_estimado_dia, // For consistency
              tempo_realizado: p.tempo_realizado_ms || 0,

              is_plug_rapido: true,
              is_pendente: true,
              status_pendente: 'AGUARDANDO_APROVACAO',

              cliente_nome: p.cliente?.nome,
              produto_nome: p.produto?.nome,
              tarefa_nome: p.tarefa?.nome,

              bloqueado: false // Allow counting time
            }));

            if (pendentesMapeados.length > 0) {
              registros = [...registros, ...pendentesMapeados];
            }
          }
        }
      } catch (e) {
        // Silent fail for pending fetch
      }

      // Filtra em memória APENAS para garantir que temos apenas a data selecionada
      // Isso é uma segurança adicional caso o backend retorne dados de outras datas
      const ehDataSelecionada = (data) => {
        if (!data) return false;
        if (typeof data === 'string') {
          const apenasData = data.split('T')[0];
          return apenasData === dataStr;
        }
        try {
          const d = new Date(data);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}` === dataStr;
        } catch {
          return false;
        }
      };

      // Filtrar APENAS registros da data selecionada E do responsável correto
      // Garantir que não carregamos dados de outras datas
      const idsUnicosSet = new Set(idsUnicos);
      registros = registros.filter((r) => {
        const dataOk = ehDataSelecionada(r.data);
        const responsavelOk = idsUnicosSet.has(String(r.responsavel_id)) ||
          idsUnicosSet.has(Number(r.responsavel_id));
        return dataOk && responsavelOk;
      });

      // Se após filtrar não há registros, significa que não há tarefas para esta data
      // Não fazer fallbacks que carregariam outras datas

      // Remover fallbacks que podem trazer dados incorretos
      // Se não encontrou nada, é porque realmente não há tarefas para hoje do usuário
      // Não fazer fallbacks que buscam sem data ou sem responsável, pois podem trazer dados incorretos

      // Atualizar referência e estado primeiro para renderização mais rápida
      tarefasRegistrosRef.current = registros;
      setTarefasRegistros(registros);

      // Renderizar imediatamente com os dados disponíveis (sem esperar nomes/tempos)
      renderTarefasNoCard(registros, alvoManual, dataParaUsar);

      // Carregar dados adicionais em paralelo (sem bloquear renderização)
      if (registros.length > 0) {
        Promise.all([
          carregarNomesRelacionados(registros),
          verificarRegistrosAtivos(),
          buscarTemposRealizados()
        ]).then(() => {
          // Re-renderizar apenas quando nomes/tempos estiverem prontos
          if (tarefasRegistrosRef.current.length > 0) {
            renderTarefasNoCard(tarefasRegistrosRef.current, alvoManual, dataParaUsar);
          }
        });
      }
    } catch (e) {
      tarefasRegistrosRef.current = [];
      setTarefasRegistros([]);
      renderTarefasNoCard([], alvoManual, dataParaUsar);
    } finally {
      setCarregandoTarefas(false);
    }
  }, [usuario, carregarNomesRelacionados, verificarRegistrosAtivos, buscarTemposRealizados]);

  // Atualizar ref quando a função mudar
  useEffect(() => {
    carregarMinhasTarefasRef.current = carregarMinhasTarefas;
  }, [carregarMinhasTarefas]);

  // Recarregar tarefas quando a data mudar
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (carregarMinhasTarefasRef.current && tarefasContainerRef.current) {
        carregarMinhasTarefasRef.current(tarefasContainerRef.current, dataTarefasSelecionada);
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [dataTarefasSelecionada]);

  // Carregar tarefas ao montar o componente
  useEffect(() => {
    if (usuario?.id && tarefasContainerRef.current) {
      // Aguardar um pouco para garantir que o ref está pronto
      const timeoutId = setTimeout(() => {
        if (carregarMinhasTarefasRef.current && tarefasContainerRef.current) {
          carregarMinhasTarefasRef.current(tarefasContainerRef.current, dataTarefasSelecionada);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  // Atualizar tempo em tempo real quando houver registros ativos (sem re-renderizar tudo)
  useEffect(() => {
    if (registrosAtivos.size === 0) return;

    const intervalId = setInterval(async () => {
      // Atualizar tempos realizados para tarefas com registros ativos
      const tarefasComRegistrosAtivos = Array.from(registrosAtivos.entries()).map(([chave, valor]) => {
        const [clienteId, tarefaId] = chave.split('_');
        return { clienteId, tarefaId, registroAtivo: valor };
      });

      // Buscar o registro completo para obter tempo_estimado_id
      const registrosCompletos = tarefasRegistrosRef.current.filter(reg => {
        return tarefasComRegistrosAtivos.some(ativo =>
          String(reg.cliente_id).trim() === ativo.clienteId &&
          String(reg.tarefa_id).trim() === ativo.tarefaId
        );
      });

      // Atualizar tempos realizados
      const novosTempos = new Map(temposRealizadosRef.current);
      await Promise.all(
        registrosCompletos.map(async (reg) => {
          const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
          if (!tempoEstimadoId) return;

          const chaveTempo = criarChaveTempo(reg);
          if (!chaveTempo) return;

          const tempoRealizado = await buscarTempoRealizado(reg);
          novosTempos.set(chaveTempo, tempoRealizado);

          // Atualizar apenas o elemento de tempo realizado no DOM, sem re-renderizar tudo
          const tempoFormatado = formatarTempoHMS(tempoRealizado);
          const tarefaIdStr = String(reg.tarefa_id).trim();
          const clienteIdStr = String(reg.cliente_id).trim();

          // Buscar todos os pills e atualizar apenas o que corresponde a esta tarefa e cliente
          const tempoPills = document.querySelectorAll(`.painel-usuario-realizado-pill[data-tarefa-id="${tarefaIdStr}"][data-cliente-id="${clienteIdStr}"]`);
          tempoPills.forEach((pill) => {
            pill.textContent = tempoFormatado;
          });
        })
      );

      if (novosTempos.size > 0) {
        temposRealizadosRef.current = novosTempos;
        setTemposRealizados(novosTempos);

        // Atualizar tempos realizados totais nos headers dos clientes (modo lista)
        atualizarTemposRealizadosHeaders();
      }
    }, 30000); // Atualizar a cada 30 segundos (reduzido de 1s para aliviar servidor)

    return () => clearInterval(intervalId);
  }, [registrosAtivos, buscarTempoRealizado, criarChaveTempo, atualizarTemposRealizadosHeaders]);

  // Escutar eventos de início e finalização de registro de tempo (sincronização com TimerAtivo)
  useEffect(() => {
    const handleRegistroIniciado = async () => {
      // Pequeno delay para garantir que o backend processou
      setTimeout(async () => {
        // Verificar registros ativos novamente
        await verificarRegistrosAtivos();

        // Buscar tempos realizados atualizados
        await buscarTemposRealizados();

        // Sincronizar TODOS os botões para garantir consistência
        sincronizarTodosBotoes();
      }, 100);
    };

    const handleRegistroFinalizado = async () => {
      // Delay maior para garantir que o backend processou completamente a finalização
      setTimeout(async () => {
        // Verificar registros ativos novamente
        await verificarRegistrosAtivos();

        // Buscar tempos realizados atualizados
        await buscarTemposRealizados();

        // Atualizar tempo realizado no DOM diretamente para todas as tarefas
        // Isso garante que o tempo seja atualizado imediatamente, igual ao botão na tarefa
        tarefasRegistrosRef.current.forEach(async (reg) => {
          const chaveTempo = criarChaveTempo(reg);
          if (chaveTempo) {
            const tempoRealizadoMs = temposRealizadosRef.current.get(chaveTempo) || 0;
            atualizarTempoRealizadoEBarraProgresso(reg, tempoRealizadoMs);

            // Recarregar timetracks individuais se o container estiver expandido
            const chaveTimetrack = criarChaveTempo(reg);
            if (chaveTimetrack && timetracksExpandidosRef.current.has(chaveTimetrack)) {
              // Limpar cache para forçar recarregamento
              const novoMap = new Map(timetracksDataRef.current);
              novoMap.delete(chaveTimetrack);
              timetracksDataRef.current = novoMap;
              setTimetracksData(novoMap);

              // Recarregar timetracks
              await buscarRegistrosTimetrack(reg);

              // Atualizar o container de timetracks no DOM
              const tarefaIdStr = String(reg.tarefa_id).trim();
              const clienteIdStr = String(reg.cliente_id).trim();

              // Buscar pelo contexto do card pai (mais confiável)
              const tarefaCards = document.querySelectorAll('.painel-usuario-tarefa-card');
              tarefaCards.forEach(card => {
                const tarefaIdAttr = card.getAttribute('data-tarefa-id');
                const clienteIdAttr = card.getAttribute('data-cliente-id');
                if (tarefaIdAttr === tarefaIdStr && clienteIdAttr === clienteIdStr) {
                  const container = card.querySelector('.painel-usuario-timetracks-container');
                  if (container) {
                    const timetracksHtml = renderizarTimetracksIndividuais(reg);
                    container.innerHTML = timetracksHtml;
                  }
                }
              });
            }
          }
        });

        // Atualizar headers dos clientes com os novos tempos realizados
        atualizarTemposRealizadosHeaders();

        // Sincronizar TODOS os botões para garantir consistência
        sincronizarTodosBotoes();

        // NÃO re-renderizar tudo - isso causa fechamento/abertura dos clientes
        // Os tempos já foram atualizados diretamente no DOM acima
      }, 300); // Delay aumentado para garantir processamento completo
    };

    window.addEventListener('registro-tempo-iniciado', handleRegistroIniciado);
    window.addEventListener('registro-tempo-finalizado', handleRegistroFinalizado);

    return () => {
      window.removeEventListener('registro-tempo-iniciado', handleRegistroIniciado);
      window.removeEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    };
  }, [verificarRegistrosAtivos, buscarTemposRealizados, sincronizarTodosBotoes, criarChaveTempo, atualizarTempoRealizadoEBarraProgresso, clientesExpandidosLista, dataTarefasSelecionada, buscarRegistrosTimetrack, renderizarTimetracksIndividuais]);

  // Re-renderizar tarefas quando clientes expandidos mudarem (modo lista)
  useEffect(() => {
    if (tarefasRegistrosRef.current.length > 0 && tarefasContainerRef.current) {
      const modo = obterModoVisualizacao();
      if (modo === 'lista') {
        renderTarefasNoCard(tarefasRegistrosRef.current, tarefasContainerRef.current, dataTarefasSelecionada);
      }
    }
  }, [clientesExpandidosLista]);

  // Re-renderizar tarefas quando clientes selecionados mudarem (apenas filtro, sem recarregar dados)
  useEffect(() => {
    // Aguardar um pouco para garantir que o estado foi atualizado
    const timeoutId = setTimeout(() => {
      if (tarefasRegistrosRef.current.length > 0 && tarefasContainerRef.current) {
        // Encontrar o wrapper existente (não recriar tudo)
        const card = tarefasContainerRef.current;
        const wrapper = card.querySelector('div[style*="flex-direction: column"]');

        if (wrapper) {
          // Atualizar apenas as tarefas, preservando cards de clientes e header
          // Usar a lógica diretamente aqui para evitar dependência circular
          const registrosFiltrados = clienteSelecionadoId
            ? (() => {
              const selectedId = String(clienteSelecionadoId).trim();
              return tarefasRegistrosRef.current.filter(reg => {
                const regClienteId = String(reg.cliente_id || '').trim();
                return regClienteId === selectedId;
              });
            })()
            : tarefasRegistrosRef.current;

          // Remover containers antigos de tarefas
          const listaContainer = wrapper.querySelector('.painel-usuario-lista-container');
          let boardContainer = null;
          const wrapperChildren = Array.from(wrapper.children);
          for (const child of wrapperChildren) {
            if (child.classList && child.classList.contains('painel-usuario-header-board')) continue;
            const clientesGrid = child.querySelector('.clientes-knowledge-grid');
            if (clientesGrid) continue;
            const style = window.getComputedStyle(child);
            if (style.display === 'flex' && style.gap && (style.overflowY === 'auto' || style.overflowY === 'scroll')) {
              boardContainer = child;
              break;
            }
          }

          if (listaContainer) listaContainer.remove();
          if (boardContainer) boardContainer.remove();

          // Atualizar contador no header
          const header = wrapper.querySelector('.painel-usuario-header-board');
          if (header) {
            const headerLeft = header.firstElementChild;
            if (headerLeft) {
              const children = Array.from(headerLeft.children);
              const subtitle = children.find(child => {
                const style = child.style.cssText || window.getComputedStyle(child).cssText;
                return style.includes('margin-left: auto') || style.includes('marginLeft: auto') || child.style.marginLeft === 'auto';
              });

              if (subtitle) {
                const btnLimpar = subtitle.querySelector('button');
                const textNodes = Array.from(subtitle.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                textNodes.forEach(node => node.remove());
                if (btnLimpar) {
                  subtitle.insertBefore(document.createTextNode(`${registrosFiltrados.length} tarefa(s)`), btnLimpar.nextSibling);
                } else {
                  subtitle.appendChild(document.createTextNode(`${registrosFiltrados.length} tarefa(s)`));
                }
              }
            }

            // Atualizar o toggle para refletir o modo atual
            const toggleView = header.querySelector('.painel-usuario-toggle-view');
            if (toggleView) {
              const modo = obterModoVisualizacao();
              const btnQuadro = toggleView.querySelector('button[data-mode="quadro"]');
              const btnLista = toggleView.querySelector('button[data-mode="lista"]');

              if (btnQuadro && btnLista) {
                // Atualizar classes active
                if (modo === 'quadro') {
                  btnQuadro.classList.add('active');
                  btnLista.classList.remove('active');
                } else {
                  btnQuadro.classList.remove('active');
                  btnLista.classList.add('active');
                }
              }
            }
          }

          // Renderizar tarefas novamente
          const modo = obterModoVisualizacao();
          const dataParaRenderizar = dataTarefasSelecionada || new Date();

          if (modo === 'lista') {
            renderTarefasEmLista(registrosFiltrados, wrapper, dataParaRenderizar);
          } else {
            renderTarefasEmQuadro(registrosFiltrados, wrapper, dataParaRenderizar);
          }
        } else {
          // Se não encontrar wrapper, fazer renderização completa (caso inicial)
          renderTarefasNoCard(tarefasRegistrosRef.current, tarefasContainerRef.current, dataTarefasSelecionada);
        }
      }
    }, 50);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSelecionadoId]);

  // Carregar comunicado de destaque
  const fetchDestaque = useCallback(async () => {
    try {
      const res = await comunicacaoAPI.buscarComunicadoDestaque();
      if (res.success && res.data) {
        setComunicadoDestaque(res.data);
      } else {
        setComunicadoDestaque(null);
      }
    } catch (err) {
      console.error('Erro ao buscar destaque:', err);
    }
  }, []);

  useEffect(() => {
    fetchDestaque();

    // Polling a cada 30 segundos para novos avisos sem precisar recarregar
    const interval = setInterval(fetchDestaque, 30000);
    return () => clearInterval(interval);
  }, [fetchDestaque]);

  const handleVisualizarDestaque = async () => {
    if (!comunicadoDestaque) return;
    try {
      await comunicacaoAPI.marcarMensagemLida(comunicadoDestaque.id);
      setComunicadoDestaque(null);
      // Opcional: abrir a central de comunicação no aviso correto
      // setIsCommOpen(true); setActiveTab('comunicados');
    } catch (err) {
      console.error('Erro ao marcar como lido:', err);
    }
  };


  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="painel-usuario-content-section">
            <div className="painel-usuario-page-header">
              <div className="painel-usuario-header-content">
                <div className="painel-usuario-header-left">
                  <div className="painel-usuario-header-icon">
                    <i className="fas fa-clipboard-list" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <h1 className="painel-usuario-page-title">Minhas Tarefas</h1>
                    </div>
                    <p className="painel-usuario-page-subtitle">
                      Visualize suas tarefas atribuídas
                    </p>
                  </div>
                </div>

                {/* Notificação Flutuante de Comunicado - Renderizada no Body para ignorar offsets de scroll/transform */}
                {comunicadoDestaque && createPortal(
                  <div className="painel-usuario-aviso-floating" style={{
                    position: 'fixed',
                    top: '67px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2000000,
                    background: 'rgba(14, 59, 111, 0.98)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    maxWidth: '80vw',
                    animation: 'slideDownFade 0.3s ease-out'
                  }}>
                    <i className="fas fa-bullhorn" style={{ color: '#fbbf24', fontSize: '13px' }}></i>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span style={{ fontWeight: '800' }}>{comunicadoDestaque.titulo}</span>
                    </div>
                    <button
                      className="view-more-aviso-btn"
                      title="Ver mais detalhes"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('open-communication-drawer', { detail: { tab: 'comunicados' } }));
                        // Marcar como lido para sumir o banner após abrir
                        handleVisualizarDestaque();
                      }}
                      style={{
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: '11px',
                        fontWeight: '600',
                        flexShrink: 0
                      }}
                    >
                      Ver mais <i className="fas fa-external-link-alt" style={{ fontSize: '10px' }}></i>
                    </button>
                  </div>,
                  document.body
                )}

                {document.getElementById('header-extra-content') && createPortal(
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="tooltip-wrapper has-tooltip" style={{ marginRight: '16px' }}>
                      <button
                        className="painel-usuario-btn-plug-rapido"
                        onClick={() => setModalPlugRapidoOpen(true)}
                        style={{
                          backgroundColor: '#fd7e14',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 4px rgba(253, 126, 20, 0.3)'
                        }}
                      >
                        <i className="fas fa-bolt"></i> Plug Rápido
                      </button>
                      <div className="filter-tooltip tooltip-bottom" style={{ minWidth: '200px', width: '250px' }}>
                        Atribui rapidamente uma nova tarefa e pluga rapidamente nela. Essa tarefa estará pendente de aprovação enquanto isso.
                      </div>
                    </div>
                    {shortcutTask && (
                      <div className="painel-usuario-header-shortcut has-tooltip" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '15px',
                        background: '#1f2937', // Dark background matching timer
                        padding: '6px 3px 6px 15px', // Matching timer-ativo-container
                        borderRadius: '12px',
                        border: 'none', // No border matching timer
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                        marginRight: '16px',
                        height: '27px',
                        position: 'relative',
                        cursor: 'default',
                        boxSizing: 'border-box',
                        zIndex: '1'
                      }}>
                        <div className="filter-tooltip">Atividade Interna</div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingRight: '0', borderRight: 'none' }}>
                          <span style={{ fontWeight: 500, color: '#e5e7eb', fontSize: '13px', lineHeight: 1, whiteSpace: 'nowrap' }}>
                            {getNomeTarefa(shortcutTask.tarefa_id, shortcutTask)}
                          </span>
                        </div>

                        <button
                          className={`painel-usuario-btn-reproducao ${registrosAtivos.has(String(shortcutTask.id || shortcutTask.tempo_estimado_id).trim()) ? 'painel-usuario-btn-stop' : 'painel-usuario-btn-play'}`}
                          onClick={() => {
                            if (registrosAtivos.has(String(shortcutTask.id || shortcutTask.tempo_estimado_id).trim())) {
                              pararRegistroTempo(shortcutTask);
                            } else {
                              if (!isTaskToday(shortcutTask.data)) return;
                              iniciarRegistroTempo(shortcutTask);
                            }
                          }}
                          disabled={!isTaskToday(shortcutTask.data)}
                          title=""
                          style={{
                            width: '20px',
                            height: '20px',
                            minWidth: '20px',
                            borderRadius: '50%', // Round button
                            border: 'none',
                            cursor: !isTaskToday(shortcutTask.data) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'none',
                            transition: 'all 0.2s ease',
                            backgroundColor: !isTaskToday(shortcutTask.data)
                              ? '#ccc'
                              : '#28a745', // Always green if enabled, even when stopping
                            padding: 0
                          }}
                        >
                          <i className={`fas ${registrosAtivos.has(String(shortcutTask.id || shortcutTask.tempo_estimado_id).trim()) ? 'fa-stop' : 'fa-play'}`} style={{ color: '#fff', fontSize: '9px' }}></i>
                        </button>
                      </div>
                    )}
                  </div>,
                  document.getElementById('header-extra-content')
                )}
              </div>
            </div>

            {/* TABS DE NAVEGAÇÃO - Apenas exibe se houver pendentes */}
            {pendentes.length > 0 && (
              <div className="painel-usuario-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '15px', padding: '0 5px' }}>
                <button
                  onClick={() => setActiveTab('minhas')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: activeTab === 'minhas' ? '#0e3b6f' : '#e5e7eb',
                    color: activeTab === 'minhas' ? '#fff' : '#4b5563',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Atribuídas
                </button>
                <button
                  onClick={() => setActiveTab('pendentes')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    backgroundColor: activeTab === 'pendentes' ? '#f59e0b' : '#e5e7eb',
                    color: activeTab === 'pendentes' ? '#fff' : '#4b5563',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  Pendentes {pendentes.length > 0 && <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '1px 6px', borderRadius: '10px' }}>{pendentes.length}</span>}
                </button>
              </div>
            )}

            {/* Container das tarefas (Lista Principal) - Exibe se tab 'minhas' está ativa OU se não há pendentes (fallback) */}
            <div ref={tarefasContainerRef} className="painel-usuario-tarefas-container" style={{ display: (activeTab === 'minhas' || pendentes.length === 0) ? 'block' : 'none' }}></div>

            {/* Container das Pendentes */}
            {activeTab === 'pendentes' && pendentes.length > 0 && (
              <div className="painel-usuario-pendentes-lista" style={{ padding: '0 5px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendentes.map(p => (
                    <div key={p.id} style={{
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      padding: '16px',
                      borderLeft: '4px solid #f59e0b',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '4px' }}>
                          {p.cliente?.nome} &bull; {p.produto?.nome}
                        </div>
                        <div style={{ fontWeight: '600', fontSize: '1rem', color: '#111827', marginBottom: '6px' }}>
                          {p.tarefa?.nome}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                            <i className="far fa-calendar"></i> {formatarData(p.data_inicio)}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4b5563' }}>
                            <i className="far fa-clock"></i> Est: {formatarTempoHMS(p.tempo_estimado_dia * 1000)}/dia
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                        <div style={{
                          padding: '4px 8px',
                          backgroundColor: '#fff7ed',
                          color: '#d97706',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          border: '1px solid #fed7aa'
                        }}>
                          AGUARDANDO APROVAÇÃO
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: '600', color: '#0e3b6f' }}>
                            {p.tempo_realizado_formatado || '00:00:00'}
                          </span>

                          <TimerButton
                            isActive={p.timer_ativo}
                            onClick={() => p.timer_ativo ? handleStopTimerPendente(p.id) : handleStartTimerPendente(p.id)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <ModalPlugRapido
              isOpen={modalPlugRapidoOpen}
              onClose={() => setModalPlugRapidoOpen(false)}
              onSuccess={() => {
                setActiveTab('pendentes');
                fetchPendentes();
              }}
            />
          </div>
        </main>
      </div>

      {/* DetailSideCard para clientes */}
      {detailCardCliente && (
        <DetailSideCard
          clienteId={detailCardCliente.clienteId}
          tipo={detailCardCliente.tipo}
          dados={detailCardCliente.dados}
          onClose={handleCloseDetailCliente}
          position={detailCardClientePosition}
        />
      )}
    </Layout>
  );
};

export default PainelUsuario;

