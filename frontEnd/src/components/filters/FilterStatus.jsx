import React, { useState, useEffect, useRef } from 'react';
import './FilterStatus.css';

const FilterStatus = ({ value, options = [], onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedText = value ? (options.find(s => s === value) || 'Selecionar status') : 'Selecionar status';

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

  const handleSelect = (status) => {
    if (!disabled) {
      if (onChange) {
        // Simular evento para compatibilidade
        const fakeEvent = {
          target: { value: status === value ? '' : status }
        };
        onChange(fakeEvent);
      }
      setIsOpen(false);
    }
  };

  return (
    <>
      <label className="filter-label">Status</label>
      <div className="status-filter-container" ref={containerRef}>
        <div className="status-select-field">
          <div 
            className={`status-select-display ${disabled ? 'disabled' : ''}`}
            onClick={() => !disabled && setIsOpen(!isOpen)}
          >
            <span className={`status-select-text ${value ? 'has-selection' : ''}`}>
              {selectedText}
            </span>
            <i className={`fas fa-chevron-down status-select-arrow ${isOpen ? 'open' : ''}`}></i>
          </div>
          {isOpen && !disabled && (
            <div className="status-dropdown">
              <div className="status-dropdown-content">
                {options.map((status) => (
                  <div
                    key={status}
                    className={`status-option ${value === status ? 'selected' : ''}`}
                    onClick={() => handleSelect(status)}
                  >
                    <div className="status-option-checkbox">
                      {value === status && <i className="fas fa-check"></i>}
                    </div>
                    <span>{status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FilterStatus;

