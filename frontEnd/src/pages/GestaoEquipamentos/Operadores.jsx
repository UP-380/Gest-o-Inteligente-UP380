import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { equipamentosAPI } from '../../services/equipamentos.service';
import { colaboradoresAPI } from '../../services/api';
import DataTable from '../../components/common/DataTable';
import LoadingState from '../../components/common/LoadingState';
import Avatar from '../../components/user/Avatar';
import FiltersCard from '../../components/filters/FiltersCard';
import './Operadores.css';

const KNOWN_TYPES = [
    { type: 'notebook', icon: 'fa-laptop', label: 'Notebook' },
    { type: 'monitor', icon: 'fa-desktop', label: 'Monitor' },
    { type: 'teclado', icon: 'fa-keyboard', label: 'Teclado' },
    { type: 'mouse', icon: 'fa-mouse', label: 'Mouse' },
    { type: 'headset', icon: 'fa-headphones', label: 'Headset' }
];

const getEquipmentIcon = (item) => {
    const text = ((item.tipo || '') + ' ' + (item.nome || '')).toLowerCase();

    // 1. Acessórios e Componentes Específicos (Prioridade ALTA)
    if (text.includes('carregador') || text.includes('fonte')) return 'fa-plug';
    if (text.includes('suporte') || text.includes('base')) return 'fa-layer-group';
    if (text.includes('mousepad') || text.includes('mouse pad')) return 'fa-square';
    if (text.includes('cabo') || text.includes('fio') || text.includes('hdmi') || text.includes('vga')) return 'fa-code-branch';
    if (text.includes('adaptador')) return 'fa-random';
    if (text.includes('hub') || text.includes('dock')) return 'fa-network-wired';
    if (text.includes('mochila') || text.includes('bag') || text.includes('mala')) return 'fa-briefcase';
    if (text.includes('filtro') || text.includes('linha')) return 'fa-grip-lines';

    // 2. Equipamentos Principais
    if (text.includes('notebook') || text.includes('laptop')) return 'fa-laptop';
    if (text.includes('monitor') || text.includes('tela') || text.includes('display')) return 'fa-desktop';
    if (text.includes('teclado')) return 'fa-keyboard';

    // Mouse (Cuidado para não pegar mousepad de novo se a lógica acima falhar, mas a ordem garante)
    if (text.includes('mouse')) return 'fa-mouse';

    if (text.includes('headset') || text.includes('fone') || text.includes('auricular')) return 'fa-headphones';
    if (text.includes('webcam') || text.includes('camera')) return 'fa-camera';
    if (text.includes('celular') || text.includes('smartphone') || text.includes('iphone') || text.includes('android')) return 'fa-mobile-alt';
    if (text.includes('tablet') || text.includes('ipad')) return 'fa-tablet-alt';

    // 3. Outros
    if (text.includes('cadeira')) return 'fa-chair';
    if (text.includes('mesa')) return 'fa-table';

    // 4. Fallback
    return 'fa-box-open';
};

const Operadores = () => {
    const navigate = useNavigate();
    const [operadores, setOperadores] = useState([]);
    const [filteredOperadores, setFilteredOperadores] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ativo'); // Filtrar apenas ativos por padrão
    const [activePopup, setActivePopup] = useState(null); // { opId: string, type: string }
    const popupRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        fetchOperadores();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [operadores, searchTerm, statusFilter]);

    // Close popup on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (popupRef.current && !popupRef.current.contains(event.target)) {
                setActivePopup(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fetchOperadores = async () => {
        setLoading(true);
        try {
            // Fetch all collaborators to match the assignment dropdown list
            const colabResponse = await colaboradoresAPI.getAll();
            const allCollaborators = (colabResponse.success && colabResponse.data)
                ? colabResponse.data.filter(u => u.status === 'ativo' || !u.status)
                : [];

            // Fetch equipment data (collaborators with equipment)
            const equipResponse = await equipamentosAPI.getOperadores();
            const collaboratorsWithEquip = (equipResponse.success && equipResponse.data) ? equipResponse.data : [];

            // Create a map of equipment data for easy lookup by ID
            const equipMap = new Map(collaboratorsWithEquip.map(c => [String(c.id), c]));

            // Merge lists: Use ALL collaborators as base, attaching equipment info if available
            const mergedList = allCollaborators.map(colab => {
                const equipData = equipMap.get(String(colab.id));
                return {
                    ...colab,
                    // If equipment data exists, use it; otherwise empty array
                    equipamentos: equipData ? equipData.equipamentos : [],
                    // Preserve or merge other fields if needed, e.g. details that might only exist in one API
                    cargo: colab.cargo || (equipData ? equipData.cargo : ''),
                    departamento: colab.departamento || (equipData ? equipData.departamento : ''),
                    email: colab.email || (equipData ? equipData.email : '')
                };
            });

            setOperadores(mergedList);
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
        setStatusFilter('todos');
    };

    if (loading) return <LoadingState message="Carregando colaboradores..." />;

    return (
        <div className="operadores-page-content">
            <FiltersCard onClear={limparFiltros} showActions={true}>
                <div className="filter-group" style={{ flex: 1 }}>
                    <label className="filter-label">Buscar Colaborador</label>
                    <div className="search-input-wrapper">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar por nome..."
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
                            key: 'equipamentos',
                            label: 'Equipamentos',
                            render: (op) => {

                                const getEquipmentsByType = (userEquipments, typeStr) => {
                                    if (!userEquipments || !Array.isArray(userEquipments)) return [];
                                    return userEquipments.filter(eq => (eq.tipo || '').toLowerCase().includes(typeStr));
                                };

                                const getOtherEquipments = (userEquipments) => {
                                    if (!userEquipments || !Array.isArray(userEquipments)) return [];
                                    return userEquipments.filter(eq => {
                                        const type = (eq.tipo || '').toLowerCase();
                                        return !KNOWN_TYPES.some(k => type.includes(k.type));
                                    });
                                };

                                // Combine known types with "Outros"
                                const ALL_TYPES = [
                                    ...KNOWN_TYPES,
                                    { type: 'outros', icon: 'fa-ellipsis-h', label: 'Outros' }
                                ];

                                const handleIconClick = (e, opId, type, equipments, icon) => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const position = {
                                        top: rect.bottom + window.scrollY + 10,
                                        left: rect.left + window.scrollX + (rect.width / 2)
                                    };

                                    if (activePopup && activePopup.opId === opId && activePopup.type === type) {
                                        setActivePopup(null);
                                    } else {
                                        setActivePopup({ opId, type, equipments, position, icon });
                                    }
                                };

                                return (
                                    <div className="op-equip-row">
                                        {ALL_TYPES.map((eq) => {
                                            const equipments = eq.type === 'outros'
                                                ? getOtherEquipments(op.equipamentos)
                                                : getEquipmentsByType(op.equipamentos, eq.type);

                                            // Ensure uniqueness and non-repetition of known types in 'outros' is handled by getOtherEquipments logic
                                            const isActive = equipments.length > 0;
                                            const isPopupOpen = activePopup && activePopup.opId === op.id && activePopup.type === eq.type;

                                            return (
                                                <div
                                                    key={eq.type}
                                                    className={`op-equip-icon ${isActive ? 'active' : ''} ${isPopupOpen ? 'popup-open' : ''}`}
                                                    title={isActive ? `${eq.label} (Em posse)` : `${eq.label} (Não possui)`}
                                                    onClick={(e) => isActive && handleIconClick(e, op.id, eq.type, equipments, eq.icon)}
                                                    style={{ cursor: isActive ? 'pointer' : 'default' }}
                                                >
                                                    <i className={`fas ${eq.icon}`}></i>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            }
                        },
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

            {/* Render Popup outside the table to avoid clipping/z-index issues */}
            {activePopup && (
                <div
                    className="equip-popup"
                    ref={popupRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: activePopup.position.top,
                        left: activePopup.position.left,
                        transform: 'translateX(-50%)',
                        zIndex: 9999,
                        marginTop: 0
                    }}
                >
                    <div className="equip-popup-header">
                        <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className={`fas ${activePopup.icon}`} style={{ color: '#3b82f6' }}></i>
                            {activePopup.type.charAt(0).toUpperCase() + activePopup.type.slice(1)}s
                        </strong>
                        <button className="equip-popup-close" onClick={() => setActivePopup(null)}>&times;</button>
                    </div>
                    <div className="equip-popup-content">
                        {activePopup.equipments.map((item, idx) => (
                            <div key={item.id} className="equip-popup-item">
                                <div
                                    className="equip-popup-item-name clickable"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/gestao-equipamentos/inventario?search=${encodeURIComponent(item.nome)}`);
                                    }}
                                    title="Ver no Inventário"
                                >
                                    <i className={`fas ${getEquipmentIcon(item)}`} style={{ marginRight: '6px', color: '#6b7280', fontSize: '11px' }}></i>
                                    {item.nome} <i className="fas fa-external-link-alt" style={{ fontSize: '10px', marginLeft: '4px', color: '#3b82f6' }}></i>
                                </div>
                                <div className="equip-popup-item-detail">
                                    <span className="label">Marca:</span> {item.marca} {item.modelo}
                                </div>
                                <div className="equip-popup-item-detail">
                                    <span className="label">Série:</span> {item.numero_serie || 'N/A'}
                                </div>
                                <div className="equip-popup-item-detail">
                                    <span className="label">Aquisição:</span> {item.data_aquisicao ? new Date(item.data_aquisicao).toLocaleDateString() : 'N/A'}
                                </div>
                                {idx < activePopup.equipments.length - 1 && <div className="equip-popup-divider"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Operadores;
