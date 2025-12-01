import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import '../../styles/global.css';

const Painel = () => {
  const navigate = useNavigate();

  const navigateToClientes = () => {
    navigate('/relatorios-clientes');
  };

  const navigateToConfiguracaoClientes = () => {
    navigate('/gestao-clientes');
  };

  const navigateToColaboradores = () => {
    navigate('/relatorios-colaboradores');
  };

  const navigateToConfiguracaoColaboradores = () => {
    navigate('/gestao-colaboradores');
  };

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <div className="form-header">
            <h2 className="form-title">Painel</h2>
          </div>
          
          {/* Painel Cards */}
          <div className="dashboard-content">
            <div className="dashboard-cards">
              <div className="dashboard-card" onClick={navigateToClientes}>
                <div className="dashboard-card-icon">
                  <i className="fas fa-users"></i>
                </div>
                <div className="dashboard-card-content">
                  <h3>CLIENTES</h3>
                  <p>Gerenciar clientes e visualizar informações</p>
                </div>
                <div 
                  className="dashboard-card-arrow" 
                  title="Ir para Relatórios de Clientes"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToClientes();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <i className="fas fa-chevron-right"></i>
                </div>
                <button 
                  className="dashboard-card-settings-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToConfiguracaoClientes();
                  }} 
                  title="Configuração de Clientes"
                >
                  <i className="fas fa-briefcase"></i>
                </button>
              </div>
              
              <div className="dashboard-card" onClick={navigateToColaboradores}>
                <div className="dashboard-card-icon">
                  <i className="fas fa-user-tie"></i>
                </div>
                <div className="dashboard-card-content">
                  <h3>COLABORADORES</h3>
                  <p>Gerenciar colaboradores e visualizar informações</p>
                </div>
                <div 
                  className="dashboard-card-arrow" 
                  title="Ir para Relatórios de Colaboradores"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToColaboradores();
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <i className="fas fa-chevron-right"></i>
                </div>
                <button 
                  className="dashboard-card-settings-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToConfiguracaoColaboradores();
                  }} 
                  title="Configuração de Colaboradores"
                >
                  <i className="fas fa-briefcase"></i>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default memo(Painel);

