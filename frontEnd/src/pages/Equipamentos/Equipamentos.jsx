import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Layout from '../../components/layout/Layout';
import Pagination from '../../components/common/Pagination';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import { equipamentosAPI } from '../../services/equipamentos.service';
import './Equipamentos.css';

const Equipamentos = () => {
    const navigate = useNavigate();
    const [equipamentos, setEquipamentos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Pagination state
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    const [searchTerm, setSearchTerm] = useState('');
    const [previewDamage, setPreviewDamage] = useState(null);

    useEffect(() => {
        fetchEquipamentos();
    }, [page, searchTerm, itemsPerPage]);

    const fetchEquipamentos = async () => {
        setLoading(true);
        try {
            const response = await equipamentosAPI.getEquipamentos(page, itemsPerPage, searchTerm);
            if (response.success) {
                setEquipamentos(response.data);
                setTotalItems(response.total);
                setTotalPages(Math.ceil(response.total / itemsPerPage));
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
            case 'em uso': return 'status-em-uso';
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
                                        onClick={() => navigate('/cadastro/equipamento')}
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
                            {loading && equipamentos.length === 0 ? (
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
                                <>
                                    <table className="listing-table">
                                        <thead>
                                            <tr>
                                                <th>EQUIPAMENTO</th>
                                                <th>TIPO</th>
                                                <th>STATUS</th>
                                                <th>MARCA/MODELO</th>
                                                <th>NÚMERO DE SÉRIE</th>
                                                <th style={{ textAlign: 'center' }}>AVARIA</th>
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
                                                    <td style={{ color: '#475569' }}>{item.tipo}</td>
                                                    <td>
                                                        <span className={`status-badge ${getStatusClass(item.status || 'ativo')}`}>
                                                            {item.status === 'em uso' ? 'Em Uso' :
                                                                item.status === 'manutencao' ? 'Manutenção' :
                                                                    item.status === 'inativo' ? 'Indisponível' : 'Disponível'}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: '#475569' }}>
                                                        {item.marca} {item.modelo}
                                                    </td>
                                                    <td style={{ color: '#64748b', fontFamily: 'monospace' }}>{item.numero_serie || '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            {item.tem_avaria ? (
                                                                <>
                                                                    <i className="fas fa-times-circle" style={{ color: '#ef4444', fontSize: '18px' }} title="Com avaria"></i>
                                                                    {item.descricao && item.descricao !== '<p><br></p>' && (
                                                                        <button
                                                                            onClick={() => setPreviewDamage(item)}
                                                                            style={{
                                                                                background: '#f0f9ff',
                                                                                border: '1px solid #bae6fd',
                                                                                color: '#0284c7',
                                                                                borderRadius: '6px',
                                                                                padding: '4px 8px',
                                                                                cursor: 'pointer',
                                                                                fontSize: '12px'
                                                                            }}
                                                                            title="Ver detalhes/fotos"
                                                                        >
                                                                            <i className="fas fa-image"></i>
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <i className="fas fa-check-circle" style={{ color: '#10b981', fontSize: '18px' }} title="Sem avaria"></i>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="actions-column" style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                            <EditButton
                                                                onClick={() => navigate(`/cadastro/equipamento?id=${item.id}`)}
                                                                title="Editar"
                                                            />
                                                            <DeleteButton
                                                                onClick={() => handleDelete(item.id)}
                                                                title="Excluir"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <Pagination
                                        currentPage={page}
                                        totalPages={totalPages}
                                        totalItems={totalItems}
                                        itemsPerPage={itemsPerPage}
                                        onPageChange={setPage}
                                        onItemsPerPageChange={setItemsPerPage}
                                        loading={loading}
                                        itemName="equipamentos"
                                    />
                                </>
                            )}
                        </div>
                    </div>
                </main>
                {/* Modal de Visualização de Avaria */}
                {previewDamage && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 2000
                    }} onClick={() => setPreviewDamage(null)}>
                        <div style={{
                            background: 'white', width: '90%', maxWidth: '700px',
                            borderRadius: '16px', padding: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
                                    <i className="fas fa-exclamation-triangle" style={{ color: '#f59e0b', marginRight: '10px' }}></i>
                                    Detalhes da Avaria: {previewDamage.nome}
                                </h2>
                                <button onClick={() => setPreviewDamage(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
                            </div>

                            <div style={{
                                maxHeight: '60vh', overflowY: 'auto', padding: '16px',
                                background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0',
                                lineHeight: '1.6'
                            }}>
                                <div
                                    className="rich-text-preview"
                                    dangerouslySetInnerHTML={{ __html: previewDamage.descricao }}
                                />
                            </div>

                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setPreviewDamage(null)}
                                    style={{
                                        padding: '10px 24px', borderRadius: '8px', background: '#0e3b6f',
                                        color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer'
                                    }}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Equipamentos;
