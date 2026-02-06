import React from 'react';
import './PageHeader.css';

/**
 * Componente de cabeçalho de página reutilizável
 * 
 * @param {string} title - Título da página
 * @param {string} subtitle - Subtítulo da página
 */
const PageHeader = ({ title, subtitle }) => {
  return (
    <div className="form-header">
      <h2 className="form-title">{title}</h2>
      {subtitle && <p className="form-subtitle">{subtitle}</p>}
    </div>
  );
};

export default PageHeader;







