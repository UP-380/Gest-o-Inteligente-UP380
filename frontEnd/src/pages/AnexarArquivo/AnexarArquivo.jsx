import React, { useState, useCallback, useEffect, useRef } from 'react';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import PageHeader from '../../components/common/PageHeader';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import RichTextEditor from '../../components/common/RichTextEditor';
import ConfirmModal from '../../components/common/ConfirmModal';
import TutorialHistory from '../../components/tutorials/TutorialHistory';
import { useToast } from '../../hooks/useToast';
import { baseConhecimentoAPI } from '../../services/api';
import { comunicacaoAPI } from '../../services/comunicacao.service';
import { markdownToHtml } from '../../utils/richEditorMarkdown';
import html2canvas from 'html2canvas';
import './AnexarArquivo.css';

const MENSAGENS = {
  SELECIONE_PASTA: 'Selecione um item para editar o documento.',
  CRIAR_PRIMEIRA_PASTA: 'Criar primeiro',
  PASTA_NOME_OBRIGATORIO: 'Título é obrigatório',
  PASTA_CRIADA: 'Criado com sucesso',
  PASTA_ATUALIZADA: 'Atualizado com sucesso',
  PASTA_EXCLUIDA: 'Excluído com sucesso',
  ERRO_CARREGAR_PASTAS: 'Erro ao carregar itens',
  ERRO_CRIAR_PASTA: 'Erro ao criar item',
  ERRO_ATUALIZAR_PASTA: 'Erro ao atualizar item',
  ERRO_EXCLUIR_PASTA: 'Erro ao excluir item',
  EXCLUIR_PASTA_TITULO: 'Excluir item',
  EXCLUIR_PASTA_TEXTO: 'Excluir este item e todo o conteúdo? Esta ação não pode ser desfeita.',
  CONTEUDO_VAZIO: 'Digite ou anexe algum conteúdo antes de salvar.',
  SUCESSO: 'Documento salvo com sucesso.',
  DOCUMENTOS_SALVO: 'Documento atualizado com sucesso.',
  ERRO_SALVAR: 'Erro ao salvar documento.',
  ERRO_ATUALIZAR: 'Erro ao atualizar documento.',
  ARQUIVO_ANEXADO: 'Arquivo anexado. Salve o documento para guardar.',
  ARQUIVO_GRANDE: 'Arquivo deve ter no máximo 50MB',
};

const AnexarArquivo = () => {
  const showToast = useToast();
  const [pastas, setPastas] = useState([]);
  const [pastaSelecionada, setPastaSelecionada] = useState(null);
  const [carregandoPastas, setCarregandoPastas] = useState(false);
  const [mostrarFormPasta, setMostrarFormPasta] = useState(false);
  const [pastaEditando, setPastaEditando] = useState(null);
  const [formPastaNome, setFormPastaNome] = useState('');
  const [salvandoPasta, setSalvandoPasta] = useState(false);
  const [pastaParaExcluir, setPastaParaExcluir] = useState(null);
  const [excluindoPasta, setExcluindoPasta] = useState(false);

  const [anexosDaPasta, setAnexosDaPasta] = useState([]);
  const [carregandoAnexos, setCarregandoAnexos] = useState(false);
  const [currentAnexoId, setCurrentAnexoId] = useState(null);
  const [conteudo, setConteudo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [uploadingMidia, setUploadingMidia] = useState(false);

  // Estados para auto-save e controle de alterações não salvas
  const [lastSavedConteudo, setLastSavedConteudo] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState(null);
  const autoSaveTimerRef = useRef(null);

  // Estados para o modal de confirmação do sistema
  const [showConfirmSair, setShowConfirmSair] = useState(false);
  const [pendenteNovaPastaId, setPendenteNovaPastaId] = useState(null);

  const fileInputRef = useRef(null);
  const docPageRef = useRef(null);
  const richEditorRef = useRef(null);
  const [pastaRenomeandoId, setPastaRenomeandoId] = useState(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState('');
  const editNomeInputRef = useRef(null);

  const carregarPastas = useCallback(async () => {
    setCarregandoPastas(true);
    try {
      const res = await baseConhecimentoAPI.getPastas();
      if (res.success) setPastas(res.data || []);
      else showToast('error', MENSAGENS.ERRO_CARREGAR_PASTAS);
    } catch (err) {
      showToast('error', err.message || MENSAGENS.ERRO_CARREGAR_PASTAS);
    } finally {
      setCarregandoPastas(false);
    }
  }, [showToast]);

  useEffect(() => {
    carregarPastas();
  }, [carregarPastas]);

  const carregarAnexosDaPasta = useCallback(async (pastaId) => {
    if (!pastaId) {
      setAnexosDaPasta([]);
      return;
    }
    setCarregandoAnexos(true);
    try {
      const res = await baseConhecimentoAPI.getAnexosPorPasta(pastaId);
      setAnexosDaPasta(Array.isArray(res.data) ? res.data : []);
    } catch {
      setAnexosDaPasta([]);
    } finally {
      setCarregandoAnexos(false);
    }
  }, []);

  const conteudoParaEditor = useCallback((armazenado) => {
    if (armazenado == null || armazenado === '') return '';
    const s = String(armazenado).trim();
    if (s.startsWith('<')) return s;
    return markdownToHtml(s);
  }, []);

  useEffect(() => {
    carregarAnexosDaPasta(pastaSelecionada);
  }, [pastaSelecionada, carregarAnexosDaPasta]);

  useEffect(() => {
    if (!pastaSelecionada || carregandoAnexos) return;
    if (anexosDaPasta.length > 0) {
      const primeiro = anexosDaPasta[0];
      setCurrentAnexoId(primeiro.id);
      const val = conteudoParaEditor(primeiro.conteudo);
      setConteudo(val);
      setLastSavedConteudo(val); // Inicializar lastSaved
      setHasUnsavedChanges(false);
    } else {
      setCurrentAnexoId(null);
      setConteudo('');
      setLastSavedConteudo('');
      setHasUnsavedChanges(false);
    }
  }, [pastaSelecionada, carregandoAnexos, anexosDaPasta, conteudoParaEditor]);

  // Efeito para monitorar alterações não salvas e configurar auto-save
  useEffect(() => {
    if (!pastaSelecionada) {
      setHasUnsavedChanges(false);
      return;
    }

    const current = conteudo || '';
    const last = lastSavedConteudo || '';

    if (current !== last) {
      setHasUnsavedChanges(true);

      // Configurar auto-save de 3 segundos
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        handleSalvar(true);
      }, 3000);
    } else {
      setHasUnsavedChanges(false);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    }

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [conteudo, lastSavedConteudo, pastaSelecionada]);

  // Efeito para avisar antes de sair da página se houver alterações
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        // Nota: O navegador controla o texto exibido no beforeunload para evitar abusos.
        // O sistema customizado será usado para navegação interna.
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSelecionarPasta = useCallback((id) => {
    if (hasUnsavedChanges) {
      setPendenteNovaPastaId(id);
      setShowConfirmSair(true);
      return;
    }
    setPastaSelecionada(id);
  }, [hasUnsavedChanges]);

  const confirmarMudarPasta = useCallback(() => {
    if (pendenteNovaPastaId) {
      setPastaSelecionada(pendenteNovaPastaId);
      setPendenteNovaPastaId(null);
    }
    setShowConfirmSair(false);
  }, [pendenteNovaPastaId]);

  const handleAbrirFormNovaPasta = useCallback(() => {
    setPastaEditando(null);
    setFormPastaNome('');
    setMostrarFormPasta(true);
  }, []);
  const handleAbrirFormEditarPasta = useCallback((pasta) => {
    setPastaRenomeandoId(pasta.id);
    setNomeEmEdicao(pasta.nome || '');
  }, []);

  useEffect(() => {
    if (pastaRenomeandoId != null && editNomeInputRef.current) {
      editNomeInputRef.current.focus();
      editNomeInputRef.current.select();
    }
  }, [pastaRenomeandoId]);

  const handleSalvarRenomear = useCallback(async () => {
    if (pastaRenomeandoId == null) return;
    const nome = nomeEmEdicao.trim();
    if (!nome) {
      showToast('warning', MENSAGENS.PASTA_NOME_OBRIGATORIO);
      return;
    }
    setSalvandoPasta(true);
    try {
      const res = await baseConhecimentoAPI.atualizarPasta(pastaRenomeandoId, { nome });
      if (res.success) {
        showToast('success', MENSAGENS.PASTA_ATUALIZADA);
        setPastaRenomeandoId(null);
        setNomeEmEdicao('');
        await carregarPastas();
      } else {
        showToast('error', res.error || MENSAGENS.ERRO_ATUALIZAR_PASTA);
      }
    } catch (err) {
      showToast('error', err.message || MENSAGENS.ERRO_ATUALIZAR_PASTA);
    } finally {
      setSalvandoPasta(false);
    }
  }, [pastaRenomeandoId, nomeEmEdicao, showToast, carregarPastas]);

  const handleCancelarRenomear = useCallback(() => {
    setPastaRenomeandoId(null);
    setNomeEmEdicao('');
  }, []);
  const handleFecharFormPasta = useCallback(() => {
    if (!salvandoPasta) {
      setMostrarFormPasta(false);
      setPastaEditando(null);
      setFormPastaNome('');
    }
  }, [salvandoPasta]);

  const handleSalvarPasta = useCallback(async (e) => {
    e.preventDefault();
    if (!formPastaNome.trim()) {
      showToast('warning', MENSAGENS.PASTA_NOME_OBRIGATORIO);
      return;
    }
    setSalvandoPasta(true);
    try {
      if (pastaEditando) {
        const res = await baseConhecimentoAPI.atualizarPasta(pastaEditando.id, { nome: formPastaNome.trim() });
        if (res.success) {
          showToast('success', MENSAGENS.PASTA_ATUALIZADA);
          await carregarPastas();
          handleFecharFormPasta();
        } else {
          showToast('error', res.error || MENSAGENS.ERRO_ATUALIZAR_PASTA);
        }
      } else {
        const res = await baseConhecimentoAPI.criarPasta({ nome: formPastaNome.trim() });
        if (res.success) {
          showToast('success', MENSAGENS.PASTA_CRIADA);
          await carregarPastas();
          setPastaSelecionada(res.data.id);
          handleFecharFormPasta();
        } else {
          showToast('error', res.error || MENSAGENS.ERRO_CRIAR_PASTA);
        }
      }
    } catch (err) {
      showToast('error', err.message || (pastaEditando ? MENSAGENS.ERRO_ATUALIZAR_PASTA : MENSAGENS.ERRO_CRIAR_PASTA));
    } finally {
      setSalvandoPasta(false);
    }
  }, [formPastaNome, pastaEditando, showToast, carregarPastas, handleFecharFormPasta]);

  const handleAbrirModalExcluir = useCallback((pasta) => setPastaParaExcluir(pasta), []);
  const handleFecharModalExcluir = useCallback(() => {
    if (!excluindoPasta) setPastaParaExcluir(null);
  }, [excluindoPasta]);
  const handleExcluirPasta = useCallback(async () => {
    if (!pastaParaExcluir) return;
    setExcluindoPasta(true);
    try {
      const res = await baseConhecimentoAPI.excluirPasta(pastaParaExcluir.id, true);
      if (res.success) {
        showToast('success', MENSAGENS.PASTA_EXCLUIDA);
        setPastaParaExcluir(null);
        if (pastaSelecionada === pastaParaExcluir.id) setPastaSelecionada(null);
        await carregarPastas();
      } else {
        showToast('error', res.error || MENSAGENS.ERRO_EXCLUIR_PASTA);
      }
    } catch (err) {
      showToast('error', err.message || MENSAGENS.ERRO_EXCLUIR_PASTA);
    } finally {
      setExcluindoPasta(false);
    }
  }, [pastaParaExcluir, pastaSelecionada, showToast, carregarPastas]);

  const handleSalvar = useCallback(async (isAutoSave = false) => {
    // Garantir que isAutoSave seja booleano, pois onClick passa um evento
    const isAutoSaveBool = typeof isAutoSave === 'boolean' ? isAutoSave : false;

    if (!pastaSelecionada) {
      if (!isAutoSaveBool) showToast('warning', 'Selecione uma pasta.');
      return;
    }

    // Se for auto-save, limpar o timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const trim = (conteudo || '').trim();

    // Se for auto-save e não mudou nada em relação ao último salvo, não faz nada
    if (isAutoSaveBool && trim === (lastSavedConteudo || '').trim()) {
      return;
    }

    if (!trim) {
      if (!isAutoSaveBool) showToast('warning', MENSAGENS.CONTEUDO_VAZIO);
      return;
    }

    setSalvando(true);
    try {
      if (currentAnexoId) {
        let snapshotBeforeUrl = null;
        if (!isAutoSaveBool && docPageRef.current) {
          try {
            const canvas = await html2canvas(docPageRef.current, {
              useCORS: true,
              allowTaint: true,
              scale: 1,
              logging: false
            });
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
            if (blob) {
              const file = new File([blob], 'snapshot.png', { type: 'image/png' });
              const formData = new FormData();
              formData.append('file', file);
              const resUp = await comunicacaoAPI.uploadMedia(formData);
              if (resUp?.success && resUp?.data?.url) snapshotBeforeUrl = resUp.data.url;
            }
          } catch (_) {
            /* ignora falha de screenshot; salva sem snapshot */
          }
        }
        const res = await baseConhecimentoAPI.atualizarAnexo(currentAnexoId, {
          titulo: null,
          conteudo: trim,
          snapshot_before_url: snapshotBeforeUrl || undefined
        });
        if (res.success) {
          if (!isAutoSaveBool) showToast('success', MENSAGENS.DOCUMENTOS_SALVO);
          else setLastAutoSaveTime(new Date());

          setLastSavedConteudo(trim);
          setHasUnsavedChanges(false);
        } else {
          if (!isAutoSaveBool) showToast('error', res.error || MENSAGENS.ERRO_ATUALIZAR);
        }
      } else {
        const res = await baseConhecimentoAPI.criarAnexo({ titulo: null, conteudo: trim, pasta_id: pastaSelecionada });
        if (res.success) {
          if (!isAutoSaveBool) showToast('success', MENSAGENS.SUCESSO);
          setLastSavedConteudo(trim);
          setHasUnsavedChanges(false);
          await carregarAnexosDaPasta(pastaSelecionada);
        }
      }
    } catch (err) {
      if (!isAutoSaveBool) showToast('error', err.message || MENSAGENS.ERRO_SALVAR);
    } finally {
      setSalvando(false);

      // Se for auto-save, limpar o tempo de feedback após 5 segundos
      if (isAutoSaveBool) {
        setTimeout(() => setLastAutoSaveTime(null), 5000);
      }
    }
  }, [conteudo, pastaSelecionada, currentAnexoId, showToast, carregarAnexosDaPasta, lastSavedConteudo]);


  const handleUploadTrigger = useCallback(() => fileInputRef.current?.click(), []);
  const handleFileSelect = useCallback(
    async (e) => {
      const files = e.target.files;
      if (!files?.length) return;
      const file = files[0];
      if (file.size > 50 * 1024 * 1024) {
        showToast('warning', MENSAGENS.ARQUIVO_GRANDE);
        e.target.value = '';
        return;
      }
      setUploadingMidia(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await comunicacaoAPI.uploadMedia(formData);
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
          showToast('success', MENSAGENS.ARQUIVO_ANEXADO);
          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }, 150);
        } else {
          showToast('error', res?.error || 'Falha no upload.');
        }
      } catch (err) {
        showToast('error', err.message || 'Falha no upload.');
      } finally {
        setUploadingMidia(false);
        e.target.value = '';
      }
    },
    [showToast]
  );

  const pastaSelecionadaObj = pastas.find((p) => p.id === pastaSelecionada);

  return (
    <Layout>
      <div className="container anexar-arquivo-page-wrapper">
        <main className="main-content">
          <CardContainer>
            <div className="anexar-arquivo-container">
              <PageHeader title="Tutoriais" subtitle="Organize e salve tutoriais em texto e mídia" />
              <div className="anexar-arquivo-layout">
                {/* Coluna esquerda: pastas */}
                <div className="anexar-arquivo-col-esq">
                  <div className="anexar-arquivo-pastas-header">
                    <button type="button" className="anexar-arquivo-btn-nova-pasta" onClick={handleAbrirFormNovaPasta} title="Novo">
                      <i className="fas fa-plus"></i> Novo
                    </button>
                  </div>
                  {carregandoPastas ? (
                    <div className="anexar-arquivo-loading"><i className="fas fa-spinner fa-spin"></i> Carregando...</div>
                  ) : pastas.length === 0 ? (
                    <div className="anexar-arquivo-empty-pastas">
                      <p>Nenhum item</p>
                      <button type="button" className="anexar-arquivo-btn-nova-pasta-small" onClick={handleAbrirFormNovaPasta}>
                        {MENSAGENS.CRIAR_PRIMEIRA_PASTA}
                      </button>
                    </div>
                  ) : (
                    <ul className="anexar-arquivo-pastas-list">
                      {pastas.map((pasta) => {
                        const estaRenomeando = pastaRenomeandoId === pasta.id;
                        return (
                          <li
                            key={pasta.id}
                            className={`anexar-arquivo-pasta-item ${pastaSelecionada === pasta.id ? 'active' : ''} ${estaRenomeando ? 'anexar-arquivo-pasta-item-editing' : ''}`}
                            onClick={() => !estaRenomeando && handleSelecionarPasta(pasta.id)}
                          >
                            {estaRenomeando ? (
                              <input
                                ref={editNomeInputRef}
                                type="text"
                                className="anexar-arquivo-pasta-nome-input"
                                value={nomeEmEdicao}
                                onChange={(e) => setNomeEmEdicao(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleSalvarRenomear(); }
                                  if (e.key === 'Escape') { e.preventDefault(); handleCancelarRenomear(); }
                                }}
                                onBlur={handleSalvarRenomear}
                                onClick={(e) => e.stopPropagation()}
                                disabled={salvandoPasta}
                                placeholder="Título"
                                aria-label="Novo título"
                              />
                            ) : (
                              <span className="anexar-arquivo-pasta-nome">{pasta.nome}</span>
                            )}
                            {!estaRenomeando && (
                              <div className="anexar-arquivo-pasta-actions">
                                <button type="button" className="anexar-arquivo-btn-edit" onClick={(ev) => { ev.stopPropagation(); handleAbrirFormEditarPasta(pasta); }} title="Editar nome">
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button type="button" className="anexar-arquivo-btn-delete" onClick={(ev) => { ev.stopPropagation(); handleAbrirModalExcluir(pasta); }} title="Excluir pasta">
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {/* Coluna direita: documento */}
                <div className="anexar-arquivo-col-dir">
                  {!pastaSelecionada ? (
                    <div className="anexar-arquivo-empty-doc">
                      <p>{MENSAGENS.SELECIONE_PASTA}</p>
                      {pastas.length === 0 && (
                        <button type="button" className="anexar-arquivo-btn-nova-pasta-primary" onClick={handleAbrirFormNovaPasta}>
                          {MENSAGENS.CRIAR_PRIMEIRA_PASTA}
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="anexar-arquivo-doc-bar">
                        <h3 className="anexar-arquivo-doc-bar-titulo">{pastaSelecionadaObj?.nome}</h3>
                        <div className="anexar-arquivo-doc-bar-actions">
                          {lastAutoSaveTime && (
                            <span style={{
                              fontSize: '13px',
                              color: '#10b981',
                              marginRight: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <i className="fas fa-check-circle"></i>
                              Salvo automaticamente
                            </span>
                          )}
                          <button type="button" className="anexar-arquivo-btn-historico" onClick={() => setMostrarHistorico(true)} title="Histórico de edições">
                            <i className="fas fa-history"></i> Histórico
                          </button>
                          <ButtonPrimary onClick={() => handleSalvar(false)} disabled={salvando} className="anexar-arquivo-btn-salvar" icon={salvando ? 'fas fa-spinner fa-spin' : 'fas fa-save'}>
                            {salvando ? 'Salvando...' : 'Salvar'}
                          </ButtonPrimary>
                        </div>
                      </div>
                      {carregandoAnexos ? (
                        <div className="anexar-arquivo-loading anexar-arquivo-loading-doc"><i className="fas fa-spinner fa-spin"></i> Carregando documento...</div>
                      ) : (
                        <div className="anexar-arquivo-doc-page">
                          <div ref={docPageRef} className="anexar-arquivo-doc-page-inner">
                            <RichTextEditor
                              ref={richEditorRef}
                              value={conteudo}
                              onChange={(v) => setConteudo((prev) => (String(prev ?? '') === String(v ?? '') ? prev : v))}
                              placeholder="Digite aqui. Use a barra de ferramentas para formatar, ou anexe imagens e vídeos pelo botão da nuvem."
                              minHeight={420}
                            />
                            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="anexar-arquivo-upload-input" onChange={handleFileSelect} />
                            <div className="anexar-arquivo-doc-upload-wrap">
                              <button type="button" className="anexar-arquivo-doc-upload-btn" onClick={handleUploadTrigger} disabled={uploadingMidia} title="Anexar imagem ou vídeo">
                                {uploadingMidia ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-cloud-upload-alt" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContainer>
        </main>
      </div>

      {/* Modal Criar/Editar Pasta */}
      {mostrarFormPasta && (
        <div className="modal-overlay anexar-arquivo-modal-overlay" onClick={handleFecharFormPasta}>
          <div className="modal-content anexar-arquivo-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{pastaEditando ? 'Editar título' : 'Novo'}</h3>
              <button type="button" className="btn-icon" onClick={handleFecharFormPasta} disabled={salvandoPasta} title="Fechar"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleSalvarPasta} className="modal-body">
              <div className="form-group">
                <label>Título <span className="required">*</span></label>
                <input type="text" value={formPastaNome} onChange={(e) => setFormPastaNome(e.target.value)} placeholder="Ex.: Como utilizar..." disabled={salvandoPasta} autoFocus />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={handleFecharFormPasta} disabled={salvandoPasta}>Cancelar</button>
                <ButtonPrimary type="submit" disabled={salvandoPasta} icon={salvandoPasta ? 'fas fa-spinner fa-spin' : 'fas fa-check'}>{salvandoPasta ? 'Salvando...' : 'Salvar'}</ButtonPrimary>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Excluir Pasta */}
      {pastaParaExcluir && (
        <div className="modal-overlay anexar-arquivo-modal-overlay" onClick={handleFecharModalExcluir}>
          <div className="modal-content anexar-arquivo-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{MENSAGENS.EXCLUIR_PASTA_TITULO}</h3>
              <button type="button" className="btn-icon" onClick={handleFecharModalExcluir} disabled={excluindoPasta} title="Fechar"><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p>{MENSAGENS.EXCLUIR_PASTA_TEXTO}</p>
              <p><strong>{pastaParaExcluir.nome}</strong></p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={handleFecharModalExcluir} disabled={excluindoPasta}>Cancelar</button>
              <ButtonPrimary onClick={handleExcluirPasta} disabled={excluindoPasta} icon={excluindoPasta ? 'fas fa-spinner fa-spin' : 'fas fa-trash'}>Excluir tudo</ButtonPrimary>
            </div>
          </div>
        </div>
      )}

      <TutorialHistory isOpen={mostrarHistorico} onClose={() => setMostrarHistorico(false)} pastaId={pastaSelecionada} pastaNome={pastaSelecionadaObj?.nome} />

      {/* Modal de confirmação do sistema para alterações não salvas */}
      <ConfirmModal
        isOpen={showConfirmSair}
        onClose={() => {
          setShowConfirmSair(false);
          setPendenteNovaPastaId(null);
        }}
        onConfirm={confirmarMudarPasta}
        title="Alterações não salvas"
        message="Existem alterações que ainda não foram salvas. Se você mudar agora, as alterações recentes podem ser perdidas. Deseja continuar?"
        confirmText="Sim, mudar"
        cancelText="Continuar editando"
        confirmButtonClass="btn-primary"
      />
    </Layout>
  );
};

export default AnexarArquivo;
