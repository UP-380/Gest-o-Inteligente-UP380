import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

    if (loading) return <div>Carregando perfil...</div>;
    if (!data) return <div>Operador não encontrado.</div>;

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
                                <div className="item-meta">
                                    <span><i className="far fa-calendar-alt"></i> Retirado em: {new Date(item.data_retirada).toLocaleDateString()}</span>
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
