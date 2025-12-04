import React, { useState, useEffect, useRef } from 'react';
import './DatePickerSingle.css';

/**
 * Componente de calendário para seleção de uma única data
 * Baseado no design do FilterPeriodo
 */
const DatePickerSingle = ({ value, onChange, disabled = false, placeholder = 'Selecionar data' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localDate, setLocalDate] = useState(value || '');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef(null);

  // Formatar data para exibição (dd/mm/yyyy)
  const formatarData = (dataStr) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Converter de dd/mm/yyyy para yyyy-mm-dd
  const parseDataBR = (dataStr) => {
    if (!dataStr) return '';
    const partes = dataStr.split('/');
    if (partes.length === 3) {
      const [dia, mes, ano] = partes;
      return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
    }
    return '';
  };

  useEffect(() => {
    setLocalDate(value || '');
    if (value) {
      const [ano, mes, dia] = value.split('-');
      if (ano && mes && dia) {
        setCurrentMonth(new Date(parseInt(ano), parseInt(mes) - 1, 1));
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleDateClick = (date) => {
    if (disabled) return;

    const dateStr = formatDateForInput(date);
    setLocalDate(dateStr);
    setIsOpen(false);
    
    if (onChange) {
      onChange({ target: { value: dateStr } });
    }
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
      days.push(<div key={`empty-${i}`} className="datepicker-calendar-day empty"></div>);
    }

    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month, day);
      let dayClasses = 'datepicker-calendar-day';
      
      // Verificar se é a data selecionada
      if (localDate) {
        const selectedDate = new Date(localDate + 'T00:00:00');
        const selectedDateObj = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const isSelected = isSameDay(currentDate, selectedDateObj);
        
        if (isSelected) {
          dayClasses += ' selected';
        }
      }

      days.push(
        <div
          key={day}
          className={dayClasses}
          onClick={() => handleDateClick(currentDate)}
        >
          {day}
        </div>
      );
    }

    return { monthYear, days };
  };

  const { monthYear, days } = renderCalendar();

  return (
    <div className="datepicker-single-container" ref={containerRef}>
      <div className="datepicker-single-field">
        <div 
          className={`datepicker-single-display ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
          onClick={handleOpen}
        >
          <i className="fas fa-calendar-alt" style={{ marginRight: '8px', color: '#6c757d' }}></i>
          <span className={`datepicker-single-text ${localDate ? 'has-selection' : ''}`}>
            {localDate ? formatarData(localDate) : placeholder}
          </span>
          <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} datepicker-single-arrow ${isOpen ? 'rotated' : ''}`}></i>
        </div>
        {isOpen && !disabled && (
          <div className="datepicker-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="datepicker-dropdown-content">
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <i className="fas fa-calendar-alt" style={{ color: '#4b5563', fontSize: '14px' }}></i>
                  <span style={{ fontWeight: 600, color: '#111827', fontSize: '13px' }}>Selecionar data</span>
                </div>
                
                <div style={{ marginBottom: '10px', maxWidth: '240px', marginLeft: 'auto', marginRight: 'auto' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={formatarData(localDate)} 
                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '14px', fontFamily: 'inherit', background: '#f9fafb', cursor: 'pointer', color: '#495057', textAlign: 'center' }}
                  />
                </div>

                <div className="datepicker-calendar-container">
                  <div className="datepicker-calendar-header">
                    <button className="datepicker-calendar-nav" type="button" onClick={handlePrevMonth}>
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span className="datepicker-calendar-month-year">{monthYear}</span>
                    <button className="datepicker-calendar-nav" type="button" onClick={handleNextMonth}>
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                  <div className="datepicker-calendar-weekdays">
                    <div>D</div>
                    <div>S</div>
                    <div>T</div>
                    <div>Q</div>
                    <div>Q</div>
                    <div>S</div>
                    <div>S</div>
                  </div>
                  <div className="datepicker-calendar-days">
                    {days}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DatePickerSingle;

