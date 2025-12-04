import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import Painel from './pages/Painel/Painel';
import RelatoriosClientes from './pages/DashboardClientes/DashboardClientes';
import RelatoriosColaboradores from './pages/DashboardColaboradores/DashboardColaboradores';
import GestaoClientes from './pages/CarteiraClientes/CarteiraClientes';
import GestaoColaboradores from './pages/ConfiguracoesColaboradores/ConfiguracoesColaboradores';
import ConfigCustoMembro from './pages/ConfigCustoMembro/ConfigCustoMembro';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/painel"
          element={
            <ProtectedRoute>
              <Painel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <Navigate to="/relatorios-clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard-clientes"
          element={
            <ProtectedRoute>
              <Navigate to="/relatorios-clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorios-clientes"
          element={
            <ProtectedRoute>
              <RelatoriosClientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard-colaboradores"
          element={
            <ProtectedRoute>
              <Navigate to="/relatorios-colaboradores" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorios-colaboradores"
          element={
            <ProtectedRoute>
              <RelatoriosColaboradores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/carteira-clientes"
          element={
            <ProtectedRoute>
              <Navigate to="/gestao-clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao-clientes"
          element={
            <ProtectedRoute>
              <GestaoClientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro-colaboradores"
          element={
            <ProtectedRoute>
              <Navigate to="/gestao-colaboradores" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao-colaboradores"
          element={
            <ProtectedRoute>
              <GestaoColaboradores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/custo-colaborador"
          element={
            <ProtectedRoute>
              <ConfigCustoMembro />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;

