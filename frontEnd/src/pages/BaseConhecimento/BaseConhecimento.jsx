import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import PageHeader from '../../components/common/PageHeader';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import { usePermissions } from '../../hooks/usePermissions';
import './BaseConhecimento.css';

const BaseConhecimento = () => {
  const navigate = useNavigate();
  const { canAccessRoute } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');

  const categorias = [
    {
      id: 1,
      titulo: 'Como Usar o Sistema',
      icon: 'fa-question-circle',
      color: '#3b82f6',
      artigos: [
        { id: 1, titulo: 'Primeiros Passos', descricao: 'Aprenda a navegar pelo sistema' },
        { id: 2, titulo: 'Cadastro de Clientes', descricao: 'Como cadastrar e gerenciar clientes' },
        { id: 3, titulo: 'Gestão de Colaboradores', descricao: 'Gerenciamento de colaboradores e vigências' }
      ]
    },
    {
      id: 2,
      titulo: 'Relatórios',
      icon: 'fa-chart-bar',
      color: '#10b981',
      artigos: [
        { id: 4, titulo: 'Relatórios de Clientes', descricao: 'Como gerar e interpretar relatórios' },
        { id: 5, titulo: 'Relatórios de Colaboradores', descricao: 'Análise de desempenho e custos' }
      ]
    },
    {
      id: 3,
      titulo: 'Configurações',
      icon: 'fa-cog',
      color: '#8b5cf6',
      artigos: [
        { id: 6, titulo: 'Configurações de Custo', descricao: 'Como configurar custos de colaboradores' },
        { id: 7, titulo: 'Vinculações', descricao: 'Gerenciar vinculações entre entidades' }
      ]
    },
    {
      id: 4,
      titulo: 'Perguntas Frequentes',
      icon: 'fa-lightbulb',
      color: '#f59e0b',
      artigos: [
        { id: 8, titulo: 'Dúvidas Comuns', descricao: 'Respostas para as perguntas mais frequentes' },
        { id: 9, titulo: 'Solução de Problemas', descricao: 'Como resolver problemas comuns' }
      ]
    }
  ];

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            <div className="base-conhecimento-container">
              <PageHeader
                title="Base de Conhecimento"
                subtitle="Encontre respostas e aprenda a usar o sistema"
              />

              {/* Barra de Busca */}
              <div className="search-container" style={{ marginBottom: '32px' }}>
                <div style={{ position: 'relative', maxWidth: '600px', margin: '0 auto' }}>
                  <i className="fas fa-search" style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#94a3b8',
                    fontSize: '16px'
                  }}></i>
                  <input
                    type="text"
                    className="search-input"
                    value={searchTerm}
                    onChange={handleSearch}
                    placeholder="Buscar artigos, tutoriais..."
                    style={{
                      width: '100%',
                      padding: '14px 16px 14px 48px',
                      border: '1px solid #e0e7ff',
                      borderRadius: '8px',
                      fontSize: '14px',
                      transition: 'all 0.2s'
                    }}
                  />
                </div>
              </div>

              {/* Seção de Tutoriais (Apresentação) - só exibe se tiver permissão */}
              {canAccessRoute('/base-conhecimento/tutoriais-apresentacao') && (
              <div style={{
                marginBottom: '24px',
                padding: '24px',
                backgroundColor: '#f0fdf4',
                borderRadius: '12px',
                border: '2px solid #22c55e'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      backgroundColor: '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '24px'
                    }}>
                      <i className="fas fa-book-open"></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0', color: '#1f2937' }}>
                        Tutoriais e Guias
                      </h3>
                      <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                        Acesse nossa central de aprendizado com guias interativos
                      </p>
                    </div>
                  </div>
                  <ButtonPrimary
                    onClick={() => navigate('/base-conhecimento/tutoriais-apresentacao')}
                    icon="fa-book-open"
                    label="Abrir Central"
                    style={{
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: '600',
                      backgroundColor: '#22c55e',
                      borderColor: '#16a34a'
                    }}
                  />
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
                    <i className="fas fa-check-circle" style={{ marginRight: '8px', color: '#22c55e' }}></i>
                    Visualize todos os tutoriais disponíveis de forma organizada e limpa.
                    Ideal para consulta rápida de procedimentos, utilização de ferramentas
                    e treinamentos internos, com suporte a imagens e vídeos.
                  </p>
                </div>
              </div>
              )}

              {/* Seção de Conteúdos dos Clientes */}
              <div style={{
                marginBottom: '32px',
                padding: '24px',
                backgroundColor: '#eff6ff',
                borderRadius: '12px',
                border: '2px solid #3b82f6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      backgroundColor: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '24px'
                    }}>
                      <i className="fas fa-briefcase"></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0', color: '#1f2937' }}>
                        Conteúdos dos Clientes
                      </h3>
                      <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                        Demonstre e publique conteúdos relacionados aos clientes
                      </p>
                    </div>
                  </div>
                  <ButtonPrimary
                    onClick={() => navigate('/base-conhecimento/conteudos-clientes')}
                    icon="fa-external-link-alt"
                    label="Ver Clientes"
                    style={{
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}
                  />
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe'
                }}>
                  <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
                    <i className="fas fa-info-circle" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                    Visualize um template único que consome automaticamente os dados já cadastrados do cliente,
                    incluindo dados básicos, acessos de sistema, contas bancárias e adquirentes.
                    Todas as informações são exibidas de forma organizada e consolidada.
                  </p>
                </div>
              </div>

              {/* Seção de Notas de Atualização (Apresentação) - só exibe se tiver permissão */}
              {canAccessRoute('/base-conhecimento/notas-atualizacao-apresentacao') && (
              <div style={{
                marginBottom: '32px',
                padding: '24px',
                backgroundColor: '#f5f3ff',
                borderRadius: '12px',
                border: '2px solid #8b5cf6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      backgroundColor: '#8b5cf6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '24px'
                    }}>
                      <i className="fas fa-history"></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0', color: '#1f2937' }}>
                        Notas de Atualização
                      </h3>
                      <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                        Fique por dentro das novidades e melhorias do sistema
                      </p>
                    </div>
                  </div>
                  <ButtonPrimary
                    onClick={() => navigate('/base-conhecimento/notas-atualizacao-apresentacao')}
                    icon="fa-clipboard-check"
                    label="Ver Versões"
                    style={{
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: '600',
                      backgroundColor: '#8b5cf6',
                      borderColor: '#7c3aed'
                    }}
                  />
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #ddd6fe'
                }}>
                  <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
                    <i className="fas fa-check-circle" style={{ marginRight: '8px', color: '#8b5cf6' }}></i>
                    Acompanhe o histórico completo de evoluções da plataforma.
                    Confira novas funcionalidades, correções de bugs e otimizações
                    realizadas pela equipe de engenharia.
                  </p>
                </div>
              </div>
              )}

              {/* Grid de Categorias */}
              <div className="categorias-grid">
                {categorias.map((categoria) => (
                  <div key={categoria.id} className="categoria-card">
                    <div className="categoria-header" style={{ borderLeftColor: categoria.color }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '12px',
                          backgroundColor: `${categoria.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: categoria.color,
                          fontSize: '20px'
                        }}>
                          <i className={`fas ${categoria.icon}`}></i>
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#1f2937' }}>
                          {categoria.titulo}
                        </h3>
                      </div>
                    </div>
                    <div className="artigos-list">
                      {categoria.artigos.map((artigo) => (
                        <div key={artigo.id} className="artigo-item">
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <i className="fas fa-file-alt" style={{ color: '#94a3b8', marginTop: '4px' }}></i>
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0', color: '#374151' }}>
                                {artigo.titulo}
                              </h4>
                              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                                {artigo.descricao}
                              </p>
                            </div>
                            <i className="fas fa-chevron-right" style={{ color: '#cbd5e1', fontSize: '12px' }}></i>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Seção de Ajuda Rápida */}
              <div style={{
                marginTop: '32px',
                padding: '24px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <i className="fas fa-headset" style={{ fontSize: '24px', color: '#3b82f6' }}></i>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Precisa de Ajuda?</h3>
                </div>
                <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px 0' }}>
                  Não encontrou o que procurava? Entre em contato com o suporte.
                </p>
                <button
                  className="btn-primary"
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fas fa-envelope"></i>
                  Contatar Suporte
                </button>
              </div>
            </div>
          </CardContainer>
        </main>
      </div>
    </Layout>
  );
};

export default BaseConhecimento;

