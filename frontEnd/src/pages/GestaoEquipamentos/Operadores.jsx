import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipamentosAPI } from '../../services/equipamentos.service';
import './Operadores.css';

const Operadores = () => {
    const [operadores, setOperadores] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchOperadores();
    }, []);

    const fetchOperadores = async () => {
        try {
            const response = await equipamentosAPI.getOperadores();
            if (response.success) setOperadores(response.data);
        } catch (error) {
            console.error('Erro ao buscar operadores:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Carregando operadores...</div>;

    return (
        <div className="operadores-container">
            <div className="operadores-grid">
                {operadores.map(op => (
                    <div
                        key={op.id}
                        className="operador-card"
                        onClick={() => navigate(`/gestao-equipamentos/operadores/${op.id}`)}
                    >
                        <div className="op-avatar">
                            {op.nome.charAt(0)}
                        </div>
                        <div className="op-info">
                            <h3>{op.nome}</h3>
                            <p>{op.cargo || 'Colaborador'} | {op.departamento || 'Geral'}</p>
                        </div>
                        <div className={`op-equip-count ${op.qtd_equipamentos > 0 ? 'active' : ''}`}>
                            <i className="fas fa-laptop"></i>
                            <span>{op.qtd_equipamentos}</span>
                        </div>
                        <div className="op-action">
                            <i className="fas fa-chevron-right"></i>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Operadores;
