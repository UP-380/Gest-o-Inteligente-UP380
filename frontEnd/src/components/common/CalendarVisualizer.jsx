import React, { useState, useEffect, useRef } from 'react';
import '../filters/FilterPeriodo.css';

const CalendarVisualizer = ({ datas = [], onClose }) => {
    // Converter datas para Set para busca rápida O(1)
    // Normalizar para YYYY-MM-DD
    const datasSet = new Set(datas.map(d => {
        if (!d) return '';
        // Se vier como timestamp ou objeto Date
        if (d instanceof Date) return d.toISOString().split('T')[0];
        // Se vier como string ISO com hora
        if (d.includes('T')) return d.split('T')[0];
        return d;
    }));

    const getInitialMonth = () => {
        if (datas && datas.length > 0) {
            // Tentar encontrar a menor data para abrir nela
            const sorted = [...datas].sort();
            const first = sorted[0];
            if (first) {
                const parts = first.split('T')[0].split('-'); // "2026-01-01"
                if (parts.length === 3) {
                    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
                }
            }
        }
        return new Date();
    };

    const [currentMonth, setCurrentMonth] = useState(getInitialMonth());
    const modalRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

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
            days.push(<div key={`empty-${i}`} className="periodo-calendar-day empty"></div>);
        }

        // Dias do mês
        for (let day = 1; day <= daysInMonth; day++) {
            // Construir data local YYYY-MM-DD
            const diaStr = String(day).padStart(2, '0');
            const mesStr = String(month + 1).padStart(2, '0');
            const dateKey = `${year}-${mesStr}-${diaStr}`;

            let dayClasses = 'periodo-calendar-day';

            if (datasSet.has(dateKey)) {
                dayClasses += ' selected';
            }

            days.push(
                <div
                    key={day}
                    className={dayClasses}
                    style={datasSet.has(dateKey) ? { cursor: 'default', backgroundColor: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe', fontWeight: 'bold' } : { cursor: 'default' }}
                >
                    {day}
                </div>
            );
        }

        return { monthYear, days };
    };

    const { monthYear, days } = renderCalendar();

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.2)',
            zIndex: 9999, // Alto z-index
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        }}>
            <div
                ref={modalRef}
                style={{
                    background: 'white',
                    padding: '16px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    width: '320px' // Tamanho fixo pequeno
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fas fa-calendar-check" style={{ color: '#0e3b6f' }}></i>
                        Dias Selecionados
                    </span>
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '16px' }}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="periodo-calendar-container" style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' }}>
                    <div className="periodo-calendar-header">
                        <button className="periodo-calendar-nav" type="button" onClick={handlePrevMonth}>
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <span className="periodo-calendar-month-year">{monthYear}</span>
                        <button className="periodo-calendar-nav" type="button" onClick={handleNextMonth}>
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                    <div className="periodo-calendar-weekdays">
                        <div>D</div>
                        <div>S</div>
                        <div>T</div>
                        <div>Q</div>
                        <div>Q</div>
                        <div>S</div>
                        <div>S</div>
                    </div>
                    <div className="periodo-calendar-days">
                        {days}
                    </div>
                </div>

                <div style={{ marginTop: '12px', textAlign: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        Total: <b>{datasSet.size}</b> dias
                    </span>
                </div>
            </div>
        </div>
    );
};

export default CalendarVisualizer;
