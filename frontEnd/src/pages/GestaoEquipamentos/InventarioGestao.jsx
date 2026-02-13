import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { equipamentosAPI } from '../../services/equipamentos.service';
import Swal from 'sweetalert2';
import './InventarioGestao.css';

const InventarioGestao = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [equipamentos, setEquipamentos] = useState([]);
    const [filteredEquipamentos, setFilteredEquipamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'todos');
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedEquip, setSelectedEquip] = useState(null);
    const [operadores, setOperadores] = useState([]);
    const [assignmentData, setAssignmentData] = useState({ colaborador_id: '', observacoes: '' });
    const [returnData, setReturnData] = useState({ descricao_estado: '' });
    const [previewDamage, setPreviewDamage] = useState(null); // For showing damage rich text

    useEffect(() => {
        fetchEquipamentos();
        fetchOperadores();
    }, [page]); // Re-fetch when page changes

    useEffect(() => {
        applyFilters();
    }, [equipamentos, searchTerm, statusFilter]);

    useEffect(() => {
        const filterFromUrl = searchParams.get('filter');
        const searchFromUrl = searchParams.get('search');
        if (filterFromUrl !== null || searchFromUrl !== null) {
            setStatusFilter(filterFromUrl || 'todos');
            setSearchTerm(searchFromUrl || '');
            setPage(1); // Reset page on new search
        }
    }, [searchParams]);

    // Reset pagination when local filters change
    useEffect(() => {
        setPage(1);
    }, [searchTerm, statusFilter]);

    const fetchEquipamentos = async () => {
        try {
            setLoading(true);
            // Note: If using client-side filtering (like current applyFilters), 
            // we should probably fetch ALL for client-side filter OR move filtering to backend.
            // Current code separates fetch and filter. If we paginate FETCH, we can't filter client-side easily effectively across pages.
            // However, the original code did client-side filtering on `equipamentos`.
            // If we assume backend pagination, we should pass filters to backend.
            // But `equipamentosAPI.getEquipamentos` takes (page, limit, search).

            // Let's use the API's search capability if possible, or fetch all if not deep enough.
            // The user asked for "10 items per page". 
            // `equipamentosAPI.getEquipamentos` supports search.

            const response = await equipamentosAPI.getEquipamentos(page, ITEMS_PER_PAGE, searchTerm);
            if (response.success) {
                setEquipamentos(response.data);
                setTotalPages(Math.ceil(response.total / ITEMS_PER_PAGE));
            }
        } catch (error) {
            console.error('Erro ao buscar equipamentos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOperadores = async () => {
        try {
            const response = await equipamentosAPI.getOperadores();
            if (response.success) {
                const ativos = response.data.filter(op => op.status === 'ativo' || !op.status);
                setOperadores(ativos);
            }
        } catch (error) {
            console.error('Erro ao buscar operadores:', error);
        }
    };

    const applyFilters = () => {
        // With backend pagination/search, `equipamentos` already contains the filtered/paginated page.
        // However, we still have `statusFilter` which might be client-side if API doesn't support it fully in `getEquipamentos` (usually generic search).
        // If `statusFilter` is 'todos', we are good. If not, we might be filtering the *page* which reduces items.
        // Ideally, filtering should happen on backend.
        // For now, let's filter client-side what we got, but keep in mind this filters only the current page.
        // If strict backend pagination is required with filters, we'd need to update the service/controller.
        // Given constraints, I will apply client-side filtering on the returned page data.

        let result = [...equipamentos];

        if (statusFilter !== 'todos') {
            result = result.filter(e => e.status === statusFilter);
        }

        // Search is already handled by backend `searchTerm`, but for extra safety or cleaner UI sync:
        // (API usually handles name/brand/model search)

        setFilteredEquipamentos(result);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const handleOpenAssign = (equip) => {
        setSelectedEquip(equip);
        setShowAssignModal(true);
    };

    const handleOpenReturn = (equip) => {
        setSelectedEquip(equip);
        setShowReturnModal(true);
    };

    const handleAssign = async () => {
        if (!assignmentData.colaborador_id) return Swal.fire('Erro', 'Selecione um operador', 'error');

        try {
            const response = await equipamentosAPI.atribuirEquipamento({
                equipamento_id: selectedEquip.id,
                ...assignmentData
            });

            if (response.success) {
                Swal.fire('Sucesso', 'Equipamento atribuído!', 'success');
                setShowAssignModal(false);
                fetchEquipamentos();
            } else {
                Swal.fire('Erro', response.error || 'Falha ao atribuir equip.', 'error');
            }
        } catch (error) {
            console.error('Erro ao atribuir:', error);
            Swal.fire('Erro', error.message || 'Falha ao atribuir equip.', 'error');
        }
    };

    const handleReturn = async () => {
        try {
            const response = await equipamentosAPI.devolverEquipamento({
                equipamento_id: selectedEquip.id,
                ...returnData
            });

            if (response.success) {
                Swal.fire('Sucesso', 'Equipamento devolvido!', 'success');
                setShowReturnModal(false);
                fetchEquipamentos();
            }
        } catch (error) {
            Swal.fire('Erro', 'Falha ao devolver equip.', 'error');
        }
    };

    if (loading) return <div>Carregando lista...</div>;

    return (
        <div className="inventario-gestao">
            <div className="inventory-controls">
                <div className="search-box">
                    <i className="fas fa-search"></i>
                    <input
                        type="text"
                        placeholder="Buscar equipamento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-box">
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="todos">Todos os Status</option>
                        <option value="ativo">Disponíveis</option>
                        <option value="em uso">Ocupados</option>
                        <option value="manutencao">Em Manutenção</option>
                        <option value="inativo">Indisponíveis</option>
                    </select>
                </div>
            </div>

            <div className="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Equipamento</th>
                            <th>Tipo</th>
                            <th>Status / Usuário</th>
                            <th style={{ textAlign: 'center' }}>Avaria</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredEquipamentos.map(equip => (
                            <tr key={equip.id}>
                                <td>
                                    <div className="equip-name-cell">
                                        <strong>{equip.nome}</strong>
                                        <span>{equip.marca} {equip.modelo}</span>
                                    </div>
                                </td>
                                <td>{equip.tipo}</td>
                                <td>
                                    <div className={`status-chip ${equip.status?.replace(' ', '-')}`}>
                                        {equip.status === 'em uso' ? 'Ocupado' :
                                            equip.status === 'inativo' ? 'Indisponível' :
                                                (equip.status === 'ativo' ? 'Disponível' : (equip.status || 'Disponível'))}
                                    </div>
                                    {equip.status === 'em uso' && equip.usuario_atual && (
                                        <div
                                            onClick={() => navigate(`/gestao-equipamentos/operadores/${equip.usuario_atual.id}`)}
                                            style={{
                                                fontSize: '11px',
                                                marginTop: '6px',
                                                color: '#0e3b6f',
                                                cursor: 'pointer',
                                                textDecoration: 'underline',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                            title="Ver perfil do colaborador"
                                        >
                                            <i className="fas fa-user" style={{ fontSize: '10px' }}></i>
                                            {equip.usuario_atual.nome}
                                        </div>
                                    )}
                                </td>
                                <td>
                                    <div className="avaria-cell">
                                        {equip.tem_avaria ? (
                                            <div className="avaria-status has-damage">
                                                <i className="fas fa-times-circle" title="Com avaria"></i>
                                                {equip.descricao && equip.descricao !== '<p><br></p>' && (
                                                    <button
                                                        className="btn-view-damage"
                                                        onClick={() => setPreviewDamage(equip)}
                                                        title="Ver detalhes/fotos da avaria"
                                                    >
                                                        <i className="fas fa-image"></i>
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="avaria-status no-damage">
                                                <i className="fas fa-check-circle" title="Sem avaria"></i>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    {equip.status === 'em uso' ? (
                                        <button className="btn-return" onClick={() => handleOpenReturn(equip)}>
                                            <i className="fas fa-undo"></i> Receber devolução
                                        </button>
                                    ) : equip.status === 'manutencao' ? (
                                        <button className="btn-assign disabled" disabled title="Item em manutenção não pode ser atribuído">
                                            <i className="fas fa-tools"></i> Em manutenção
                                        </button>
                                    ) : (
                                        <button className="btn-assign" onClick={() => handleOpenAssign(equip)}>
                                            <i className="fas fa-user-plus"></i> Atribuir a alguém
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredEquipamentos.length === 0 && (
                    <div className="empty-inventory">
                        <i className="fas fa-search"></i>
                        <p>Nenhum equipamento encontrado nesta página.</p>
                    </div>
                )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
                <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                    <div className="pagination" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        <span style={{ fontSize: '14px', color: '#64748b' }}>
                            Página {page} de {totalPages}
                        </span>
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

            {/* Modal Atribuição */}
            {showAssignModal && (
                <div className="modal-overlay">
                    <div className="gestao-modal">
                        <h2>Atribuir {selectedEquip?.nome}</h2>
                        <div className="form-group">
                            <label>Operador</label>
                            <select
                                value={assignmentData.colaborador_id}
                                onChange={(e) => setAssignmentData({ ...assignmentData, colaborador_id: e.target.value })}
                            >
                                <option value="">Selecione um operador...</option>
                                {operadores.map(op => (
                                    <option key={op.id} value={op.id}>{op.nome}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Observações de entrega</label>
                            <textarea
                                value={assignmentData.observacoes}
                                onChange={(e) => setAssignmentData({ ...assignmentData, observacoes: e.target.value })}
                                placeholder="Descreva o estado do equipamento e acessórios entregues"
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setShowAssignModal(false)} className="btn-cancel">Cancelar</button>
                            <button onClick={handleAssign} className="btn-confirm">Confirmar Entrega</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Devolução */}
            {showReturnModal && (
                <div className="modal-overlay">
                    <div className="gestao-modal">
                        <h2>Receber {selectedEquip?.nome}</h2>
                        <div className="form-group">
                            <label>Estado na Devolução</label>
                            <textarea
                                value={returnData.descricao_estado}
                                onChange={(e) => setReturnData({ ...returnData, descricao_estado: e.target.value })}
                                placeholder="Algum dano? Tudo ok?"
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setShowReturnModal(false)} className="btn-cancel">Cancelar</button>
                            <button onClick={handleReturn} className="btn-confirm secondary">Confirmar Devolução</button>
                        </div>
                    </div>
                </div>
            )}

            {previewDamage && (
                <div className="modal-overlay" onClick={() => setPreviewDamage(null)}>
                    <div className="gestao-modal damage-preview-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Detalhes da Avaria: {previewDamage.nome}</h2>
                            <button className="btn-close-modal" onClick={() => setPreviewDamage(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div
                                className="rich-text-content"
                                dangerouslySetInnerHTML={{ __html: previewDamage.descricao }}
                            />
                        </div>
                        <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setPreviewDamage(null)} className="btn-confirm" style={{ padding: '10px 24px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventarioGestao;
