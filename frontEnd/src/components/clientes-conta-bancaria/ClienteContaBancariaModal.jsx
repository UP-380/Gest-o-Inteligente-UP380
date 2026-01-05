import React, { useEffect, useRef, useState } from 'react';

/**
 * Modal reutilizável para criar/editar conta bancária do cliente
 */
const ClienteContaBancariaModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  formErrors,
  setFormErrors,
  submitting,
  editingId,
  clienteId,
  bancos = []
}) => {
  const bancoSelectRef = useRef(null);
  const [bancosList, setBancosList] = useState(bancos);
  const [showSenha, setShowSenha] = useState(false);
  const [showNovoBanco, setShowNovoBanco] = useState(false);
  const [bancoFormData, setBancoFormData] = useState({ nome: '', codigo: '' });
  const [bancoFormErrors, setBancoFormErrors] = useState({});
  const [bancoSubmitting, setBancoSubmitting] = useState(false);

  // Carregar bancos se não foram fornecidos
  useEffect(() => {
    if (bancos.length === 0 && isOpen) {
      fetch('/api/bancos?limit=1000', {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
        .then(res => res.json())
        .then(result => {
          if (result.success && result.data) {
            setBancosList(result.data);
          }
        })
        .catch(err => console.error('Erro ao carregar bancos:', err));
    } else {
      setBancosList(bancos);
    }
  }, [bancos, isOpen]);

  // Focar no campo banco quando o modal abrir
  useEffect(() => {
    if (isOpen && bancoSelectRef.current) {
      setTimeout(() => {
        bancoSelectRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);


  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(e);
    }
  };

  const handleBancoChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, banco_id: value });
    if (formErrors.banco_id) {
      setFormErrors({ ...formErrors, banco_id: '' });
    }
  };

  const handleFieldChange = (fieldName) => (e) => {
    const value = e.target.value;
    setFormData({ ...formData, [fieldName]: value });
    if (formErrors[fieldName]) {
      setFormErrors({ ...formErrors, [fieldName]: '' });
    }
  };

  // Função para salvar novo banco
  const handleSalvarBanco = async (e) => {
    e.preventDefault();
    
    // Validações
    const errors = {};
    if (!bancoFormData.nome || !bancoFormData.nome.trim()) {
      errors.nome = 'Nome do banco é obrigatório';
    }
    
    if (Object.keys(errors).length > 0) {
      setBancoFormErrors(errors);
      return;
    }

    setBancoSubmitting(true);
    setBancoFormErrors({});

    try {
      const response = await fetch('/api/bancos', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          nome: bancoFormData.nome.trim(),
          codigo: bancoFormData.codigo ? bancoFormData.codigo.trim() : null
        }),
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success && result.data) {
        // Adicionar o novo banco à lista
        const novoBanco = result.data;
        setBancosList([...bancosList, novoBanco]);
        
        // Selecionar automaticamente o banco criado
        setFormData({ ...formData, banco_id: novoBanco.id });
        if (formErrors.banco_id) {
          setFormErrors({ ...formErrors, banco_id: '' });
        }
        
        // Fechar os campos de novo banco
        setShowNovoBanco(false);
        setBancoFormData({ nome: '', codigo: '' });
      } else {
        setBancoFormErrors({ 
          nome: result.error || 'Erro ao salvar banco. Tente novamente.' 
        });
      }
    } catch (error) {
      console.error('Erro ao salvar banco:', error);
      setBancoFormErrors({ 
        nome: 'Erro ao salvar banco. Tente novamente.' 
      });
    } finally {
      setBancoSubmitting(false);
    }
  };

  const canSave = formData.banco_id && !submitting;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ 
        maxWidth: '900px', 
        width: '95%', 
        maxHeight: '95vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '18px 24px', 
          borderBottom: '1px solid #eee',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <i className={`fas ${editingId ? 'fa-edit' : 'fa-university'}`} style={{ marginRight: '8px', color: 'var(--primary-color, #3498db)' }}></i>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {editingId ? 'Editar Conta Bancária' : 'Nova Conta Bancária'}
            </h3>
          </div>
          <button
            className="btn-icon"
            onClick={onClose}
            title="Fechar"
            disabled={submitting}
            style={{ fontSize: '18px' }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="modal-body" style={{ 
          padding: '20px 24px', 
          overflowY: 'auto',
          overflowX: 'hidden',
          flex: 1,
          minHeight: 0
        }}>
          <form onSubmit={handleSubmit} className="conta-bancaria-form">
            {/* Campo Banco - Obrigatório */}
            <div className="form-group" style={{ marginBottom: '18px' }}>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                Banco <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    ref={bancoSelectRef}
                    className={`form-input ${formErrors.banco_id ? 'error' : ''}`}
                    value={formData.banco_id || ''}
                    onChange={handleBancoChange}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 36px 9px 12px',
                      fontSize: '14px',
                      border: formErrors.banco_id ? '2px solid #ef4444' : (formData.banco_id ? '1px solid #10b981' : '1px solid #d1d5db'),
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff',
                      appearance: 'none',
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%236b7280\' d=\'M6 9L1 4h10z\'/%3E%3C/svg%3E")',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      backgroundSize: '12px',
                      cursor: submitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="">Selecione o banco</option>
                    {bancosList.map((banco) => (
                      <option key={banco.id} value={banco.id}>
                        {banco.codigo ? `${banco.codigo} - ` : ''}{banco.nome}
                      </option>
                    ))}
                  </select>
                  {formData.banco_id && !formErrors.banco_id && (
                    <i className="fas fa-check-circle" style={{
                      position: 'absolute',
                      right: '32px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#10b981',
                      fontSize: '16px',
                      pointerEvents: 'none'
                    }}></i>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (showNovoBanco) {
                      setShowNovoBanco(false);
                      setBancoFormData({ nome: '', codigo: '' });
                      setBancoFormErrors({});
                    } else {
                      setShowNovoBanco(true);
                      setBancoFormData({ nome: '', codigo: '' });
                      setBancoFormErrors({});
                    }
                  }}
                  disabled={submitting}
                  title={showNovoBanco ? "Cancelar adicionar banco" : "Adicionar novo banco"}
                  style={{
                    padding: '9px 12px',
                    fontSize: '14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: showNovoBanco ? '#ef4444' : '#fff',
                    color: showNovoBanco ? '#fff' : '#0e3b6f',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                    opacity: submitting ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!submitting && !showNovoBanco) {
                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#0e3b6f';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!submitting && !showNovoBanco) {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  <i className={`fas ${showNovoBanco ? 'fa-times' : 'fa-plus'}`} style={{ fontSize: '12px' }}></i>
                </button>
              </div>
              {formErrors.banco_id && (
                <span className="error-message" style={{ 
                  color: '#ef4444', 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-exclamation-circle"></i>
                  {formErrors.banco_id}
                </span>
              )}
              {!formErrors.banco_id && formData.banco_id && (
                <span style={{ 
                  color: '#10b981', 
                  fontSize: '11px', 
                  marginTop: '4px', 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <i className="fas fa-check-circle"></i>
                  Banco selecionado
                </span>
              )}
              
              {/* Campos para adicionar novo banco */}
              {showNovoBanco && (
                <div style={{
                  marginTop: '12px',
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}>
                  <div style={{ marginBottom: '12px', fontWeight: '500', fontSize: '13px', color: '#374151' }}>
                    <i className="fas fa-plus-circle" style={{ marginRight: '6px', color: '#0e3b6f' }}></i>
                    Novo Banco
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '12px' }}>
                        Nome do Banco <span className="required" style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className={`form-input ${bancoFormErrors.nome ? 'error' : ''}`}
                        value={bancoFormData.nome}
                        onChange={(e) => {
                          const value = e.target.value;
                          setBancoFormData({ ...bancoFormData, nome: value });
                          if (bancoFormErrors.nome) {
                            setBancoFormErrors({ ...bancoFormErrors, nome: '' });
                          }
                        }}
                        placeholder="Ex: Banco do Brasil, Bradesco, Itaú..."
                        disabled={bancoSubmitting}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '13px',
                          border: bancoFormErrors.nome ? '2px solid #ef4444' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          transition: 'border-color 0.2s'
                        }}
                        maxLength={100}
                      />
                      {bancoFormErrors.nome && (
                        <span className="error-message" style={{ 
                          color: '#ef4444', 
                          fontSize: '11px', 
                          marginTop: '4px', 
                          display: 'block' 
                        }}>
                          {bancoFormErrors.nome}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: '0 0 150px' }}>
                      <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '12px' }}>
                        Código
                        <span style={{ 
                          fontSize: '10px', 
                          color: '#6b7280', 
                          marginLeft: '4px',
                          fontWeight: 'normal'
                        }}>
                          (Opcional)
                        </span>
                      </label>
                      <input
                        type="text"
                        className={`form-input ${bancoFormErrors.codigo ? 'error' : ''}`}
                        value={bancoFormData.codigo || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, ''); // Apenas números
                          setBancoFormData({ ...bancoFormData, codigo: value });
                          if (bancoFormErrors.codigo) {
                            setBancoFormErrors({ ...bancoFormErrors, codigo: '' });
                          }
                        }}
                        placeholder="Ex: 001, 237, 341..."
                        disabled={bancoSubmitting}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '13px',
                          border: bancoFormErrors.codigo ? '2px solid #ef4444' : '1px solid #d1d5db',
                          borderRadius: '6px',
                          transition: 'border-color 0.2s'
                        }}
                        maxLength={10}
                      />
                      {bancoFormErrors.codigo && (
                        <span className="error-message" style={{ 
                          color: '#ef4444', 
                          fontSize: '11px', 
                          marginTop: '4px', 
                          display: 'block' 
                        }}>
                          {bancoFormErrors.codigo}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNovoBanco(false);
                        setBancoFormData({ nome: '', codigo: '' });
                        setBancoFormErrors({});
                      }}
                      disabled={bancoSubmitting}
                      style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        backgroundColor: '#fff',
                        color: '#374151',
                        cursor: bancoSubmitting ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvarBanco}
                      disabled={bancoSubmitting || !bancoFormData.nome?.trim()}
                      style={{
                        padding: '6px 16px',
                        fontSize: '12px',
                        border: 'none',
                        borderRadius: '6px',
                        backgroundColor: bancoSubmitting || !bancoFormData.nome?.trim() ? '#9ca3af' : '#0e3b6f',
                        color: '#fff',
                        cursor: bancoSubmitting || !bancoFormData.nome?.trim() ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        opacity: bancoSubmitting || !bancoFormData.nome?.trim() ? 0.6 : 1
                      }}
                    >
                      {bancoSubmitting ? (
                        <>
                          <i className="fas fa-spinner fa-spin" style={{ marginRight: '4px' }}></i>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save" style={{ marginRight: '4px' }}></i>
                          Salvar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Campos de Dados Bancários */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ 
                  width: '4px', 
                  height: '20px', 
                  backgroundColor: '#3b82f6', 
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-building-columns" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                  Dados Bancários
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Agencia/coperativa
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.agencia ? 'error' : ''}`}
                    value={formData.agencia || ''}
                    onChange={handleFieldChange('agencia')}
                    placeholder="Ex: 1234"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.agencia ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={10}
                  />
                  {formErrors.agencia && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.agencia}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Conta/Convenio
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.conta ? 'error' : ''}`}
                    value={formData.conta || ''}
                    onChange={handleFieldChange('conta')}
                    placeholder="Ex: 123456-7"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.conta ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={20}
                  />
                  {formErrors.conta && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.conta}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Operador
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.operador ? 'error' : ''}`}
                    value={formData.operador || ''}
                    onChange={handleFieldChange('operador')}
                    placeholder="Ex: 001"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.operador ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={10}
                  />
                  {formErrors.operador && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.operador}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Chave de Acesso
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.chave_acesso ? 'error' : ''}`}
                    value={formData.chave_acesso || ''}
                    onChange={handleFieldChange('chave_acesso')}
                    placeholder="Ex: Token ou chave"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.chave_acesso ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={200}
                  />
                  {formErrors.chave_acesso && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.chave_acesso}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de Credenciais */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ 
                  width: '4px', 
                  height: '20px', 
                  backgroundColor: '#10b981', 
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-key" style={{ marginRight: '8px', color: '#10b981' }}></i>
                  Credenciais de Acesso
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Usuário
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.usuario ? 'error' : ''}`}
                    value={formData.usuario || ''}
                    onChange={handleFieldChange('usuario')}
                    placeholder="Ex: usuario.banco"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.usuario ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={100}
                  />
                  {formErrors.usuario && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.usuario}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showSenha ? 'text' : 'password'}
                      className={`form-input ${formErrors.senha ? 'error' : ''}`}
                      value={formData.senha || ''}
                      onChange={handleFieldChange('senha')}
                      placeholder="Digite a senha"
                      disabled={submitting}
                      style={{
                        width: '100%',
                        padding: '9px 40px 9px 12px',
                        fontSize: '14px',
                        border: formErrors.senha ? '2px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '6px',
                        transition: 'border-color 0.2s',
                        backgroundColor: submitting ? '#f3f4f6' : '#fff'
                      }}
                      maxLength={100}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#374151'}
                      onMouseLeave={(e) => e.target.style.color = '#6b7280'}
                      title={showSenha ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      <i className={`fas ${showSenha ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  {formErrors.senha && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de Senhas Adicionais */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ 
                  width: '4px', 
                  height: '20px', 
                  backgroundColor: '#8b5cf6', 
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-lock" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>
                  Senhas Adicionais
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha 4 Dígitos
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="password"
                    className={`form-input ${formErrors.senha_4digitos ? 'error' : ''}`}
                    value={formData.senha_4digitos || ''}
                    onChange={handleFieldChange('senha_4digitos')}
                    placeholder="Ex: 1234"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.senha_4digitos ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={4}
                  />
                  {formErrors.senha_4digitos && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha_4digitos}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha 6 Dígitos
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="password"
                    className={`form-input ${formErrors.senha_6digitos ? 'error' : ''}`}
                    value={formData.senha_6digitos || ''}
                    onChange={handleFieldChange('senha_6digitos')}
                    placeholder="Ex: 123456"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.senha_6digitos ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={6}
                  />
                  {formErrors.senha_6digitos && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha_6digitos}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Senha 8 Dígitos
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="password"
                    className={`form-input ${formErrors.senha_8digitos ? 'error' : ''}`}
                    value={formData.senha_8digitos || ''}
                    onChange={handleFieldChange('senha_8digitos')}
                    placeholder="Ex: 12345678"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.senha_8digitos ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={8}
                  />
                  {formErrors.senha_8digitos && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.senha_8digitos}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Campos de Status e Acesso */}
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ 
                  width: '4px', 
                  height: '20px', 
                  backgroundColor: '#f59e0b', 
                  borderRadius: '2px',
                  marginRight: '12px'
                }}></div>
                <h4 style={{ fontSize: '15px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                  <i className="fas fa-info-circle" style={{ marginRight: '8px', color: '#f59e0b' }}></i>
                  Status e Informações Adicionais
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Status Cadastro
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.status_cadastro ? 'error' : ''}`}
                    value={formData.status_cadastro || ''}
                    onChange={handleFieldChange('status_cadastro')}
                    placeholder="Ex: Ativo, Pendente"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.status_cadastro ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={50}
                  />
                  {formErrors.status_cadastro && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.status_cadastro}
                    </span>
                  )}
                </div>

                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Status Acesso
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="text"
                    className={`form-input ${formErrors.status_acesso ? 'error' : ''}`}
                    value={formData.status_acesso || ''}
                    onChange={handleFieldChange('status_acesso')}
                    placeholder="Ex: Liberado, Bloqueado"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.status_acesso ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={50}
                  />
                  {formErrors.status_acesso && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.status_acesso}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '0' }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                    Link de Acesso
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#9ca3af', 
                      marginLeft: '4px',
                      fontWeight: 'normal'
                    }}>
                      (Opcional)
                    </span>
                  </label>
                  <input
                    type="url"
                    className={`form-input ${formErrors.link_acesso ? 'error' : ''}`}
                    value={formData.link_acesso || ''}
                    onChange={handleFieldChange('link_acesso')}
                    placeholder="Ex: https://banco.com.br"
                    disabled={submitting}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      fontSize: '14px',
                      border: formErrors.link_acesso ? '2px solid #ef4444' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      transition: 'border-color 0.2s',
                      backgroundColor: submitting ? '#f3f4f6' : '#fff'
                    }}
                    maxLength={500}
                  />
                  {formErrors.link_acesso && (
                    <span className="error-message" style={{ 
                      color: '#ef4444', 
                      fontSize: '11px', 
                      marginTop: '3px', 
                      display: 'block' 
                    }}>
                      <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                      {formErrors.link_acesso}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '14px' }}>
                <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: '500', fontSize: '13px' }}>
                  Observações
                  <span style={{ 
                    fontSize: '11px', 
                    color: '#9ca3af', 
                    marginLeft: '4px',
                    fontWeight: 'normal'
                  }}>
                    (Opcional)
                  </span>
                </label>
                <textarea
                  className={`form-input ${formErrors.observacoes ? 'error' : ''}`}
                  value={formData.observacoes || ''}
                  onChange={handleFieldChange('observacoes')}
                  placeholder="Digite observações sobre a conta bancária..."
                  disabled={submitting}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    fontSize: '14px',
                    border: formErrors.observacoes ? '2px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    transition: 'border-color 0.2s',
                    backgroundColor: submitting ? '#f3f4f6' : '#fff',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  maxLength={1000}
                />
                {formErrors.observacoes && (
                  <span className="error-message" style={{ 
                    color: '#ef4444', 
                    fontSize: '11px', 
                    marginTop: '3px', 
                    display: 'block' 
                  }}>
                    <i className="fas fa-exclamation-circle" style={{ marginRight: '4px' }}></i>
                    {formErrors.observacoes}
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
        <div className="modal-footer" style={{ 
          padding: '14px 24px', 
          borderTop: '1px solid #eee',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          flexShrink: 0,
          marginTop: 'auto'
        }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              fontSize: '14px'
            }}
          >
            <i className="fas fa-times" style={{ marginRight: '6px' }}></i>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={!canSave}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              opacity: !canSave ? 0.6 : 1,
              cursor: !canSave ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }}></i>
                Salvando...
              </>
            ) : (
              <>
                <i className={`fas ${editingId ? 'fa-save' : 'fa-plus'}`} style={{ marginRight: '6px' }}></i>
                {editingId ? 'Atualizar' : 'Salvar'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClienteContaBancariaModal;
