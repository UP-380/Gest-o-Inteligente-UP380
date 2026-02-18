import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipamentosAPI } from '../../services/equipamentos.service';
import './DashboardEquipamentos.css';

const DashboardEquipamentos = () => {
    const navigate = useNavigate();
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

    const getIconByTipo = (tipo = '') => {
        const lowerTipo = tipo?.toLowerCase() || '';
        if (lowerTipo.includes('notebook') || lowerTipo.includes('laptop')) return 'fa-laptop';
        if (lowerTipo.includes('mouse')) return 'fa-mouse';
        if (lowerTipo.includes('teclado')) return 'fa-keyboard';
        if (lowerTipo.includes('fone') || lowerTipo.includes('headset')) return 'fa-headphones';
        if (lowerTipo.includes('monitor') || lowerTipo.includes('tela')) return 'fa-desktop';
        return 'fa-box';
    };

    if (loading) return <div className="loading-container">Carregando painel...</div>;

    return (
        <div className="dashboard-grid">
            <div className="stats-cards">
                <div className="card-stat total" onClick={() => navigate('/gestao-equipamentos/inventario?filter=todos')}>
                    <div className="card-icon"><i className="fas fa-boxes"></i></div>
                    <div className="card-info">
                        <h3>Total de Ativos</h3>
                        <p className="value">{stats.total}</p>
                    </div>
                </div>
                <div className="card-stat usage" onClick={() => navigate('/gestao-equipamentos/inventario?filter=em uso')}>
                    <div className="card-icon"><i className="fas fa-user-tag"></i></div>
                    <div className="card-info">
                        <h3>Em Uso</h3>
                        <p className="value">{stats.em_uso}</p>
                    </div>
                </div>
                <div className="card-stat stock" onClick={() => navigate('/gestao-equipamentos/inventario?filter=ativo')}>
                    <div className="card-icon"><i className="fas fa-warehouse"></i></div>
                    <div className="card-info">
                        <h3>Disponíveis</h3>
                        <p className="value">{stats.estoque}</p>
                    </div>
                </div>
                <div className="card-stat maintenance" onClick={() => navigate('/gestao-equipamentos/inventario?filter=manutencao')}>
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
                            <div
                                key={act.id}
                                className="activity-item clickable"
                                onClick={() => navigate(`/gestao-equipamentos/inventario?search=${encodeURIComponent(act.cp_equipamentos?.nome || '')}`)}
                                title={`Ver ${act.cp_equipamentos?.nome} no inventário`}
                            >
                                <div className="activity-leading">
                                    <div className="activity-icon">
                                        <i className={`fas ${getIconByTipo(act.cp_equipamentos?.tipo)}`}></i>
                                    </div>
                                    <div className={`activity-badge ${act.tipo.toLowerCase()}`}>
                                        {act.tipo}
                                    </div>
                                </div>
                                <div className="activity-details">
                                    <p><strong>{act.cp_equipamentos?.nome}</strong></p>
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
            </div>
        </div>
    );
};

export default DashboardEquipamentos;
