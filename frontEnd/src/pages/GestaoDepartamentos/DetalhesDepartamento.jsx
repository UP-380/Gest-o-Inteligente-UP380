import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useToast } from '../../hooks/useToast';
import { colaboradoresAPI, departamentosAPI } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import DatePicker from '../../components/vigencia/DatePicker';
import DeleteButton from '../../components/common/DeleteButton';
import ConfirmModal from '../../components/common/ConfirmModal';
import FilterColaborador from '../../components/filters/FilterColaborador';
import './DetalhesDepartamento.css';

// Ícones disponíveis para seleção
const AVAILABLE_ICONS = [
    'fa-bullhorn', 'fa-wallet', 'fa-id-card', 'fa-laptop-code', 'fa-chart-line',
    'fa-users', 'fa-building', 'fa-handshake', 'fa-briefcase', 'fa-headset',
    'fa-cog', 'fa-shield-alt', 'fa-brain', 'fa-database', 'fa-globe'
];

const DetalhesDepartamento = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const showToast = useToast();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deptInfo, setDeptInfo] = useState({ name: '', description: '', head: '', headRole: '', icon: 'fa-building', color: '#f1f5f9', iconColor: '#64748b' });
    const [members, setMembers] = useState([]);
    const [colaboradores, setColaboradores] = useState([]);
    const [showIconModal, setShowIconModal] = useState(false);
    const [isEditingInfo, setIsEditingInfo] = useState(false);
    const [editInfoData, setEditInfoData] = useState({ name: '', description: '' });
    const [savingInfo, setSavingInfo] = useState(false);
    const [isEditingHead, setIsEditingHead] = useState(false);
    const [editHeadData, setEditHeadData] = useState({ head: '', headRole: '', headIds: [] });
    const [newMemberData, setNewMemberData] = useState({
        name: '',
        email: '',
        role: '',
        status: 'Ativo',
        joined: '',
        colaboradoresIds: []
    });

    // Estados para o modal customizado de confirmação de exclusão do Membro
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [memberParaExcluir, setMemberParaExcluir] = useState(null);
    const [deletandoMember, setDeletandoMember] = useState(false);

    // Carregar dados
    const loadData = async () => {
        if (id === 'novo') {
            setDeptInfo({
                name: 'Novo Departamento',
                description: '',
                icon: 'fa-building',
                color: '#f1f5f9',
                iconColor: '#475569'
            });
            setIsEditingInfo(true);
            setEditInfoData({ name: '', description: '' });
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            // Carregar colaboradores para o select - Buscar todos (mesmo sem usuário vinculado)
            const colabsResult = await colaboradoresAPI.getAllIncludingWithoutUser();
            if (colabsResult.success && colabsResult.data) {
                setColaboradores(colabsResult.data);
            }

            // Carregar info do departamento
            const deptResult = await departamentosAPI.getById(id);
            let deptData = null;

            if (deptResult.success) {
                deptData = deptResult.data;
                setDeptInfo({
                    name: deptData.nome || 'Departamento sem nome',
                    description: deptData.descricao || '',
                    head: deptData.head || 'Não definido',
                    headRole: deptData.head_role || 'N/A',
                    icon: deptData.icon || 'fa-building',
                    color: deptData.color || '#f1f5f9',
                    iconColor: deptData.icon_color || '#64748b'
                });
            } else {
                setError('Departamento não encontrado');
                return;
            }

            // Carregar membros do departamento
            const membersResult = await departamentosAPI.getMembros(id);
            if (membersResult.success) {
                // Sort members alphabetically by name
                const sortedMembers = (membersResult.data || []).sort((a, b) =>
                    (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
                );
                setMembers(sortedMembers);

                // Inicializar dados do responsável para edição (suporta múltiplos nomes separados por vírgula)
                const savedHeadNames = (deptData.head || '').split(',').map(n => n.trim()).filter(n => n);
                const matchingMembers = sortedMembers.filter(m =>
                    savedHeadNames.includes(m.name) ||
                    (deptData.head_id && String(m.membro_id || m.id) === String(deptData.head_id))
                );

                setEditHeadData({
                    head: deptData.head || '',
                    headRole: deptData.head_role || 'Responsável',
                    headIds: matchingMembers.map(m => m.membro_id || m.id)
                });
            }
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Erro ao carregar dados do departamento');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    const handleSaveInfo = async () => {
        if (!editInfoData.name.trim()) {
            showToast('error', 'O nome do departamento é obrigatório');
            return;
        }
        setSavingInfo(true);
        try {
            if (id === 'novo') {
                const novoDepartamento = {
                    nome: editInfoData.name,
                    descricao: editInfoData.description || 'Nova divisão corporativa',
                    status: 'Ativo',
                    icon: 'fa-building',
                    color: '#f1f5f9',
                    iconColor: '#475569'
                };
                const result = await departamentosAPI.create(novoDepartamento);
                if (result.success) {
                    showToast('success', 'Departamento criado com sucesso!');
                    navigate('/gestao/departamentos');
                } else {
                    showToast('error', 'Erro ao criar departamento');
                }
            } else {
                const result = await departamentosAPI.update(id, { nome: editInfoData.name, descricao: editInfoData.description });
                if (result.success) {
                    showToast('success', 'Departamento atualizado com sucesso!');
                    setDeptInfo(prev => ({ ...prev, name: editInfoData.name, description: editInfoData.description }));
                    setIsEditingInfo(false);
                } else {
                    showToast('error', 'Erro ao atualizar departamento');
                }
            }
        } catch (error) {
            console.error('Erro ao salvar departamento:', error);
            showToast('error', 'Erro de conexão ao salvar departamento');
        } finally {
            setSavingInfo(false);
        }
    };

    const handleSaveHead = async () => {
        setSavingInfo(true);
        try {
            const result = await departamentosAPI.update(id, {
                head: editHeadData.head,
                head_role: editHeadData.headRole
            });
            if (result.success) {
                showToast('success', 'Responsável atualizado com sucesso!');
                setDeptInfo(prev => ({
                    ...prev,
                    head: editHeadData.head,
                    headRole: editHeadData.headRole
                }));
                setIsEditingHead(false);
            } else {
                showToast('error', 'Erro ao atualizar responsável');
            }
        } catch (error) {
            console.error('Erro ao atualizar responsável:', error);
            showToast('error', 'Erro de conexão ao atualizar responsável');
        } finally {
            setSavingInfo(false);
        }
    };

    const handleSelectIcon = async (iconName) => {
        try {
            const result = await departamentosAPI.update(id, { icon: iconName });
            if (result.success) {
                showToast('success', 'Ícone atualizado com sucesso!');
                setDeptInfo(prev => ({ ...prev, icon: iconName }));
                setShowIconModal(false);
            } else {
                showToast('error', 'Erro ao atualizar ícone');
            }
        } catch (error) {
            console.error('Erro ao atualizar ícone:', error);
            showToast('error', 'Erro de conexão ao atualizar ícone');
        }
    };

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentMembers = members.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(members.length / itemsPerPage);

    const handleRemoveMemberClick = (member) => {
        setMemberParaExcluir(member);
        setShowDeleteModal(true);
    };

    const handleConfirmRemoveMember = async () => {
        if (!memberParaExcluir) return;

        setDeletandoMember(true);
        try {
            const result = await departamentosAPI.removeMembro(id, memberParaExcluir.id);
            if (result.success) {
                showToast('success', 'Colaborador removido com sucesso!');
                loadData(); // Recarregar lista
            } else {
                showToast('error', 'Erro ao remover colaborador');
            }
        } catch (error) {
            console.error('Erro ao remover colaborador:', error);
            showToast('error', 'Erro ao remover colaborador');
        } finally {
            setDeletandoMember(false);
            setShowDeleteModal(false);
            setMemberParaExcluir(null);
        }
    };

    const handleAddMember = async (idsToUse = null) => {
        const targetIds = idsToUse || newMemberData.colaboradoresIds;

        if (!targetIds || targetIds.length === 0) {
            showToast('error', 'Selecione pelo menos um colaborador');
            return;
        }

        // Filtrar membros que já estão no departamento para evitar duplicatas visuais no toast
        const existingMemberIds = members.map(m => String(m.membro_id));
        const finalIds = targetIds.filter(id => !existingMemberIds.includes(String(id)));

        if (finalIds.length === 0) {
            setNewMemberData(prev => ({ ...prev, colaboradoresIds: [] }));
            return;
        }

        let formattedDate = newMemberData.joined;
        if (!formattedDate) {
            const today = new Date();
            formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        }

        setSavingInfo(true);
        try {
            const results = await Promise.all(finalIds.map(async (colabId) => {
                const selectedColab = colaboradores.find(c => String(c.id) === String(colabId));

                const newMemberPayload = {
                    membro_id: colabId,
                    cargo: newMemberData.role || 'Colaborador',
                    email: selectedColab?.email || '',
                    status: newMemberData.status || 'Ativo',
                    data_entrada: formattedDate
                };

                return await departamentosAPI.addMembro(id, newMemberPayload);
            }));

            const allSuccess = results.every(r => r.success);
            const someFail = results.some(r => !r.success);

            if (allSuccess) {
                showToast('success', `${finalIds.length} colaborador(es) adicionado(s) com sucesso!`);
                loadData();
                setNewMemberData({ name: '', email: '', role: '', status: 'Ativo', joined: '', colaboradoresIds: [] });
            } else if (someFail) {
                showToast('warning', 'Alguns colaboradores não puderam ser adicionados.');
                loadData();
                setNewMemberData(prev => ({ ...prev, colaboradoresIds: [] }));
            } else {
                showToast('error', 'Erro ao adicionar colaboradores');
            }
        } catch (error) {
            console.error('Erro ao adicionar membros:', error);
            showToast('error', 'Erro ao adicionar colaboradores');
        } finally {
            setSavingInfo(false);
        }
    };


    if (loading) {
        return (
            <Layout>
                <div className="container">
                    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                        <div style={{ textAlign: 'center', color: '#64748b' }}>
                            <i className="fas fa-spinner fa-spin fa-3x" style={{ marginBottom: '1rem' }}></i>
                            <p>Carregando dados do departamento...</p>
                        </div>
                    </main>
                </div>
            </Layout>
        );
    }

    if (error) {
        return (
            <Layout>
                <div className="container">
                    <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                        <div style={{ textAlign: 'center', color: '#ef4444' }}>
                            <i className="fas fa-exclamation-triangle fa-3x" style={{ marginBottom: '1rem' }}></i>
                            <p>{error}</p>
                            <button
                                onClick={() => navigate('/gestao/departamentos')}
                                style={{ marginTop: '20px', padding: '10px 20px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}
                            >
                                Voltar para Departamentos
                            </button>
                        </div>
                    </main>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="container detalhes-full-page">
                <main className="main-content">
                    <div className="detalhes-departamento-section">

                        {/* Header */}
                        <div className="detalhes-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div className="dept-title-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div
                                            className="dept-icon clickable"
                                            onClick={() => setShowIconModal(true)}
                                            style={{
                                                width: '64px',
                                                height: '64px',
                                                borderRadius: '16px',
                                                background: deptInfo.color || '#f1f5f9',
                                                color: deptInfo.iconColor || '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '28px',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                                                cursor: 'pointer',
                                                position: 'relative'
                                            }}
                                            title="Clique para mudar o ícone"
                                        >
                                            <i className={`fas ${deptInfo.icon || 'fa-building'}`}></i>
                                            <div className="icon-overlay">
                                                <i className="fas fa-sync-alt" style={{ fontSize: '14px' }}></i>
                                            </div>
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {isEditingInfo ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '300px' }}>
                                                        <input
                                                            type="text"
                                                            value={editInfoData.name}
                                                            onChange={(e) => setEditInfoData({ ...editInfoData, name: e.target.value })}
                                                            className="form-control"
                                                            placeholder="Nome do Departamento"
                                                            autoFocus
                                                            style={{ fontSize: '1.25rem', fontWeight: 'bold', padding: '6px 10px', height: '36px', margin: 0 }}
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editInfoData.description}
                                                            onChange={(e) => setEditInfoData({ ...editInfoData, description: e.target.value })}
                                                            className="form-control"
                                                            placeholder="Descrição do Departamento"
                                                            style={{ fontSize: '0.875rem', padding: '6px 10px', height: '32px', margin: 0 }}
                                                        />
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className="btn-primary"
                                                            style={{ padding: '6px 12px', fontSize: '13px', height: '36px' }}
                                                            onClick={handleSaveInfo}
                                                            disabled={savingInfo}
                                                        >
                                                            {savingInfo ? 'Salvando...' : 'Salvar'}
                                                        </button>
                                                        <button
                                                            className="btn-secondary"
                                                            style={{ padding: '6px 12px', fontSize: '13px', height: '36px' }}
                                                            onClick={() => {
                                                                if (id === 'novo') {
                                                                    navigate('/gestao/departamentos');
                                                                } else {
                                                                    setIsEditingInfo(false);
                                                                }
                                                            }}
                                                            disabled={savingInfo}
                                                        >
                                                            Cancelar
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="dept-title-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', group: 'title' }}>
                                                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                                        {deptInfo.name}
                                                        <button
                                                            onClick={() => {
                                                                setEditInfoData({ name: deptInfo.name, description: deptInfo.description });
                                                                setIsEditingInfo(true);
                                                            }}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: '#64748b',
                                                                cursor: 'pointer',
                                                                fontSize: '16px',
                                                                padding: '4px',
                                                                borderRadius: '4px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title="Editar informações"
                                                            onMouseEnter={e => {
                                                                e.currentTarget.style.color = '#3b82f6';
                                                                e.currentTarget.style.backgroundColor = '#eff6ff';
                                                            }}
                                                            onMouseLeave={e => {
                                                                e.currentTarget.style.color = '#64748b';
                                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                            }}
                                                        >
                                                            <i className="fas fa-pencil-alt"></i>
                                                        </button>
                                                    </h1>
                                                </div>
                                            )}
                                            {!isEditingInfo && <p className="dept-subtitle">{deptInfo.description}</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Botoes de acao da pagina (Direita) */}
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => navigate('/gestao/departamentos')}
                                    title="Voltar para Departamentos"
                                >
                                    <i className="fas fa-arrow-left"></i> Voltar
                                </button>
                                {id !== 'novo' && (
                                    <div className="add-member-container" style={{ width: '300px' }}>
                                        <FilterColaborador
                                            hideLabel
                                            placeholder="Adicionar Membros..."
                                            value={newMemberData.colaboradoresIds}
                                            options={colaboradores.filter(c => !members.some(m => String(m.membro_id) === String(c.id)))}
                                            onChange={(e) => {
                                                setNewMemberData(prev => ({
                                                    ...prev,
                                                    colaboradoresIds: e.target.value || []
                                                }));
                                            }}
                                            disabled={savingInfo}
                                            showConfirmButton={true}
                                            confirmButtonLabel={savingInfo ? "Adicionando..." : "Adicionar ao Departamento"}
                                            onConfirm={() => handleAddMember()}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {id !== 'novo' && (
                            <>
                                {/* Top Cards */}
                                <div className="top-cards-grid">
                                    <div className="info-card">
                                        <div className="card-icon-wrapper" style={{ background: '#fff7ed', color: '#0e3b6f' }}>
                                            <i className="fas fa-users"></i>
                                        </div>
                                        <div className="card-content">
                                            <span className="card-label">Total de Membros</span>
                                            <span className="card-value">{members.length}</span>
                                        </div>
                                    </div>
                                    <div className="info-card">
                                        <div className="card-icon-wrapper" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                            {editHeadData.headIds && editHeadData.headIds.length > 0 ? (
                                                <div className="avatar-stack">
                                                    {editHeadData.headIds.slice(0, 3).map((id, index) => {
                                                        const member = members.find(m => String(m.membro_id || m.id) === String(id));
                                                        return (
                                                            <div key={id} className="avatar-stack-item" title={member?.name || 'Responsável'}>
                                                                {member?.avatar_url ? (
                                                                    <img src={member.avatar_url} alt={member.name} className="avatar-stack-img" />
                                                                ) : (
                                                                    (member?.name || 'R').charAt(0)
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                    {editHeadData.headIds.length > 3 && (
                                                        <div className="avatar-stack-more">
                                                            +{editHeadData.headIds.length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <i className="fas fa-user-plus" style={{ opacity: 0.5 }}></i>
                                            )}
                                        </div>
                                        <div className="card-content">
                                            <span className="card-label">Responsável pelo Departamento</span>
                                            <div className="head-profile">
                                                <div className="head-info">
                                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, flexWrap: 'wrap' }}>
                                                        {deptInfo.head ? (
                                                            deptInfo.head.split(',').map((name, idx, arr) => (
                                                                <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    {name.trim()}
                                                                    {idx < arr.length - 1 && <span style={{ color: '#cbd5e1', fontSize: '12px' }}>•</span>}
                                                                </span>
                                                            ))
                                                        ) : 'Não definido'}
                                                        <FilterColaborador
                                                            className="edit-head-filter"
                                                            hideLabel
                                                            isIconButton={true}
                                                            icon="fa-plus"
                                                            placeholder="Selecionar Responsáveis"
                                                            value={editHeadData.headIds || []}
                                                            options={members.map(m => ({ id: m.membro_id || m.id, nome: m.name }))}
                                                            onChange={(e) => {
                                                                const ids = e.target.value || [];
                                                                const selectedMembers = members.filter(m =>
                                                                    ids.map(String).includes(String(m.membro_id || m.id))
                                                                );

                                                                if (selectedMembers.length > 0) {
                                                                    setEditHeadData(prev => ({
                                                                        ...prev,
                                                                        head: selectedMembers.map(m => m.name).join(', '),
                                                                        headIds: ids,
                                                                        headRole: 'Responsável'
                                                                    }));
                                                                } else {
                                                                    setEditHeadData(prev => ({
                                                                        ...prev,
                                                                        head: '',
                                                                        headIds: [],
                                                                        headRole: 'Responsável'
                                                                    }));
                                                                }
                                                            }}
                                                            allowEmpty={true}
                                                            showConfirmButton={true}
                                                            confirmButtonLabel={savingInfo ? "Salvando..." : "Definir Responsáveis"}
                                                            onConfirm={handleSaveHead}
                                                            disabled={savingInfo}
                                                        />
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Members List */}
                                <div className="members-section">
                                    <div className="members-header">
                                        <h2>Membros do Departamento</h2>
                                    </div>

                                    <table className="members-table">
                                        <thead>
                                            <tr>
                                                <th>Membro</th>
                                                <th style={{ textAlign: 'right' }}>Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentMembers.map(member => (
                                                <tr key={member.id}>
                                                    <td>
                                                        <div className="member-profile">
                                                            {member.avatar_url ? (
                                                                <img src={member.avatar_url} alt={member.name} className="member-avatar" />
                                                            ) : (
                                                                <div className="member-avatar-placeholder">
                                                                    {(member.name || '?').charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className="member-info">
                                                                <div>{member.name}</div>
                                                                <div>{member.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            <DeleteButton
                                                                onClick={() => handleRemoveMemberClick(member)}
                                                                title="Remover Membro"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {currentMembers.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                                            Nenhum membro encontrado.
                                        </div>
                                    )}

                                    {/* Controles de Paginação */}
                                    {totalPages > 1 && (
                                        <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '14px', color: '#64748b' }}>
                                                Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, members.length)} de {members.length} membros
                                            </span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                    disabled={currentPage === 1}
                                                    style={{
                                                        padding: '6px 12px',
                                                        border: '1px solid #e2e8f0',
                                                        background: 'white',
                                                        borderRadius: '6px',
                                                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                                        opacity: currentPage === 1 ? 0.5 : 1
                                                    }}
                                                >
                                                    <i className="fas fa-chevron-left"></i>
                                                </button>

                                                {Array.from({ length: totalPages }, (_, i) => (
                                                    <button
                                                        key={i + 1}
                                                        onClick={() => setCurrentPage(i + 1)}
                                                        style={{
                                                            padding: '6px 12px',
                                                            border: `1px solid ${currentPage === i + 1 ? '#3b82f6' : '#e2e8f0'}`,
                                                            background: currentPage === i + 1 ? '#eff6ff' : 'white',
                                                            color: currentPage === i + 1 ? '#3b82f6' : '#64748b',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                ))}

                                                <button
                                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                    disabled={currentPage === totalPages}
                                                    style={{
                                                        padding: '6px 12px',
                                                        border: '1px solid #e2e8f0',
                                                        background: 'white',
                                                        borderRadius: '6px',
                                                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                                        opacity: currentPage === totalPages ? 0.5 : 1
                                                    }}
                                                >
                                                    <i className="fas fa-chevron-right"></i>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>




            {/* Modal Seleção de Ícone */}
            {showIconModal && (
                <div className="modal-overlay" onClick={() => setShowIconModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
                            <h3 style={{ margin: 0 }}>Selecionar Ícone</h3>
                        </div>
                        <div className="modal-body">
                            <div className="icon-selector-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(5, 1fr)',
                                gap: '12px',
                                padding: '8px'
                            }}>
                                {AVAILABLE_ICONS.map(icon => (
                                    <div
                                        key={icon}
                                        className={`icon-option ${deptInfo.icon === icon ? 'selected' : ''}`}
                                        onClick={() => handleSelectIcon(icon)}
                                        style={{
                                            aspectRatio: '1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            cursor: 'pointer',
                                            fontSize: '20px',
                                            color: '#64748b',
                                            transition: 'all 0.2s'
                                        }}
                                        title={icon}
                                    >
                                        <i className={`fas ${icon}`}></i>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                            <button
                                onClick={() => setShowIconModal(false)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    background: 'white',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmação de exclusão */}
            <ConfirmModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setMemberParaExcluir(null);
                }}
                onConfirm={handleConfirmRemoveMember}
                title="Remover Membro"
                message={
                    memberParaExcluir ? (
                        <>
                            <p>
                                Tem certeza que deseja remover o colaborador <strong>{memberParaExcluir.name}</strong> deste departamento?
                            </p>
                            <p style={{ color: '#b45309', marginTop: '8px' }}>Poderão ser perdidos vínculos e responsabilidades atribuídas a ele dentro do departamento.</p>
                        </>
                    ) : (
                        ''
                    )
                }
                confirmText="Remover"
                loading={deletandoMember}
            />
        </Layout>
    );
};

export default DetalhesDepartamento;
