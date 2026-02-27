import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { gerarDatasRecorrencia } from '../../utils/gerarDatasRecorrencia';
import { obterFeriadosBrasileiros } from '../../utils/dateUtils';
import './FilterPeriodo.css';

const FilterPeriodo = ({
  dataInicio,
  dataFim,
  onInicioChange,
  onFimChange,
  disabled = false,
  size = 'default',
  uiVariant,
  showWeekendToggle = false,
  onWeekendToggleChange,
  showHolidayToggle = false,
  onHolidayToggleChange,
  datasIndividuais = [],
  onDatasIndividuaisChange,
  habilitarFinaisSemana: propHabilitarFinaisSemana,
  habilitarFeriados: propHabilitarFeriados,
  onClose,
  source,
  onSourceChange,
  recorrenciaConfig: propRecorrenciaConfig,
  onRecorrenciaConfigChange,
  showRecurrence = false,
  onOpenChange = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const containerRef = useRef(null);

  // Estados Locais
  const [localInicio, setLocalInicio] = useState(dataInicio || propRecorrenciaConfig?.anchorInicio || '');
  const [localFim, setLocalFim] = useState(dataFim || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [habilitarFinaisSemana, setHabilitarFinaisSemana] = useState(propHabilitarFinaisSemana !== undefined ? propHabilitarFinaisSemana : false);
  const [habilitarFeriados, setHabilitarFeriados] = useState(propHabilitarFeriados !== undefined ? propHabilitarFeriados : false);
  const [feriados, setFeriados] = useState({});
  const [hoveredHoliday, setHoveredHoliday] = useState(null);
  const [datasIndividuaisLocal, setDatasIndividuaisLocal] = useState(new Set(datasIndividuais || []));
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  // Estados para Recorrência
  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(source === 'recorrencia');
  const [recorrenciaTipo, setRecorrenciaTipo] = useState(propRecorrenciaConfig?.tipo || 'nao_repetir');
  const [recorrenciaDiasSemana, setRecorrenciaDiasSemana] = useState(propRecorrenciaConfig?.diasSemana || []);
  const [recorrenciaMensalOpcao, setRecorrenciaMensalOpcao] = useState(propRecorrenciaConfig?.mensalOpcao || 'mesmo_dia_mes');
  const [recorrenciaPersonalizado, setRecorrenciaPersonalizado] = useState(propRecorrenciaConfig?.personalizado || { repeteCada: 1, intervalo: 'dias' });
  const [recorrenciaTermina, setRecorrenciaTermina] = useState(propRecorrenciaConfig?.termina || 'nunca');
  const [recorrenciaTerminaData, setRecorrenciaTerminaData] = useState(propRecorrenciaConfig?.terminaData || '');

  // Sincronização de props externos
  useEffect(() => {
    setRecorrenciaAtiva(source === 'recorrencia');
  }, [source]);

  useEffect(() => {
    // Sincronizar localInicio se houver alteração externa, independente do source
    // mas priorizamos dataInicio ou o anchorInicio se for recorrência
    const targetInicio = dataInicio || (source === 'recorrencia' ? propRecorrenciaConfig?.anchorInicio : null);
    if (targetInicio && targetInicio !== localInicio) {
      setLocalInicio(targetInicio);
    }

    // localFim só faz sentido fora de recorrência
    if (source !== 'recorrencia' && dataFim !== localFim) {
      setLocalFim(dataFim || '');
    }
  }, [dataInicio, dataFim, source, propRecorrenciaConfig?.anchorInicio]);

  // Sincronização de props externos para datas individuais
  useEffect(() => {
    if (Array.isArray(datasIndividuais)) {
      setDatasIndividuaisLocal(prev => {
        // Só atualiza se for diferente para evitar loops infinitos
        const currentArr = Array.from(prev).sort();
        const incomingArr = [...datasIndividuais].sort();
        if (JSON.stringify(currentArr) === JSON.stringify(incomingArr)) return prev;
        return new Set(datasIndividuais);
      });
    }
  }, [JSON.stringify(datasIndividuais)]);

  // Cálculo de Posição do Dropdown
  const calculatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownWidth = 680;
      const dropdownHeight = 550; // Estimativa para garantir espaço

      let top = rect.bottom + window.scrollY + 6;
      // Centralizar horizontalmente em relação ao gatilho
      let left = rect.left + window.scrollX + (rect.width / 2) - (dropdownWidth / 2);

      // Ajuste horizontal para manter dentro da tela
      if (left < 10) {
        left = 10;
      } else if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }

      // Ajuste vertical se estourar o fundo da tela
      if (rect.bottom + dropdownHeight > window.innerHeight && rect.top > dropdownHeight) {
        top = rect.top + window.scrollY - dropdownHeight - 6;
      }

      setDropdownPos({ top, left });
    }
  };

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      window.addEventListener('scroll', calculatePosition, true);
      window.addEventListener('resize', calculatePosition);
    }
    return () => {
      window.removeEventListener('scroll', calculatePosition, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [isOpen]);

  // Sincronizar feriados do ano
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const feriadosArray = obterFeriadosBrasileiros(year);
    const feriadosObj = {};
    feriadosArray.forEach(d => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      feriadosObj[`${year}-${month}-${day}`] = true;
    });
    setFeriados(feriadosObj);
  }, [currentMonth.getFullYear()]);

  // Helpers de Formatação
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

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

  // Lógica de Recorrência
  const renderSumarioRecorrencia = useMemo(() => {
    const resumo = (() => {
      switch (recorrenciaTipo) {
        case 'diariamente': return 'Todo dia';
        case 'semanalmente':
          const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
          const selecionados = (recorrenciaDiasSemana || []).sort().map(d => dias[d]);
          return selecionados.length === 7 ? 'Toda semana' : `Toda ${selecionados.join(', ')}`;
        case 'mensalmente':
          const anchorDate = localInicio ? new Date(localInicio + 'T12:00:00') : new Date();
          const diaDoMes = anchorDate.getDate();
          if (recorrenciaMensalOpcao === 'mesmo_dia_mes') return `Todo dia ${diaDoMes}`;
          else if (recorrenciaMensalOpcao === 'primeiro_dia_util') return 'Todo 1º dia útil';
          else if (recorrenciaMensalOpcao === 'ultimo_dia_util') return 'Todo último dia útil';
          else if (recorrenciaMensalOpcao === 'mesmo_dia_semana') {
            const diasSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            const semanaNoMes = Math.ceil(diaDoMes / 7);
            const ordinal = ['1ª', '2ª', '3ª', '4ª', '5ª'][semanaNoMes - 1];
            return `Toda ${ordinal} ${diasSemanaNomes[anchorDate.getDay()]}-feira`;
          }
          return 'Todo mês';
        case 'personalizado':
          return `A cada ${recorrenciaPersonalizado.repeteCada} ${recorrenciaPersonalizado.intervalo}`;
        default: return 'Repetindo';
      }
    })();

    const termoTermino = recorrenciaTermina === 'nunca' ? 'para sempre' : `até ${formatarData(recorrenciaTerminaData)}`;
    return `${resumo}, ${termoTermino}`;
  }, [recorrenciaAtiva, recorrenciaTipo, recorrenciaDiasSemana, recorrenciaMensalOpcao, recorrenciaPersonalizado, recorrenciaTermina, recorrenciaTerminaData, localInicio]);

  // Efeito para Gerar Datas de Recorrência
  useEffect(() => {
    if (!recorrenciaAtiva || recorrenciaTipo === 'nao_repetir') return;

    const gerarEAtualizar = () => {
      try {
        let fimParaGerar = recorrenciaTermina === 'nunca' ? '' : recorrenciaTerminaData;
        if (!fimParaGerar && localInicio) {
          const d = new Date(localInicio + 'T12:00:00');
          d.setFullYear(d.getFullYear() + 2); // Limite de 2 anos para não pesar
          fimParaGerar = d.toISOString().split('T')[0];
        }

        if (localInicio) {
          const datas = gerarDatasRecorrencia({
            inicio: localInicio,
            fim: fimParaGerar,
            tipo: recorrenciaTipo,
            diasSemana: recorrenciaDiasSemana || [],
            mensalOpcao: recorrenciaMensalOpcao,
            personalizado: recorrenciaPersonalizado,
            feriados: feriados
          });

          // Filtrar datas baseado nos toggles de FDS e Feriado
          const filteredDatas = datas.filter(d => {
            const dt = new Date(d + 'T12:00:00');
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            const isHoliday = !!feriados[d];

            if (showWeekendToggle && !habilitarFinaisSemana && isWeekend) return false;
            if (showHolidayToggle && !habilitarFeriados && isHoliday) return false;
            return true;
          });

          setDatasIndividuaisLocal(new Set(filteredDatas));
          if (onDatasIndividuaisChange) onDatasIndividuaisChange(filteredDatas);
          if (onSourceChange && source !== 'recorrencia') onSourceChange('recorrencia');

          if (onRecorrenciaConfigChange) {
            onRecorrenciaConfigChange({
              tipo: recorrenciaTipo,
              diasSemana: recorrenciaDiasSemana,
              mensalOpcao: recorrenciaMensalOpcao,
              personalizado: recorrenciaPersonalizado,
              termina: recorrenciaTermina,
              terminaData: recorrenciaTerminaData,
              anchorInicio: localInicio
            });
          }
        }
      } catch (e) {
        console.error("Erro ao gerar datas:", e);
      }
    };

    gerarEAtualizar();
  }, [recorrenciaAtiva, recorrenciaTipo, JSON.stringify(recorrenciaDiasSemana), recorrenciaMensalOpcao, JSON.stringify(recorrenciaPersonalizado), recorrenciaTermina, recorrenciaTerminaData, localInicio, feriados, habilitarFinaisSemana, habilitarFeriados]);

  // Handlers
  const handleOpen = () => {
    if (!disabled) {
      const next = !isOpen;
      setIsOpen(next);
      if (onOpenChange) onOpenChange(next);
    }
  };

  const handleLimpar = (e) => {
    e.preventDefault();
    setLocalInicio('');
    setLocalFim('');
    setDatasIndividuaisLocal(new Set());
    setRecorrenciaAtiva(false);
    if (onInicioChange) onInicioChange({ target: { value: '' } });
    if (onFimChange) onFimChange({ target: { value: '' } });
    if (onDatasIndividuaisChange) onDatasIndividuaisChange([]);
    if (onSourceChange) onSourceChange(null);
  };

  const handleDateClick = (date, event) => {
    if (disabled) return;
    const isCtrl = event && (event.ctrlKey || event.metaKey);
    const dStr = formatDateForInput(date);

    if (isCtrl) {
      const ns = new Set(datasIndividuaisLocal);
      if (ns.has(dStr)) ns.delete(dStr); else ns.add(dStr);
      setDatasIndividuaisLocal(ns);
      if (onDatasIndividuaisChange) onDatasIndividuaisChange(Array.from(ns));
      return;
    }

    if (recorrenciaAtiva) {
      setLocalInicio(dStr);
      if (onInicioChange) onInicioChange({ target: { value: dStr } });
      return;
    }

    if (!localInicio || (localInicio && localFim)) {
      setLocalInicio(dStr);
      setLocalFim('');
      if (onInicioChange) onInicioChange({ target: { value: dStr } });
      if (onFimChange) onFimChange({ target: { value: '' } });
    } else {
      const start = new Date(localInicio + 'T12:00:00');
      if (date < start) {
        setLocalFim(localInicio);
        setLocalInicio(dStr);
        if (onInicioChange) onInicioChange({ target: { value: dStr } });
        if (onFimChange) onFimChange({ target: { value: localInicio } });
      } else {
        setLocalFim(dStr);
        if (onFimChange) onFimChange({ target: { value: dStr } });
      }
    }
  };

  const handleQuickSelect = (tipo) => {
    const hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    let i, f;
    const d = hoje.getDate(), m = hoje.getMonth(), y = hoje.getFullYear(), ds = hoje.getDay();

    switch (tipo) {
      case 'hoje': i = new Date(hoje); f = new Date(hoje); break;
      case 'ontem': i = new Date(hoje); i.setDate(d - 1); f = new Date(i); break;
      case 'semana_atual':
        const offset = ds === 0 ? 6 : ds - 1;
        i = new Date(hoje); i.setDate(d - offset);
        f = new Date(i); f.setDate(i.getDate() + 6);
        break;
      case 'mes_atual': i = new Date(y, m, 1); f = new Date(y, m + 1, 0); break;
      case 'mes_passado': i = new Date(y, m - 1, 1); f = new Date(y, m, 0); break;
      case 'proximo_mes': i = new Date(y, m + 1, 1); f = new Date(y, m + 2, 0); break;
      default: return;
    }

    const si = formatDateForInput(i), sf = formatDateForInput(f);
    setLocalInicio(si);
    setLocalFim(sf);
    setRecorrenciaAtiva(false);
    setCurrentMonth(new Date(i.getFullYear(), i.getMonth(), 1));
    if (onInicioChange) onInicioChange({ target: { value: si } });
    if (onFimChange) onFimChange({ target: { value: sf } });
    if (onSourceChange) onSourceChange(null);
  };

  // Renderizadores de UI
  const textoDisplay = useMemo(() => {
    if (recorrenciaAtiva && recorrenciaTipo !== 'nao_repetir') return renderSumarioRecorrencia;
    if (localInicio && localFim) return `${formatarData(localInicio)} - ${formatarData(localFim)}`;
    if (localInicio) return `${formatarData(localInicio)} - ...`;
    return 'Selecionar período';
  }, [recorrenciaAtiva, recorrenciaTipo, renderSumarioRecorrencia, localInicio, localFim]);

  const renderCalendar = () => {
    const yr = currentMonth.getFullYear(), mt = currentMonth.getMonth();
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const firstDay = new Date(yr, mt, 1, 12, 0, 0);
    const lastDay = new Date(yr, mt + 1, 0, 12, 0, 0);
    const firstDayWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];
    for (let i = 0; i < firstDayWeekday; i++) {
      days.push(<div key={`empty-${i}`} className="periodo-calendar-day empty"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const curr = new Date(yr, mt, d, 12, 0, 0);
      const dStr = formatDateForInput(curr);
      const isH = !!feriados[dStr];
      const isW = curr.getDay() === 0 || curr.getDay() === 6;
      const isDW = showWeekendToggle && !habilitarFinaisSemana && isW;
      const isHD = showHolidayToggle && !habilitarFeriados && isH;
      const isDisabled = isDW || isHD;

      let cls = 'periodo-calendar-day';
      if (isDisabled) cls += ' disabled';
      if (isH) cls += ' holiday';
      if (isW) cls += ' weekend-day';

      // Só marcamos como selecionado ou in-range se NÃO estiver desabilitado
      if (!isDisabled) {
        if (dStr === localInicio) cls += ' selected start-date anchor-date';
        else if (datasIndividuaisLocal.has(dStr)) cls += ' selected recurring-day';

        if (localInicio && !recorrenciaAtiva) {
          if (localFim) {
            if (dStr === localFim) cls += ' selected end-date';
            const di = new Date(localInicio + 'T12:00:00');
            const df = new Date(localFim + 'T12:00:00');
            if (curr > di && curr < df) cls += ' in-range';
          }
        }
      }

      days.push(
        <div key={dStr} className={cls} onClick={(e) => !(isDW || isHD) && handleDateClick(curr, e)}>
          {d}
        </div>
      );
    }

    return { title: `${monthNames[mt]} ${yr}`, days };
  };

  const { title, days } = renderCalendar();

  const handleWeekendToggle = (v) => {
    setHabilitarFinaisSemana(v);
    if (onWeekendToggleChange) onWeekendToggleChange(v);
  };

  const handleHolidayToggle = (v) => {
    setHabilitarFeriados(v);
    if (onHolidayToggleChange) onHolidayToggleChange(v);
  };

  return (
    <div className={`periodo-filter-container ${size === 'small' ? 'size-small' : ''} ${uiVariant ? `variant-${uiVariant}` : ''}`} ref={containerRef}>
      <div className="periodo-select-field" ref={triggerRef}>
        <div className={`periodo-select-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`} onClick={handleOpen}>
          <i className="fas fa-calendar-alt"></i>
          <span className="periodo-select-text">{textoDisplay}</span>
          <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
        </div>

        {isOpen && !disabled && createPortal(
          <div
            ref={dropdownRef}
            className="periodo-portal-wrapper"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="periodo-dropdown">
              <div className="periodo-header-portal">
                <div className="periodo-header-title">
                  <i className="fas fa-calendar-alt"></i>
                  <span>Filtro de período</span>
                </div>

              </div>
              <div className="periodo-dropdown-body">
                {/* SIDEBAR */}
                <aside className="periodo-sidebar">
                  <div className="sidebar-content custom-scrollbar">
                    {!recorrenciaAtiva ? (
                      <div className="quick-select-list">
                        <div style={{ padding: '0 8px 12px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                          Seleção Rápida
                        </div>
                        {[
                          { label: 'Hoje', id: 'hoje', icon: 'fa-calendar-day', color: '#3b82f6' },
                          { label: 'Ontem', id: 'ontem', icon: 'fa-history', color: '#64748b' },
                          { label: 'Semana Atual', id: 'semana_atual', icon: 'fa-calendar-week', color: '#10b981' },
                          { label: 'Mês Atual', id: 'mes_atual', icon: 'fa-calendar-alt', color: '#6366f1' },
                          { label: 'Mês Passado', id: 'mes_passado', icon: 'fa-arrow-left', color: '#8b5cf6' },
                          { label: 'Próximo Mês', id: 'proximo_mes', icon: 'fa-arrow-right', color: '#ec4899' },
                        ].map(opt => (
                          <button key={opt.id} type="button" onClick={() => handleQuickSelect(opt.id)} className="quick-button">
                            <i className={`fas ${opt.icon}`} style={{ color: opt.color }}></i>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="recurrence-config">
                        <div className="recurrence-title">Configurar Recorrência</div>

                        <div className="recurrence-form-group">
                          <label className="input-label">REPETIR</label>
                          <select
                            value={recorrenciaTipo}
                            onChange={(e) => setRecorrenciaTipo(e.target.value)}
                            className="recurrence-input"
                          >
                            <option value="diariamente">Todo dia</option>
                            <option value="semanalmente">Toda semana</option>
                            <option value="mensalmente">Todo mês</option>
                            <option value="personalizado">Personalizar</option>
                          </select>
                        </div>

                        {recorrenciaTipo === 'semanalmente' && (
                          <div className="recurrence-form-group">
                            <label className="input-label">DIAS</label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px' }}>
                              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRecorrenciaDiasSemana(prev => (prev || []).includes(i) ? prev.filter(x => x !== i) : [...(prev || []), i]);
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="recurrence-day-btn"
                                  style={{
                                    background: (recorrenciaDiasSemana || []).includes(i) ? '#0e3b6f' : '#f1f5f9',
                                    color: (recorrenciaDiasSemana || []).includes(i) ? '#fff' : '#64748b'
                                  }}
                                >
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {recorrenciaTipo === 'mensalmente' && (
                          <div className="recurrence-form-group">
                            <label className="input-label">OPÇÃO MENSAL</label>
                            <select
                              value={recorrenciaMensalOpcao}
                              onChange={(e) => setRecorrenciaMensalOpcao(e.target.value)}
                              className="recurrence-input"
                            >
                              <option value="mesmo_dia_mes">
                                {localInicio ? `Todo dia ${new Date(localInicio + 'T12:00:00').getDate()}` : 'No mesmo dia do mês'}
                              </option>
                              <option value="primeiro_dia_util">No primeiro dia útil</option>
                              <option value="ultimo_dia_util">No último dia útil</option>
                              <option value="mesmo_dia_semana">No mesmo dia da semana</option>
                            </select>
                          </div>
                        )}

                        {recorrenciaTipo === 'personalizado' && (
                          <div className="recurrence-form-group">
                            <label className="input-label">REPETIR A CADA</label>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                value={recorrenciaPersonalizado.repeteCada}
                                onChange={(e) => setRecorrenciaPersonalizado({ ...recorrenciaPersonalizado, repeteCada: parseInt(e.target.value) || 1 })}
                                className="recurrence-input"
                                style={{ width: '45px', textAlign: 'center' }}
                              />
                              <select
                                value={recorrenciaPersonalizado.intervalo}
                                onChange={(e) => setRecorrenciaPersonalizado({ ...recorrenciaPersonalizado, intervalo: e.target.value })}
                                className="recurrence-input"
                                style={{ flex: 1 }}
                              >
                                <option value="dias">Dia(s)</option>
                                <option value="semanas">Semana(s)</option>
                                <option value="meses">Mês(es)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="recurrence-form-group" style={{ marginTop: '8px' }}>
                          <label className="input-label">TERMINA EM</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div
                              onClick={() => setRecorrenciaTermina('nunca')}
                              className="recurrence-option-card"
                              style={{
                                background: recorrenciaTermina === 'nunca' ? '#eff6ff' : '#fff',
                                borderColor: recorrenciaTermina === 'nunca' ? '#0e3b6f' : '#e2e8f0'
                              }}
                            >
                              <div className="recurrence-radio-outer">
                                {recorrenciaTermina === 'nunca' && <div className="recurrence-radio-inner" />}
                              </div>
                              <span className="recurrence-option-text">Para sempre</span>
                            </div>
                            <div
                              onClick={() => setRecorrenciaTermina('em_data')}
                              className="recurrence-option-card"
                              style={{
                                background: recorrenciaTermina === 'em_data' ? '#eff6ff' : '#fff',
                                borderColor: recorrenciaTermina === 'em_data' ? '#0e3b6f' : '#e2e8f0'
                              }}
                            >
                              <div className="recurrence-radio-outer">
                                {recorrenciaTermina === 'em_data' && <div className="recurrence-radio-inner" />}
                              </div>
                              <span className="recurrence-option-text">Determinar fim</span>
                            </div>
                            {recorrenciaTermina === 'em_data' && (
                              <input
                                type="date"
                                value={recorrenciaTerminaData}
                                onChange={(e) => setRecorrenciaTerminaData(e.target.value)}
                                className="recurrence-input"
                              />
                            )}
                          </div>
                        </div>

                        {/* SUMÁRIO DA RECORRÊNCIA */}
                        <div className="recurrence-summary-box">
                          <div className="recurrence-summary-text">
                            <i className="fas fa-info-circle"></i>
                            <span>{renderSumarioRecorrencia}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {showRecurrence && (
                    <div className="sidebar-footer">
                      <div className="toggle-row" onClick={(e) => {
                        e.stopPropagation();
                        const next = !recorrenciaAtiva;
                        setRecorrenciaAtiva(next);
                        if (next) {
                          if (onSourceChange) onSourceChange('recorrencia');
                          if (recorrenciaTipo === 'nao_repetir') setRecorrenciaTipo('semanalmente');

                          // Se ativar recorrência e não tiver data de início, sugerir hoje
                          if (!localInicio) {
                            const today = new Date();
                            const todayStr = today.toISOString().split('T')[0];
                            setLocalInicio(todayStr);
                            if (onInicioChange) onInicioChange({ target: { value: todayStr } });
                          }
                        } else {
                          if (onSourceChange) onSourceChange(null);
                        }
                      }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <span className="toggle-label">Recorrência</span>
                        <div className={`toggle-switch ${recorrenciaAtiva ? 'active' : ''}`}>
                          <div className="toggle-knob"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </aside>

                {/* MAIN CALENDAR */}
                <main className="periodo-main">
                  <div className="periodo-hint-ctrl">
                    💡 Clique segurando <strong>Ctrl</strong> para selecionar dias específicos.
                  </div>

                  {(showWeekendToggle || showHolidayToggle) && (
                    <div className="calendar-options">
                      {showWeekendToggle && (
                        <div
                          className={`calendar-option-item ${habilitarFinaisSemana ? 'active' : ''}`}
                          onClick={() => handleWeekendToggle(!habilitarFinaisSemana)}
                        >
                          <span>Habilitar finais de semana</span>
                          <div className={`toggle-switch ${habilitarFinaisSemana ? 'active' : ''}`}>
                            <div className="toggle-knob"></div>
                          </div>
                        </div>
                      )}
                      {showHolidayToggle && (
                        <div
                          className={`calendar-option-item ${habilitarFeriados ? 'active' : ''}`}
                          onClick={() => handleHolidayToggle(!habilitarFeriados)}
                        >
                          <span>Habilitar feriados</span>
                          <div className={`toggle-switch ${habilitarFeriados ? 'active' : ''}`}>
                            <div className="toggle-knob"></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <header className="calendar-header">
                    <button type="button" className="btn-secondary-light" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span className="calendar-title">{title}</span>
                    <button type="button" className="btn-secondary-light" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </header>



                  <div className="calendar-grid">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, idx) => (
                      <div key={`${d}-${idx}`} className="weekday-header">{d}</div>
                    ))}
                    {days}
                  </div>
                </main>
              </div>

              {/* FOOTER */}
              <footer className="periodo-footer">
                <div className="footer-actions">
                  <button type="button" className="btn-limpar" onClick={handleLimpar}>Limpar Tudo</button>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="btn-secondary-light" onClick={() => setIsOpen(false)}>Cancelar</button>
                    <button type="button" className="btn-primary-solid" onClick={() => { setIsOpen(false); if (onClose) onClose(); }}>Salvar Período</button>
                  </div>
                </div>
              </footer>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default FilterPeriodo;
