import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import Painel from './pages/Painel/Painel';
import DashboardClientes from './pages/DashboardClientes/DashboardClientes';
import CarteiraClientes from './pages/CarteiraClientes/CarteiraClientes';
import CadastroColaboradores from './pages/CadastroColaboradores/CadastroColaboradores';
import CustoMembroVigencia from './pages/CustoMembroVigencia/CustoMembroVigencia';
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
              <Navigate to="/dashboard-clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard-clientes"
          element={
            <ProtectedRoute>
              <DashboardClientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/carteira-clientes"
          element={
            <ProtectedRoute>
              <CarteiraClientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro-colaboradores"
          element={
            <ProtectedRoute>
              <CadastroColaboradores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/custo-membro-vigencia"
          element={
            <ProtectedRoute>
              <CustoMembroVigencia />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;

