import React, { useState, useEffect } from 'react';
import './TempoEstimadoInput.css';

/**
 * Componente de input para tempo estimado (horas e minutos)
 * Aceita formato: "1h 30min", "90min", "1.5h", etc.
 * Converte para milissegundos
 */
const TempoEstimadoInput = ({ value, onChange, disabled = false, placeholder = "Ex: 1h 30min ou 90min" }) => {
  const [horas, setHoras] = useState('');
  const [minutos, setMinutos] = useState('');
  const [inputTexto, setInputTexto] = useState('');
  const [modoTexto, setModoTexto] = useState(true); // true = modo texto livre, false = modo separado

  // Converter milissegundos para horas e minutos
  useEffect(() => {
    if (value && value > 0) {
      const horasTotal = Math.floor(value / (1000 * 60 * 60));
      const minutosTotal = Math.floor((value % (1000 * 60 * 60)) / (1000 * 60));
      
      if (modoTexto) {
        // Formato texto: "1h 30min"
        if (horasTotal > 0 && minutosTotal > 0) {
          setInputTexto(`${horasTotal}h ${minutosTotal}min`);
        } else if (horasTotal > 0) {
          setInputTexto(`${horasTotal}h`);
        } else if (minutosTotal > 0) {
          setInputTexto(`${minutosTotal}min`);
        } else {
          setInputTexto('');
        }
      } else {
        setHoras(horasTotal.toString());
        setMinutos(minutosTotal.toString());
      }
    } else {
      setHoras('');
      setMinutos('');
      setInputTexto('');
    }
  }, [value, modoTexto]);

  // Converter texto para milissegundos
  const parsearTextoParaMs = (texto) => {
    if (!texto || texto.trim() === '') return 0;

    const textoLimpo = texto.trim().toLowerCase();
    let totalMs = 0;

    // Padrões: "1h 30min", "1h", "30min", "1.5h", "90min"
    const horaMatch = textoLimpo.match(/(\d+(?:\.\d+)?)\s*h/);
    const minutoMatch = textoLimpo.match(/(\d+)\s*min/);

    if (horaMatch) {
      const horas = parseFloat(horaMatch[1]);
      totalMs += horas * 60 * 60 * 1000;
    }

    if (minutoMatch) {
      const minutos = parseInt(minutoMatch[1], 10);
      totalMs += minutos * 60 * 1000;
    }

    // Se não encontrou padrões, tentar como número (assumir minutos)
    if (!horaMatch && !minutoMatch) {
      const numero = parseFloat(textoLimpo);
      if (!isNaN(numero)) {
        // Se for menor que 24, assumir minutos; senão, assumir horas
        if (numero < 24) {
          totalMs = numero * 60 * 1000;
        } else {
          totalMs = numero * 60 * 60 * 1000;
        }
      }
    }

    return Math.round(totalMs);
  };

  // Converter horas e minutos separados para milissegundos
  const converterHorasMinutosParaMs = (h, m) => {
    const horasNum = parseFloat(h) || 0;
    const minutosNum = parseFloat(m) || 0;
    return Math.round((horasNum * 60 * 60 + minutosNum * 60) * 1000);
  };

  const handleTextoChange = (e) => {
    const novoTexto = e.target.value;
    setInputTexto(novoTexto);
    const ms = parsearTextoParaMs(novoTexto);
    if (onChange) {
      onChange(ms);
    }
  };

  const handleHorasChange = (e) => {
    const novaHora = e.target.value;
    setHoras(novaHora);
    const ms = converterHorasMinutosParaMs(novaHora, minutos);
    if (onChange) {
      onChange(ms);
    }
  };

  const handleMinutosChange = (e) => {
    const novoMinuto = e.target.value;
    setMinutos(novoMinuto);
    const ms = converterHorasMinutosParaMs(horas, novoMinuto);
    if (onChange) {
      onChange(ms);
    }
  };

  const toggleModo = () => {
    if (modoTexto) {
      // Converter texto para horas/minutos
      const ms = parsearTextoParaMs(inputTexto);
      const horasTotal = Math.floor(ms / (1000 * 60 * 60));
      const minutosTotal = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      setHoras(horasTotal.toString());
      setMinutos(minutosTotal.toString());
    } else {
      // Converter horas/minutos para texto
      const ms = converterHorasMinutosParaMs(horas, minutos);
      const horasTotal = Math.floor(ms / (1000 * 60 * 60));
      const minutosTotal = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      if (horasTotal > 0 && minutosTotal > 0) {
        setInputTexto(`${horasTotal}h ${minutosTotal}min`);
      } else if (horasTotal > 0) {
        setInputTexto(`${horasTotal}h`);
      } else if (minutosTotal > 0) {
        setInputTexto(`${minutosTotal}min`);
      } else {
        setInputTexto('');
      }
    }
    setModoTexto(!modoTexto);
  };

  return (
    <div className="tempo-estimado-input-container">
      <label className="tempo-estimado-label">
        <i className="fas fa-clock" style={{ marginRight: '8px' }}></i>
        Tempo Estimado (por dia)
      </label>
      
      {modoTexto ? (
        <div className="tempo-estimado-input-wrapper">
          <input
            type="text"
            className="tempo-estimado-input-text"
            value={inputTexto}
            onChange={handleTextoChange}
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            type="button"
            className="tempo-estimado-toggle-btn"
            onClick={toggleModo}
            disabled={disabled}
            title="Alternar para modo horas/minutos separados"
          >
            <i className="fas fa-edit"></i>
          </button>
        </div>
      ) : (
        <div className="tempo-estimado-input-wrapper">
          <div className="tempo-estimado-inputs-separados">
            <input
              type="number"
              className="tempo-estimado-input-horas"
              value={horas}
              onChange={handleHorasChange}
              placeholder="Horas"
              min="0"
              disabled={disabled}
            />
            <span className="tempo-estimado-separador">h</span>
            <input
              type="number"
              className="tempo-estimado-input-minutos"
              value={minutos}
              onChange={handleMinutosChange}
              placeholder="Minutos"
              min="0"
              max="59"
              disabled={disabled}
            />
            <span className="tempo-estimado-separador">min</span>
          </div>
          <button
            type="button"
            className="tempo-estimado-toggle-btn"
            onClick={toggleModo}
            disabled={disabled}
            title="Alternar para modo texto livre"
          >
            <i className="fas fa-keyboard"></i>
          </button>
        </div>
      )}
      
      {value > 0 && (
        <div className="tempo-estimado-preview">
          <span className="tempo-estimado-preview-label">Total:</span>
          <span className="tempo-estimado-preview-value">
            {(() => {
              const h = Math.floor(value / (1000 * 60 * 60));
              const m = Math.floor((value % (1000 * 60 * 60)) / (1000 * 60));
              if (h > 0 && m > 0) return `${h}h ${m}min`;
              if (h > 0) return `${h}h`;
              if (m > 0) return `${m}min`;
              return '0min';
            })()}
          </span>
          <span className="tempo-estimado-preview-ms">
            ({Math.round(value / 1000)}s / {value}ms)
          </span>
        </div>
      )}
    </div>
  );
};

export default TempoEstimadoInput;

