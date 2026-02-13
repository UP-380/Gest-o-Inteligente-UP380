import React, { useState, useEffect } from 'react';
import { equipamentosAPI } from '../../services/equipamentos.service';
import Swal from 'sweetalert2';
import './InventarioGestao.css';

const InventarioGestao = () => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [selectedEquip, setSelectedEquip] = useState(null);
    const [operadores, setOperadores] = useState([]);
    const [assignmentData, setAssignmentData] = useState({ colaborador_id: '', observacoes: '' });
    const [returnData, setReturnData] = useState({ descricao_estado: '' });

    useEffect(() => {
        fetchEquipamentos();
        fetchOperadores();
    }, []);

    const fetchEquipamentos = async () => {
        try {
            const response = await equipamentosAPI.getEquipamentos(1, 100); // Pegar todos para gestão simplificada
            if (response.success) setEquipamentos(response.data);
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
                // Filtrar para mostrar apenas operadores ativos
                const ativos = response.data.filter(op => op.status === 'ativo' || !op.status);
                setOperadores(ativos);
            }
        } catch (error) {
            console.error('Erro ao buscar operadores:', error);
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
            <div className="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Equipamento</th>
                            <th>Tipo</th>
                            <th>Status/Usuário Atual</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {equipamentos.map(equip => (
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
                                        {equip.status === 'em uso' ? 'Ocupado' : (equip.status || 'Ativo')}
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
            </div>

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
        </div>
    );
};

export default InventarioGestao;
