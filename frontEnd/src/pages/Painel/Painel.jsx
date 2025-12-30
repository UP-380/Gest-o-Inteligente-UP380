import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import './Painel.css';

const Painel = () => {
  const navigate = useNavigate();

  const menuSections = [
    {
      id: 'relatorios',
      title: 'Relatórios',
      icon: 'fa-file-alt',
      items: [
        {
          label: 'Relatórios de Clientes',
          path: '/relatorios-clientes',
          icon: 'fa-users'
        },
        {
          label: 'Relatórios de Colaboradores',
          path: '/relatorios-colaboradores',
          icon: 'fa-user-tie'
        }
      ]
    },
    {
      id: 'cadastros',
      title: 'Cadastros',
      icon: 'fa-database',
      items: [
        {
          label: 'Clientes',
          path: '/cadastro/clientes',
          icon: 'fa-briefcase'
        },
        {
          label: 'Colaboradores',
          path: '/cadastro/colaboradores',
          icon: 'fa-user-cog'
        },
        {
          label: 'Produtos',
          path: '/cadastro/produtos',
          icon: 'fa-box'
        },
        {
          label: 'Tarefas',
          path: '/cadastro/tarefas',
          icon: 'fa-tasks'
        },
        {
          label: 'Subtarefas',
          path: '/cadastro/subtarefas',
          icon: 'fa-list-ul'
        },
        {
          label: 'Tipo de Tarefas',
          path: '/cadastro/tipo-tarefas',
          icon: 'fa-list-alt'
        },
        {
          label: 'Banco',
          path: '/cadastro/bancos',
          icon: 'fa-university'
        },
        {
          label: 'Adquirente',
          path: '/cadastro/adquirentes',
          icon: 'fa-credit-card'
        },
        {
          label: 'Sistemas',
          path: '/cadastro/sistemas',
          icon: 'fa-server'
        }
      ]
    },
    {
      id: 'configuracoes',
      title: 'Configurações',
      icon: 'fa-cog',
      items: [
        {
          label: 'Custo Colaborador',
          path: '/cadastro/custo-colaborador',
          icon: 'fa-dollar-sign'
        },
        {
          label: 'Vinculações',
          path: '/cadastro/vinculacoes',
          icon: 'fa-link'
        }
      ]
    }
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content painel-main">
          <div className="painel-header">
            <div className="painel-header-content">
              <h1 className="painel-title">Painel Principal</h1>
              <p className="painel-subtitle">Acesse rapidamente as principais funcionalidades do sistema</p>
            </div>
          </div>
          
          <div className="painel-grid">
            {menuSections.map((section) => (
              <div key={section.id} className="painel-section-card">
                <div className="painel-section-header">
                  <i className={`fas ${section.icon}`}></i>
                  <h2 className="painel-section-title">{section.title}</h2>
                </div>
                
                <div className={`painel-section-items ${section.items.length > 2 ? 'custom-scrollbar' : ''}`}>
                  {section.items.map((item, index) => (
                    <div
                      key={index}
                      className="painel-item-card"
                      onClick={() => handleCardClick(item.path)}
                    >
                      <i className={`fas ${item.icon}`}></i>
                      <span className="painel-item-label">{item.label}</span>
                      <i className="fas fa-chevron-right painel-item-arrow"></i>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default memo(Painel);

