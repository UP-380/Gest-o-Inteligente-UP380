import React, { useState } from 'react';

const AdquirentesContent = ({ adquirentes, maxHeight, onClone }) => {
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());
  const [copiedField, setCopiedField] = useState(null);

  const togglePassword = (adquirenteId) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(adquirenteId)) {
        newSet.delete(adquirenteId);
      } else {
        newSet.add(adquirenteId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (text, fieldId, e) => {
    if (e) e.stopPropagation();
    if (!text || text === '-') return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      setTimeout(() => {
        setCopiedField(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  const ValueWithCopy = ({ value, fieldId, isPassword = false, isHidden = false }) => {
    const fieldKey = fieldId;
    const isCopied = copiedField === fieldKey;

    if (!value || value === '-') {
      return <span style={{ color: '#111827', fontWeight: 600 }}>-</span>;
    }

    if (isPassword) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{
            color: '#111827',
            fontWeight: 600,
            fontFamily: 'monospace',
            fontSize: '13px',
            padding: '2px 8px',
            background: '#f9fafb',
            borderRadius: '4px',
            flex: 1
          }}>
            {isHidden ? '••••••••' : value}
          </span>
          <button
            onClick={(e) => copyToClipboard(value, fieldKey, e)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
              color: isCopied ? '#10b981' : '#6b7280',
              fontSize: '14px'
            }}
            title={isCopied ? 'Copiado!' : 'Copiar senha'}
          >
            <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
        <button
          onClick={(e) => copyToClipboard(value, fieldKey, e)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            color: isCopied ? '#10b981' : '#9ca3af',
            fontSize: '12px',
            display: 'inline-flex',
            alignItems: 'center'
          }}
          title={isCopied ? 'Copiado!' : 'Copiar'}
        >
          <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'}`}></i>
        </button>
      </div>
    );
  };

  if (!adquirentes || adquirentes.length === 0) {
    return <div className="empty-state"><p>Nenhum adquirente encontrado</p></div>;
  }

  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingRight: '8px'
  };

  if (maxHeight) {
    containerStyle.maxHeight = maxHeight;
    containerStyle.overflowY = 'auto';
  }

  return (
    <div style={containerStyle}>
      {adquirentes.map((adquirente) => {
        const adquirenteNome = adquirente.cp_adquirente?.nome || 'Adquirente não informado';
        const isPasswordVisible = visiblePasswords.has(adquirente.id);

        return (
          <div
            key={adquirente.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              border: '1px solid #eef2f7',
              borderRadius: '12px',
              padding: '12px',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px', letterSpacing: '.2px' }}>
                {adquirenteNome}
              </span>
              {onClone && (
                <button
                  className="btn-icon"
                  onClick={() => onClone(adquirente)}
                  title="Clonar este adquirente"
                  style={{
                    backgroundColor: '#f3f4f6',
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6b7280',
                    transition: 'all 0.2s'
                  }}
                >
                  <i className="fas fa-copy" style={{ fontSize: '12px' }}></i>
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
              {adquirente['e-mail'] && (
                <div>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>E-mail: </span>
                  <ValueWithCopy value={adquirente['e-mail']} fieldId={`adquirente-email-${adquirente.id}`} />
                </div>
              )}
              {adquirente.usuario && (
                <div>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Usuário: </span>
                  <ValueWithCopy value={adquirente.usuario} fieldId={`adquirente-usuario-${adquirente.id}`} />
                </div>
              )}
              {adquirente.senha && (
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Senha: </span>
                  <ValueWithCopy
                    value={adquirente.senha}
                    fieldId={`adquirente-senha-${adquirente.id}`}
                    isPassword={true}
                    isHidden={!isPasswordVisible}
                  />
                  <button
                    onClick={() => togglePassword(adquirente.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      color: '#6b7280',
                      fontSize: '14px'
                    }}
                    title={isPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <i className={`fas ${isPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              )}
              {adquirente.estabelecimento && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Estabelecimento: </span>
                  <ValueWithCopy value={adquirente.estabelecimento} fieldId={`adquirente-estabelecimento-${adquirente.id}`} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdquirentesContent;

