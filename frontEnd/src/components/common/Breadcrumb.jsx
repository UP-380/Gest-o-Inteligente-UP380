import React from 'react';
import { Link } from 'react-router-dom';
import './Breadcrumb.css';

/**
 * Componente de breadcrumb para navegação
 * @param {Array} items - Array de objetos { label, path } ou { label } (sem link)
 */
const Breadcrumb = ({ items = [] }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={index} className="breadcrumb-item">
              {isLast || !item.path ? (
                <span className="breadcrumb-current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link to={item.path} className="breadcrumb-link">
                  {item.label}
                </Link>
              )}
              {!isLast && (
                <span className="breadcrumb-separator" aria-hidden="true">
                  <i className="fas fa-chevron-right"></i>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;

