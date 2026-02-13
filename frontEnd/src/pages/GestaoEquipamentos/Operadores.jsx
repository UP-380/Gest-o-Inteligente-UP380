import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipamentosAPI } from '../../services/equipamentos.service';
import DataTable from '../../components/common/DataTable';
import LoadingState from '../../components/common/LoadingState';
import Avatar from '../../components/user/Avatar';
import FiltersCard from '../../components/filters/FiltersCard';
import './Operadores.css';

const Operadores = () => {
    const navigate = useNavigate();
    const [operadores, setOperadores] = useState([]);
    const [filteredOperadores, setFilteredOperadores] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ativo'); // Padrão ativos
    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        fetchOperadores();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [operadores, searchTerm, statusFilter]);

    const fetchOperadores = async () => {
        setLoading(true);
        try {
            const response = await equipamentosAPI.getOperadores();
            if (response.success) {
                setOperadores(response.data);
            }
        } catch (error) {
            console.error('Erro ao buscar operadores:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let result = [...operadores];

        // Filtro de Status
        if (statusFilter !== 'todos') {
            result = result.filter(op => op.status === statusFilter);
        }

        // Busca por texto
        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase();
            result = result.filter(op =>
                op.nome?.toLowerCase().includes(search) ||
                op.cargo?.toLowerCase().includes(search) ||
                op.departamento?.toLowerCase().includes(search)
            );
        }

        setFilteredOperadores(result);
    };

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
    };

    const limparFiltros = () => {
        setSearchTerm('');
        setStatusFilter('ativo');
    };

    if (loading) return <LoadingState message="Carregando colaboradores..." />;

    return (
        <div className="operadores-page-content">
            <FiltersCard onClear={limparFiltros} showActions={true}>
                <div className="filter-group" style={{ flex: '0 0 200px' }}>
                    <label className="filter-label">Status</label>
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="todos">Todos</option>
                        <option value="ativo">Ativos</option>
                        <option value="inativo">Inativos</option>
                    </select>
                </div>
                <div className="filter-group" style={{ flex: 1 }}>
                    <label className="filter-label">Buscar Colaborador</label>
                    <div className="search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Nome, cargo ou departamento..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                        />
                    </div>
                </div>
            </FiltersCard>

            <div className="operadores-table-container">
                <DataTable
                    columns={[
                        {
                            key: 'nome',
                            label: 'Colaborador',
                            render: (op) => (
                                <div className="op-cell-user">
                                    <Avatar
                                        avatarId={op.foto_perfil}
                                        nomeUsuario={op.nome}
                                        size="small"
                                        entityType="user"
                                    />
                                    <div className="op-cell-info">
                                        <span className="op-name">{op.nome}</span>
                                        <span className="op-meta">{op.email || ''}</span>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'cargo',
                            label: 'Cargo / Departamento',
                            render: (op) => (
                                <div className="op-cell-dept">
                                    <span className="op-cargo">{op.cargo || '-'}</span>
                                    <span className="op-dept">{op.departamento || '-'}</span>
                                </div>
                            )
                        },
                        {
                            key: 'qtd_equipamentos',
                            label: 'Equipamentos em Posse',
                            render: (op) => (
                                <div className={`op-count-badge ${op.qtd_equipamentos > 0 ? 'active' : ''}`}>
                                    <i className="fas fa-laptop"></i>
                                    <strong>{op.qtd_equipamentos}</strong>
                                </div>
                            )
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (op) => (
                                <span className={`status-badge ${op.status}`}>
                                    {op.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </span>
                            )
                        }
                    ]}
                    data={filteredOperadores}
                    renderActions={(op) => (
                        <button
                            className="btn-view-profile"
                            onClick={() => navigate(`/gestao-equipamentos/operadores/${op.id}`)}
                            title="Ver Perfil de Equipamentos"
                        >
                            <i className="fas fa-id-card"></i> Detalhes
                        </button>
                    )}
                    emptyMessage="Nenhum colaborador encontrado com os filtros aplicados."
                    emptyIcon="fa-users-slash"
                />
            </div>
        </div>
    );
};

export default Operadores;
