import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { equipamentosAPI } from '../../services/equipamentos.service';
import './PerfilOperador.css';

const PerfilOperador = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPerfil();
    }, [id]);

    const fetchPerfil = async () => {
        try {
            const response = await equipamentosAPI.getPerfilOperador(id);
            if (response.success) setData(response.data);
        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDesvincular = async (item) => {
        const result = await Swal.fire({
            title: 'Desvincular Equipamento?',
            text: `Deseja realmente remover o vínculo de "${item.cp_equipamentos.nome}"? O equipamento voltará para o estoque.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, desvincular',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const response = await equipamentosAPI.devolverEquipamento({
                    equipamento_id: item.equipamento_id,
                    colaborador_id: id, // Optional, but good for logging if needed
                    descricao_estado: 'Devolvido via Perfil do Responsável'
                });

                if (response.data?.success || response.status === 200 || response.status === 201) {
                    Swal.fire('Desvinculado!', 'O equipamento foi devolvido ao estoque.', 'success');
                    fetchPerfil();
                } else {
                    // Check if response itself is the data object or axios response
                    // usually response.data has success
                    if (response.data && !response.data.success) {
                        Swal.fire('Erro', response.data.error || 'Falha ao desvincular.', 'error');
                    } else {
                        // Assuming success if no explicit error in data
                        Swal.fire('Desvinculado!', 'O equipamento foi devolvido ao estoque.', 'success');
                        fetchPerfil();
                    }
                }
            } catch (error) {
                console.error('Erro ao desvincular:', error);
                Swal.fire('Erro', 'Não foi possível desvincular o equipamento.', 'error');
            }
        }
    };

    if (loading) return <div>Carregando perfil...</div>;
    if (!data) return <div>Responsável não encontrado.</div>;

    const { membro, atuais, historico } = data;

    return (
        <div className="perfil-operador">
            <button className="btn-back" onClick={() => navigate('/gestao-equipamentos/operadores')}>
                <i className="fas fa-arrow-left"></i> Voltar para lista
            </button>

            <section className="perfil-header-card">
                <div className="perfil-info">
                    <div className="big-avatar">{membro.nome.charAt(0)}</div>
                    <div>
                        <h1>{membro.nome}</h1>
                        <p>{membro.cargo} • {membro.departamento}</p>
                    </div>
                </div>
            </section>

            <div className="perfil-main-grid">
                <div className="atuais-section">
                    <h2><i className="fas fa-laptop"></i> Equipamentos Atuais ({atuais.length})</h2>
                    <div className="atuais-list">
                        {atuais.length > 0 ? atuais.map(item => (
                            <div key={item.id} className="equip-item-card">
                                <div className="item-main">
                                    <strong>{item.cp_equipamentos.nome}</strong>
                                    <span>{item.cp_equipamentos.tipo}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div className="item-meta">
                                        <span><i className="far fa-calendar-alt"></i> Retirado em: {new Date(item.data_retirada).toLocaleDateString()}</span>
                                    </div>
                                    <button
                                        onClick={() => handleDesvincular(item)}
                                        className="btn-unbind"
                                        title="Desvincular / Devolver"
                                        style={{
                                            border: 'none',
                                            background: '#fee2e2',
                                            color: '#ef4444',
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                                        onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                                    >
                                        <i className="fas fa-unlink"></i>
                                    </button>
                                </div>
                            </div>
                        )) : <p className="empty">Nenhum equipamento em posse atualmente.</p>}
                    </div>
                </div>

                <div className="historico-section">
                    <h2><i className="fas fa-history"></i> Histórico de Uso</h2>
                    <div className="historico-list">
                        {historico.length > 0 ? historico.map(item => (
                            <div key={item.id} className="hist-item">
                                <div className="hist-icon"><i className="fas fa-check-circle"></i></div>
                                <div className="hist-content">
                                    <p>Devolveu <strong>{item.cp_equipamentos.nome}</strong></p>
                                    <span>Período: {new Date(item.data_retirada).toLocaleDateString()} - {new Date(item.data_devolucao).toLocaleDateString()}</span>
                                </div>
                            </div>
                        )) : <p className="empty">Nenhum histórico disponível.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerfilOperador;
