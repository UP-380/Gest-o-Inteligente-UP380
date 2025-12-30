import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import Avatar from '../../../components/user/Avatar';
import './TarefasList.css';

/**
 * Componente TarefasList
 * Exibe a lista de tarefas atribuídas ao usuário logado
 * @param {Object} props - Props do componente
 * @param {Object} props.usuario - Dados do usuário (opcional, tenta usar useAuth se não fornecido)
 */
const TarefasList = ({ usuario: usuarioProp }) => {
  // Tentar usar hook se disponível, senão usar prop
  let authContext = null;
  try {
    authContext = useAuth();
  } catch (e) {
    // Contexto não disponível, usar props
  }
  const usuario = usuarioProp || (authContext?.usuario || null);
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tempoTotal, setTempoTotal] = useState(0);
  const [custoTotal, setCustoTotal] = useState(null);
  const [custoHora, setCustoHora] = useState(null);
  const [nomeColaborador, setNomeColaborador] = useState(null);
  const [fotoPerfilColaborador, setFotoPerfilColaborador] = useState(null);

  const carregarTarefas = useCallback(async () => {
    if (!usuario) {
      setError('Usuário não identificado');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Identificar o ID do membro/responsável do usuário
      // O responsavel_id na tabela tempo_estimado corresponde ao membro.id (não ao usuario.id)
      // Precisamos buscar qual membro.id tem usuario_id igual ao usuario.id
      
      let responsavelId = usuario.membro_id;
      
      // Se não temos membro_id explicitamente, buscar o membro que corresponde ao usuario.id
      if (!responsavelId && usuario.id) {
        try {

          // Estratégia principal: buscar a lista de colaboradores e tentar mapear pelo nome ou pelo id
          const nomesPossiveis = [
            usuario.nome_usuario,
            usuario.nome,
            usuario.nome_completo,
            usuario.nome_colaborador
          ].filter(Boolean).map(n => n.trim().toLowerCase());

          const colaboradoresResponse = await fetch(`/api/colaboradores?limit=1000`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });

          if (colaboradoresResponse.ok) {
            const colaboradoresResult = await colaboradoresResponse.json();
            if (colaboradoresResult.success && colaboradoresResult.data && Array.isArray(colaboradoresResult.data)) {
              // 1) Tentar achar por id igual ao usuario.id
              let membro = colaboradoresResult.data.find(m => String(m.id) === String(usuario.id));

              // 2) Se não achar por id, tentar por nome
              if (!membro && nomesPossiveis.length > 0) {
                membro = colaboradoresResult.data.find(m =>
                  m.nome &&
                  nomesPossiveis.includes(String(m.nome).trim().toLowerCase())
                );
              }

              if (membro) {
                responsavelId = membro.id;
              } else {
                responsavelId = usuario.id;
              }
            } else {
              responsavelId = usuario.id;
            }
          } else {
            responsavelId = usuario.id;
          }
        } catch (err) {
          // Fallback: usar usuario.id diretamente
          responsavelId = usuario.id || usuario.colaborador_id;
        }
      } else if (!responsavelId) {
        // Último fallback
        responsavelId = usuario.id || usuario.colaborador_id;
      }
      
      if (!responsavelId) {
        setError('ID do membro não encontrado no perfil do usuário');
        setLoading(false);
        return;
      }

      // Buscar tarefas atribuídas usando o endpoint de tempo-estimado
      const params = new URLSearchParams({
        page: '1',
        limit: '1000',
        filtro_responsavel: 'true'
      });
      
      params.append('responsavel_id', String(responsavelId).trim());

      const url = `/api/tempo-estimado?${params}`;
      
      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao carregar tarefas (${response.status})`);
      }

      const result = await response.json();

      if (result.success && result.data && Array.isArray(result.data)) {
        
        // Agrupar tarefas por agrupador_id (mesmo formato da página de atribuir)
        const tarefasMap = new Map();
        let tempoTotalCalculado = 0;

        // Buscar foto do perfil do responsável no primeiro registro
        const primeiroRegistroComFoto = result.data.find(r => r.responsavel_foto_perfil);
        if (primeiroRegistroComFoto?.responsavel_foto_perfil) {
          setFotoPerfilColaborador(primeiroRegistroComFoto.responsavel_foto_perfil);
        }

        result.data.forEach((registro) => {
          const agrupadorId = registro.agrupador_id || `sem-grupo-${registro.tarefa_id || 'unknown'}`;

          if (!tarefasMap.has(agrupadorId)) {
            // Tentar obter nome da tarefa de várias formas possíveis
            const tarefaNome = registro.tarefa_nome 
              || registro.tarefa?.nome 
              || registro.tarefa?.tarefa_nome
              || registro.nome_tarefa
              || 'Tarefa sem nome';
            
            // Tentar obter nome do cliente
            const clienteNome = registro.cliente_nome 
              || registro.cliente?.nome 
              || registro.nome_cliente
              || null;
            
            // Tentar obter nome do produto
            const produtoNome = registro.produto_nome 
              || registro.produto?.nome 
              || registro.nome_produto
              || null;

            tarefasMap.set(agrupadorId, {
              agrupador_id: agrupadorId,
              tarefa_id: registro.tarefa_id,
              tarefa_nome: tarefaNome,
              produto_nome: produtoNome,
              cliente_nome: clienteNome,
              quantidade: 0,
              registros: [],
              primeiroRegistro: registro
            });
          }

          const tarefa = tarefasMap.get(agrupadorId);
          tarefa.registros.push(registro);
          tarefa.quantidade = tarefa.registros.length;
          
          // Calcular tempo total: tempo_estimado_dia (em milissegundos) * quantidade
          const tempoEstimadoDia = registro.tempo_estimado_dia || 0;
          tempoTotalCalculado += tempoEstimadoDia; // Já está em milissegundos, cada registro conta 1 vez
        });

        const tarefasArray = Array.from(tarefasMap.values());
        setTarefas(tarefasArray);
        setTempoTotal(tempoTotalCalculado);
        
        // Buscar nome do colaborador e custo
        if (responsavelId) {
          buscarNomeColaborador(responsavelId);
          buscarCustoERecalcular(responsavelId, tarefasArray, tempoTotalCalculado);
        }
      } else {
        setTarefas([]);
        setTempoTotal(0);
        setCustoTotal(null);
      }
    } catch (err) {
      setError('Erro ao carregar tarefas. Tente novamente.');
      setTarefas([]);
    } finally {
      setLoading(false);
    }
  }, [usuario]);

  // Buscar nome do colaborador
  const buscarNomeColaborador = async (membroId) => {
    try {
      const response = await fetch(`/api/membros-id-nome`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && Array.isArray(result.data)) {
          const membro = result.data.find(m => String(m.id) === String(membroId));
          if (membro) {
            setNomeColaborador(membro.nome);
            // Avatar é resolvido automaticamente pelo componente Avatar via Supabase Storage
            // Usar foto_perfil diretamente
            if (membro.foto_perfil) {
              setFotoPerfilColaborador(membro.foto_perfil);
            }
          }
        }
      }
    } catch (err) {
      // Erro silencioso - não é crítico
    }
  };

  // Buscar custo do responsável e recalcular custo total
  const buscarCustoERecalcular = async (responsavelId, tarefasArray, tempoTotalMs) => {
    try {
      const response = await fetch(`/api/custo-colaborador-vigencia/mais-recente?membro_id=${responsavelId}`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data && result.data.custo_hora) {
          const custoHoraStr = result.data.custo_hora;
          const custoHoraNum = parseFloat(custoHoraStr.replace(',', '.'));
          
          if (!isNaN(custoHoraNum) && custoHoraNum > 0) {
            setCustoHora(custoHoraNum);
            
            // Calcular custo total: tempo em horas * custo por hora
            const tempoHoras = tempoTotalMs / 3600000; // converter milissegundos para horas
            const custoCalculado = custoHoraNum * tempoHoras;
            setCustoTotal(custoCalculado);
          }
        }
      }
    } catch (err) {
      // Erro silencioso - não é crítico
    }
  };

  // Formatar tempo estimado (similar à página de atribuir responsáveis)
  const formatarTempoEstimado = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0h';
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    
    if (horas > 0 && minutos > 0) {
      return `${horas}h ${minutos}min`;
    } else if (horas > 0) {
      return `${horas}h`;
    } else if (minutos > 0) {
      return `${minutos}min`;
    }
    return '0h';
  };

  // Formatar valor monetário
  const formatarValorMonetario = (valor) => {
    if (!valor || isNaN(valor)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  // Obter nome do usuário (verificar vários campos possíveis)
  const getNomeUsuario = () => {
    if (!usuario) return 'Usuário';
    return usuario.nome_usuario 
      || usuario.nome 
      || usuario.nome_completo
      || usuario.nome_colaborador
      || 'Usuário';
  };

  useEffect(() => {
    if (usuario) {
      carregarTarefas();
    } else {
      setLoading(false);
      setError('Usuário não identificado');
    }
  }, [usuario, carregarTarefas]);

  if (loading) {
    return (
      <div className="tarefas-list-loading">
        <div className="spinner-small"></div>
        <p>Carregando tarefas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tarefas-list-error">
        <i className="fas fa-exclamation-circle"></i>
        <p>{error}</p>
        <button 
          onClick={carregarTarefas}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            background: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (tarefas.length === 0) {
    return (
      <div className="tarefas-list-empty">
        <i className="fas fa-inbox"></i>
        <p>Nenhuma tarefa atribuída</p>
      </div>
    );
  }

  return (
    <div className="tarefas-list-container">
      {/* Header similar ao da página de atribuir responsáveis */}
      <div className="tarefas-list-summary-header">
        <div className="tarefas-list-summary-left">
          <span className="tarefas-badge tarefas-badge-responsavel">RESPONSÁVEL</span>
          <h3 className="tarefas-summary-title">
            {fotoPerfilColaborador || usuario?.foto_perfil ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar
                  avatarId={fotoPerfilColaborador || usuario?.foto_perfil}
                  nomeUsuario={nomeColaborador || getNomeUsuario()}
                  size="tiny"
                  entityType="user"
                  entityId={usuario?.id}
                />
                <span>{nomeColaborador || getNomeUsuario()}</span>
              </div>
            ) : (
              <span>{nomeColaborador || getNomeUsuario()}</span>
            )}
          </h3>
          {tempoTotal > 0 && (
            <span className="tarefas-summary-tempo">{formatarTempoEstimado(tempoTotal)}</span>
          )}
          {custoTotal !== null && custoTotal > 0 && (
            <span className="tarefas-summary-custo">{formatarValorMonetario(custoTotal)}</span>
          )}
          <span className="tarefas-summary-count">{tarefas.length}</span>
        </div>
      </div>

      {/* Lista de tarefas */}
      <div className="tarefas-list-content">
        {tarefas.map((tarefa, index) => (
          <div key={tarefa.agrupador_id || index} className="tarefa-item">
            <div className="tarefa-item-header">
              <div className="tarefa-item-title">
                <i className="fas fa-tasks"></i>
                <span>{tarefa.tarefa_nome}</span>
              </div>
              <span className="tarefa-item-count">{tarefa.quantidade}</span>
            </div>
            {tarefa.cliente_nome && (
              <div className="tarefa-item-info">
                <i className="fas fa-building"></i>
                <span>{tarefa.cliente_nome}</span>
              </div>
            )}
            {tarefa.produto_nome && (
              <div className="tarefa-item-info">
                <i className="fas fa-box"></i>
                <span>{tarefa.produto_nome}</span>
              </div>
            )}
            {tarefa.primeiroRegistro?.tempo_estimado_dia && (
              <div className="tarefa-item-info">
                <i className="fas fa-clock"></i>
                <span>{formatarTempoEstimado(tarefa.primeiroRegistro.tempo_estimado_dia * tarefa.quantidade)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TarefasList;
