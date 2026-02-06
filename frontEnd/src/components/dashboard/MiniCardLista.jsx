import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const MiniCardLista = ({ titulo, itens, onClose, position }) => {
  const cardRef = useRef(null);

  useEffect(() => {
    if (cardRef.current && position) {
      cardRef.current.style.left = position.left;
      cardRef.current.style.top = position.top;
    }
  }, [position]);

  useEffect(() => {
    // Animar abertura
    if (cardRef.current) {
      requestAnimationFrame(() => {
        if (cardRef.current) {
          cardRef.current.style.opacity = '1';
          cardRef.current.style.transform = 'scale(1)';
        }
      });
    }
  }, []);

  useEffect(() => {
    // Fechar ao clicar fora
    const handleClickOutside = (event) => {
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        onClose();
      }
    };

    // Adicionar listener após um pequeno delay para não fechar imediatamente
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  const cardContent = (
    <div
      ref={cardRef}
      className="dashboard-lista-mini-card"
      style={{
        position: 'absolute',
        zIndex: 2000,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        padding: '12px',
        minWidth: '300px',
        maxWidth: '500px',
        maxHeight: '50vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: 0,
        transform: 'scale(0.95)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        left: position?.left || '50%',
        top: position?.top || '50%',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          fontWeight: 600,
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-list" style={{ color: '#4b5563' }}></i> {titulo}
        </div>
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#6b7280',
            fontSize: '18px',
          }}
        >
          ✕
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          maxHeight: 'calc(50vh - 80px)',
          overflowY: 'auto',
          paddingRight: '8px',
        }}
      >
        {itens.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '13px' }}>Nenhum item encontrado</div>
        ) : (
          itens.map((item, index) => {
            // Suportar tanto string quanto objeto { nome, status }
            const nome = typeof item === 'string' ? item : item.nome;
            const status = typeof item === 'string' ? 'ativo' : (item.status || 'ativo');
            const isInativo = status === 'inativo';
            const nomeColor = isInativo ? '#ef4444' : '#111827';
            
            return (
              <div
                key={index}
                style={{
                  padding: '8px',
                  background: '#f9fafb',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#111827',
                }}
              >
                {index + 1}. <span style={{ color: nomeColor }}>{nome}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Renderizar usando portal para garantir que fique acima de tudo
  return createPortal(cardContent, document.body);
};

export default MiniCardLista;

