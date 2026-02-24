import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import ConfirmModal from '../../components/common/ConfirmModal';
import SearchInput from '../../components/common/SearchInput';
import DataTable from '../../components/common/DataTable';
import Pagination from '../../components/common/Pagination';
import LoadingState from '../../components/common/LoadingState';
import EditButton from '../../components/common/EditButton';
import DeleteButton from '../../components/common/DeleteButton';
import './CadastroStatusTarefas.css';

const COMMON_ICONS = [
    'fa-circle', 'fa-check-circle', 'fa-spinner', 'fa-pause-circle', 'fa-hourglass-half',
    'fa-play-circle', 'fa-stop-circle', 'fa-exclamation-triangle', 'fa-clock', 'fa-calendar-check',
    'fa-tasks', 'fa-clipboard-check', 'fa-check', 'fa-times-circle', 'fa-sync',
    'fa-history', 'fa-flag', 'fa-star', 'fa-bullseye', 'fa-rocket'
];

const CadastroStatusTarefas = () => {
    const navigate = useNavigate();

    // Estados principais
    const [statuses, setStatuses] = useState([]);
    const [filteredStatuses, setFilteredStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    // Estados para modal de confirmação de exclusão
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [statusToDelete, setStatusToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchStatuses = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/tempo-estimado-config-status', {
                credentials: 'include'
            });
            const result = await response.json();
            if (result.success) {
                setStatuses(result.data);
                setTotalItems(result.data.length);
            } else {
                Swal.fire('Erro', 'Erro ao carregar statuses: ' + result.error, 'error');
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro de conexão ao carregar statuses', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatuses();
    }, [fetchStatuses]);

    // Lógica de filtragem e paginação local
    useEffect(() => {
        const filtered = statuses.filter(s =>
            s.nome.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setTotalItems(filtered.length);

        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;
        setFilteredStatuses(filtered.slice(indexOfFirstItem, indexOfLastItem));
    }, [statuses, searchTerm, currentPage, itemsPerPage]);

    const handleEdit = (status) => {
        navigate(`/cadastro/status-tarefa?id=${status.id}`);
    };

    const handleCreate = () => {
        navigate('/cadastro/status-tarefa');
    };

    const confirmDelete = (status) => {
        setStatusToDelete(status);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!statusToDelete) return;

        setDeleteLoading(true);
        try {
            const response = await fetch(`/api/tempo-estimado-config-status/${statusToDelete.id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();
            if (result.success) {
                Swal.fire('Removido!', 'Status removido com sucesso.', 'success');
                setShowDeleteModal(false);
                setStatusToDelete(null);
                fetchStatuses();
            } else {
                Swal.fire('Erro', 'Erro ao remover: ' + result.error, 'error');
            }
        } catch (error) {
            Swal.fire('Erro', 'Erro de conexão ao remover status', 'error');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Debounce para busca
    const searchTimeoutRef = useRef(null);
    const handleSearch = (value) => {
        setSearchTerm(value);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            setCurrentPage(1);
        }, 500);
    };

    // Colunas da Tabela
    const tableColumns = [
        {
            key: 'icone',
            label: 'Ícone',
            render: (status) => (
                <div
                    className="status-preview-icon"
                    style={{
                        backgroundColor: status.cor_fundo || '#f1f5f9',
                        color: status.cor_texto || '#475569',
                        border: `1px solid ${status.cor_borda || '#e2e8f0'}`,
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px'
                    }}
                >
                    <i className={`fas ${status.icone}`}></i>
                </div>
            )
        },
        {
            key: 'nome',
            label: 'Nome do Status',
            render: (status) => (
                <div className="status-name-cell">
                    <div className="status-info">
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{status.nome}</span>
                    </div>
                </div>
            )
        }
    ];

    // Ações da Tabela
    const renderTableActions = (status) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start' }}>
            <EditButton onClick={() => handleEdit(status)} title="Editar" />
            <DeleteButton onClick={() => confirmDelete(status)} title="Deletar" />
        </div>
    );

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <CardContainer>
                        <div className="status-listing-section">
                            {/* Header da Página */}
                            <div className="cadastro-listing-page-header">
                                <div className="cadastro-listing-header-content">
                                    <div className="cadastro-listing-header-left">
                                        <div className="cadastro-listing-header-icon">
                                            <i className="fas fa-tasks" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                                        </div>
                                        <div>
                                            <h1 className="cadastro-listing-page-title">Configuração de Status</h1>
                                            <p className="cadastro-listing-page-subtitle">
                                                Gerencie os status globais das tarefas do sistema
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Controles de Busca e Ação */}
                            <div className="listing-controls">
                                <SearchInput
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    placeholder="Buscar por nome..."
                                />
                                <div className="listing-controls-right">
                                    <ButtonPrimary
                                        onClick={handleCreate}
                                        icon="fas fa-plus"
                                    >
                                        Novo Status
                                    </ButtonPrimary>
                                </div>
                            </div>

                            {/* Tabela de Dados */}
                            <div className="listing-table-container">
                                {loading ? (
                                    <LoadingState message="Carregando configurações de status..." />
                                ) : (
                                    <DataTable
                                        columns={tableColumns}
                                        data={filteredStatuses}
                                        renderActions={renderTableActions}
                                        emptyMessage="Nenhum status configurado"
                                        emptyIcon="fa-tasks"
                                    />
                                )}
                            </div>

                            {/* Paginação */}
                            <Pagination
                                currentPage={currentPage}
                                totalPages={Math.ceil(totalItems / itemsPerPage)}
                                totalItems={totalItems}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                loading={loading}
                                itemName="statuses"
                            />
                        </div>
                    </CardContainer>
                </main>
            </div>

            {/* Modal de Exclusão */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setStatusToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Excluir Status"
                message={
                    statusToDelete ? (
                        <>
                            <p>Tem certeza que deseja excluir o status <strong>{statusToDelete.nome}</strong>?</p>
                            <p className="warning-text">Isso afetará como as tarefas são exibidas.</p>
                        </>
                    ) : null
                }
                confirmText="Excluir"
                confirmButtonClass="btn-danger"
                loading={deleteLoading}
            />
        </Layout>
    );
};

export default CadastroStatusTarefas;
