import React, { useState, useEffect } from 'react';
import './Equipamentos.css';
import { equipamentosAPI } from '../../services/equipamentos.service';
import Swal from 'sweetalert2';
import Layout from '../../components/layout/Layout';

const Equipamentos = () => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null); // Null for new, object for edit

    // Form state
    const [formData, setFormData] = useState({
        nome: '',
        tipo: '',
        marca: '',
        modelo: '',
        numero_serie: '',
        data_aquisicao: '',
        status: 'ativo'
    });

    const ITEMS_PER_PAGE = 5;

    useEffect(() => {
        fetchEquipamentos();
    }, [page, searchTerm]);

    const fetchEquipamentos = async () => {
        setLoading(true);
        try {
            const response = await equipamentosAPI.getEquipamentos(page, ITEMS_PER_PAGE, searchTerm);
            if (response.success) {
                setEquipamentos(response.data);
                setTotalPages(Math.ceil(response.total / ITEMS_PER_PAGE));
            }
        } catch (error) {
            console.error("Erro ao buscar equipamentos:", error);
            Swal.fire('Erro', 'Não foi possível carregar os equipamentos.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setPage(1); // Reset to first page on search
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const openModal = (item = null) => {
        if (item) {
            setCurrentItem(item);
            setFormData({
                nome: item.nome,
                tipo: item.tipo,
                marca: item.marca || '',
                modelo: item.modelo || '',
                numero_serie: item.numero_serie || '',
                data_aquisicao: item.data_aquisicao || '',
                status: item.status || 'ativo'
            });
        } else {
            setCurrentItem(null);
            setFormData({
                nome: '',
                tipo: '',
                marca: '',
                modelo: '',
                numero_serie: '',
                data_aquisicao: '',
                status: 'ativo'
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setCurrentItem(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let response;
            if (currentItem) {
                // Update
                response = await equipamentosAPI.atualizarEquipamento(currentItem.id, formData);
            } else {
                // Create
                response = await equipamentosAPI.criarEquipamento(formData);
            }

            if (response.success) {
                Swal.fire('Sucesso', currentItem ? 'Equipamento atualizado!' : 'Equipamento criado!', 'success');
                closeModal();
                fetchEquipamentos(); // Refresh list
            }
        } catch (error) {
            console.error("Erro ao salvar equipamento:", error);
            Swal.fire('Erro', 'Não foi possível salvar o equipamento.', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Tem certeza?',
            text: "Você não poderá reverter isso!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Sim, deletar!'
        });

        if (result.isConfirmed) {
            try {
                const response = await equipamentosAPI.deletarEquipamento(id);
                if (response.success) {
                    Swal.fire('Deletado!', 'O equipamento foi removido.', 'success');
                    fetchEquipamentos();
                }
            } catch (error) {
                console.error("Erro ao deletar equipamento:", error);
                Swal.fire('Erro', 'Não foi possível deletar o equipamento.', 'error');
            }
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case 'ativo': return 'status-ativo';
            case 'inativo': return 'status-inativo';
            case 'manutencao': return 'status-manutencao';
            default: return '';
        }
    };

    const getIconByTipo = (tipo) => {
        const lowerTipo = tipo.toLowerCase();
        if (lowerTipo.includes('notebook') || lowerTipo.includes('laptop')) return 'fa-laptop';
        if (lowerTipo.includes('mouse')) return 'fa-mouse';
        if (lowerTipo.includes('teclado')) return 'fa-keyboard';
        if (lowerTipo.includes('fone') || lowerTipo.includes('headset')) return 'fa-headphones';
        if (lowerTipo.includes('monitor') || lowerTipo.includes('tela')) return 'fa-desktop';
        return 'fa-box'; // default
    };

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <div className="colaboradores-listing-section">
                        <div className="cadastro-listing-page-header">
                            <div className="cadastro-listing-header-content">
                                <div className="cadastro-listing-header-left">
                                    <div className="cadastro-listing-header-icon">
                                        <i className="fas fa-laptop" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                                    </div>
                                    <div>
                                        <h1 className="cadastro-listing-page-title">Cadastro de Equipamentos</h1>
                                        <p className="cadastro-listing-page-subtitle">
                                            Gerencie o inventário de hardware e periféricos da empresa
                                        </p>
                                    </div>
                                </div>
                                <div className="cadastro-listing-header-actions">
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() => openModal()}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        <i className="fas fa-plus"></i> Novo Equipamento
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="listing-controls" style={{ marginBottom: '24px' }}>
                            <div className="search-container">
                                <div className="search-input-wrapper">
                                    <i className="fas fa-search search-icon"></i>
                                    <input
                                        type="text"
                                        className="search-input"
                                        placeholder="Buscar equipamento por nome ou marca..."
                                        value={searchTerm}
                                        onChange={handleSearch}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="listing-table-container view-transition view-enter">
                            {loading ? (
                                <div className="loading-container" style={{ textAlign: 'center', padding: '40px' }}>
                                    <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: '#0e3b6f' }}></i>
                                    <p style={{ marginTop: '10px', color: '#64748b' }}>Carregando equipamentos...</p>
                                </div>
                            ) : equipamentos.length === 0 ? (
                                <div className="empty-state" style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '8px' }}>
                                    <i className="fas fa-laptop" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '16px' }}></i>
                                    <p style={{ color: '#64748b' }}>Nenhum equipamento encontrado.</p>
                                </div>
                            ) : (
                                <table className="listing-table">
                                    <thead>
                                        <tr>
                                            <th>EQUIPAMENTO</th>
                                            <th>MARCA</th>
                                            <th>MODELO</th>
                                            <th>NÚMERO DE SÉRIE</th>
                                            <th className="actions-column" style={{ textAlign: 'right' }}>AÇÕES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipamentos.map(item => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            background: '#f1f5f9',
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: '#475569'
                                                        }}>
                                                            <i className={`fas ${getIconByTipo(item.tipo)}`}></i>
                                                        </div>
                                                        <span style={{ fontWeight: '500', color: '#1e293b' }}>{item.nome}</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: '#475569' }}>{item.marca || '-'}</td>
                                                <td style={{ color: '#475569' }}>{item.modelo || '-'}</td>
                                                <td style={{ color: '#64748b', fontFamily: 'monospace' }}>{item.numero_serie || '-'}</td>
                                                <td className="actions-column" style={{ textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => openModal(item)}
                                                            title="Editar"
                                                            style={{ color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
                                                        >
                                                            <i className="fas fa-pencil-alt"></i>
                                                        </button>
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleDelete(item.id)}
                                                            title="Excluir"
                                                            style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
                                                        >
                                                            <i className="fas fa-trash-alt"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {!loading && equipamentos.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '0 8px' }}>
                                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                                        Exibindo {equipamentos.length} de equipamentos registrados
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handlePageChange(page - 1)}
                                            disabled={page === 1}
                                            style={{
                                                padding: '8px 16px',
                                                border: '1px solid #e2e8f0',
                                                background: 'white',
                                                borderRadius: '6px',
                                                color: page === 1 ? '#cbd5e1' : '#475569',
                                                cursor: page === 1 ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => handlePageChange(page + 1)}
                                            disabled={page === totalPages}
                                            style={{
                                                padding: '8px 16px',
                                                border: '1px solid #e2e8f0',
                                                background: 'white',
                                                borderRadius: '6px',
                                                color: page === totalPages ? '#cbd5e1' : '#475569',
                                                cursor: page === totalPages ? 'not-allowed' : 'pointer'
                                            }}
                                        >
                                            Próximo
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    {showModal && (
                        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
                            <div className="equipment-modal-content">
                                <div className="modal-header">
                                    <h2 className="modal-title">{currentItem ? 'Editar Equipamento' : 'Novo Equipamento'}</h2>
                                    <button type="button" className="btn-close" onClick={closeModal}><i className="fas fa-times"></i></button>
                                </div>
                                <form onSubmit={handleSubmit}>
                                    <div className="form-grid">
                                        <div className="form-group full-width">
                                            <label className="form-label">Nome *</label>
                                            <input
                                                type="text"
                                                name="nome"
                                                className="form-input"
                                                value={formData.nome}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Ex: Notebook Dell Latitude"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Tipo (Categoria) *</label>
                                            <input
                                                type="text"
                                                name="tipo"
                                                className="form-input"
                                                value={formData.tipo}
                                                onChange={handleInputChange}
                                                required
                                                placeholder="Ex: Notebook"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Status</label>
                                            <select name="status" className="form-select" value={formData.status} onChange={handleInputChange}>
                                                <option value="ativo">Ativo</option>
                                                <option value="inativo">Inativo</option>
                                                <option value="manutencao">Em Manutenção</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Marca</label>
                                            <input
                                                type="text"
                                                name="marca"
                                                className="form-input"
                                                value={formData.marca}
                                                onChange={handleInputChange}
                                                placeholder="Ex: Dell"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Modelo</label>
                                            <input
                                                type="text"
                                                name="modelo"
                                                className="form-input"
                                                value={formData.modelo}
                                                onChange={handleInputChange}
                                                placeholder="Ex: 5420"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Número de Série</label>
                                            <input
                                                type="text"
                                                name="numero_serie"
                                                className="form-input"
                                                value={formData.numero_serie}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Data de Aquisição</label>
                                            <input
                                                type="date"
                                                name="data_aquisicao"
                                                className="form-input"
                                                value={formData.data_aquisicao}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="modal-footer">
                                        <button type="button" className="btn-cancel" onClick={closeModal}>Cancelar</button>
                                        <button type="submit" className="btn-save">Salvar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                    }
                </main>
            </div >
        </Layout>
    );
};

export default Equipamentos;
