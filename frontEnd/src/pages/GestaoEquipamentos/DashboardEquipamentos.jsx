import React, { useState, useEffect } from 'react';
import { equipamentosAPI } from '../../services/equipamentos.service';
import './DashboardEquipamentos.css';

const DashboardEquipamentos = () => {
    const [stats, setStats] = useState({ total: 0, em_uso: 0, manutencao: 0, estoque: 0 });
    const [atividades, setAtividades] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const response = await equipamentosAPI.getDashboardStats();
            if (response.success) {
                setStats(response.data.stats);
                setAtividades(response.data.atividades);
            }
        } catch (error) {
            console.error('Erro ao buscar stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading-container">Carregando painel...</div>;

    return (
        <div className="dashboard-grid">
            <div className="stats-cards">
                <div className="card-stat total">
                    <div className="card-icon"><i className="fas fa-boxes"></i></div>
                    <div className="card-info">
                        <h3>Total de Ativos</h3>
                        <p className="value">{stats.total}</p>
                    </div>
                </div>
                <div className="card-stat usage">
                    <div className="card-icon"><i className="fas fa-user-tag"></i></div>
                    <div className="card-info">
                        <h3>Em Uso</h3>
                        <p className="value">{stats.em_uso}</p>
                    </div>
                </div>
                <div className="card-stat stock">
                    <div className="card-icon"><i className="fas fa-warehouse"></i></div>
                    <div className="card-info">
                        <h3>Disponíveis</h3>
                        <p className="value">{stats.estoque}</p>
                    </div>
                </div>
                <div className="card-stat maintenance">
                    <div className="card-icon"><i className="fas fa-tools"></i></div>
                    <div className="card-info">
                        <h3>Manutenção</h3>
                        <p className="value">{stats.manutencao}</p>
                    </div>
                </div>
            </div>

            <div className="dashboard-main">
                <div className="dashboard-card activities-card">
                    <h2><i className="fas fa-history"></i> Atividades Recentes</h2>
                    <div className="activity-list">
                        {atividades.length > 0 ? atividades.map((act) => (
                            <div key={act.id} className="activity-item">
                                <div className={`activity-badge ${act.tipo.toLowerCase()}`}>
                                    {act.tipo}
                                </div>
                                <div className="activity-details">
                                    <p><strong>{act.cp_equipamentos?.nome}</strong> ({act.cp_equipamentos?.tipo})</p>
                                    <span className="activity-desc">
                                        {act.colaborador_nome && <span className="operator-tag">{act.colaborador_nome}</span>}
                                        {act.descricao}
                                    </span>
                                </div>
                                <div className="activity-time">
                                    {new Date(act.data_ocorrencia).toLocaleDateString('pt-BR')}
                                </div>
                            </div>
                        )) : <p className="empty-msg">Nenhuma atividade registrada.</p>}
                    </div>
                </div>

                <div className="dashboard-card info-card">
                    <h2><i className="fas fa-lightbulb"></i> Links Rápidos</h2>
                    <div className="quick-links">
                        <button className="q-link">Nova Entrega</button>
                        <button className="q-link">Ver Operadores</button>
                        <button className="q-link">Log de Manutenção</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardEquipamentos;
