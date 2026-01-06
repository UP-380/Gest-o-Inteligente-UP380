import React, { useState, useEffect } from 'react';
import './TempoEstimadoInput.css';

/**
 * Componente de input para tempo estimado (horas e minutos)
 * Apenas modo separado (horas e minutos)
 * Converte para milissegundos
 */
const TempoEstimadoInput = ({ value, onChange, disabled = false, placeholder = "Ex: 1h 30min ou 90min" }) => {
  const [horas, setHoras] = useState('');
  const [minutos, setMinutos] = useState('');

  // Converter milissegundos para horas e minutos
  useEffect(() => {
    if (value && value > 0) {
      const horasTotal = Math.floor(value / (1000 * 60 * 60));
      const minutosTotal = Math.floor((value % (1000 * 60 * 60)) / (1000 * 60));
      setHoras(horasTotal.toString());
      setMinutos(minutosTotal.toString());
    } else {
      setHoras('');
      setMinutos('');
    }
  }, [value]);

  // Converter horas e minutos separados para milissegundos
  const converterHorasMinutosParaMs = (h, m) => {
    const horasNum = parseFloat(h) || 0;
    const minutosNum = parseFloat(m) || 0;
    return Math.round((horasNum * 60 * 60 + minutosNum * 60) * 1000);
  };

  const handleHorasChange = (e) => {
    const novaHora = e.target.value;
    setHoras(novaHora);
    const ms = converterHorasMinutosParaMs(novaHora || '0', minutos || '0');
    if (onChange) {
      onChange(ms);
    }
  };

  const handleMinutosChange = (e) => {
    const novoMinuto = e.target.value;
    setMinutos(novoMinuto);
    const ms = converterHorasMinutosParaMs(horas || '0', novoMinuto || '0');
    if (onChange) {
      onChange(ms);
    }
  };

  return (
    <div 
      className="tempo-estimado-input-container"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div 
        className="tempo-estimado-input-wrapper"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div 
          className="tempo-estimado-inputs-separados"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            type="number"
            className="tempo-estimado-input-horas"
            value={horas}
            onChange={handleHorasChange}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            placeholder="0"
            min="0"
            disabled={disabled}
          />
          <span className="tempo-estimado-separador">h</span>
          <input
            type="number"
            className="tempo-estimado-input-minutos"
            value={minutos}
            onChange={handleMinutosChange}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            placeholder="0"
            min="0"
            max="59"
            disabled={disabled}
          />
          <span className="tempo-estimado-separador">min</span>
        </div>
      </div>
    </div>
  );
};

export default TempoEstimadoInput;

