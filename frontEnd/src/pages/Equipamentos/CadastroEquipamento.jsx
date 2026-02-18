import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import Layout from '../../components/layout/Layout';
import RichTextEditor from '../../components/common/RichTextEditor';
import DatePicker from '../../components/vigencia/DatePicker';
import { equipamentosAPI } from '../../services/equipamentos.service';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import './Equipamentos.css';

const CadastroEquipamento = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const equipamentoId = searchParams.get('id');
    const isEditMode = !!equipamentoId;

    const [loading, setLoading] = useState(false);
    const [uploadingMidia, setUploadingMidia] = useState(false);

    // Refs
    const richEditorRef = useRef(null);
    const fileInputRef = useRef(null);

    // Form State
    const [formData, setFormData] = useState({
        nome: '',
        tipo: '',
        marca: '',
        modelo: '',
        numero_serie: '',
        data_aquisicao: '',
        status: 'ativo',
        descricao: '',
        tem_avaria: false
    });

    useEffect(() => {
        if (isEditMode) {
            loadEquipamento(equipamentoId);
        }
    }, [equipamentoId]);

    const loadEquipamento = async (id) => {
        setLoading(true);
        try {
            const response = await equipamentosAPI.getEquipamentoPorId(id);
            if (response.success && response.data) {
                const item = response.data;
                setFormData({
                    nome: item.nome || '',
                    tipo: item.tipo || '',
                    marca: item.marca || '',
                    modelo: item.modelo || '',
                    numero_serie: item.numero_serie || '',
                    data_aquisicao: item.data_aquisicao ? item.data_aquisicao.split('T')[0] : '',
                    status: item.status || 'ativo',
                    descricao: item.descricao || '',
                    tem_avaria: !!item.tem_avaria
                });
            } else {
                Swal.fire('Erro', 'Equipamento não encontrado.', 'error');
                navigate('/cadastro/equipamentos');
            }
        } catch (error) {
            console.error("Erro ao carregar equipamento:", error);
            Swal.fire('Erro', 'Não foi possível carregar os dados do equipamento.', 'error');
            navigate('/cadastro/equipamentos');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleDateChange = (e) => {
        setFormData(prev => ({
            ...prev,
            data_aquisicao: e.target.value
        }));
    };

    const handleUploadTrigger = () => fileInputRef.current?.click();

    const handleFileSelect = async (e) => {
        const files = e.target.files;
        if (!files?.length) return;
        const file = files[0];

        if (file.size > 50 * 1024 * 1024) {
            Swal.fire('Atenção', 'Arquivo deve ter no máximo 50MB', 'warning');
            e.target.value = '';
            return;
        }

        setUploadingMidia(true);
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);

            const res = await comunicacaoAPI.uploadMedia(uploadFormData);

            if (res?.success && res?.data?.url) {
                const url = res.data.url;
                const isVideo = file.type.startsWith('video/');

                if (isVideo && richEditorRef.current?.insertVideoAtEnd) {
                    richEditorRef.current.insertVideoAtEnd(url);
                } else if (!isVideo && richEditorRef.current?.insertImageAtEnd) {
                    richEditorRef.current.insertImageAtEnd(url);
                } else if (richEditorRef.current?.insertHtmlAtEnd) {
                    const html = isVideo
                        ? `<p><video src="${url}" controls style="max-width:100%;"></video></p>`
                        : `<p><img src="${url}" alt="imagem" style="max-width:100%;" /></p>`;
                    richEditorRef.current.insertHtmlAtEnd(html);
                }

                Swal.fire('Sucesso', 'Arquivo anexado com sucesso!', 'success');
            } else {
                Swal.fire('Erro', res?.error || 'Falha no upload.', 'error');
            }
        } catch (err) {
            console.error("Upload error:", err);
            Swal.fire('Erro', err.message || 'Falha no upload.', 'error');
        } finally {
            setUploadingMidia(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            let response;
            if (isEditMode) {
                response = await equipamentosAPI.atualizarEquipamento(equipamentoId, formData);
            } else {
                response = await equipamentosAPI.criarEquipamento(formData);
            }

            if (response.success) {
                await Swal.fire('Sucesso', isEditMode ? 'Equipamento atualizado!' : 'Equipamento criado!', 'success');
                navigate('/cadastro/equipamentos');
            } else {
                Swal.fire('Erro', response.error || 'Erro ao salvar equipamento.', 'error');
            }
        } catch (error) {
            console.error("Erro ao salvar equipamento:", error);
            Swal.fire('Erro', error.message || 'Não foi possível salvar o equipamento.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <div className="colaboradores-listing-section">
                        <div className="cadastro-listing-page-header">
                            <div className="cadastro-listing-header-content">
                                <div className="cadastro-listing-header-left">
                                    <div className="cadastro-listing-header-icon" onClick={() => navigate('/cadastro/equipamentos')} style={{ cursor: 'pointer' }}>
                                        <i className="fas fa-arrow-left" style={{ fontSize: '24px', color: '#0e3b6f' }}></i>
                                    </div>
                                    <div>
                                        <h1 className="cadastro-listing-page-title">{isEditMode ? 'Editar Equipamento' : 'Novo Equipamento'}</h1>
                                        <p className="cadastro-listing-page-subtitle">
                                            {isEditMode ? 'Atualize as informações do equipamento' : 'Preencha os dados do novo equipamento'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Form Container */}
                        <div className="view-transition" style={{
                            background: 'white',
                            borderRadius: '16px',
                            padding: '32px',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            border: '1px solid #e2e8f0',
                            maxWidth: '1200px',
                            margin: '0 auto'
                        }}>
                            <form onSubmit={handleSubmit}>
                                <div className="form-grid">
                                    <div className="form-group full-width">
                                        <label className="form-label">Nome *</label>
                                        <input
                                            type="text"
                                            name="nome"
                                            className="form-input"
                                            value={formData.nome}
                                            onChange={handleInputChange}
                                            required
                                            placeholder="Ex: Notebook Dell Latitude"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tipo (Categoria) *</label>
                                        <select
                                            name="tipo"
                                            className="form-select"
                                            value={formData.tipo}
                                            onChange={handleInputChange}
                                            required
                                            disabled={loading}
                                        >
                                            <option value="">Selecione...</option>
                                            <option value="Notebook">Notebook</option>
                                            <option value="Monitor">Monitor</option>
                                            <option value="Teclado">Teclado</option>
                                            <option value="Fone/Headset">Fone/Headset</option>
                                            <option value="Mouse">Mouse</option>
                                            <option value="Mousepad">Mousepad</option>
                                            <option value="Carregador Notebook">Carregador Notebook</option>
                                            <option value="Fonte Monitor">Fonte Monitor</option>
                                            <option value="Adaptador HDMI">Adaptador HDMI</option>
                                            <option value="Suporte Notebook">Suporte Notebook</option>
                                            <option value="Carregador Monitor">Carregador Monitor</option>
                                            <option value="Outros">Outros</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Status</label>
                                        <select
                                            name="status"
                                            className="form-select"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                        >
                                            <option value="ativo">Disponível</option>
                                            <option value="inativo">Indisponível</option>
                                            <option value="manutencao">Em Manutenção</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Marca</label>
                                        <input
                                            type="text"
                                            name="marca"
                                            className="form-input"
                                            value={formData.marca}
                                            onChange={handleInputChange}
                                            placeholder="Ex: Dell"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Modelo</label>
                                        <input
                                            type="text"
                                            name="modelo"
                                            className="form-input"
                                            value={formData.modelo}
                                            onChange={handleInputChange}
                                            placeholder="Ex: 5420"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Número de Série</label>
                                        <input
                                            type="text"
                                            name="numero_serie"
                                            className="form-input"
                                            value={formData.numero_serie}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Data de Aquisição</label>
                                        <DatePicker
                                            value={formData.data_aquisicao}
                                            onChange={handleDateChange}
                                            disabled={loading}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-group full-width" style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', paddingRight: '10px' }}>
                                        <label className="checkbox-label" style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            color: '#0e3b6f',
                                            background: '#f1f5f9',
                                            padding: '12px 24px',
                                            borderRadius: '30px',
                                            border: '2px solid #e2e8f0',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                        }}>
                                            <input
                                                type="checkbox"
                                                name="tem_avaria"
                                                checked={formData.tem_avaria}
                                                onChange={handleInputChange}
                                                style={{ width: '20px', height: '20px', accentColor: '#0e3b6f' }}
                                                disabled={loading}
                                            />
                                            Este equipamento possui avaria?
                                        </label>
                                    </div>

                                    {formData.tem_avaria && (
                                        <div className="form-group full-width" style={{ marginTop: '15px' }}>
                                            <label className="form-label">Descrição da Avaria (Opcional - pode conter fotos)</label>
                                            <div className="equip-editor-wrapper">
                                                <RichTextEditor
                                                    ref={richEditorRef}
                                                    value={formData.descricao}
                                                    onChange={(value) => setFormData(prev => ({ ...prev, descricao: value }))}
                                                    placeholder="Descreva o problema e anexe fotos se necessário..."
                                                    minHeight={300}
                                                    readOnly={loading}
                                                />
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*,video/*"
                                                    className="equip-upload-input"
                                                    onChange={handleFileSelect}
                                                    disabled={loading || uploadingMidia}
                                                />
                                                <div className="equip-upload-wrap">
                                                    <button
                                                        type="button"
                                                        className="equip-upload-btn"
                                                        onClick={handleUploadTrigger}
                                                        disabled={loading || uploadingMidia}
                                                        title="Anexar imagem ou vídeo"
                                                    >
                                                        {uploadingMidia ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-cloud-upload-alt" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer" style={{ marginTop: '40px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => navigate('/cadastro/equipamentos')}
                                        disabled={loading}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-save"
                                        disabled={loading}
                                    >
                                        {loading ? 'Salvando...' : 'Salvar Equipamento'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </main>
            </div>
        </Layout>
    );
};

export default CadastroEquipamento;
