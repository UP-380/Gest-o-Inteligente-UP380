import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import ContratosContent from './DetailContent/ContratosContent';
import TarefasContent from './DetailContent/TarefasContent';
import ProdutosContent from './DetailContent/ProdutosContent';
import ColaboradoresContent from './DetailContent/ColaboradoresContent';
import ContasBancariasContent from './DetailContent/ContasBancariasContent';
import SistemasContent from './DetailContent/SistemasContent';
import AdquirentesContent from './DetailContent/AdquirentesContent';
import './DetailSideCard.css';

const DetailSideCard = ({ clienteId, tipo, dados, onClose, position }) => {
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
      case 'contratos':
        return <ContratosContent contratos={dados.contratos || []} />;
      case 'tarefas':
        return <TarefasContent registros={dados.registros || []} />;
      case 'produtos':
        return <ProdutosContent clienteId={clienteId} registros={dados.registros || []} />;
      case 'colaboradores':
        return (
          <ColaboradoresContent
            clienteId={clienteId}
            tempoPorColaborador={dados.tempoPorColaborador || {}}
            registros={dados.registros || []}
          />
        );
      case 'contas-bancarias':
        return <ContasBancariasContent contasBancarias={dados.contasBancarias || []} maxHeight="calc(75vh - 80px)" />;
      case 'sistemas':
        return <SistemasContent sistemas={dados.sistemas || []} maxHeight="calc(75vh - 80px)" />;
      case 'adquirentes':
        return <AdquirentesContent adquirentes={dados.adquirentes || []} maxHeight="calc(75vh - 80px)" />;
      default:
        return <div className="empty-state"><p>Tipo não reconhecido</p></div>;
    }
  };

  const tipoLabels = {
    contratos: { label: 'Contratos', icon: 'fa-file-contract', color: '#4b5563' },
    tarefas: { label: 'Tarefas', icon: 'fa-list', color: '#4b5563' },
    produtos: { label: 'Produtos', icon: 'fa-box', color: '#4b5563' },
    colaboradores: { label: 'Detalhes de Colaboradores', icon: 'fa-user-friends', color: '#4b5563' },
    'contas-bancarias': { label: 'Contas Bancárias', icon: 'fa-university', color: '#4b5563' },
    sistemas: { label: 'Acessos de Sistema', icon: 'fa-server', color: '#4b5563' },
    adquirentes: { label: 'Adquirentes', icon: 'fa-credit-card', color: '#4b5563' }
  };

  const tipoInfo = tipoLabels[tipo] || { label: tipo, icon: 'fa-info-circle', color: '#4b5563' };

  // Calcular posição - estilo igual ao servidor original
  let cardStyle = {
    position: 'absolute',
    width: '500px',
    minWidth: '420px',
    maxWidth: '560px',
    maxHeight: '75vh',
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

  // Renderizar usando portal para garantir posicionamento correto
  return createPortal(cardContent, document.body);
};

export default DetailSideCard;

