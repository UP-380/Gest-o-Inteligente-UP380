import React, { useState } from 'react';

const SistemasContent = ({ sistemas, maxHeight, onClone }) => {
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
        const isServidorPasswordVisible = visiblePasswords.has(`${sistema.id}-servidor`);
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
              {onClone && (
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClone(sistema);
                  }}
                  title="Clonar acesso de sistema"
                  style={{
                    fontSize: '16px',
                    color: '#64748b'
                  }}
                >
                  <i className="fas fa-clone"></i>
                </button>
              )}
            </div>

            {/* Informações do Servidor - Ordem: Servidor, Usuário, Senha */}
            {(sistema.servidor || sistema.usuario_servidor || sistema.senha_servidor) && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, color: '#4b5563', fontSize: '12px', marginBottom: '8px' }}>
                  <i className="fas fa-server" style={{ marginRight: '6px', color: '#3b82f6' }}></i>
                  Servidor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
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
                  {sistema.senha_servidor && (
                    <div style={{ minWidth: 0 }}>
                      <span style={{ color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Senha: </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <ValueWithCopy 
                            value={sistema.senha_servidor} 
                            fieldId={`sistema-senha-servidor-${sistema.id}`}
                            isPassword={true}
                            isHidden={!isServidorPasswordVisible}
                          />
                        </div>
                        <button
                          onClick={() => togglePassword(sistema.id, 'servidor')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#6b7280',
                            fontSize: '14px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={isServidorPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          <i className={`fas ${isServidorPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
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
                    <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                      <span style={{ color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Senha VPN: </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <ValueWithCopy 
                            value={sistema.senha_vpn} 
                            fieldId={`sistema-senha-vpn-${sistema.id}`}
                            isPassword={true}
                            isHidden={!isVpnPasswordVisible}
                          />
                        </div>
                        <button
                          onClick={() => togglePassword(sistema.id, 'vpn')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#6b7280',
                            fontSize: '14px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={isVpnPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          <i className={`fas ${isVpnPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
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
                    <div style={{ gridColumn: sistema.usuario_sistema ? 'span 1' : 'span 2', minWidth: 0 }}>
                      <span style={{ color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Senha: </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <ValueWithCopy 
                            value={sistema.senha_sistema} 
                            fieldId={`sistema-senha-sistema-${sistema.id}`}
                            isPassword={true}
                            isHidden={!isSistemaPasswordVisible}
                          />
                        </div>
                        <button
                          onClick={() => togglePassword(sistema.id, 'sistema')}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: '#6b7280',
                            fontSize: '14px',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title={isSistemaPasswordVisible ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          <i className={`fas ${isSistemaPasswordVisible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Informações Adicionais - Ordem: Link de Acesso, Observações */}
            {(sistema.link_acesso || sistema.observacoes) && (
              <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 600, color: '#4b5563', fontSize: '12px', marginBottom: '8px' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '6px', color: '#6b7280' }}></i>
                  Informações Adicionais
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', color: '#374151' }}>
                  {sistema.link_acesso && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Link Acesso: </span>
                      <a 
                        href={sistema.link_acesso} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#3b82f6', 
                          textDecoration: 'underline',
                          wordBreak: 'break-all',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir em nova aba"
                      >
                        {sistema.link_acesso}
                        <i className="fas fa-external-link-alt" style={{ fontSize: '10px', opacity: 0.7 }}></i>
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(sistema.link_acesso, `sistema-link-${sistema.id}`, e);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          color: '#9ca3af',
                          fontSize: '12px',
                          marginLeft: '4px'
                        }}
                        title="Copiar link"
                      >
                        <i className={`fas ${copiedField === `sistema-link-${sistema.id}` ? 'fa-check' : 'fa-copy'}`}></i>
                      </button>
                    </div>
                  )}
                  {sistema.observacoes && (
                    <div style={{ 
                      gridColumn: 'span 2',
                      fontSize: '12px', 
                      color: '#374151', 
                      padding: '8px',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      <span style={{ color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Observações: </span>
                      {sistema.observacoes}
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

