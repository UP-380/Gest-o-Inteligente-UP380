import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TarefasDetalhadasList from './TarefasDetalhadasList';
import './DetailSideCard.css';

const API_BASE_URL = '/api';

// Função para formatar tempo em formato HMS (ex: "35s", "3min 42s", "1h 30min")
const formatarTempoHMS = (milissegundos) => {
  if (!milissegundos || milissegundos === 0) return '0s';
  const totalSegundos = Math.floor(milissegundos / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;
  const partes = [];
  if (horas > 0) partes.push(`${horas}h`);
  if (minutos > 0) partes.push(`${minutos}min`);
  if (segundos > 0 || partes.length === 0) partes.push(`${segundos}s`);
  return partes.join(' ');
};

// Função para formatar data e hora
const formatarDataHora = (dataInput) => {
  if (!dataInput) return '—';
  try {
    const date = new Date(dataInput);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '—';
  }
};

const DetailSideCard = ({ entidadeId, tipo, dados, onClose, position, getTempoRealizado, formatarTempoEstimado, formatarData, calcularCustoPorTempo, formatarValorMonetario, getNomeCliente }) => {
  const cardRef = useRef(null);
  const [tarefasExpandidas, setTarefasExpandidas] = useState(new Set());
  const [registrosIndividuais, setRegistrosIndividuais] = useState({});
  const [carregandoRegistros, setCarregandoRegistros] = useState({});

  useEffect(() => {
    // Fechar ao clicar fora
    const handleClickOutside = (event) => {
      const card = cardRef.current;
      if (card && !card.contains(event.target) && !event.target.closest('.resumo-arrow')) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Buscar registros individuais de tempo realizado para uma tarefa
  const buscarRegistrosIndividuais = async (tarefa) => {
    if (registrosIndividuais[tarefa.id] || carregandoRegistros[tarefa.id]) {
      return; // Já carregado ou carregando
    }

    setCarregandoRegistros(prev => ({ ...prev, [tarefa.id]: true }));

    try {
      // Coletar todos os tempo_estimado_ids dos registros desta tarefa
      const tempoEstimadoIds = tarefa.registros
        .map(reg => reg.id || reg.tempo_estimado_id)
        .filter(Boolean);

      if (tempoEstimadoIds.length === 0) {
        setRegistrosIndividuais(prev => ({ ...prev, [tarefa.id]: [] }));
        setCarregandoRegistros(prev => {
          const novo = { ...prev };
          delete novo[tarefa.id];
          return novo;
        });
        return;
      }

      // Criar mapa de tempo_estimado_id -> responsavelId a partir dos registros da tarefa
      const responsavelIdMap = new Map();
      tarefa.registros.forEach(reg => {
        const tempoEstimadoId = String(reg.id || reg.tempo_estimado_id || '');
        if (tempoEstimadoId && reg.responsavel_id) {
          responsavelIdMap.set(tempoEstimadoId, reg.responsavel_id);
        }
      });

      // Buscar registros individuais para cada tempo_estimado_id
      const promises = tempoEstimadoIds.map(async (tempoEstimadoId) => {
        try {
          const response = await fetch(`${API_BASE_URL}/registro-tempo/por-tempo-estimado?tempo_estimado_id=${tempoEstimadoId}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
              // Obter responsavelId para este tempo_estimado_id
              const responsavelId = responsavelIdMap.get(String(tempoEstimadoId)) || tarefa.responsavelId || null;
              
              return result.data.map(r => ({
                ...r,
                tempo_estimado_id: tempoEstimadoId,
                responsavelId: responsavelId, // Incluir responsavelId para calcular custo
                // Calcular tempo realizado se não estiver presente
                tempo_realizado: r.tempo_realizado || (r.data_inicio && r.data_fim 
                  ? (new Date(r.data_fim).getTime() - new Date(r.data_inicio).getTime())
                  : 0)
              }));
            }
          }
          return [];
        } catch (error) {
          console.error('Erro ao buscar registros individuais:', error);
          return [];
        }
      });

      const resultados = await Promise.all(promises);
      const registros = resultados.flat();
      
      // Ordenar por data_inicio (mais recente primeiro)
      registros.sort((a, b) => {
        const dataA = a.data_inicio ? new Date(a.data_inicio).getTime() : 0;
        const dataB = b.data_inicio ? new Date(b.data_inicio).getTime() : 0;
        return dataB - dataA; // Ordem decrescente (mais recente primeiro)
      });

      setRegistrosIndividuais(prev => ({ ...prev, [tarefa.id]: registros }));
    } catch (error) {
      console.error('Erro ao buscar registros individuais:', error);
      setRegistrosIndividuais(prev => ({ ...prev, [tarefa.id]: [] }));
    } finally {
      setCarregandoRegistros(prev => {
        const novo = { ...prev };
        delete novo[tarefa.id];
        return novo;
      });
    }
  };

  if (!dados || !dados.registros || dados.registros.length === 0) {
    return null;
  }

  const tipoLabels = {
    tarefas: { label: 'Tarefas', icon: 'fa-list', color: '#4b5563' },
    produtos: { label: 'Produtos', icon: 'fa-box', color: '#4b5563' },
    clientes: { label: 'Clientes', icon: 'fa-briefcase', color: '#4b5563' },
    responsaveis: { label: 'Responsáveis', icon: 'fa-user-tie', color: '#4b5563' }
  };

  const tipoInfo = tipoLabels[tipo] || { label: tipo, icon: 'fa-info-circle', color: '#4b5563' };

  // Calcular posição
  let cardStyle = {
    position: 'absolute',
    width: '500px',
    minWidth: '420px',
    maxWidth: '560px',
    maxHeight: '50vh',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
    zIndex: 2000,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    opacity: 0,
    transform: 'scale(0.95)',
    transition: 'opacity 0.2s ease, transform 0.2s ease'
  };

  if (position) {
    // Position vem como objeto { left: '500px', top: '300px' }
    cardStyle.left = position.left;
    cardStyle.top = position.top;
    cardStyle.position = 'absolute';
  } else {
    // Se não houver posição, centralizar na tela
    cardStyle.left = '50%';
    cardStyle.top = '50%';
    cardStyle.position = 'fixed';
    cardStyle.transform = 'translate(-50%, -50%) scale(0.95)';
  }

  // Aplicar animação após montagem
  useEffect(() => {
    const card = cardRef.current;
    if (card) {
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        if (position) {
          card.style.transform = 'scale(1)';
        } else {
          card.style.transform = 'translate(-50%, -50%) scale(1)';
        }
      });
    }
  }, [position]);

  // Se for tarefas, os dados já vêm agrupados com tempo realizado total e registros
  // Para outros tipos, agrupar por nome (para mostrar apenas uma vez cada item)
  const itensLista = tipo === 'tarefas' 
    ? dados.registros 
    : (() => {
        const itensUnicos = {};
        dados.registros.forEach(reg => {
          const chave = reg.nome || `${reg.tipo}_${reg.id || reg.tarefa_id || reg.produto_id || reg.cliente_id || reg.responsavel_id}`;
          if (!itensUnicos[chave]) {
            itensUnicos[chave] = {
              nome: reg.nome || chave,
              tipo: reg.tipo,
              id: reg.id || reg.tarefa_id || reg.produto_id || reg.cliente_id || reg.responsavel_id
            };
          }
        });
        return Object.values(itensUnicos);
      })();

  const toggleTarefa = (tarefaId) => {
    setTarefasExpandidas(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(tarefaId)) {
        newExpanded.delete(tarefaId);
      } else {
        newExpanded.add(tarefaId);
        // Buscar registros individuais quando expandir
        const tarefa = dados.registros.find(t => t.id === tarefaId);
        if (tarefa) {
          buscarRegistrosIndividuais(tarefa);
        }
      }
      return newExpanded;
    });
  };

  const cardContent = (
    <div ref={cardRef} className="detail-side-card" style={cardStyle}>
      <div className="detail-side-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className={`fas ${tipoInfo.icon}`} style={{ color: tipoInfo.color }}></i>
          <h3>{tipoInfo.label}</h3>
        </div>
        <button className="detail-side-card-close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="detail-side-card-body">
        <div className="detail-side-card-list">
          {itensLista.length === 0 ? (
            <div className="empty-state">
              <p>Nenhum item encontrado</p>
            </div>
          ) : tipo === 'tarefas' ? (
            <TarefasDetalhadasList
              tarefas={itensLista}
              tarefasExpandidas={tarefasExpandidas}
              registrosIndividuais={registrosIndividuais}
              carregandoRegistros={carregandoRegistros}
              formatarTempoEstimado={formatarTempoEstimado}
              calcularCustoPorTempo={calcularCustoPorTempo}
              formatarValorMonetario={formatarValorMonetario}
              formatarDataHora={formatarDataHora}
              formatarTempoHMS={formatarTempoHMS}
              onToggleTarefa={toggleTarefa}
              getNomeCliente={getNomeCliente}
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {itensLista.map((item, index) => (
                <li
                  key={`${item.tipo}_${item.id}_${index}`}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index < itensLista.length - 1 ? '1px solid #e5e7eb' : 'none',
                    fontSize: '13px',
                    color: '#334155'
                  }}
                >
                  {item.nome}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );

  // Renderizar usando portal para garantir posicionamento correto
  return createPortal(cardContent, document.body);
};

export default DetailSideCard;

