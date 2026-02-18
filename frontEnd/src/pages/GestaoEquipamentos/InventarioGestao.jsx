import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { equipamentosAPI } from '../../services/equipamentos.service';
import { colaboradoresAPI } from '../../services/api'; // Import colaboradoresAPI to match Assignments page source
import ResponsavelCard from '../../components/atribuicoes/ResponsavelCard';
import '../../components/atribuicoes/ResponsavelCard.css';
import './InventarioGestao.css';

const InventarioGestao = () => {
    const navigate = useNavigate();
    const [equipamentos, setEquipamentos] = useState([]);
    const [filteredEquipamentos, setFilteredEquipamentos] = useState([]);
    const [responsaveis, setResponsaveis] = useState([]);
    const [loading, setLoading] = useState(false); // Default to false to avoid immediate return if useEffect hasn't run
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Modals
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedEquip, setSelectedEquip] = useState(null);
    const [previewDamage, setPreviewDamage] = useState(null);

    // Form data
    const [assignmentData, setAssignmentData] = useState({
        colaborador_id: '',
        observacoes: '',
        horario_entrada: '',
        horario_saida: ''
    });
    const [returnData, setReturnData] = useState({
        descricao_estado: ''
    });

    const fetchEquipamentos = async () => {
        setLoading(true);
        try {
            const response = await equipamentosAPI.getEquipamentos(page, 10, searchTerm);
            if (response.success) {
                const list = response.data.equipamentos || response.data; // Handle potential API structure variations
                setEquipamentos(list);
                setTotalPages(response.data.totalPages || 1);
            }
        } catch (error) {
            console.error('Erro ao buscar equipamentos:', error);
            Swal.fire('Erro', 'Erro ao carregar equipamentos.', 'error');
        } finally {
            setLoading(false);
        }
    };
    const fetchResponsaveis = async () => {
        try {
            // Using colaboradoresAPI.getAll() to fetch all potential responsibles, consistent with Assignments page
            const response = await colaboradoresAPI.getAll(false);
            if (response.success && response.data) {
                const ativos = response.data
                    .filter(u => u.status === 'ativo' || !u.status)
                    .map(u => ({
                        id: u.id,
                        nome: u.nome,
                        foto_perfil: u.foto_perfil || null
                    }));
                setResponsaveis(ativos);
            }
        } catch (error) {
            console.error('Erro ao buscar responsáveis:', error);
        }
    };

    const checkAvailability = (equip) => {
        let isAvailable = false;
        let statusText = 'Disponível';
        let statusClass = 'ativo';
        let scheduleInfo = null;

        if (equip.status === 'inativo') {
            statusText = 'Indisponível';
            statusClass = 'inativo';
            isAvailable = false;
        } else if (equip.status === 'manutencao') {
            statusText = 'Em Manutenção';
            statusClass = 'manutencao';
            isAvailable = false;
        } else if (equip.status === 'em uso') {
            const users = equip.usuarios_atuais && equip.usuarios_atuais.length > 0
                ? equip.usuarios_atuais
                : (equip.usuario_atual ? [equip.usuario_atual] : []);

            if (users.length === 0) {
                statusText = 'Ocupado';
                statusClass = 'em-uso';
                isAvailable = false;
            } else {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                let isAnyoneWorking = false;
                let schedules = [];

                for (const user of users) {
                    if (user.horario_entrada && user.horario_saida) {
                        const [startH, startM] = user.horario_entrada.split(':').map(Number);
                        const [endH, endM] = user.horario_saida.split(':').map(Number);

                        const startMinutes = startH * 60 + startM;
                        const endMinutes = endH * 60 + endM;

                        const isWorking = currentMinutes >= startMinutes && currentMinutes < endMinutes;
                        if (isWorking) isAnyoneWorking = true;

                        schedules.push(`${user.horario_entrada} às ${user.horario_saida}`);
                    } else {
                        // Se não tem horário definido, assume ocupação total
                        isAnyoneWorking = true;
                        schedules.push('Total');
                    }
                }

                if (isAnyoneWorking) {
                    statusText = 'Ocupado';
                    statusClass = 'em-uso';
                    isAvailable = false;
                } else {
                    statusText = 'Disponível (Fora de horário)';
                    statusClass = 'ativo';
                    isAvailable = true;
                }
                scheduleInfo = schedules.join(', ');
            }
        } else {
            isAvailable = true;
        }

        return { isAvailable, statusText, statusClass, scheduleInfo };
    };

    const applyFilters = () => {
        let result = [...equipamentos];

        if (statusFilter !== 'todos') {
            if (statusFilter === 'ativo') {
                result = result.filter(e => checkAvailability(e).isAvailable);
            } else {
                result = result.filter(e => e.status === statusFilter);
            }
        }

        setFilteredEquipamentos(result);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    const handleOpenAssign = (equip) => {
        setAssignmentData({ colaborador_id: '', observacoes: '', horario_entrada: '', horario_saida: '' });
        setSelectedEquip(equip);
        setShowAssignModal(true);
    };

    const handleOpenReturn = (equip) => {
        setSelectedEquip(equip);
        setShowReturnModal(true);
    };

    const handleAssign = async () => {
        if (!assignmentData.colaborador_id) return Swal.fire('Erro', 'Selecione um responsável', 'error');

        // Validation for shared equipment
        if (selectedEquip.status === 'em uso' && (!assignmentData.horario_entrada || !assignmentData.horario_saida)) {
            return Swal.fire('Atenção', 'Este equipamento já possui um vínculo. Para compartilhá-lo, é obrigatório informar o Horário de Início e Fim para o novo responsável.', 'warning');
        }

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

    useEffect(() => {
        fetchEquipamentos();
    }, [page, searchTerm]);

    useEffect(() => {
        fetchResponsaveis();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [equipamentos, statusFilter]);

    if (loading) return <div>Carregando lista...</div>;

    return (
        <div className="inventario-gestao">
            {/* ... component JSX ... */}
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
                                    {(() => {
                                        let statusText = equip.status === 'ativo' ? 'Disponível' : (equip.status || 'Disponível');
                                        let statusClass = equip.status?.replace(' ', '-') || 'disponivel';
                                        let scheduleInfo = null;

                                        if (equip.status === 'inativo') {
                                            statusText = 'Indisponível';
                                        } else if (equip.status === 'em uso' && equip.usuario_atual) {
                                            // Lógica de disponibilidade por horário
                                            const user = equip.usuario_atual;
                                            if (user.horario_entrada && user.horario_saida) {
                                                const now = new Date();
                                                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                                                const [startH, startM] = user.horario_entrada.split(':').map(Number);
                                                const [endH, endM] = user.horario_saida.split(':').map(Number);

                                                const startMinutes = startH * 60 + startM;
                                                const endMinutes = endH * 60 + endM;

                                                const isWorking = currentMinutes >= startMinutes && currentMinutes < endMinutes;

                                                statusText = isWorking ? 'Ocupado' : 'Disponível (Fora de horário)';
                                                statusClass = isWorking ? 'em-uso' : 'ativo'; // 'ativo' geralmente é verde/disponível
                                                scheduleInfo = `${user.horario_entrada} às ${user.horario_saida}`;
                                            } else {
                                                statusText = 'Ocupado';
                                                statusClass = 'em-uso';
                                            }
                                        } else if (equip.status === 'em uso') {
                                            statusText = 'Ocupado';
                                        }

                                        return (
                                            <>
                                                <div className={`status-chip ${statusClass}`}>
                                                    {statusText}
                                                </div>
                                                {equip.status === 'em uso' && equip.usuario_atual && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px', gap: '2px' }}>
                                                        <div
                                                            onClick={() => navigate(`/gestao-equipamentos/operadores/${equip.usuario_atual.id}`)}
                                                            style={{
                                                                fontSize: '11px',
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
                                                        {scheduleInfo && (
                                                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                                                                <i className="far fa-clock" style={{ marginRight: '3px' }}></i>
                                                                {scheduleInfo}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
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
                                    {equip.status === 'manutencao' ? (
                                        <button className="btn-assign disabled" disabled title="Item em manutenção não pode ser atribuído">
                                            <i className="fas fa-tools"></i> Em manutenção
                                        </button>
                                    ) : !checkAvailability(equip).isAvailable ? (
                                        <button className="btn-return" onClick={() => handleOpenReturn(equip)}>
                                            <i className="fas fa-undo"></i> Receber devolução
                                        </button>
                                    ) : (
                                        <button className="btn-assign" onClick={() => handleOpenAssign(equip)}>
                                            <i className="fas fa-user-plus"></i> Atribuir
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

                        {selectedEquip?.status === 'em uso' && (
                            <div style={{
                                background: '#fff7ed',
                                border: '1px solid #ffedd5',
                                padding: '10px',
                                borderRadius: '6px',
                                marginBottom: '15px',
                                fontSize: '13px',
                                color: '#9a3412'
                            }}>
                                <strong style={{ display: 'block', marginBottom: '8px' }}>
                                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
                                    Equipamento em uso compartilhado
                                </strong>
                                <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
                                    {(selectedEquip.usuarios_atuais || (selectedEquip.usuario_atual ? [selectedEquip.usuario_atual] : [])).map((u, idx) => (
                                        <div key={u.id || idx} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px dashed #fdba74' }}>
                                            Ocupado por: <strong>{u.nome}</strong><br />
                                            Horário reservado: <strong>{u.horario_entrada} às {u.horario_saida}</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="form-group">
                            <label>Responsável</label>
                            <div style={{ position: 'relative' }}>
                                <ResponsavelCard
                                    value={assignmentData.colaborador_id}
                                    onChange={(e) => setAssignmentData({ ...assignmentData, colaborador_id: e.target.value })}
                                    colaboradores={responsaveis.map(op => ({
                                        id: op.id,
                                        nome: op.nome,
                                        foto_perfil: op.foto_perfil
                                    }))}
                                    options={responsaveis.map(op => ({
                                        value: op.id,
                                        label: op.nome
                                    }))}
                                    placeholder="Selecione um responsável..."
                                />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div className="form-group">
                                <label>Horário Início</label>
                                <input
                                    type="time"
                                    value={assignmentData.horario_entrada}
                                    onChange={(e) => setAssignmentData({ ...assignmentData, horario_entrada: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Horário Fim</label>
                                <input
                                    type="time"
                                    value={assignmentData.horario_saida}
                                    onChange={(e) => setAssignmentData({ ...assignmentData, horario_saida: e.target.value })}
                                />
                            </div>
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
