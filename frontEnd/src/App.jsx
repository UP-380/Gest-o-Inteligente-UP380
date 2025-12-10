import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import Painel from './pages/Painel/Painel';
import RelatoriosClientes from './pages/DashboardClientes/DashboardClientes';
import RelatoriosColaboradores from './pages/DashboardColaboradores/DashboardColaboradores';
import GestaoClientes from './pages/CarteiraClientes/CarteiraClientes';
import GestaoColaboradores from './pages/ConfiguracoesColaboradores/ConfiguracoesColaboradores';
import ConfigCustoMembro from './pages/ConfigCustoMembro/ConfigCustoMembro';
import CadastroAtividades from './pages/CadastroAtividades/CadastroAtividades';
import CadastroProdutos from './pages/CadastroProdutos/CadastroProdutos';
import CadastroTipoAtividades from './pages/CadastroTipoAtividades/CadastroTipoAtividades';
import CadastroVinculacoes from './pages/CadastroVinculacoes/CadastroVinculacoes';
import ConfiguracoesPerfil from './pages/ConfiguracoesPerfil/ConfiguracoesPerfil';
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
        {/* Redirecionamentos de URLs antigas */}
        <Route
          path="/carteira-clientes"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao-clientes"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro-clientes"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/clientes" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao-colaboradores"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/colaboradores" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro-colaboradores"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/colaboradores" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes/custo-colaborador"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/custo-colaborador" replace />
            </ProtectedRoute>
          }
        />
        {/* Rotas de cadastro */}
        <Route
          path="/cadastro/clientes"
          element={
            <ProtectedRoute>
              <GestaoClientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/colaboradores"
          element={
            <ProtectedRoute>
              <GestaoColaboradores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/custo-colaborador"
          element={
            <ProtectedRoute>
              <ConfigCustoMembro />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tarefas"
          element={
            <ProtectedRoute>
              <CadastroAtividades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/produtos"
          element={
            <ProtectedRoute>
              <CadastroProdutos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tipo-tarefas"
          element={
            <ProtectedRoute>
              <CadastroTipoAtividades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/vinculacoes"
          element={
            <ProtectedRoute>
              <CadastroVinculacoes />
            </ProtectedRoute>
          }
        />
        {/* Redirecionamentos de URLs antigas */}
        <Route
          path="/cadastro/atividades"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/tarefas" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tipo-atividades"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/tipo-tarefas" replace />
            </ProtectedRoute>
          }
        />
        {/* Redirecionamentos de URLs antigas de catálogo */}
        <Route
          path="/catalogo/atividades"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/tarefas" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogo/produtos"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/produtos" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogo/tipo-atividades"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/tipo-tarefas" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogo/vinculacoes"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/vinculacoes" replace />
            </ProtectedRoute>
          }
        />
        {/* Rota de configurações de perfil */}
        <Route
          path="/configuracoes/perfil"
          element={
            <ProtectedRoute>
              <ConfiguracoesPerfil />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;

