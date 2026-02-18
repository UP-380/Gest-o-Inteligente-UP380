/**
 * Histórico da página Tutoriais: logs de alterações (tutorial_logs).
 * Exibe tabela com Data, Responsável e Alteração (formatada).
 * Para alterações (UPDATE), permite expandir e ver preview do documento ANTES da alteração.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { baseConhecimentoAPI } from '../../services/api';
import { markdownToHtml } from '../../utils/richEditorMarkdown';
import './TutorialHistory.css';

function formatarData(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatarAlteracao(log) {
  const tipo = log.action_type;
  const changes = log.changes_json || {};
  const oldVal = changes.old;
  const newVal = changes.new;

  if (tipo === 'CREATE') {
    return 'Tutorial criado';
  }
  if (tipo === 'DELETE') {
    return 'Tutorial excluído';
  }
  if (tipo === 'UPDATE') {
    const partes = [];
    if (oldVal && newVal) {
      if (oldVal.titulo !== newVal.titulo) {
        partes.push(`Título: "${oldVal.titulo || ''}" → "${newVal.titulo || ''}"`);
      }
      if (oldVal.conteudo !== newVal.conteudo) {
        partes.push('Conteúdo alterado');
      }
      if (oldVal.pasta_id !== newVal.pasta_id) {
        partes.push('Pasta alterada');
      }
    }
    return partes.length ? partes.join('; ') : 'Tutorial atualizado';
  }
  return tipo || '—';
}

/** Retorna se este log tem estado "antes" para exibir preview (UPDATE com changes_json.old ou snapshot_before_url). */
function temPreviewAntes(log) {
  if (log.action_type !== 'UPDATE') return false;
  const cj = log.changes_json;
  return (cj?.old != null) || (cj?.snapshot_before_url != null && cj.snapshot_before_url !== '');
}

/** Conteúdo para exibição visual: se já for HTML, retorna como está; senão converte markdown → HTML. */
function conteudoParaVisual(conteudo) {
  if (conteudo == null || conteudo === '') return '';
  const s = String(conteudo).trim();
  if (s.startsWith('<')) return s;
  return markdownToHtml(s);
}

const TutorialHistory = ({ isOpen, onClose, pastaId = null, pastaNome = null }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const carregar = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const resLogs = await baseConhecimentoAPI.getTutorialLogs(200, pastaId);
      if (resLogs.success) setLogs(resLogs.data || []);
      else setError(resLogs.error || 'Erro ao carregar logs');
    } catch (err) {
      setError(err.message || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [isOpen, pastaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="tutorial-history-overlay" onClick={onClose}>
      <div className="tutorial-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-history-header">
          <h2>Histórico{pastaNome ? ` – ${pastaNome}` : ' – Tutoriais'}</h2>
          <button type="button" className="tutorial-history-close" onClick={onClose} title="Fechar">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="tutorial-history-body">
          {loading ? (
            <div className="tutorial-history-loading">
              <i className="fas fa-spinner fa-spin"></i> Carregando...
            </div>
          ) : error ? (
            <div className="tutorial-history-error">{error}</div>
          ) : (
            <div className="tutorial-history-table-wrap">
              <table className="tutorial-history-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Responsável</th>
                    <th>Alteração</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="tutorial-history-empty">Nenhum registro de alteração.</td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const oldVal = log.changes_json?.old;
                      const expanded = expandedLogId === log.id;
                      const showPreviewBtn = temPreviewAntes(log);
                      return (
                        <React.Fragment key={log.id}>
                          <tr className={expanded ? 'tutorial-history-row-expanded' : ''}>
                            <td>{formatarData(log.created_at)}</td>
                            <td>{log.user_email || (log.user_id != null ? `Usuário #${log.user_id}` : '—')}</td>
                            <td>
                              <span className="tutorial-history-alteracao-text">{formatarAlteracao(log)}</span>
                              {showPreviewBtn && (
                                <button
                                  type="button"
                                  className="tutorial-history-preview-btn"
                                  onClick={(e) => { e.stopPropagation(); setExpandedLogId((id) => (id === log.id ? null : log.id)); }}
                                  title={expanded ? 'Ocultar preview' : 'Ver documento antes da alteração'}
                                >
                                  {expanded ? (
                                    <><i className="fas fa-eye-slash"></i> Ocultar preview</>
                                  ) : (
                                    <><i className="fas fa-eye"></i> Ver documento antes</>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expanded && (oldVal || log.changes_json?.snapshot_before_url) && (
                            <tr className="tutorial-history-detail-row">
                              <td colSpan="3" className="tutorial-history-preview-cell">
                                <div className="tutorial-history-preview-box">
                                  <div className="tutorial-history-preview-title">Documento antes da alteração</div>
                                  {log.changes_json?.snapshot_before_url ? (
                                    <img
                                      src={log.changes_json.snapshot_before_url}
                                      alt="Documento antes"
                                      className="tutorial-history-preview-screenshot"
                                    />
                                  ) : null}
                                  {oldVal?.titulo != null && oldVal.titulo !== '' && (
                                    <div className="tutorial-history-preview-doc-title">{oldVal.titulo}</div>
                                  )}
                                  {oldVal && !log.changes_json?.snapshot_before_url && (
                                    <div
                                      className="tutorial-history-preview-content tutorial-history-preview-content-visual"
                                      dangerouslySetInnerHTML={{
                                        __html: conteudoParaVisual(oldVal.conteudo)
                                      }}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialHistory;
