import React, { useState } from 'react';
import BankLogo from '../../bancos/BankLogo';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BankLogo 
                codigo={banco.codigo} 
                nome={banco.nome} 
                size={32}
                className="bank-logo-card"
              />
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '14px', letterSpacing: '.2px' }}>
                {bancoNome}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Dados Bancários - Ordem: Agência, Conta, Operador, Chave de Acesso */}
              {(conta.agencia || conta.conta || conta.operador || conta.chave_acesso) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
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
                  {conta.chave_acesso && (
                    <div>
                      <span style={{ color: '#6b7280', fontWeight: 500 }}>Chave Acesso: </span>
                      <ValueWithCopy 
                        value={conta.chave_acesso} 
                        fieldId={`conta-chave-acesso-${conta.id}`}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Credenciais de Acesso */}
              {(conta.usuario || conta.senha) && (
                <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
                    {conta.usuario && (
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>Usuário: </span>
                        <ValueWithCopy value={conta.usuario} fieldId={`conta-usuario-${conta.id}`} />
                      </div>
                    )}
                    {conta.senha && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              )}

              {/* Senhas Adicionais */}
              {(conta.senha_4digitos || conta.senha_6digitos || conta.senha_8digitos) && (
                <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: '6px', fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                    SENHAS ADICIONAIS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
                    {conta.senha_4digitos && (
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>4 Dígitos: </span>
                        <ValueWithCopy 
                          value={conta.senha_4digitos} 
                          fieldId={`conta-senha4-${conta.id}`}
                          isPassword={true}
                          isHidden={!isPasswordVisible}
                        />
                      </div>
                    )}
                    {conta.senha_6digitos && (
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>6 Dígitos: </span>
                        <ValueWithCopy 
                          value={conta.senha_6digitos} 
                          fieldId={`conta-senha6-${conta.id}`}
                          isPassword={true}
                          isHidden={!isPasswordVisible}
                        />
                      </div>
                    )}
                    {conta.senha_8digitos && (
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>8 Dígitos: </span>
                        <ValueWithCopy 
                          value={conta.senha_8digitos} 
                          fieldId={`conta-senha8-${conta.id}`}
                          isPassword={true}
                          isHidden={!isPasswordVisible}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status e Informações Adicionais - Ordem: Status Cadastro, Status Acesso, Link de Acesso */}
              {(conta.status_cadastro || conta.status_acesso || conta.link_acesso) && (
                <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: '6px', fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                    STATUS E INFORMAÇÕES ADICIONAIS
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', color: '#374151' }}>
                    {conta.status_cadastro && (
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>Status Cadastro: </span>
                        <ValueWithCopy value={conta.status_cadastro} fieldId={`conta-status-cadastro-${conta.id}`} />
                      </div>
                    )}
                    {conta.status_acesso && (
                      <div>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>Status Acesso: </span>
                        <ValueWithCopy value={conta.status_acesso} fieldId={`conta-status-acesso-${conta.id}`} />
                      </div>
                    )}
                    {conta.link_acesso && (
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: '#6b7280', fontWeight: 500 }}>Link Acesso: </span>
                        <a 
                          href={conta.link_acesso} 
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
                          {conta.link_acesso}
                          <i className="fas fa-external-link-alt" style={{ fontSize: '10px', opacity: 0.7 }}></i>
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(conta.link_acesso, `conta-link-${conta.id}`, e);
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
                          <i className={`fas ${copiedField === `conta-link-${conta.id}` ? 'fa-check' : 'fa-copy'}`}></i>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Observações */}
              {conta.observacoes && (
                <div style={{ paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: '6px', fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
                    OBSERVAÇÕES
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#374151', 
                    padding: '8px',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {conta.observacoes}
                  </div>
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

