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
                            <div className="gestao-title-area">
                                <h1>Gestão de Equipamentos</h1>
                                <p>Controle de atribuições, estado e histórico de ativos.</p>
                            </div>

                            <nav className="gestao-tabs">
                                <NavLink to="/gestao-equipamentos" end className={({ isActive }) => isActive ? "tab-item active" : "tab-item"}>
                                    <i className="fas fa-chart-line"></i> Dashboard
                                </NavLink>
                                <NavLink to="/gestao-equipamentos/inventario" className={({ isActive }) => isActive ? "tab-item active" : "tab-item"}>
                                    <i className="fas fa-microchip"></i> Inventário de Gestão
                                </NavLink>
                                <NavLink to="/gestao-equipamentos/operadores" className={({ isActive }) => isActive ? "tab-item active" : "tab-item"}>
                                    <i className="fas fa-users-cog"></i> Operadores
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
