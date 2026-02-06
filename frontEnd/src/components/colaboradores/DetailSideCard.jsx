import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import TarefasContent from '../clients/DetailContent/TarefasContent';
import ProdutosContent from '../clients/DetailContent/ProdutosContent';
import ClientesContent from './DetailContent/ClientesContent';
import '../clients/DetailSideCard.css';

const DetailSideCard = ({ colaboradorId, tipo, dados, onClose, position, filtroCliente }) => {
  const cardRef = useRef(null);

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

  if (!dados) {
    return null;
  }

  const renderContent = () => {
    switch (tipo) {
      case 'tarefas':
        return <TarefasContent registros={dados.registros || []} />;
      case 'produtos':
        return <ProdutosContent colaboradorId={colaboradorId} registros={dados.registros || []} />;
      case 'clientes':
        return <ClientesContent colaboradorId={colaboradorId} registros={dados.registros || []} filtroCliente={filtroCliente} />;
      default:
        return <div className="empty-state"><p>Tipo não reconhecido</p></div>;
    }
  };

  const tipoLabels = {
    tarefas: { label: 'Tarefas', icon: 'fa-list', color: '#4b5563' },
    produtos: { label: 'Produtos', icon: 'fa-box', color: '#4b5563' },
    clientes: { label: 'Clientes', icon: 'fa-user-friends', color: '#4b5563' }
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
    cardStyle.left = position.left;
    cardStyle.top = position.top;
    cardStyle.position = 'absolute';
  } else {
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
        {renderContent()}
      </div>
    </div>
  );

  // Renderizar usando portal
  return createPortal(cardContent, document.body);
};

export default DetailSideCard;

