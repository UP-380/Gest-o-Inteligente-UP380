import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import AtribuicoesTabela from '../../components/atribuicoes/AtribuicoesTabela';
import { colaboradoresAPI } from '../../services/api';
import ClienteTempoInfo from './components/ClienteTempoInfo';
import './PainelUsuario.css';

/**
 * Componente PainelUsuario
 * Tela de painel personalizável usando Gridstack.js
 * Permite arrastar e redimensionar blocos visuais
 */
const RESPONSAVEL_ID_FIXO = '87902612'; // ID vinculado ao usuário logado (João Pedro)

const PainelUsuario = () => {
  const { usuario } = useAuth();
  const gridRef = useRef(null);
  const gridstackInstanceRef = useRef(null);
  const [menuPosicao, setMenuPosicao] = useState({ open: false, x: 0, y: 0, target: null });
  const [carregandoTarefas, setCarregandoTarefas] = useState(false);
  const [tarefasAgrupadas, setTarefasAgrupadas] = useState([]);
  const [tarefasRegistros, setTarefasRegistros] = useState([]);
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
  const [clientesExpandidosLista, setClientesExpandidosLista] = useState(new Set()); // para controlar expansão de clientes na lista
  const [timetracksExpandidos, setTimetracksExpandidos] = useState(new Set()); // para controlar expansão de timetracks individuais
  const timetracksExpandidosRef = useRef(new Set()); // Ref para acesso síncrono ao estado de expansão
  const [timetracksData, setTimetracksData] = useState(new Map()); // Map<chave, registros[]> - cache de registros de tempo
  const timetracksDataRef = useRef(new Map()); // Ref para acesso síncrono aos dados
  const [modoVisualizacao, setModoVisualizacao] = useState({}); // objeto com { cardId: 'quadro' | 'lista' }
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
  const inicializadoRef = useRef(false);
  const tarefasRegistrosRef = useRef([]);
  const [registrosAtivos, setRegistrosAtivos] = useState(new Map()); // Map<tarefa_id, { registro_id, data_inicio }>
  const registrosAtivosRef = useRef(new Map()); // Ref para acesso em funções não-hook
  const [temposRealizados, setTemposRealizados] = useState(new Map()); // Map<chave, tempo_realizado_ms>
  const temposRealizadosRef = useRef(new Map()); // Ref para acesso em funções não-hook

  // Array inicial de blocos vazios (cards sem conteúdo)
  // Máximo de 9 módulos permitidos
  // Cada bloco possui um ID fixo para futura persistência
  const blocosIniciais = [
    { id: 'bloco-1', x: 0, y: 0, w: 4, h: 3 },
    { id: 'bloco-2', x: 4, y: 0, w: 4, h: 3 },
    { id: 'bloco-3', x: 8, y: 0, w: 4, h: 3 },
    { id: 'bloco-4', x: 0, y: 3, w: 4, h: 3 },
    { id: 'bloco-5', x: 4, y: 3, w: 4, h: 3 },
    { id: 'bloco-6', x: 8, y: 3, w: 4, h: 3 },
    { id: 'bloco-7', x: 0, y: 6, w: 4, h: 3 },
    { id: 'bloco-8', x: 4, y: 6, w: 4, h: 3 },
    { id: 'bloco-9', x: 8, y: 6, w: 4, h: 3 }
  ];

const MIN_W_TAREFAS = 7;
const MIN_H_TAREFAS = 6;

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

  const getNomeProduto = (id) => nomesCache.produtos[String(id)] || `Produto #${id}`;
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
    console.warn(`[PainelUsuario] Nome não encontrado para tarefa ${idStr}. Cache:`, cacheAtual.tarefas);
    return `Tarefa #${idStr}`;
  };
  const getNomeCliente = (id) => nomesCache.clientes[String(id)] || `Cliente #${id}`;
  const getNomeColaborador = (id) => nomesCache.colaboradores[String(id)] || `Colaborador #${id}`;

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
  const criarChaveRegistro = useCallback((clienteId, tarefaId) => {
    return `${String(clienteId).trim()}_${String(tarefaId).trim()}`;
  }, []);

  // Helper: Criar chave de tempo (cliente_id + tarefa_id + tempo_estimado_id)
  const criarChaveTempo = useCallback((reg) => {
    const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
    if (!tempoEstimadoId) return null;
    return `${String(reg.cliente_id).trim()}_${String(reg.tarefa_id).trim()}_${String(tempoEstimadoId).trim()}`;
  }, []);

  // Helper: Atualizar renderização de todas as tarefas
  const atualizarRenderizacaoTarefas = useCallback(() => {
    if (tarefasRegistrosRef.current.length > 0) {
      const cardsComTarefas = document.querySelectorAll('.grid-item-content-board');
      cardsComTarefas.forEach((card) => {
        renderTarefasNoCard(tarefasRegistrosRef.current, card);
      });
    }
  }, []);

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

  // Sincronizar refs com estados
  useEffect(() => {
    timetracksDataRef.current = timetracksData;
  }, [timetracksData]);
  
  useEffect(() => {
    timetracksExpandidosRef.current = timetracksExpandidos;
  }, [timetracksExpandidos]);

  // Função para buscar registros de tempo individuais de uma tarefa
  const buscarRegistrosTimetrack = useCallback(async (reg) => {
    const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
    if (!tempoEstimadoId) return [];
    
    const chaveTimetrack = criarChaveTempo(reg);
    if (!chaveTimetrack) return [];
    
    // Verificar se já está no cache (usar ref para acesso síncrono)
    if (timetracksDataRef.current.has(chaveTimetrack)) {
      return timetracksDataRef.current.get(chaveTimetrack);
    }
    
    try {
      const response = await fetch(`/api/registro-tempo/por-tempo-estimado?tempo_estimado_id=${tempoEstimadoId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const registros = result.data.map(r => ({
            id: r.id,
            tempo_realizado: r.tempo_realizado || 0,
            data_inicio: r.data_inicio,
            data_fim: r.data_fim,
            created_at: r.created_at
          }));
          
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
      console.error('[PainelUsuario] Erro ao buscar registros timetrack:', error);
      return [];
    }
  }, [criarChaveTempo]);

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
      <div class="painel-usuario-timetracks-list" style="margin-top: 8px; padding-left: 12px; display: flex; flex-direction: column; gap: 6px;">
        ${registros.map((registro, idx) => {
          const tempoRealizado = Number(registro.tempo_realizado) || 0;
          let tempoMs = tempoRealizado < 1 ? Math.round(tempoRealizado * 3600000) : tempoRealizado;
          if (tempoMs > 0 && tempoMs < 1000) tempoMs = 1000;
          const tempoFormatado = formatarTempoHMS(tempoMs);
          
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
            : '';
          
          return `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; background: #f9fafb; padding: 6px 10px; border-radius: 6px; border: 1px solid #e5e7eb;">
              <span style="font-weight: 600; color: #374151;">${tempoFormatado}</span>
              <span style="color: #6b7280;">${dataFormatada}</span>
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
    // Limitar a barra de excesso a um máximo de 10% da largura da barra base
    // Isso garante que sempre apareça quando houver excesso, mas nunca fique muito grande
    const porcentagemExcessoBruta = porcentagem > 100 ? porcentagem - 100 : 0;
    const porcentagemExcesso = porcentagemExcessoBruta > 0 ? Math.min(10, porcentagemExcessoBruta) : 0;
    
    // Cor: laranja padrão (#f59e0b) se <= 100%, vermelho se > 100%
    const corBarra = porcentagem > 100 ? '#dc2626' : '#f59e0b';
    
    const porcentagemFormatada = porcentagem.toFixed(0);
    
    if (modo === 'quadro') {
      // Modo quadro: barra abaixo do nome
      return `
        <div class="painel-usuario-barra-progresso-wrapper painel-usuario-barra-progresso-quadro" style="margin-top: 8px;">
          <div class="painel-usuario-barra-progresso-container">
            <div class="painel-usuario-barra-progresso-base painel-usuario-barra-progresso-base-quadro">
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

    try {
      const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
      if (!tempoEstimadoId) return 0;

      const response = await fetch(
        `/api/registro-tempo/realizado?usuario_id=${usuario.id}&tarefa_id=${reg.tarefa_id}&cliente_id=${reg.cliente_id}&tempo_estimado_id=${tempoEstimadoId}`,
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
      console.warn('[TimeTracking] Erro ao buscar tempo realizado:', error);
      return 0;
    }
  }, [usuario]);

  // Função para iniciar registro de tempo
  const iniciarRegistroTempo = useCallback(async (reg) => {
    if (!usuario?.id) {
      alert('Usuário não encontrado');
      return;
    }

    try {
      // Verificar se já existe registro ativo para esta tarefa neste cliente
      const chaveRegistro = criarChaveRegistro(reg.cliente_id, reg.tarefa_id);
      if (registrosAtivosRef.current.has(chaveRegistro)) {
        return; // Já existe registro ativo para esta tarefa
      }

      // ANTES DE INICIAR: Parar qualquer registro ativo anterior
      // Não é permitido ter mais de um registro ativo ao mesmo tempo
      if (registrosAtivosRef.current.size > 0) {
        // Encontrar o primeiro registro ativo
        const [chaveRegistroAtivo, registroAtivo] = Array.from(registrosAtivosRef.current.entries())[0];
        
        // Buscar o registro completo nas tarefas registradas
        const [clienteIdAtivo, tarefaIdAtivo] = chaveRegistroAtivo.split('_');
        const regAtivo = tarefasRegistrosRef.current.find(r => 
          String(r.cliente_id).trim() === clienteIdAtivo && 
          String(r.tarefa_id).trim() === tarefaIdAtivo
        );
        
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
              novoRegistrosAtivos.delete(chaveRegistroAtivo);
              registrosAtivosRef.current = novoRegistrosAtivos;
              setRegistrosAtivos(novoRegistrosAtivos);

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
            console.warn('[TimeTracking] Erro ao parar registro anterior:', error);
            // Continua mesmo se houver erro ao parar o anterior
          }
        }
      }

      // Buscar o ID do tempo_estimado
      const tempoEstimadoId = reg.id || reg.tempo_estimado_id;
      if (!tempoEstimadoId) {
        alert('Erro: ID do tempo estimado não encontrado');
        return;
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
          tempo_estimado_id: String(tempoEstimadoId).trim(),
          cliente_id: String(reg.cliente_id).trim(),
          usuario_id: parseInt(usuario.id, 10)
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        alert(result.error || 'Erro ao iniciar registro de tempo');
        return;
      }

      // Atualizar estado com o registro ativo
      const novoRegistrosAtivos = new Map(registrosAtivosRef.current);
      novoRegistrosAtivos.set(chaveRegistro, {
        registro_id: result.data.id,
        data_inicio: result.data.data_inicio
      });
      registrosAtivosRef.current = novoRegistrosAtivos;
      setRegistrosAtivos(novoRegistrosAtivos);

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

      // Re-renderizar tarefas
      atualizarRenderizacaoTarefas();
    } catch (error) {
      console.error('[TimeTracking] Erro ao iniciar registro:', error);
      alert('Erro ao iniciar registro de tempo');
    }
  }, [usuario, criarChaveRegistro, criarChaveTempo, buscarTempoRealizado, atualizarRenderizacaoTarefas]);

  // Função para parar registro de tempo
  const pararRegistroTempo = useCallback(async (reg) => {
    if (!usuario?.id) {
      alert('Usuário não encontrado');
      return;
    }

    try {
      const chaveRegistro = criarChaveRegistro(reg.cliente_id, reg.tarefa_id);
      const registroAtivo = registrosAtivosRef.current.get(chaveRegistro);
      
      if (!registroAtivo?.registro_id) {
        return; // Nenhum registro ativo encontrado
      }

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
        return;
      }

      // Remover do estado de registros ativos
      const novoRegistrosAtivos = new Map(registrosAtivosRef.current);
      novoRegistrosAtivos.delete(chaveRegistro);
      registrosAtivosRef.current = novoRegistrosAtivos;
      setRegistrosAtivos(novoRegistrosAtivos);

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
      window.dispatchEvent(new CustomEvent('registro-tempo-finalizado'));

      // Re-renderizar tarefas
      atualizarRenderizacaoTarefas();
    } catch (error) {
      console.error('[TimeTracking] Erro ao finalizar registro:', error);
      alert('Erro ao finalizar registro de tempo');
    }
  }, [usuario, criarChaveRegistro, criarChaveTempo, buscarTempoRealizado, atualizarRenderizacaoTarefas]);

  // Função auxiliar para atualizar tempos realizados totais nos headers dos clientes
  const atualizarTemposRealizadosHeaders = useCallback(() => {
    const temposAtuais = temposRealizadosRef.current;
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
          tempoRealizadoElement.innerHTML = `<i class="fas fa-stopwatch painel-usuario-realizado-icon-inline" style="margin-right: 4px;"></i>${tempoRealizadoFormatado}<div class="filter-tooltip">Tempo realizado</div>`;
          tempoRealizadoElement.classList.add('has-tooltip');
        } else {
          // Criar novo elemento
          tempoRealizadoElement = document.createElement('span');
          tempoRealizadoElement.className = 'painel-usuario-grupo-tempo-realizado has-tooltip';
          tempoRealizadoElement.innerHTML = `<i class="fas fa-stopwatch painel-usuario-realizado-icon-inline" style="margin-right: 4px;"></i>${tempoRealizadoFormatado}<div class="filter-tooltip">Tempo realizado</div>`;
          
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
  }, [criarChaveTempo]);

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
      console.error('[TimeTracking] Erro ao buscar tempos realizados:', error);
    }
  }, [usuario, buscarTempoRealizado, criarChaveTempo, atualizarTemposRealizadosHeaders]);

  // Função para verificar registros ativos ao carregar tarefas
  const verificarRegistrosAtivos = useCallback(async () => {
    if (!usuario?.id || tarefasRegistrosRef.current.length === 0) {
      return;
    }

    try {
      // Buscar registros ativos para todas as tarefas (considerando cliente_id também)
      const tarefasUnicas = tarefasRegistrosRef.current
        .map(r => ({
          tarefa_id: String(r.tarefa_id).trim(),
          cliente_id: String(r.cliente_id).trim()
        }))
        .filter(r => r.tarefa_id && r.cliente_id);
      
      // Remover duplicatas usando Map
      const tarefasUnicasMap = new Map();
      tarefasUnicas.forEach(t => {
        const chave = criarChaveRegistro(t.cliente_id, t.tarefa_id);
        if (!tarefasUnicasMap.has(chave)) {
          tarefasUnicasMap.set(chave, t);
        }
      });
      
      const novosRegistrosAtivos = new Map();

      await Promise.all(
        Array.from(tarefasUnicasMap.values()).map(async (tarefa) => {
          try {
            const response = await fetch(
              `/api/registro-tempo/ativo?usuario_id=${usuario.id}&tarefa_id=${tarefa.tarefa_id}&cliente_id=${tarefa.cliente_id}`,
              {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              }
            );

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.data) {
                const chaveRegistro = criarChaveRegistro(tarefa.cliente_id, tarefa.tarefa_id);
                novosRegistrosAtivos.set(chaveRegistro, {
                  registro_id: result.data.id,
                  data_inicio: result.data.data_inicio
                });
              }
            }
          } catch (error) {
            // Erro silencioso - continua verificando outras tarefas
          }
        })
      );

      registrosAtivosRef.current = novosRegistrosAtivos;
      setRegistrosAtivos(novosRegistrosAtivos);
    } catch (error) {
      console.error('[TimeTracking] Erro ao verificar registros ativos:', error);
    }
  }, [usuario, criarChaveRegistro]);

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

  const garantirTamanhoMinimoTarefas = useCallback((conteudoEl) => {
    if (!conteudoEl || !gridstackInstanceRef.current) return;
    const widgetEl = conteudoEl.closest('.grid-item');
    if (!widgetEl || !widgetEl.gridstackNode) return;
    const node = widgetEl.gridstackNode;
    const novoW = Math.max(node.w || 0, MIN_W_TAREFAS);
    const novoH = Math.max(node.h || 0, MIN_H_TAREFAS);
    gridstackInstanceRef.current.update(widgetEl, {
      w: novoW,
      h: novoH,
      minW: MIN_W_TAREFAS,
      minH: MIN_H_TAREFAS
    });
  }, []);

  const obterCardId = (card) => {
    if (!card) return null;
    const widgetEl = card.closest('.grid-item');
    if (!widgetEl) return null;
    return widgetEl.getAttribute('data-bloco-id') || null;
  };

  const obterModoVisualizacao = (cardId) => {
    if (!cardId) return 'quadro';
    // Tenta ler do DOM primeiro (mais atualizado), depois do estado
    try {
      const widgetEl = document.querySelector(`[data-bloco-id="${cardId}"]`);
      if (widgetEl && widgetEl.getAttribute('data-view-mode')) {
        return widgetEl.getAttribute('data-view-mode');
      }
    } catch (e) {}
    return modoVisualizacao[cardId] || 'quadro';
  };

  const alternarModoVisualizacao = useCallback((cardId, modoDesejado = null) => {
    if (!cardId) {
      console.warn('[PainelUsuario] cardId não fornecido para alternarModoVisualizacao');
      return;
    }
    setModoVisualizacao((prev) => {
      // Se modoDesejado foi fornecido, usa ele. Senão, alterna entre os modos
      const novoModo = modoDesejado || (prev[cardId] === 'lista' ? 'quadro' : 'lista');
      const novo = { ...prev, [cardId]: novoModo };
      // Armazenar no DOM imediatamente
      const widgetEl = document.querySelector(`[data-bloco-id="${cardId}"]`);
      if (widgetEl) {
        widgetEl.setAttribute('data-view-mode', novoModo);
      }
      // Re-renderizar tarefas após mudar o modo
      setTimeout(() => {
        // Usa ref para garantir acesso aos registros mais recentes
        const registrosAtuais = tarefasRegistrosRef.current || [];
        if (registrosAtuais.length > 0) {
          const card = document.querySelector(`[data-bloco-id="${cardId}"] .grid-item-content`);
          if (card) {
            renderTarefasNoCard(registrosAtuais, card);
          }
        }
      }, 50);
      return novo;
    });
  }, []);

  const renderTarefasNoCard = (registros, target) => {
    const card = target || menuPosicao.target;
    if (!card) {
      console.warn('[PainelUsuario] Card não fornecido para renderTarefasNoCard');
      return;
    }
    card.innerHTML = '';
    card.classList.add('grid-item-content-board');

    const cardId = obterCardId(card);
    if (!cardId) {
      console.warn('[PainelUsuario] cardId não encontrado para o card');
    }
    const modo = obterModoVisualizacao(cardId);
    // Armazenar modo no DOM para acesso futuro
    const widgetEl = card.closest('.grid-item');
    if (widgetEl && cardId) {
      widgetEl.setAttribute('data-view-mode', modo);
    }

    const wrapper = document.createElement('div');
    wrapper.style.height = '100%';
    wrapper.style.width = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '12px';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.minWidth = '0';

    const header = document.createElement('div');
    header.className = 'painel-usuario-header-board';
    
    const headerLeft = document.createElement('div');
    headerLeft.style.display = 'flex';
    headerLeft.style.flexDirection = 'column';
    headerLeft.style.gap = '4px';
    
    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.color = '#111827';
    title.style.fontSize = '14px';
    title.textContent = 'Minhas tarefas - hoje';
    headerLeft.appendChild(title);
    
    const subtitle = document.createElement('div');
    subtitle.style.fontSize = '12px';
    subtitle.style.color = '#6b7280';
    subtitle.textContent = `${registros.length} tarefa(s)`;
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
    if (cardId) {
      btnQuadro.addEventListener('click', (e) => {
        e.stopPropagation();
        alternarModoVisualizacao(cardId, 'quadro');
      });
    }
    toggleView.appendChild(btnQuadro);
    
    const btnLista = document.createElement('button');
    btnLista.type = 'button';
    btnLista.className = `painel-usuario-toggle-btn ${modo === 'lista' ? 'active' : ''}`;
    btnLista.setAttribute('data-mode', 'lista');
    btnLista.title = 'Visualização em Lista';
    btnLista.innerHTML = '<i class="fas fa-list"></i><span>Lista</span>';
    if (cardId) {
      btnLista.addEventListener('click', (e) => {
        e.stopPropagation();
        alternarModoVisualizacao(cardId, 'lista');
      });
    }
    toggleView.appendChild(btnLista);
    
    header.appendChild(toggleView);
    wrapper.appendChild(header);

    // Renderizar baseado no modo
    if (modo === 'lista') {
      renderTarefasEmLista(registros, wrapper);
    } else {
      renderTarefasEmQuadro(registros, wrapper);
    }

    card.appendChild(wrapper);
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

  const renderTarefasEmLista = (registros, wrapper) => {
    const lista = document.createElement('div');
    lista.className = 'painel-usuario-lista-container';
    lista.style.flex = '1';
    lista.style.overflowY = 'auto';
    lista.style.overflowX = 'hidden';
    lista.style.display = 'flex';
    lista.style.flexDirection = 'column';
    lista.style.gap = '0';

    if (registros.length === 0) {
      const vazio = document.createElement('div');
      vazio.style.color = '#6b7280';
      vazio.style.fontSize = '13px';
      vazio.style.textAlign = 'center';
      vazio.style.padding = '20px';
      vazio.textContent = 'Nenhuma tarefa para hoje.';
      lista.appendChild(vazio);
    } else {
      // Agrupar por cliente
      const gruposPorCliente = registros.reduce((acc, reg) => {
        const clienteNome = reg.cliente_nome || reg.cliente || getNomeCliente(reg.cliente_id);
        if (!acc[clienteNome]) acc[clienteNome] = [];
        acc[clienteNome].push(reg);
        return acc;
      }, {});

      Object.entries(gruposPorCliente).forEach(([clienteNome, items]) => {
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
            ${tempoTotal > 0 ? `<span class="painel-usuario-grupo-tempo-total has-tooltip"><i class="fas fa-clock" style="color: #0e3b6f; font-size: 12px; margin-right: 4px;"></i>${tempoTotalFormatado}<div class="filter-tooltip">Tempo estimado</div></span>` : ''}
            ${tempoRealizadoTotal > 0 ? `<span class="painel-usuario-grupo-tempo-realizado has-tooltip"><i class="fas fa-stopwatch painel-usuario-realizado-icon-inline" style="margin-right: 4px;"></i>${tempoRealizadoFormatado}<div class="filter-tooltip">Tempo realizado</div></span>` : ''}
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
            const chaveRegistro = criarChaveRegistro(reg.cliente_id, reg.tarefa_id);
            const registroAtivo = registrosAtivosRef.current.get(chaveRegistro);
            const isAtivo = !!registroAtivo;
            const btnClass = isAtivo ? 'painel-usuario-stop-btn' : 'painel-usuario-play-btn';
            const btnIcon = isAtivo ? 'fa-stop' : 'fa-play';
            const btnTitle = isAtivo ? 'Parar registro de tempo' : 'Iniciar registro de tempo';
            const btnAction = isAtivo ? 'parar' : 'iniciar';
            
            item.innerHTML = `
              <div class="painel-usuario-tarefa-item-lista-content">
                <div class="painel-usuario-tarefa-item-lista-main">
                  <div class="painel-usuario-tarefa-item-lista-left">
                    <div class="painel-usuario-tarefa-nome">
                      ${getNomeTarefa(reg.tarefa_id, reg)}
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px; align-items: center;">
                    <button
                      type="button"
                      class="${btnClass}"
                      title="${btnTitle}"
                      data-tarefa-id="${reg.tarefa_id || ''}"
                      data-cliente-id="${reg.cliente_id || ''}"
                      data-action="${btnAction}"
                    >
                      <i class="fas ${btnIcon}"></i>
                    </button>
                    ${(() => {
                      const chaveTimetrack = criarChaveTempo(reg);
                      const isTimetrackExpanded = timetracksExpandidos.has(chaveTimetrack);
                      return `
                        <button
                          type="button"
                          class="painel-usuario-expand-timetrack-btn"
                          title="${isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais'}"
                          data-chave-timetrack="${chaveTimetrack}"
                          style="background: transparent; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 6px; cursor: pointer; color: #6b7280; font-size: 11px; display: flex; align-items: center; gap: 4px; transition: all 0.2s;"
                        >
                          <i class="fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'}" style="font-size: 9px;"></i>
                          <span>Timetrack</span>
                        </button>
                      `;
                    })()}
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
                    <i class="fas fa-stopwatch painel-usuario-realizado-icon-inline"></i>
                    <span class="painel-usuario-realizado-label">Realizado:</span>
                    <span class="painel-usuario-realizado-pill" data-tarefa-id="${reg.tarefa_id}" data-cliente-id="${reg.cliente_id}">${obterTempoRealizadoFormatado(reg)}</span>
                  </span>
                  ${renderizarBarraProgressoTarefa(reg, 'lista')}
                </div>
                <div class="painel-usuario-timetracks-container">
                  ${(() => {
                    const chaveTimetrack = criarChaveTempo(reg);
                    const isTimetrackExpanded = timetracksExpandidos.has(chaveTimetrack);
                    return isTimetrackExpanded ? renderizarTimetracksIndividuais(reg) : '';
                  })()}
                </div>
              </div>
            `;
            
            // Adicionar event listener ao botão play/stop
            const btn = item.querySelector(`button[data-action]`);
            if (btn) {
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const action = btn.getAttribute('data-action');
                if (action === 'iniciar') {
                  iniciarRegistroTempo(reg);
                } else if (action === 'parar') {
                  pararRegistroTempo(reg);
                }
              });
            }
            
            // Adicionar event listener ao botão de expandir timetrack
            const expandBtn = item.querySelector('.painel-usuario-expand-timetrack-btn');
            if (expandBtn) {
              // Remover listeners anteriores para evitar duplicação
              const newExpandBtn = expandBtn.cloneNode(true);
              expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);
              
              newExpandBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const chave = newExpandBtn.getAttribute('data-chave-timetrack');
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
                  // Se não existe, criar e adicionar após os tags
                  timetracksContainer = document.createElement('div');
                  timetracksContainer.className = 'painel-usuario-timetracks-container';
                  const tagsContainer = itemContent.querySelector('.painel-usuario-tarefa-tags');
                  if (tagsContainer && tagsContainer.parentNode) {
                    tagsContainer.parentNode.insertBefore(timetracksContainer, tagsContainer.nextSibling);
                  } else {
                    itemContent.appendChild(timetracksContainer);
                  }
                }
                
                if (timetracksContainer) {
                  timetracksContainer.innerHTML = timetracksHtml;
                }
                
                // Atualizar ícone do botão
                const icon = newExpandBtn.querySelector('i');
                if (icon) {
                  icon.className = `fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'}`;
                  icon.style.fontSize = '9px';
                }
                newExpandBtn.setAttribute('title', isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais');
              });
            }
            
            // Garantir que cliques no item não bloqueiem o header
            item.addEventListener('click', (e) => {
              // Se não foi o botão que foi clicado, não fazer nada (deixar propagar)
              if (e.target !== btn && !btn.contains(e.target)) {
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

  const renderTarefasEmQuadro = (registros, wrapper) => {

    const board = document.createElement('div');
    board.style.flex = '1';
    board.style.overflowY = 'auto';
    board.style.overflowX = 'hidden';
    board.style.display = 'flex';
    board.style.gap = '12px';
    board.style.alignItems = 'flex-start';

    if (registros.length === 0) {
      const vazio = document.createElement('div');
      vazio.style.color = '#6b7280';
      vazio.style.fontSize = '13px';
      vazio.style.textAlign = 'center';
      vazio.style.padding = '10px';
      vazio.textContent = 'Nenhuma tarefa para hoje.';
      board.appendChild(vazio);
    } else {
      // Agrupar por cliente
      const gruposPorCliente = registros.reduce((acc, reg) => {
        const clienteNome = reg.cliente_nome || reg.cliente || getNomeCliente(reg.cliente_id);
        if (!acc[clienteNome]) acc[clienteNome] = [];
        acc[clienteNome].push(reg);
        return acc;
      }, {});

      Object.entries(gruposPorCliente).forEach(([clienteNome, items]) => {
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
        coluna.style.maxWidth = '320px';
        coluna.style.flex = '1 1 240px';
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
        colunaHeader.style.flexWrap = 'wrap';
        
        // Nome do cliente
        const clienteNomeEl = document.createElement('div');
        clienteNomeEl.textContent = clienteNome;
        clienteNomeEl.style.flexShrink = '0';
        colunaHeader.appendChild(clienteNomeEl);
        
        // Container para as informações de tempo (na mesma linha, alinhado à direita)
        const tempoInfoContainer = document.createElement('div');
        tempoInfoContainer.style.display = 'flex';
        tempoInfoContainer.style.alignItems = 'center';
        tempoInfoContainer.style.gap = '8px';
        tempoInfoContainer.style.flexWrap = 'wrap';
        tempoInfoContainer.style.marginLeft = 'auto';
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
          const chaveRegistro = criarChaveRegistro(reg.cliente_id, reg.tarefa_id);
          const registroAtivo = registrosAtivosRef.current.get(chaveRegistro);
          const isAtivo = !!registroAtivo;
          const btnClass = isAtivo ? 'painel-usuario-stop-btn' : 'painel-usuario-play-btn';
          const btnIcon = isAtivo ? 'fa-stop' : 'fa-play';
          const btnTitle = isAtivo ? 'Parar registro de tempo' : 'Iniciar registro de tempo';
          const btnAction = isAtivo ? 'parar' : 'iniciar';
          
          const chaveTimetrack = criarChaveTempo(reg);
          const isTimetrackExpanded = timetracksExpandidos.has(chaveTimetrack);
          
          item.innerHTML = `
            <div class="painel-usuario-tarefa-top">
              <div class="painel-usuario-tarefa-nome">
                ${getNomeTarefa(reg.tarefa_id, reg)}
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button
                  type="button"
                  class="${btnClass}"
                  title="${btnTitle}"
                  data-tarefa-id="${reg.tarefa_id || ''}"
                  data-action="${btnAction}"
                >
                  <i class="fas ${btnIcon}"></i>
                </button>
                <button
                  type="button"
                  class="painel-usuario-expand-timetrack-btn"
                  title="${isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais'}"
                  data-chave-timetrack="${chaveTimetrack}"
                  style="background: transparent; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 6px; cursor: pointer; color: #6b7280; font-size: 11px; display: flex; align-items: center; gap: 4px; transition: all 0.2s;"
                >
                  <i class="fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'}" style="font-size: 9px;"></i>
                  <span>Timetrack</span>
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
                <i class="fas fa-stopwatch painel-usuario-realizado-icon-inline"></i>
                <span class="painel-usuario-realizado-label">Realizado:</span>
                <span class="painel-usuario-realizado-pill" data-tarefa-id="${reg.tarefa_id}" data-cliente-id="${reg.cliente_id}">${obterTempoRealizadoFormatado(reg)}</span>
              </span>
            </div>
            <div class="painel-usuario-timetracks-container">
              ${isTimetrackExpanded ? renderizarTimetracksIndividuais(reg) : ''}
            </div>
          `;
          
          // Adicionar event listener ao botão play/stop
          const btn = item.querySelector(`button[data-action]`);
          if (btn) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const action = btn.getAttribute('data-action');
              if (action === 'iniciar') {
                iniciarRegistroTempo(reg);
              } else if (action === 'parar') {
                pararRegistroTempo(reg);
              }
            });
          }
          
          // Adicionar event listener ao botão de expandir timetrack
          const expandBtn = item.querySelector('.painel-usuario-expand-timetrack-btn');
          if (expandBtn) {
            // Remover listeners anteriores para evitar duplicação
            const newExpandBtn = expandBtn.cloneNode(true);
            expandBtn.parentNode.replaceChild(newExpandBtn, expandBtn);
            
            newExpandBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const chave = newExpandBtn.getAttribute('data-chave-timetrack');
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
              
              // Atualizar ícone do botão
              const icon = newExpandBtn.querySelector('i');
              if (icon) {
                icon.className = `fas fa-chevron-${isTimetrackExpanded ? 'down' : 'right'}`;
                icon.style.fontSize = '9px';
              }
              newExpandBtn.setAttribute('title', isTimetrackExpanded ? 'Ocultar timetracks' : 'Ver timetracks individuais');
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
        const tarefasFaltando = tarefasIdsArray.filter(id => !novos.tarefas[id]);
        
        if (tarefasFaltando.length > 0) {
          // Usar a rota de múltiplos IDs para buscar todas as tarefas de uma vez
          const idsParam = tarefasFaltando.join(',');
          console.log('[PainelUsuario] Buscando nomes de tarefas para IDs:', tarefasFaltando);
          
          const response = await fetch(`/api/tarefas-por-ids?ids=${idsParam}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('[PainelUsuario] Resposta da API tarefas-por-ids:', result);
            
            if (result.success && result.data) {
              // result.data é um objeto { id: nome }
              // Os IDs podem vir como números ou strings, garantir que sejam strings
              Object.entries(result.data).forEach(([id, nome]) => {
                const idStr = String(id);
                if (nome && nome.trim()) {
                  novos.tarefas[idStr] = nome.trim();
                  console.log(`[PainelUsuario] Nome carregado para tarefa ${idStr}:`, nome.trim());
                } else {
                  novos.tarefas[idStr] = `tarefa #${idStr}`;
                  console.warn(`[PainelUsuario] Nome vazio para tarefa ${idStr}, usando fallback`);
                }
              });
            } else {
              console.warn('[PainelUsuario] Resposta da API não contém dados válidos:', result);
            }
          } else {
            console.warn('[PainelUsuario] Erro ao buscar tarefas por IDs:', response.status, response.statusText);
          }
          
          // Para tarefas que não foram encontradas na busca em lote, usar fallback
          tarefasFaltando.forEach(id => {
            const idStr = String(id);
            if (!novos.tarefas[idStr]) {
              novos.tarefas[idStr] = `tarefa #${idStr}`;
              console.warn(`[PainelUsuario] Tarefa ${idStr} não encontrada na API, usando fallback`);
            }
          });
        }
      } catch (err) {
        console.warn('[PainelUsuario] Erro ao carregar tarefas:', err);
        // Em caso de erro, usar fallback para todas as tarefas faltando
        Array.from(tarefasIds).forEach(id => {
          if (!novos.tarefas[id]) {
            novos.tarefas[id] = `tarefa #${id}`;
          }
        });
      }
    }
    
    // Buscar produtos em lote usando a rota de múltiplos IDs
    if (produtosIds.size > 0) {
      try {
        const produtosIdsArray = Array.from(produtosIds);
        const produtosFaltando = produtosIdsArray.filter(id => !novos.produtos[id]);
        
        if (produtosFaltando.length > 0) {
          // Usar a rota de múltiplos IDs para buscar todas os produtos de uma vez
          const idsParam = produtosFaltando.join(',');
          const response = await fetch(`/api/produtos-por-ids-numericos?ids=${idsParam}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });
          
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
          
          // Para produtos que não foram encontrados na busca em lote, usar fallback
          produtosFaltando.forEach(id => {
            if (!novos.produtos[id]) {
              novos.produtos[id] = `produto #${id}`;
            }
          });
        }
      } catch (err) {
        console.warn('[PainelUsuario] Erro ao carregar produtos:', err);
        // Em caso de erro, usar fallback para todos os produtos faltando
        Array.from(produtosIds).forEach(id => {
          if (!novos.produtos[id]) {
            novos.produtos[id] = `produto #${id}`;
          }
        });
      }
    }
    
    // Para clientes, tenta usar cache de lista em vez de chamar /clientes/:id
    if (clientesIds.size > 0) {
      const clientesIdsArray = Array.from(clientesIds);
      const clientesFaltando = clientesIdsArray.filter(id => !novos.clientes[id]);
      if (clientesFaltando.length > 0) {
        const lista = await carregarClientesLista();
        clientesFaltando.forEach(id => {
          if (lista && lista[id]) {
            novos.clientes[id] = lista[id];
          } else {
            novos.clientes[id] = `cliente #${id}`;
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

    console.log('[PainelUsuario] Atualizando cache de nomes. Tarefas no cache:', Object.keys(novos.tarefas).length, novos.tarefas);
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
      console.warn('[PainelUsuario] Erro ao carregar colaboradores', e);
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
            const nome =
              c.nome ||
              c.nome_fantasia ||
              c.razao_social ||
              c.cliente_nome ||
              c.nome_cliente ||
              `Cliente #${id}`;
            if (id) mapa[id] = nome;
          });
          setClientesListaCache(mapa);
          return mapa;
        }
      }
    } catch (e) {
      console.warn('[PainelUsuario] Erro ao carregar lista de clientes', e);
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

  const carregarMinhasTarefas = useCallback(async (alvoManual = null) => {
    if (!usuario || !usuario.id) {
      return;
    }
    const alvoReferencia = alvoManual || menuPosicao.target;
    garantirTamanhoMinimoTarefas(alvoReferencia);
    setCarregandoTarefas(true);
    try {
      const hoje = new Date();
      const yyyy = hoje.getFullYear();
      const mm = String(hoje.getMonth() + 1).padStart(2, '0');
      const dd = String(hoje.getDate()).padStart(2, '0');
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
        responsavelIdDescoberto,
        RESPONSAVEL_ID_FIXO
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

      console.info('[PainelUsuario] Usuario atual:', usuario);
      console.info('[PainelUsuario] Usuario storage:', usuarioStorage);
      console.info('[PainelUsuario] IDs possíveis para filtro:', idsPossiveis);

      const idsUnicos = Array.from(new Set(idsPossiveis));
      if (idsUnicos.length === 0) {
        console.warn('[PainelUsuario] Nenhum ID encontrado para responsável, usando fallback data-only');
      } else {
        idsUnicos.forEach((id) => params.append('responsavel_id', id));
      }

      params.append('data_inicio', dataStr);
      params.append('data_fim', dataStr);
      params.append('limit', '200');
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
          console.info('[PainelUsuario] Tarefas carregadas (apenas responsavel_id):', registros.length);
        } else {
          console.warn('[PainelUsuario] Nenhum dado retornado para minhas tarefas', result);
        }
      } else {
        console.warn('[PainelUsuario] Falha HTTP ao carregar minhas tarefas', response.status);
      }

      // Filtra em memória apenas registros do dia atual E do responsável correto
      const ehHoje = (data) => {
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
      
      // Filtrar por data de hoje E responsável
      const idsUnicosSet = new Set(idsUnicos);
      registros = registros.filter((r) => {
        const dataOk = ehHoje(r.data);
        const responsavelOk = idsUnicosSet.has(String(r.responsavel_id)) || 
                             idsUnicosSet.has(Number(r.responsavel_id));
        return dataOk && responsavelOk;
      });
      console.info('[PainelUsuario] Após filtro por data=hoje E responsável (memória):', registros.length);

      // Remover fallbacks que podem trazer dados incorretos
      // Se não encontrou nada, é porque realmente não há tarefas para hoje do usuário
      // Não fazer fallbacks que buscam sem data ou sem responsável, pois podem trazer dados incorretos

      if (registros.length > 0) {
        // Carregar nomes primeiro e aguardar atualização do cache
        await carregarNomesRelacionados(registros);
        
        // Aguardar um tick para garantir que o estado do cache foi atualizado
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Atualizar referência e estado
        tarefasRegistrosRef.current = registros;
        setTarefasRegistros(registros);
        
        // Verificar registros ativos e buscar tempos realizados antes de renderizar
        await Promise.all([
          verificarRegistrosAtivos(),
          buscarTemposRealizados()
        ]);
        
        // Aguardar um tick adicional e usar o cache atualizado do estado
        setTimeout(() => {
          // Forçar re-renderização usando o estado atualizado do cache
          renderTarefasNoCard(registros, alvoManual);
        }, 100);
      } else {
        tarefasRegistrosRef.current = [];
        setTarefasRegistros([]);
        renderTarefasNoCard([], alvoManual);
      }
    } catch (e) {
      console.error('[PainelUsuario] Erro ao carregar minhas tarefas:', e);
      tarefasRegistrosRef.current = [];
      setTarefasRegistros([]);
      renderTarefasNoCard([], alvoManual);
    } finally {
      setCarregandoTarefas(false);
    }
  }, [usuario, carregarNomesRelacionados, garantirTamanhoMinimoTarefas, menuPosicao, modoVisualizacao, tarefasRegistros, verificarRegistrosAtivos, buscarTemposRealizados]);

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
    }, 1000); // Atualizar a cada 1 segundo

    return () => clearInterval(intervalId);
  }, [registrosAtivos, buscarTempoRealizado, criarChaveTempo, atualizarTemposRealizadosHeaders]);

  // Escutar evento de finalização de registro de tempo (quando parado pelo header)
  useEffect(() => {
    const handleRegistroFinalizado = async () => {
      // Verificar registros ativos novamente
      await verificarRegistrosAtivos();
      
      // Buscar tempos realizados atualizados
      await buscarTemposRealizados();
      
      // Re-renderizar todas as tarefas para atualizar os botões
      atualizarRenderizacaoTarefas();
    };

    window.addEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    
    return () => {
      window.removeEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    };
  }, [verificarRegistrosAtivos, buscarTemposRealizados, atualizarRenderizacaoTarefas]);

  // Re-renderizar tarefas quando clientes expandidos mudarem (modo lista)
  useEffect(() => {
    if (tarefasRegistrosRef.current.length > 0) {
      // Verifica se há algum card com tarefas renderizadas
      const cardsComTarefas = document.querySelectorAll('.grid-item-content-board');
      if (cardsComTarefas.length > 0) {
        cardsComTarefas.forEach((card) => {
          const cardId = obterCardId(card);
          if (cardId) {
            const modo = obterModoVisualizacao(cardId);
            if (modo === 'lista') {
              renderTarefasNoCard(tarefasRegistrosRef.current, card);
            }
          }
        });
      }
    }
  }, [clientesExpandidosLista]);

  useEffect(() => {
    /**
     * Cria um elemento DOM para um bloco
     * @param {string} id - ID único do bloco
     * @returns {HTMLElement} Elemento criado
     */
    const criarElementoBloco = (id) => {
      const bloco = document.createElement('div');
      bloco.className = 'grid-item';
      bloco.setAttribute('data-bloco-id', id);

      // Handle para arrastar (indicador visual de arrastabilidade)
      const handle = document.createElement('div');
      handle.className = 'grid-item-handle';
      handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
      bloco.appendChild(handle);

      // Conteúdo do bloco (vazio conforme especificado)
      const conteudo = document.createElement('div');
      conteudo.className = 'grid-item-content';
      conteudo.innerHTML = '<div class="grid-item-empty"><i class="fas fa-plus"></i></div>';
      bloco.appendChild(conteudo);

      // Clique no "+" abre menu contextual
      const botao = conteudo.querySelector('.grid-item-empty');
      if (botao) {
        botao.style.cursor = 'pointer';
        botao.addEventListener('click', (e) => {
          e.stopPropagation();
          const rect = botao.getBoundingClientRect();
          setMenuPosicao({
            open: true,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8,
            target: conteudo
          });
        });
      }

      return bloco;
    };

    // Função para inicializar o Gridstack
    const inicializarGridstack = () => {
      // Previne múltiplas inicializações
      if (inicializadoRef.current) {
        return;
      }

      // Verifica se Gridstack está disponível
      if (typeof window === 'undefined' || typeof window.GridStack === 'undefined') {
        console.error('Gridstack.js não está carregado. Verifique se o script foi adicionado no index.html');
        return;
      }

      // Verifica se já existe uma instância e se o grid já foi inicializado
      if (!gridRef.current || gridstackInstanceRef.current) {
        return;
      }

      // Marca como inicializado antes de continuar
      inicializadoRef.current = true;

      // Limpa qualquer conteúdo existente no container
      if (gridRef.current) {
        gridRef.current.innerHTML = '';
      }

      // Cria a instância do Gridstack
      // Configurações: 12 colunas, altura mínima dos itens, etc.
      gridstackInstanceRef.current = window.GridStack.init({
        column: 12,
        cellHeight: 60,
        margin: 10,
        resizable: {
          handles: 'e, se, s, sw, w, nw, n, ne'
        },
        draggable: {
          handle: '.grid-item-handle',
          appendTo: 'parent'
        },
        minRow: 1,
        float: false,
        disableOneColumnMode: true
      }, gridRef.current);

      // Adiciona os blocos iniciais ao grid
      // Verifica se já existem widgets antes de adicionar
      const widgetsExistentes = gridstackInstanceRef.current.engine.nodes.length;
      if (widgetsExistentes === 0) {
        blocosIniciais.forEach((bloco) => {
          // Verifica se o bloco já existe antes de adicionar
          const existe = gridstackInstanceRef.current.engine.nodes.some(
            node => node.id === bloco.id
          );
          
          if (!existe) {
            const elemento = criarElementoBloco(bloco.id);
            gridstackInstanceRef.current.addWidget(elemento, {
              x: bloco.x,
              y: bloco.y,
              w: bloco.w,
              h: bloco.h,
              noResize: false,
              noMove: false,
              id: bloco.id
            });
          }
        });
      }

      // Listener para mudanças no grid (útil para futura persistência)
      gridstackInstanceRef.current.on('change', (event, items) => {
        console.log('Grid alterado:', items);
        // Aqui futuramente será implementada a persistência dos layouts
      });

      // Listener para quando um item é arrastado
      gridstackInstanceRef.current.on('dragstop', (event, element) => {
        const node = element.gridstackNode;
        console.log('Bloco arrastado:', {
          id: node.id,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h
        });
      });

      // Listener para quando um item é redimensionado
      gridstackInstanceRef.current.on('resizestop', (event, element) => {
        const node = element.gridstackNode;
        console.log('Bloco redimensionado:', {
          id: node.id,
          x: node.x,
          y: node.y,
          w: node.w,
          h: node.h
        });
      });
    };

    // Aguarda o carregamento do Gridstack (com timeout de segurança)
    let intervalo = null;
    if (typeof window !== 'undefined' && window.GridStack) {
      // Se já estiver carregado, inicializa imediatamente
      inicializarGridstack();
    } else {
      // Se não estiver carregado, aguarda até que esteja disponível
      let tentativas = 0;
      const maxTentativas = 50; // 5 segundos máximo
      intervalo = setInterval(() => {
        tentativas++;
        if (typeof window !== 'undefined' && window.GridStack) {
          clearInterval(intervalo);
          inicializarGridstack();
        } else if (tentativas >= maxTentativas) {
          clearInterval(intervalo);
          console.error('Gridstack.js não foi carregado dentro do tempo esperado');
        }
      }, 100);
    }

    // Cleanup: destroi a instância do Gridstack quando o componente desmonta
    return () => {
      if (intervalo) {
        clearInterval(intervalo);
      }
      if (gridstackInstanceRef.current) {
        // Remove todos os widgets antes de destruir
        try {
          const nodes = gridstackInstanceRef.current.engine.nodes;
          nodes.forEach((node) => {
            const el = node.el;
            if (el && el.parentNode) {
              gridstackInstanceRef.current.removeWidget(el, false);
            }
          });
        } catch (e) {
          console.warn('Erro ao remover widgets:', e);
        }
        
        // Destrói a instância
        gridstackInstanceRef.current.destroy(false);
        gridstackInstanceRef.current = null;
      }
      
      // Limpa o conteúdo do container
      if (gridRef.current) {
        gridRef.current.innerHTML = '';
      }
      
      // Reseta a flag de inicialização
      inicializadoRef.current = false;
    };
  }, []);

  return (
    <Layout>
      <div className="painel-usuario-container">
        <div className="painel-usuario-header">
          <h1 className="painel-usuario-title">
            <i className="fas fa-th-large"></i> Painel do Usuário
          </h1>
          <p className="painel-usuario-subtitle">
            Organize seus blocos arrastando e redimensionando conforme necessário
          </p>
        </div>

        <div className="painel-usuario-content">
          {/* Container do Gridstack */}
          <div ref={gridRef} className="grid-stack" id="gridstack-container"></div>
        </div>

        {menuPosicao.open && (
          <div
            className="painel-usuario-menu"
            style={{
              position: 'fixed',
              left: menuPosicao.x,
              top: menuPosicao.y,
              transform: 'translate(-50%, 0)',
              background: '#fff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
              borderRadius: '10px',
              padding: '12px',
              zIndex: 2000,
              minWidth: '180px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ color: '#1f2937', fontSize: 14 }}>Adicionar</strong>
              <button
                onClick={() => setMenuPosicao({ open: false, x: 0, y: 0 })}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}
                title="Fechar"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <button
              type="button"
            className="painel-usuario-menu-item"
            style={{
              width: '100%',
              border: 'none',
              background: '#eef2ff',
              color: '#3730a3',
              padding: '10px 12px',
              borderRadius: 8,
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 600
            }}
            onClick={() => {
              const alvo = menuPosicao.target;
              setMenuPosicao({ open: false, x: 0, y: 0, target: null });
              setTarefasExpandidas(new Set());
              if (alvo) {
                mostrarLoadingNoAlvo(alvo);
                carregarMinhasTarefas(alvo);
              }
            }}
            >
              <i className="fas fa-list-check" style={{ marginRight: 8 }}></i>
              Minhas tarefas (hoje)
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PainelUsuario;

