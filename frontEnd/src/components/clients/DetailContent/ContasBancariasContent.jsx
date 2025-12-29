import React, { useState } from 'react';

const ContasBancariasContent = ({ contasBancarias, maxHeight }) => {
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());
  const [copiedField, setCopiedField] = useState(null);

  const togglePassword = (contaId) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contaId)) {
        newSet.delete(contaId);
      } else {
        newSet.add(contaId);
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

  if (!contasBancarias || contasBancarias.length === 0) {
    return <div className="empty-state"><p>Nenhuma conta bancária encontrada</p></div>;
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
      {contasBancarias.map((conta) => {
        const banco = conta.cp_banco || {};
        const bancoNome = banco.codigo ? `${banco.codigo} - ${banco.nome}` : banco.nome || 'Banco não informado';
        const isPasswordVisible = visiblePasswords.has(conta.id);

        return (
          <div
            key={conta.id}
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
                {bancoNome}
              </span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
              {conta.agencia && (
                <div>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Agência: </span>
                  <ValueWithCopy value={conta.agencia} fieldId={`conta-agencia-${conta.id}`} />
                </div>
              )}
              {conta.conta && (
                <div>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Conta: </span>
                  <ValueWithCopy value={conta.conta} fieldId={`conta-conta-${conta.id}`} />
                </div>
              )}
              {conta.operador && (
                <div>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Operador: </span>
                  <ValueWithCopy value={conta.operador} fieldId={`conta-operador-${conta.id}`} />
                </div>
              )}
              {conta.usuario && (
                <div>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Usuário: </span>
                  <ValueWithCopy value={conta.usuario} fieldId={`conta-usuario-${conta.id}`} />
                </div>
              )}
              {conta.senha && (
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#6b7280', fontWeight: 500 }}>Senha: </span>
                  <ValueWithCopy 
                    value={conta.senha} 
                    fieldId={`conta-senha-${conta.id}`}
                    isPassword={true}
                    isHidden={!isPasswordVisible}
                  />
                  <button
                    onClick={() => togglePassword(conta.id)}
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
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ContasBancariasContent;

