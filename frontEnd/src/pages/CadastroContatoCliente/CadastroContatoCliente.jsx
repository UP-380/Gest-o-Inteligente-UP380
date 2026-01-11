import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import { useToast } from '../../hooks/useToast';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import './CadastroContatoCliente.css';

const API_BASE_URL = '/api';

const CadastroContatoCliente = () => {
  const showToast = useToast();
  
  // Estados principais
  const [contatos, setContatos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContatos, setTotalContatos] = useState(0);
  const [mostrarInativos, setMostrarInativos] = useState(false);

  // Estados para modal de formulário
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cargo: '',
    departamento: '',
    observacoes: '',
    ativo: true,
    permite_envio_documentos: false,
    cliente_id: '' // Cliente para vincular ao criar
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Estados para modal de vinculação
  const [showVinculacaoModal, setShowVinculacaoModal] = useState(false);
  const [contatoParaVincular, setContatoParaVincular] = useState(null);
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [vinculando, setVinculando] = useState(false);

  // Estados para modal de confirmação
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contatoToDelete, setContatoToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Carregar clientes para o select
  const loadClientes = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/clientes?page=1&limit=10000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setClientes(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    }
  }, []);

  // Carregar contatos com clientes vinculados
  const loadContatos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString()
      });

      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }

      if (!mostrarInativos) {
        params.append('ativo', 'true');
      }

      const response = await fetch(`${API_BASE_URL}/contatos?${params}`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Carregar clientes vinculados para cada contato
        const contatosComClientes = await Promise.all(
          (result.data || []).map(async (contato) => {
            try {
              const clienteResponse = await fetch(`${API_BASE_URL}/contatos/${contato.id}`, {
                credentials: 'include',
                headers: {
                  'Accept': 'application/json',
                },
              });

              if (clienteResponse.ok) {
                const clienteResult = await clienteResponse.json();
                if (clienteResult.success && clienteResult.data && clienteResult.data.cliente_contato) {
                  contato.clientesVinculados = clienteResult.data.cliente_contato.map(v => ({
                    ...v.cp_cliente,
                    vinculoId: v.id // Armazenar ID do vínculo para poder desvincular
                  }));
                }
              }
            } catch (err) {
              console.error('Erro ao carregar clientes do contato:', err);
            }
            return contato;
          })
        );

        setContatos(contatosComClientes);
        setTotalContatos(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / itemsPerPage));
      } else {
        throw new Error(result.error || 'Erro ao carregar contatos');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar contatos:', error);
      showToast('error', error.message || 'Erro ao carregar contatos. Tente novamente.');
      setContatos([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, mostrarInativos, showToast]);

  // Abrir modal de formulário
  const handleNewContato = () => {
    setEditingId(null);
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      cargo: '',
      departamento: '',
      observacoes: '',
      ativo: true,
      permite_envio_documentos: false,
      cliente_id: ''
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  // Abrir modal de edição
  const handleEdit = (contato) => {
    setEditingId(contato.id);
    setFormData({
      nome: contato.nome || '',
      email: contato.email || '',
      telefone: contato.telefone ? aplicarMascaraTelefone(contato.telefone) : '',
      cargo: contato.cargo || '',
      departamento: contato.departamento || '',
      observacoes: contato.observacoes || '',
      ativo: contato.ativo !== undefined ? contato.ativo : true,
      permite_envio_documentos: contato.permite_envio_documentos || false,
      cliente_id: '' // Não mostrar cliente na edição (já vinculados aparecem separadamente)
    });
    setFormErrors({});
    setShowFormModal(true);
  };

  // Salvar contato
  const handleSave = async () => {
    // Validação
    const errors = {};
    if (!formData.nome || !formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'E-mail inválido';
      }
    }

    if (formData.telefone && formData.telefone.trim()) {
      if (!validarTelefone(formData.telefone)) {
        errors.telefone = 'Telefone deve estar no formato (00) 0 0000-0000';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      // Preparar dados do contato (sem cliente_id)
      const contatoData = {
        nome: formData.nome,
        email: formData.email || null,
        telefone: formData.telefone || null,
        cargo: formData.cargo || null,
        departamento: formData.departamento || null,
        observacoes: formData.observacoes || null,
        ativo: formData.ativo,
        permite_envio_documentos: formData.permite_envio_documentos
      };

      const url = editingId 
        ? `${API_BASE_URL}/contatos/${editingId}`
        : `${API_BASE_URL}/contatos`;
      
      const method = editingId ? 'PUT' : 'POST';

      // Criar ou atualizar contato
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(contatoData)
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Se for criação E tiver cliente selecionado, vincular
        if (!editingId && formData.cliente_id && formData.cliente_id.trim()) {
          try {
            const vincularResponse = await fetch(`${API_BASE_URL}/contatos/vincular`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
              },
              body: JSON.stringify({
                cliente_id: formData.cliente_id,
                contato_id: result.data.id
              })
            });

            if (vincularResponse.ok) {
              const vincularResult = await vincularResponse.json();
              if (vincularResult.success) {
                showToast('success', 'Contato criado e vinculado ao cliente com sucesso!');
              } else {
                showToast('success', 'Contato criado com sucesso! (Erro ao vincular: ' + (vincularResult.error || 'Erro desconhecido') + ')');
              }
            } else {
              showToast('success', 'Contato criado com sucesso! (Erro ao vincular)');
            }
          } catch (vincularError) {
            console.error('Erro ao vincular contato:', vincularError);
            showToast('success', 'Contato criado com sucesso! (Erro ao vincular)');
          }
        } else {
          showToast('success', editingId ? 'Contato atualizado com sucesso!' : 'Contato criado com sucesso!');
        }
        
        setShowFormModal(false);
        await loadContatos();
      } else {
        throw new Error(result.error || 'Erro ao salvar contato');
      }
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
      showToast('error', error.message || 'Erro ao salvar contato. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deletar contato
  const handleDelete = useCallback(async () => {
    if (!contatoToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contatos/${contatoToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Contato deletado com sucesso!');
        setShowDeleteModal(false);
        setContatoToDelete(null);
        await loadContatos();
      } else {
        throw new Error(result.error || 'Erro ao deletar contato');
      }
    } catch (error) {
      console.error('Erro ao deletar contato:', error);
      showToast('error', error.message || 'Erro ao deletar contato. Tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  }, [contatoToDelete, loadContatos, showToast]);

  // Abrir modal de vinculação
  const handleVincular = (contato) => {
    setContatoParaVincular(contato);
    setClienteSelecionado('');
    setShowVinculacaoModal(true);
  };

  // Vincular contato a cliente
  const handleVincularCliente = async () => {
    if (!contatoParaVincular || !clienteSelecionado) {
      showToast('error', 'Selecione um cliente');
      return;
    }

    setVinculando(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contatos/vincular`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          cliente_id: clienteSelecionado,
          contato_id: contatoParaVincular.id
        })
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', 'Contato vinculado ao cliente com sucesso!');
        setShowVinculacaoModal(false);
        setContatoParaVincular(null);
        setClienteSelecionado('');
        await loadContatos();
      } else {
        throw new Error(result.error || 'Erro ao vincular contato');
      }
    } catch (error) {
      console.error('Erro ao vincular contato:', error);
      showToast('error', error.message || 'Erro ao vincular contato. Tente novamente.');
    } finally {
      setVinculando(false);
    }
  };

  // Desvincular contato de cliente
  const handleDesvincularCliente = async (vinculoId, contatoNome, clienteNome) => {
    if (!vinculoId) {
      showToast('error', 'ID do vínculo não encontrado');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/contatos/vinculo/${vinculoId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (result.success) {
        showToast('success', `Contato "${contatoNome}" desvinculado de "${clienteNome}" com sucesso!`);
        await loadContatos();
      } else {
        throw new Error(result.error || 'Erro ao desvincular contato');
      }
    } catch (error) {
      console.error('Erro ao desvincular contato:', error);
      showToast('error', error.message || 'Erro ao desvincular contato. Tente novamente.');
    }
  };

  // Confirmar exclusão
  const confirmDelete = (contato) => {
    setContatoToDelete(contato);
    setShowDeleteModal(true);
  };

  // Aplicar máscara de telefone (00) 0 0000-0000
  const aplicarMascaraTelefone = (valor) => {
    // Remove tudo que não é dígito
    const apenasDigitos = valor.replace(/\D/g, '');
    
    // Limita a 11 dígitos (DDD + 9 dígitos)
    const digitosLimitados = apenasDigitos.slice(0, 11);
    
    // Aplica a máscara (00) 0 0000-0000
    if (digitosLimitados.length === 0) {
      return '';
    } else if (digitosLimitados.length <= 2) {
      return `(${digitosLimitados}`;
    } else if (digitosLimitados.length <= 3) {
      return `(${digitosLimitados.slice(0, 2)}) ${digitosLimitados.slice(2)}`;
    } else if (digitosLimitados.length <= 7) {
      return `(${digitosLimitados.slice(0, 2)}) ${digitosLimitados.slice(2, 3)} ${digitosLimitados.slice(3)}`;
    } else {
      return `(${digitosLimitados.slice(0, 2)}) ${digitosLimitados.slice(2, 3)} ${digitosLimitados.slice(3, 7)}-${digitosLimitados.slice(7, 11)}`;
    }
  };

  // Validar formato de telefone (00) 0 0000-0000
  const validarTelefone = (telefone) => {
    if (!telefone || !telefone.trim()) {
      return true; // Telefone é opcional
    }
    // Remove caracteres não numéricos
    const apenasDigitos = telefone.replace(/\D/g, '');
    // Deve ter exatamente 11 dígitos (DDD + 9 dígitos)
    return apenasDigitos.length === 11;
  };

  // Debounce para busca
  const searchTimeoutRef = useRef(null);
  const handleSearch = useCallback((value) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setCurrentPage(1);
    }, 500);
  }, []);

  // Efeitos
  useEffect(() => {
    loadContatos();
    loadClientes();
  }, [loadContatos, loadClientes]);

  // Definir colunas da tabela
  const tableColumns = [
    { 
      key: 'nome', 
      label: 'Nome',
      render: (contato) => (
        <div className="contato-nome-cell">
          <strong>{contato.nome || '-'}</strong>
          {contato.permite_envio_documentos && (
            <span className="badge-envio" title="Permite envio de documentos">
              <i className="fas fa-paper-plane"></i>
            </span>
          )}
        </div>
      )
    },
    { 
      key: 'email', 
      label: 'E-mail',
      render: (contato) => contato.email || '-'
    },
    { 
      key: 'telefone', 
      label: 'Telefone',
      render: (contato) => contato.telefone || '-'
    },
    { 
      key: 'cargo', 
      label: 'Cargo',
      render: (contato) => contato.cargo || '-'
    },
    { 
      key: 'clientes', 
      label: 'Clientes Vinculados',
      render: (contato) => {
        const clientes = contato.clientesVinculados || [];
        if (clientes.length === 0) {
          return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum cliente</span>;
        }
        return (
          <div className="clientes-vinculados">
            {clientes.map((cliente, idx) => {
              const clienteNome = cliente?.nome || cliente?.razao_social || cliente?.nome_fantasia || 'Cliente';
              const vinculoId = cliente?.vinculoId;
              
              return (
                <span key={vinculoId || idx} className="badge-cliente">
                  {clienteNome}
                  {vinculoId && (
                    <button
                      type="button"
                      className="btn-remove-vinculo"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Deseja realmente desvincular o contato "${contato.nome}" de "${clienteNome}"?`)) {
                          handleDesvincularCliente(vinculoId, contato.nome, clienteNome);
                        }
                      }}
                      title="Desvincular"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        );
      }
    },
    { 
      key: 'ativo', 
      label: 'Status',
      render: (contato) => (
        <span className={`status-badge ${contato.ativo ? 'ativo' : 'inativo'}`}>
          {contato.ativo ? 'Ativo' : 'Inativo'}
        </span>
      )
    }
  ];

  // Renderizar ações da tabela
  const renderTableActions = (contato) => (
    <>
      <EditButton
        onClick={() => handleEdit(contato)}
        title="Editar"
      />
      <button
        className="btn-icon btn-vincular"
        onClick={() => handleVincular(contato)}
        title="Vincular a Cliente"
      >
        <i className="fas fa-link"></i>
      </button>
      <DeleteButton
        onClick={() => confirmDelete(contato)}
        title="Deletar"
      />
    </>
  );


  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="cadastro-contato-cliente-listing-section">
              <div className="cadastro-listing-page-header">
                <div className="cadastro-listing-header-content">
                  <div className="cadastro-listing-header-left">
                    <div className="cadastro-listing-header-icon">
                      <i className="fas fa-address-book" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                    </div>
                    <div>
                      <h1 className="cadastro-listing-page-title">Cadastro de Contatos</h1>
                      <p className="cadastro-listing-page-subtitle">
                        Gerencie os contatos dos clientes e suas vinculações
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtro de busca e botão adicionar */}
              <div className="listing-controls">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                  <SearchInput
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder="Buscar por nome, e-mail ou telefone..."
                  />
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={mostrarInativos}
                      onChange={(e) => {
                        setMostrarInativos(e.target.checked);
                        setCurrentPage(1);
                      }}
                    />
                    Mostrar inativos
                  </label>
                </div>
                <div className="listing-controls-right">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="select-items-per-page"
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                  </select>
                  <ButtonPrimary
                    onClick={handleNewContato}
                    icon="fas fa-plus"
                  >
                    Novo Contato
                  </ButtonPrimary>
                </div>
              </div>

              {/* Lista de contatos */}
              <div className="listing-table-container">
                {loading ? (
                  <LoadingState message="Carregando contatos..." />
                ) : (
                  <>
                    <DataTable
                      data={contatos}
                      columns={tableColumns}
                      renderActions={renderTableActions}
                      emptyMessage="Nenhum contato encontrado"
                    />

                    {totalPages > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        totalItems={totalContatos}
                        itemsPerPage={itemsPerPage}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal de Formulário */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowFormModal(false)}>
          <div className="modal-content contato-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fas fa-address-book"></i>
                {editingId ? 'Editar Contato' : 'Novo Contato'}
              </h3>
              <button
                className="btn-icon"
                onClick={() => !submitting && setShowFormModal(false)}
                disabled={submitting}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>
                  Nome <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className={formErrors.nome ? 'error' : ''}
                />
                {formErrors.nome && <span className="error-message">{formErrors.nome}</span>}
              </div>

              <div className="form-group">
                <label>E-mail</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={formErrors.email ? 'error' : ''}
                />
                {formErrors.email && <span className="error-message">{formErrors.email}</span>}
              </div>

              <div className="form-group">
                <label>Telefone</label>
                <input
                  type="text"
                  value={formData.telefone}
                  onChange={(e) => {
                    const masked = aplicarMascaraTelefone(e.target.value);
                    setFormData({ ...formData, telefone: masked });
                    // Limpar erro se existir
                    if (formErrors.telefone) {
                      setFormErrors({ ...formErrors, telefone: '' });
                    }
                  }}
                  placeholder="(00) 0 0000-0000"
                  maxLength={16}
                  className={formErrors.telefone ? 'error' : ''}
                />
                {formErrors.telefone && <span className="error-message">{formErrors.telefone}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Cargo</label>
                  <input
                    type="text"
                    value={formData.cargo}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Departamento</label>
                  <input
                    type="text"
                    value={formData.departamento}
                    onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.ativo}
                      onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    />
                    Contato ativo
                  </label>
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.permite_envio_documentos}
                      onChange={(e) => setFormData({ ...formData, permite_envio_documentos: e.target.checked })}
                    />
                    Permite envio de documentos
                  </label>
                </div>
              </div>

              {/* Campo de cliente - apenas ao criar novo contato */}
              {!editingId && (
                <div className="form-group">
                  <label>
                    <i className="fas fa-link" style={{ marginRight: '8px', color: '#0e3b6f' }}></i>
                    Vincular a Cliente (Opcional)
                  </label>
                  <select
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    disabled={submitting}
                  >
                    <option value="">Selecione um cliente (opcional)...</option>
                    {clientes
                      .filter(c => c.status === 'ativo' || !c.status)
                      .map(cliente => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome}
                        </option>
                      ))}
                  </select>
                  <small style={{ display: 'block', marginTop: '4px', color: '#64748b', fontSize: '12px' }}>
                    Você pode vincular o contato a um cliente agora ou depois
                  </small>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowFormModal(false)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <ButtonPrimary onClick={handleSave} disabled={submitting}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </ButtonPrimary>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vinculação */}
      {showVinculacaoModal && contatoParaVincular && (
        <div className="modal-overlay" onClick={() => !vinculando && setShowVinculacaoModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fas fa-link"></i>
                Vincular Contato a Cliente
              </h3>
              <button
                className="btn-icon"
                onClick={() => !vinculando && setShowVinculacaoModal(false)}
                disabled={vinculando}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <p>
                <strong>Contato:</strong> {contatoParaVincular.nome}
              </p>
              <div className="form-group">
                <label>
                  Cliente <span className="required">*</span>
                </label>
                <select
                  value={clienteSelecionado}
                  onChange={(e) => setClienteSelecionado(e.target.value)}
                  disabled={vinculando}
                >
                  <option value="">Selecione um cliente...</option>
                  {clientes
                    .filter(c => c.status === 'ativo' || !c.status)
                    .map(cliente => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome_amigavel || cliente.nome_fantasia || cliente.razao_social || cliente.nome}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setShowVinculacaoModal(false)}
                disabled={vinculando}
              >
                Cancelar
              </button>
              <ButtonPrimary onClick={handleVincularCliente} disabled={vinculando || !clienteSelecionado}>
                {vinculando ? 'Vinculando...' : 'Vincular'}
              </ButtonPrimary>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setContatoToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir o contato "${contatoToDelete?.nome}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        cancelText="Cancelar"
        confirmButtonClass="btn-danger"
        loading={deleteLoading}
      />
    </Layout>
  );
};

export default CadastroContatoCliente;

