import React, { useState } from 'react';

const SistemasContent = ({ sistemas, maxHeight }) => {
  const [visiblePasswords, setVisiblePasswords] = useState(new Set());
  const [copiedField, setCopiedField] = useState(null);

  const togglePassword = (sistemaId, tipo) => {
    const key = `${sistemaId}-${tipo}`;
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
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

  if (!sistemas || sistemas.length === 0) {
    return <div className="empty-state"><p>Nenhum sistema encontrado</p></div>;
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
      {sistemas.map((sistema) => {
        const sistemaNome = sistema.cp_sistema?.nome || 'Sistema não informado';
        const isVpnPasswordVisible = visiblePasswords.has(`${sistema.id}-vpn`);
        const isSistemaPasswordVisible = visiblePasswords.has(`${sistema.id}-sistema`);

        return (
          <div
            key={sistema.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              border: '1px solid #eef2f7',
              borderRadius: '12px',
              padding: '12px',
              background: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px', letterSpacing: '.2px' }}>
                {sistemaNome}
              </span>
            </div>

            {/* Informações do Servidor */}
            {(sistema.servidor || sistema.usuario_servidor) && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, color: '#4b5563', fontSize: '12px', marginBottom: '8px' }}>
                  <i className="fas fa-server" style={{ marginRight: '6px', color: '#3b82f6' }}></i>
                  Servidor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
                  {sistema.servidor && (
                    <div>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Servidor: </span>
                      <ValueWithCopy value={sistema.servidor} fieldId={`sistema-servidor-${sistema.id}`} />
                    </div>
                  )}
                  {sistema.usuario_servidor && (
                    <div>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Usuário: </span>
                      <ValueWithCopy value={sistema.usuario_servidor} fieldId={`sistema-usuario-servidor-${sistema.id}`} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Informações de VPN */}
            {(sistema.vpn || sistema.usuario_vpn || sistema.senha_vpn) && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, color: '#4b5563', fontSize: '12px', marginBottom: '8px' }}>
                  <i className="fas fa-network-wired" style={{ marginRight: '6px', color: '#10b981' }}></i>
                  VPN
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
                  {sistema.vpn && (
                    <div>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>VPN: </span>
                      <ValueWithCopy value={sistema.vpn} fieldId={`sistema-vpn-${sistema.id}`} />
                    </div>
                  )}
                  {sistema.usuario_vpn && (
                    <div>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Usuário VPN: </span>
                      <ValueWithCopy value={sistema.usuario_vpn} fieldId={`sistema-usuario-vpn-${sistema.id}`} />
                    </div>
                  )}
                  {sistema.senha_vpn && (
                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Senha VPN: </span>
                      <ValueWithCopy 
                        value={sistema.senha_vpn} 
                        fieldId={`sistema-senha-vpn-${sistema.id}`}
                        isPassword={true}
                        isHidden={!isVpnPasswordVisible}
                      />
                      <button
                        onClick={() => togglePassword(sistema.id, 'vpn')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          color: '#6b7280',
                          fontSize: '14px'
                        }}
                        title={isVpnPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        <i className={`fas ${isVpnPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Credenciais do Sistema */}
            {(sistema.usuario_sistema || sistema.senha_sistema) && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, color: '#4b5563', fontSize: '12px', marginBottom: '8px' }}>
                  <i className="fas fa-key" style={{ marginRight: '6px', color: '#f59e0b' }}></i>
                  Credenciais do Sistema
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
                  {sistema.usuario_sistema && (
                    <div>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Usuário: </span>
                      <ValueWithCopy value={sistema.usuario_sistema} fieldId={`sistema-usuario-sistema-${sistema.id}`} />
                    </div>
                  )}
                  {sistema.senha_sistema && (
                    <div style={{ gridColumn: sistema.usuario_sistema ? 'span 1' : 'span 2', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Senha: </span>
                      <ValueWithCopy 
                        value={sistema.senha_sistema} 
                        fieldId={`sistema-senha-sistema-${sistema.id}`}
                        isPassword={true}
                        isHidden={!isSistemaPasswordVisible}
                      />
                      <button
                        onClick={() => togglePassword(sistema.id, 'sistema')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          color: '#6b7280',
                          fontSize: '14px'
                        }}
                        title={isSistemaPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        <i className={`fas ${isSistemaPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SistemasContent;

