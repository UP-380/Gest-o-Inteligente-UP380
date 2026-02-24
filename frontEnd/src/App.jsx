import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import Login from './pages/Login/Login';
import PainelUsuario from './pages/PainelUsuario/PainelUsuario';
import RelatoriosClientes from './pages/DashboardClientes/DashboardClientes';
import RelatoriosColaboradores from './pages/DashboardColaboradores/DashboardColaboradores';
import CadastroClientes from './pages/CadastroClientes/CadastroClientes';
import GestaoColaboradores from './pages/ConfiguracoesColaboradores/ConfiguracoesColaboradores';
import ConfigCustoMembro from './pages/ConfigCustoMembro/ConfigCustoMembro';
import CadastroColaborador from './pages/CadastroColaborador/CadastroColaborador';
import CadastroVigencia from './pages/CadastroVigencia/CadastroVigencia';
import ListaVigencias from './pages/ListaVigencias/ListaVigencias';
import RelatorioVigencias from './pages/RelatorioVigencias/RelatorioVigencias';
import EditarConfigCusto from './pages/EditarConfigCusto/EditarConfigCusto';
import CadastroProdutos from './pages/CadastroProdutos/CadastroProdutos';
import CadastroProdutoIndividual from './pages/CadastroProdutoIndividual/CadastroProdutoIndividual';
import CadastroTarefas from './pages/CadastroTarefas/CadastroTarefas';
import CadastroTarefaIndividual from './pages/CadastroTarefaIndividual/CadastroTarefaIndividual';
import CadastroSubtarefas from './pages/CadastroSubtarefas/CadastroSubtarefas';
import CadastroSubtarefaIndividual from './pages/CadastroSubtarefaIndividual/CadastroSubtarefaIndividual';
import CadastroTipoTarefas from './pages/CadastroTipoTarefas/CadastroTipoTarefas';
import CadastroTipoTarefaIndividual from './pages/CadastroTipoTarefaIndividual/CadastroTipoTarefaIndividual';
import CadastroStatusTarefas from './pages/CadastroStatusTarefas/CadastroStatusTarefas';
import CadastroStatusTarefaIndividual from './pages/CadastroStatusTarefaIndividual/CadastroStatusTarefaIndividual';
import CadastroTipoContratos from './pages/CadastroTipoContratos/CadastroTipoContratos';
import CadastroTipoContrato from './pages/CadastroTipoContrato/CadastroTipoContrato';
import CadastroVinculacoes from './pages/CadastroVinculacoes/CadastroVinculacoes';
import CadastroVinculacao from './pages/CadastroVinculacao/CadastroVinculacao';
import NovaVinculacao from './pages/Vinculacoes/NovaVinculacao';
import CadastroBanco from './pages/CadastroBancos/CadastroBanco';
import CadastroBancoIndividual from './pages/CadastroBancoIndividual/CadastroBancoIndividual';
import CadastroAdquirente from './pages/CadastroAdquirente/CadastroAdquirente';
import CadastroAdquirenteIndividual from './pages/CadastroAdquirenteIndividual/CadastroAdquirenteIndividual';
import CadastroSistemas from './pages/CadastroSistemas/CadastroSistemas';
import CadastroSistemaIndividual from './pages/CadastroSistemaIndividual/CadastroSistemaIndividual';
import CadastroContatoCliente from './pages/CadastroContatoCliente/CadastroContatoCliente';
import GestaoCapacidade from './pages/GestaoCapacidade/GestaoCapacidade';
import HistoricoAtribuicoes from './pages/HistoricoAtribuicoes/HistoricoAtribuicoes';
import ConfiguracoesPerfil from './pages/ConfiguracoesPerfil/ConfiguracoesPerfil';
import BaseConhecimento from './pages/BaseConhecimento/BaseConhecimento';
import ConteudosClientes from './pages/ConteudosClientes/ConteudosClientes';
import AnexarArquivo from './pages/AnexarArquivo/AnexarArquivo';
import NotasAtualizacao from './pages/NotasAtualizacao/NotasAtualizacao';
import BaseConhecimentoCliente from './pages/BaseConhecimentoCliente/BaseConhecimentoCliente';
import CadastroCliente from './pages/CadastroCliente/CadastroCliente';
import DocumentacaoAPI from './pages/DocumentacaoAPI/DocumentacaoAPI';
import AtribuicaoCliente from './pages/AtribuicaoCliente/AtribuicaoCliente';
import GestaoUsuarios from './pages/GestaoUsuarios/GestaoUsuarios';
import ConfigPermissoes from './pages/ConfigPermissoes/ConfigPermissoes';
import PlanilhaHoras from './pages/PlanilhaHoras/PlanilhaHoras';
import RelatorioTempo from './pages/RelatorioTempo/RelatorioTempo';
import Equipamentos from './pages/Equipamentos/Equipamentos';
import CadastroEquipamento from './pages/Equipamentos/CadastroEquipamento';
import GestaoEquipamentosLayout from './pages/GestaoEquipamentos/GestaoEquipamentosLayout';
import DashboardEquipamentos from './pages/GestaoEquipamentos/DashboardEquipamentos';
import InventarioGestao from './pages/GestaoEquipamentos/InventarioGestao';
import Operadores from './pages/GestaoEquipamentos/Operadores';
import PerfilOperador from './pages/GestaoEquipamentos/PerfilOperador';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AprovacoesPendentes from './pages/Aprovacoes/AprovacoesPendentes';
import MinhasNotificacoes from './pages/Notificacoes/MinhasNotificacoes';
import TutoriaisPublicos from './pages/BaseConhecimento/TutoriaisPublicos';
import NotasAtualizacaoPublicas from './pages/NotasAtualizacao/NotasAtualizacaoPublicas';

// Componente para redirecionar rota antiga
const RedirectToCadastroCliente = () => {
  const { clienteId } = useParams();
  return <Navigate to={`/cadastro/cliente?id=${clienteId}`} replace />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/painel-colaborador"
          element={
            <ProtectedRoute>
              <PainelUsuario />
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
              <CadastroClientes />
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
          path="/cadastro/colaborador"
          element={
            <ProtectedRoute>
              <CadastroColaborador />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/vigencia"
          element={
            <ProtectedRoute>
              <CadastroVigencia />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/colaborador/vigencias"
          element={
            <ProtectedRoute>
              <ListaVigencias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorios/vigencias"
          element={
            <ProtectedRoute>
              <RelatorioVigencias />
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
          path="/cadastro/config-custo"
          element={
            <ProtectedRoute>
              <EditarConfigCusto />
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
          path="/cadastro/produto"
          element={
            <ProtectedRoute>
              <CadastroProdutoIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tarefas"
          element={
            <ProtectedRoute>
              <CadastroTarefas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tarefa"
          element={
            <ProtectedRoute>
              <CadastroTarefaIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/subtarefas"
          element={
            <ProtectedRoute>
              <CadastroSubtarefas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/subtarefa"
          element={
            <ProtectedRoute>
              <CadastroSubtarefaIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tipo-tarefas"
          element={
            <ProtectedRoute>
              <CadastroTipoTarefas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tipo-tarefa"
          element={
            <ProtectedRoute>
              <CadastroTipoTarefaIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/status-tarefas"
          element={
            <ProtectedRoute>
              <CadastroStatusTarefas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/status-tarefa"
          element={
            <ProtectedRoute>
              <CadastroStatusTarefaIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tipo-contratos"
          element={
            <ProtectedRoute>
              <CadastroTipoContratos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/tipo-contrato"
          element={
            <ProtectedRoute>
              <CadastroTipoContrato />
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
        <Route
          path="/cadastro/vinculacao"
          element={
            <ProtectedRoute>
              <CadastroVinculacao />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vinculacoes/nova"
          element={
            <ProtectedRoute>
              <NovaVinculacao />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/bancos"
          element={
            <ProtectedRoute>
              <CadastroBanco />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/banco"
          element={
            <ProtectedRoute>
              <CadastroBancoIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/adquirentes"
          element={
            <ProtectedRoute>
              <CadastroAdquirente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/adquirente"
          element={
            <ProtectedRoute>
              <CadastroAdquirenteIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/sistemas"
          element={
            <ProtectedRoute>
              <CadastroSistemas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/sistema"
          element={
            <ProtectedRoute>
              <CadastroSistemaIndividual />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/contato-cliente"
          element={
            <ProtectedRoute>
              <CadastroContatoCliente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/equipamentos"
          element={
            <ProtectedRoute>
              <Equipamentos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/equipamento"
          element={
            <ProtectedRoute>
              <CadastroEquipamento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao-equipamentos"
          element={
            <ProtectedRoute>
              <GestaoEquipamentosLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardEquipamentos />} />
          <Route path="inventario" element={<InventarioGestao />} />
          <Route path="operadores" element={<Operadores />} />
          <Route path="operadores/:id" element={<PerfilOperador />} />
        </Route>
        <Route
          path="/gestao-capacidade"
          element={
            <ProtectedRoute>
              <GestaoCapacidade />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao-capacidade/historico"
          element={
            <ProtectedRoute>
              <HistoricoAtribuicoes />
            </ProtectedRoute>
          }
        />
        {/* Redirecionamentos de rotas antigas */}
        <Route
          path="/atribuir-responsaveis"
          element={
            <ProtectedRoute>
              <Navigate to="/gestao-capacidade" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/atribuir-responsaveis/historico"
          element={
            <ProtectedRoute>
              <Navigate to="/gestao-capacidade/historico" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/atribuicoes/pendentes/aprovacao"
          element={
            <ProtectedRoute>
              <AprovacoesPendentes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/delegar-tarefas"
          element={
            <ProtectedRoute>
              <Navigate to="/gestao-capacidade" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento"
          element={
            <ProtectedRoute>
              <BaseConhecimento />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento/conteudos-clientes"
          element={
            <ProtectedRoute>
              <ConteudosClientes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento/tutoriais"
          element={
            <ProtectedRoute>
              <AnexarArquivo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento/tutoriais-apresentacao"
          element={
            <ProtectedRoute>
              <TutoriaisPublicos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento/notas-atualizacao"
          element={
            <ProtectedRoute>
              <NotasAtualizacao />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento/notas-atualizacao-apresentacao"
          element={
            <ProtectedRoute>
              <NotasAtualizacaoPublicas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/base-conhecimento/cliente/:clienteId"
          element={
            <ProtectedRoute>
              <BaseConhecimentoCliente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/atribuicao/cliente/:clienteId"
          element={
            <ProtectedRoute>
              <AtribuicaoCliente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/atribuicao/nova"
          element={
            <ProtectedRoute>
              <AtribuicaoCliente />
            </ProtectedRoute>
          }
        />
        {/* Adicionando rota no plural para compatibilidade */}
        <Route
          path="/atribuicoes/nova"
          element={
            <ProtectedRoute>
              <AtribuicaoCliente />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cadastro/cliente"
          element={
            <ProtectedRoute>
              <CadastroCliente />
            </ProtectedRoute>
          }
        />
        {/* Redirecionamento da rota antiga */}
        <Route
          path="/base-conhecimento/cliente/:clienteId/editar"
          element={
            <ProtectedRoute>
              <RedirectToCadastroCliente />
            </ProtectedRoute>
          }
        />
        {/* Redirecionamentos de URLs antigas de catálogo */}
        <Route
          path="/catalogo/produtos"
          element={
            <ProtectedRoute>
              <Navigate to="/cadastro/produtos" replace />
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
        <Route
          path="/documentacao-api"
          element={
            <ProtectedRoute>
              <DocumentacaoAPI />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao/usuarios"
          element={
            <ProtectedRoute>
              <GestaoUsuarios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestao/permissoes"
          element={
            <ProtectedRoute>
              <ConfigPermissoes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/planilha-horas"
          element={
            <ProtectedRoute>
              <PlanilhaHoras />
            </ProtectedRoute>
          }
        />
        <Route
          path="/relatorio-tempo"
          element={
            <ProtectedRoute>
              <RelatorioTempo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notificacoes"
          element={
            <ProtectedRoute>
              <MinhasNotificacoes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/aprovacoes-pendentes"
          element={
            <ProtectedRoute>
              <AprovacoesPendentes />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider >
  );
}

export default App;
