import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import './GestaoEquipamentosLayout.css';

const GestaoEquipamentosLayout = () => {
    return (
        <Layout>
            <div className="container">
                <main className="main-content">
                    <div className="gestao-equipamentos-container">
                        <header className="gestao-header">
                            <div className="gestao-equipamentos-header-content">
                                <div className="gestao-equipamentos-header-left">
                                    <div className="gestao-equipamentos-header-icon">
                                        <i className="fas fa-tasks" style={{ fontSize: '32px', color: 'rgb(14, 59, 111)' }}></i>
                                    </div>
                                    <div>
                                        <h1 className="gestao-equipamentos-title">Gestão de Equipamentos</h1>
                                        <p className="gestao-equipamentos-subtitle">Controle de atribuições, estado e histórico de ativos.</p>
                                    </div>
                                </div>
                            </div>

                            <nav className="gestao-tabs">
                                <NavLink to="/gestao-equipamentos" end className={({ isActive }) => isActive ? "tab-item active" : "tab-item"}>
                                    <i className="fas fa-chart-line"></i> Dashboard
                                </NavLink>
                                <NavLink to="/gestao-equipamentos/inventario" className={({ isActive }) => isActive ? "tab-item active" : "tab-item"}>
                                    <i className="fas fa-microchip"></i> Inventário de Gestão
                                </NavLink>
                                <NavLink to="/gestao-equipamentos/operadores" className={({ isActive }) => isActive ? "tab-item active" : "tab-item"}>
                                    <i className="fas fa-users-cog"></i> Responsáveis
                                </NavLink>
                            </nav>
                        </header>

                        <main className="gestao-content">
                            <Outlet />
                        </main>
                    </div>
                </main>
            </div>
        </Layout>
    );
};

export default GestaoEquipamentosLayout;
