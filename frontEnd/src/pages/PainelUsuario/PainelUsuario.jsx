import React, { useEffect, useRef, useState, useCallback } from 'react';
import Layout from '../../components/layout/Layout';
import { useAuth } from '../../contexts/AuthContext';
import AtribuicoesTabela from '../../components/atribuicoes/AtribuicoesTabela';
import { colaboradoresAPI } from '../../services/api';
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
  const [nomesCache, setNomesCache] = useState({
    produtos: {},
    tarefas: {},
    clientes: {},
    colaboradores: {}
  });
  const [clientesListaCache, setClientesListaCache] = useState(null);
  const [colaboradoresCache, setColaboradoresCache] = useState([]);
  const inicializadoRef = useRef(false);

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
  const getNomeTarefa = (id) => nomesCache.tarefas[String(id)] || `Tarefa #${id}`;
  const getNomeCliente = (id) => nomesCache.clientes[String(id)] || `Cliente #${id}`;
  const getNomeColaborador = (id) => nomesCache.colaboradores[String(id)] || `Colaborador #${id}`;

  const formatarTempoComCusto = (tempo, responsavelId) => {
    const valor = Number(tempo) || 0;
    // Se for milissegundos, converte para horas
    const horas = valor >= 1000 ? valor / 3600000 : valor;
    const horasFormatadas = Number.isInteger(horas) ? horas : horas.toFixed(1);
    return `${horasFormatadas}h`;
  };

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

  const renderTarefasNoCard = (registros, target) => {
    const card = target || menuPosicao.target;
    if (!card) return;
    card.innerHTML = '';
    card.classList.add('grid-item-content-board');

    const wrapper = document.createElement('div');
    wrapper.style.height = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '12px';

    const header = document.createElement('div');
    header.className = 'painel-usuario-header-board';
    header.innerHTML = `
      <div style="font-weight:700;color:#111827;font-size:14px;">Minhas tarefas - hoje</div>
      <div style="font-size:12px;color:#6b7280;">${registros.length} tarefa(s)</div>
    `;
    wrapper.appendChild(header);

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
        colunaHeader.textContent = clienteNome;
        coluna.appendChild(colunaHeader);

        const colunaBody = document.createElement('div');
        colunaBody.className = 'painel-usuario-coluna-body';
        colunaBody.style.padding = '10px';
        colunaBody.style.display = 'flex';
        colunaBody.style.flexDirection = 'column';
        colunaBody.style.gap = '8px';

        items.forEach((reg) => {
          const item = document.createElement('div');
          item.style.border = '1px solid #e5e7eb';
          item.style.borderRadius = '10px';
          item.style.padding = '10px';
          item.style.background = '#fff';
          item.style.display = 'flex';
          item.style.flexDirection = 'column';
          item.style.gap = '6px';
          item.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="font-weight:700;color:#111827;font-size:13px;flex:1;">
                ${getNomeTarefa(reg.tarefa_id)}
              </div>
              <button
                type="button"
                style="
                  border: 1px solid #b91c1c;
                  background: #ffffff;
                  color: #b91c1c;
                  border-radius: 8px;
                  padding: 4px 6px;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  gap: 6px;
                  font-size: 11px;
                  box-shadow: 0 2px 6px rgba(185,28,28,0.15);
                "
                title="Iniciar tarefa (futuro time tracking)"
                onclick="console.log('play tarefa', '${reg.tarefa_id || ''}')"
              >
                <i class="fas fa-play"></i>
              </button>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:#4b5563;">
              <span style="
                padding:2px 6px;
                background:#fff7ed;
                border-radius:6px;
                color:#c2410c;
                border:1px solid #f97316;
              ">
                Estimado: ${formatarTempoComCusto(reg.tempo_estimado_dia || reg.tempo_estimado_total || 0)}
              </span>
            </div>
          `;
          colunaBody.appendChild(item);
        });

        coluna.appendChild(colunaBody);
        board.appendChild(coluna);
      });
    }

    wrapper.appendChild(board);
    card.appendChild(wrapper);
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
    const fetchNome = async (tipo, id) => {
      if (novos[tipo][id]) return;
      // Para clientes, tenta usar cache de lista em vez de chamar /clientes/:id
      if (tipo === 'clientes') {
        const lista = await carregarClientesLista();
        if (lista && lista[id]) {
          novos[tipo][id] = lista[id];
          return;
        }
        novos[tipo][id] = `${tipo.slice(0, -1)} #${id}`;
        return;
      }
      try {
        const response = await fetch(`/api/${tipo === 'tarefas' ? 'atividades' : tipo}/${id}`, {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            const nome =
              result.data.nome ||
              result.data.razao_social ||
              result.data.nome_fantasia ||
              result.data.nomecolaborador;
            novos[tipo][id] = nome || `${tipo.slice(0, -1)} #${id}`;
          } else {
            novos[tipo][id] = `${tipo.slice(0, -1)} #${id}`;
          }
        } else {
          novos[tipo][id] = `${tipo.slice(0, -1)} #${id}`;
        }
      } catch (err) {
        novos[tipo][id] = `${tipo.slice(0, -1)} #${id}`;
      }
    };

    for (const id of produtosIds) await fetchNome('produtos', id);
    for (const id of tarefasIds) await fetchNome('tarefas', id);
    for (const id of clientesIds) await fetchNome('clientes', id);
    for (const id of colaboradoresIds) await fetchNome('colaboradores', id);

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

      // Filtra em memória apenas registros do dia atual (comparando parte da data, desconsiderando timezone)
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
      registros = registros.filter((r) => ehHoje(r.data));
      console.info('[PainelUsuario] Após filtro por data=hoje (memória):', registros.length);

      // Fallback 1: se nada veio, tenta apenas por data e filtra em memória
      if (registros.length === 0) {
        const paramsFallback = new URLSearchParams();
        paramsFallback.append('data_inicio', dataStr);
        paramsFallback.append('data_fim', dataStr);
        paramsFallback.append('limit', '200');
        paramsFallback.append('page', '1');

        try {
          const respFallback = await fetch(`/api/tempo-estimado?${paramsFallback}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });
          if (respFallback.ok) {
            const resultFallback = await respFallback.json();
            if (resultFallback.success && Array.isArray(resultFallback.data)) {
              const todos = resultFallback.data;
              const idsUnicosSet = new Set(idsPossiveis);
              registros = todos.filter((reg) => {
                const idMatch =
                  idsUnicosSet.has(String(reg.responsavel_id || '').trim()) ||
                  idsUnicosSet.has(String(reg.usuario_id || '').trim()) ||
                  idsUnicosSet.has(String(reg.membro_id || '').trim()) ||
                  idsUnicosSet.has(String(reg.colaborador_id || '').trim());

                const nomeRegistro = normalizeText(
                  reg.responsavel_nome ||
                    reg.nome_responsavel ||
                    reg.nomecolaborador ||
                    reg.nome_colaborador ||
                    reg.usuario_nome ||
                    reg.nome ||
                    ''
                );
                const nomeMatch =
                  nomesPossiveis.length === 0
                    ? true
                    : nomesPossiveis.some((n) => n && nomeRegistro.includes(n));

                return (idsUnicosSet.size > 0 ? idMatch : true) && nomeMatch;
              });
              console.info('[PainelUsuario] Fallback tarefas (filtradas em memória):', registros.length);
            }
          }
        } catch (err) {
          console.warn('[PainelUsuario] Erro no fallback de tarefas', err);
        }
      }

      // Fallback 2: se ainda nada, tenta apenas por responsável (sem data)
      if (registros.length === 0) {
        const paramsResp = new URLSearchParams();
        paramsResp.append('filtro_responsavel', 'true');
        idsPossiveis.forEach((id) => paramsResp.append('responsavel_id', id));
        paramsResp.append('limit', '200');
        paramsResp.append('page', '1');

        try {
          const respApenasId = await fetch(`/api/tempo-estimado?${paramsResp}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' }
          });
          if (respApenasId.ok) {
            const resultResp = await respApenasId.json();
            if (resultResp.success && Array.isArray(resultResp.data)) {
              registros = resultResp.data;
              console.info('[PainelUsuario] Fallback só responsavel_id:', registros.length);
            }
          }
        } catch (err) {
          console.warn('[PainelUsuario] Erro no fallback só responsavel_id', err);
        }
      }

      if (registros.length > 0) {
        setTarefasRegistros(registros);
        await carregarNomesRelacionados(registros);
        renderTarefasNoCard(registros, alvoManual);
      } else {
        setTarefasRegistros([]);
        renderTarefasNoCard([], alvoManual);
      }
    } catch (e) {
      console.error('[PainelUsuario] Erro ao carregar minhas tarefas:', e);
      setTarefasRegistros([]);
      renderTarefasNoCard([], alvoManual);
    } finally {
      setCarregandoTarefas(false);
    }
  }, [usuario, carregarNomesRelacionados, renderTarefasNoCard, garantirTamanhoMinimoTarefas, menuPosicao]);

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

