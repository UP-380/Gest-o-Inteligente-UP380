import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './CadastroAssuntos.css';


const CadastroAssuntos = () => {
    const navigate = useNavigate();
    const showToast = useToast();

    // Estados principais
    const [assuntos, setAssuntos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAssuntos, setTotalAssuntos] = useState(0);

    // Estados para modal de confirmação de exclusão
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [assuntoToDelete, setAssuntoToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Carregar assuntos
    const loadAssuntos = useCallback(async () => {
        setLoading(true);
        try {
            const response = await comunicacaoAPI.listarAssuntosCompleto({
                page: currentPage,
                limit: itemsPerPage,
                search: searchTerm.trim()
            });

            if (response.success) {
                setAssuntos(response.data || []);
                setTotalAssuntos(response.total || 0);
                setTotalPages(Math.ceil((response.total || 0) / itemsPerPage));
            } else {
                throw new Error(response.error || response.message || 'Erro ao carregar assuntos');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar assuntos:', error);
            const errorMessage = error.message || 'Erro ao carregar assuntos. Tente novamente.';
            showToast('error', errorMessage);
            setAssuntos([]);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTerm, showToast]);


    // Deletar assunto
    const handleDelete = useCallback(async () => {
        if (!assuntoToDelete) return;

        setDeleteLoading(true);
        try {
            const response = await comunicacaoAPI.deletarAssunto(assuntoToDelete.id);

            if (response.success) {
                showToast('success', 'Assunto deletado com sucesso!');
                setShowDeleteModal(false);
                setAssuntoToDelete(null);
                await loadAssuntos();
            } else {
                throw new Error(response.error || response.message || 'Erro ao deletar assunto');
            }
        } catch (error) {
            console.error('Erro ao deletar assunto:', error);
            showToast('error', error.message || 'Erro ao deletar assunto. Tente novamente.');
            setShowDeleteModal(false);
        } finally {
            setDeleteLoading(false);
        }
    }, [assuntoToDelete, loadAssuntos, showToast]);

    // Navegar para novo assunto
    const handleNewAssunto = () => {
        navigate('/cadastro/assunto', { state: { from: '/cadastro/assuntos' } });
    };

    // Navegar para edição
    const handleEdit = (assunto) => {
        navigate(`/cadastro/assunto?id=${assunto.id}`, { state: { from: '/cadastro/assuntos' } });
    };

    // Confirmar exclusão
    const confirmDelete = (assunto) => {
        setAssuntoToDelete(assunto);
        setShowDeleteModal(true);
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
        loadAssuntos();
    }, [loadAssuntos]);

    // Cleanup do timeout de busca ao desmontar
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Definir colunas da tabela
    const tableColumns = [
        { key: 'nome', label: 'Assunto' }
    ];

    // Renderizar ações da tabela
    const renderTableActions = (assunto) => (
        <>
            <EditButton
                onClick={() => handleEdit(assunto)}
                title="Editar"
            />
            <DeleteButton
                onClick={() => confirmDelete(assunto)}
                title="Deletar"
            />
        </>
    );

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <CardContainer>
                        <div className="assuntos-listing-section">
                            <div className="cadastro-listing-page-header">
                                <div className="cadastro-listing-header-content">
                                    <div className="cadastro-listing-header-left">
                                        <div className="cadastro-listing-header-icon">
                                            <i className="fas fa-tags" style={{ fontSize: '32px', color: '#0e3b6f' }}></i>
                                        </div>
                                        <div>
                                            <h1 className="cadastro-listing-page-title">Assuntos Chamados</h1>
                                            <p className="cadastro-listing-page-subtitle">
                                                Gerencie os assuntos (tópicos de ajuda) que aparecerão na abertura de chamados
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Nota Informativa */}
                            <div className="info-note" style={{
                                backgroundColor: '#f0f7ff',
                                borderLeft: '4px solid #007bff',
                                padding: '12px 16px',
                                marginBottom: '20px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <i className="fas fa-info-circle" style={{ color: '#007bff' }}></i>
                                <p style={{ margin: 0, color: '#004085', fontSize: '14px' }}>
                                    <strong>Aviso:</strong> Esses assuntos serão dados como opções na hora de abrir um chamado.
                                </p>
                            </div>

                            {/* Filtro de busca e botão adicionar */}
                            <div className="listing-controls">
                                <SearchInput
                                    value={searchTerm}
                                    onChange={handleSearch}
                                    placeholder="Buscar assunto por nome..."
                                />
                                <div className="listing-controls-right">
                                    <ButtonPrimary
                                        onClick={handleNewAssunto}
                                        icon="fas fa-plus"
                                    >
                                        Novo Assunto
                                    </ButtonPrimary>
                                </div>
                            </div>

                            {/* Lista de assuntos */}
                            <div className="listing-table-container">
                                {loading ? (
                                    <LoadingState message="Carregando assuntos..." />
                                ) : (
                                    <DataTable
                                        columns={tableColumns}
                                        data={assuntos}
                                        renderActions={renderTableActions}
                                        emptyMessage="Nenhum assunto encontrado"
                                        emptyIcon="fa-tags"
                                    />
                                )}
                            </div>

                            {/* Controles de Paginação */}
                            <Pagination
                                currentPage={currentPage}
                                totalPages={totalPages}
                                totalItems={totalAssuntos}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                                onItemsPerPageChange={setItemsPerPage}
                                loading={loading}
                                itemName="assuntos"
                            />
                        </div>
                    </CardContainer>
                </main>
            </div>

            {/* Modal de confirmação de exclusão */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setAssuntoToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Confirmar Exclusão"
                message={
                    assuntoToDelete ? (
                        <>
                            <p>
                                Tem certeza que deseja deletar o assunto{' '}
                                <strong>{assuntoToDelete.nome}</strong>?
                            </p>
                            <p className="warning-text">
                                Esta ação não pode ser desfeita e só é possível se não houver chamados vinculados.
                            </p>
                        </>
                    ) : null
                }
                confirmText="Deletar"
                cancelText="Cancelar"
                confirmButtonClass="btn-danger"
                loading={deleteLoading}
            />
        </Layout>
    );
};

export default CadastroAssuntos;
