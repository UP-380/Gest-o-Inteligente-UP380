import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import '../../styles/global.css';

const Painel = () => {
  const navigate = useNavigate();

  const navigateToClientes = () => {
    navigate('/dashboard-clientes');
  };

  const navigateToConfiguracaoClientes = () => {
    navigate('/carteira-clientes');
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
                <div className="dashboard-card-arrow">
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
                  <i className="fas fa-cog"></i>
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

