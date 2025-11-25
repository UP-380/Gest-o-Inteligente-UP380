/**
 * Calcula o resumo do cliente (contratos, tarefas, produtos, tempo)
 */
export const calculateResumo = (registrosDoCliente, contratosDoCliente) => {
  // Calcular tempo total por colaborador
  const tempoPorColaborador = {};
  registrosDoCliente.forEach(registro => {
    const colaboradorId = registro.usuario_id || registro.membro?.id || 'desconhecido';
    const colaboradorNome = registro.membro?.nome || `Colaborador ${colaboradorId}`;
    const tempo = Number(registro.tempo_realizado) || 0;
    
    if (!tempoPorColaborador[colaboradorId]) {
      tempoPorColaborador[colaboradorId] = {
        nome: colaboradorNome,
        total: 0
      };
    }
    tempoPorColaborador[colaboradorId].total += tempo;
  });
  
  // Contar tarefas únicas
  const tarefasUnicas = new Set();
  registrosDoCliente.forEach(registro => {
    if (registro.tarefa_id) {
      tarefasUnicas.add(String(registro.tarefa_id).trim());
    }
  });
  const totalTarefasUnicas = tarefasUnicas.size;
  
  // Contar produtos únicos
  const produtosUnicos = new Set();
  registrosDoCliente.forEach(registro => {
    if (registro.tarefa && registro.tarefa.produto_id) {
      produtosUnicos.add(String(registro.tarefa.produto_id).trim());
    }
  });
  const totalProdutosUnicos = produtosUnicos.size;
  const totalContratos = contratosDoCliente.length;
  const totalColaboradoresUnicos = Object.keys(tempoPorColaborador).length;
  
  // Calcular tempo total geral (soma de todos os colaboradores)
  const tempoTotalGeral = Object.values(tempoPorColaborador).reduce((total, colaborador) => {
    return total + (colaborador.total || 0);
  }, 0);
  
  return {
    tempoPorColaborador,
    totalTarefasUnicas,
    totalProdutosUnicos,
    totalContratos,
    totalColaboradoresUnicos,
    tempoTotalGeral
  };
};


