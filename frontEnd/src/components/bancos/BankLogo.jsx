import React, { useState } from 'react';
import { getBankLogoUrl } from '../../utils/bankDomains';
import './BankLogo.css';

/**
 * Componente para exibir o logo de um banco usando a API BankConv
 * @param {string} codigo - Código do banco (ex: "001")
 * @param {string} nome - Nome do banco (ex: "Banco do Brasil")
 * @param {number} size - Tamanho do logo em pixels (padrão: 64)
 * @param {string} className - Classes CSS adicionais
 * @param {string} alt - Texto alternativo (padrão: nome do banco)
 */
const BankLogo = ({ 
  codigo, 
  nome, 
  size = 64, 
  className = '', 
  alt = null 
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const logoUrl = getBankLogoUrl(codigo, nome, size);
  const displayAlt = alt || nome || 'Logo do banco';
  const initials = nome 
    ? nome
        .split(' ')
        .map(word => word[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '??';

  // Se não há URL do logo ou houve erro, mostra fallback
  if (!logoUrl || imageError) {
    return (
      <div 
        className={`bank-logo-fallback ${className}`}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          fontSize: `${size * 0.35}px`
        }}
        title={displayAlt}
      >
        {initials}
      </div>
    );
  }

  return (
    <div className={`bank-logo-container ${className}`}>
      <img
        src={logoUrl}
        alt={displayAlt}
        className="bank-logo-image"
        style={{ 
          width: `${size}px`, 
          height: `${size}px`,
          opacity: imageLoading ? 0 : 1,
          transition: 'opacity 0.2s ease'
        }}
        onLoad={() => setImageLoading(false)}
        onError={() => {
          setImageError(true);
          setImageLoading(false);
        }}
      />
      {imageLoading && (
        <div 
          className="bank-logo-loading"
          style={{ 
            width: `${size}px`, 
            height: `${size}px`,
            fontSize: `${size * 0.35}px`
          }}
        >
          {initials}
        </div>
      )}
      {/* Atribuição BankConv (requerida pela API) */}
      <a 
        href="https://bankconv.com" 
        target="_blank" 
        rel="noopener noreferrer"
        className="bank-logo-attribution"
        title="Logos fornecidos por BankConv"
        aria-hidden="true"
      >
        {/* Link invisível para atribuição */}
      </a>
    </div>
  );
};

export default BankLogo;
