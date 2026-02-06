import React from 'react';
import './SemResultadosFiltros.css';

const SemResultadosFiltros = ({ mensagem = null, filtrosAplicados = false }) => {
  return (
    <div className="empty-state sem-resultados-container">
      {mensagem || filtrosAplicados ? (
        <div className="sem-resultados-mensagem">
          <i className="fas fa-info-circle"></i>
          <span>{mensagem || 'Nenhum resultado encontrado com os filtros selecionados.'}</span>
        </div>
      ) : (
        <div className="sem-resultados-padrao">
          POR FAVOR APLIQUE OS FILTROS
        </div>
      )}
    </div>
  );
};

export default SemResultadosFiltros;

