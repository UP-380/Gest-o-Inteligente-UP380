
import os

file_path = r"c:\Aplicacao\Gest-o-Inteligente-UP380\backEnd\src\controllers\tempo-estimado.controller.js"

new_function_code = r"""// PUT - Atualizar todos os registros de um agrupamento
async function atualizarTempoEstimadoPorAgrupador(req, res) {
  try {
    const { agrupador_id } = req.params;
    const { cliente_id, grupos } = req.body;

    if (!agrupador_id) {
      return res.status(400).json({ success: false, error: 'agrupador_id é obrigatório' });
    }

    if (!cliente_id) {
      return res.status(400).json({ success: false, error: 'cliente_id é obrigatório' });
    }

    // Função auxiliar local para buscar tipo_tarefa_id
    const buscarTipoTarefaIdPorTarefa = async (tarefaId) => {
      try {
        if (!tarefaId) return null;
        const tarefaIdStr = String(tarefaId).trim();
        const tarefaIdNum = parseInt(tarefaIdStr, 10);
        if (isNaN(tarefaIdNum)) return null;

        const { data: vinculados, error } = await supabase
          .schema('up_gestaointeligente')
          .from('vinculados')
          .select('tarefa_tipo_id')
          .eq('tarefa_id', tarefaIdNum)
          .not('tarefa_tipo_id', 'is', null)
          .is('produto_id', null)
          .is('cliente_id', null)
          .is('subtarefa_id', null)
          .limit(1);

        if (error || !vinculados || vinculados.length === 0) return null;
        return vinculados[0].tarefa_tipo_id ? String(vinculados[0].tarefa_tipo_id) : null;
      } catch (error) {
        console.error('❌ Erro ao buscar tipo_tarefa_id:', error);
        return null;
      }
    };

    // Função auxiliar para processar um grupo de regras
    const processarGrupo = async (grupoDados) => {
      const {
        produtos_com_tarefas,
        data_inicio,
        data_fim,
        responsavel_id,
        incluir_finais_semana = true,
        incluir_feriados = true,
        datas_individuais = []
      } = grupoDados;

      const temPeriodoCompleto = data_inicio && data_fim;
      const temDatasIndividuais = Array.isArray(datas_individuais) && datas_individuais.length > 0;

      if (!temPeriodoCompleto && !temDatasIndividuais) {
        throw new Error('Grupo inválido: É necessário fornecer data_inicio e data_fim OU datas_individuais');
      }

      if (!produtos_com_tarefas || typeof produtos_com_tarefas !== 'object' || Object.keys(produtos_com_tarefas).length === 0) {
        throw new Error('Grupo inválido: É necessário fornecer "produtos_com_tarefas"');
      }

      let temResponsavelNoGrupo = !!responsavel_id;
      for (const list of Object.values(produtos_com_tarefas)) {
        for (const t of list) {
          if (t.responsavel_id) temResponsavelNoGrupo = true;
        }
      }
      if (!temResponsavelNoGrupo) {
        throw new Error('Grupo inválido: responsavel_id é obrigatório (global ou nas tarefas)');
      }

      const incFinaisSemanaBool = incluir_finais_semana === undefined ? true : Boolean(incluir_finais_semana);
      const incFeriadosBool = incluir_feriados === undefined ? true : Boolean(incluir_feriados);

      let datasDoPeriodo = [];
      if (temDatasIndividuais && !temPeriodoCompleto) {
        datasDoPeriodo = await processarDatasIndividuais(datas_individuais, incFinaisSemanaBool, incFeriadosBool);
      } else if (temPeriodoCompleto) {
        const todasDatas = await gerarDatasDoPeriodo(data_inicio, data_fim, incFinaisSemanaBool, incFeriadosBool);
        if (temDatasIndividuais) {
          const datasIndividuaisSet = new Set(datas_individuais);
          datasDoPeriodo = todasDatas.filter(data => datasIndividuaisSet.has(data.split('T')[0]));
        } else {
          datasDoPeriodo = todasDatas;
        }
      }

      if (datasDoPeriodo.length === 0) {
        // Ignorar grupos sem datas válidas mas não falhar tudo? Não, melhor falhar.
        throw new Error('Nenhuma data válida encontrada para o grupo.');
      }

      const datasApenasData = datasDoPeriodo.map(d => d.split('T')[0]).sort();
      const segmentos = await agruparDatasEmSegmentos(datasApenasData, incFinaisSemanaBool, incFeriadosBool);

      const tarefasIdsDoGrupo = new Set();
      Object.values(produtos_com_tarefas).forEach(l => l.forEach(t => tarefasIdsDoGrupo.add(String(t.tarefa_id).trim())));
      
      const tipoTarefaMap = new Map();
      for (const tId of tarefasIdsDoGrupo) {
        const tipoId = await buscarTipoTarefaIdPorTarefa(tId);
        if (tipoId) tipoTarefaMap.set(tId, tipoId);
      }

      const regrasDoGrupo = [];
      for (const [produtoId, tarefasList] of Object.entries(produtos_com_tarefas)) {
        for (const t of tarefasList) {
          const tId = String(t.tarefa_id).trim();
          const tipoId = tipoTarefaMap.get(tId) || null;
          const respId = t.responsavel_id || responsavel_id;
          const tempoDia = t.tempo_estimado_dia;

          if (!respId || !tempoDia) continue;

          for (const seg of segmentos) {
            regrasDoGrupo.push({
              agrupador_id,
              cliente_id: String(cliente_id).trim(),
              produto_id: String(produtoId).trim(),
              tarefa_id: parseInt(tId, 10),
              tipo_tarefa_id: tipoId ? parseInt(tipoId, 10) : null,
              responsavel_id: String(respId).trim(),
              data_inicio: seg.inicio,
              data_fim: seg.fim,
              tempo_estimado_dia: parseInt(tempoDia, 10),
              incluir_finais_semana: incFinaisSemanaBool,
              incluir_feriados: incFeriadosBool,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        }
      }
      return regrasDoGrupo;
    };

    let regrasParaInserirTotal = [];

    if (grupos && Array.isArray(grupos) && grupos.length > 0) {
      console.log(`📦 [UPDATE-AGRUPADOR] Processando ${grupos.length} grupos recebidos.`);
      for (const g of grupos) {
        const regras = await processarGrupo(g);
        regrasParaInserirTotal.push(...regras);
      }
    } else {
      // Modo Legacy
      const grupoUnico = {
        produtos_com_tarefas: req.body.produtos_com_tarefas,
        data_inicio: req.body.data_inicio,
        data_fim: req.body.data_fim,
        responsavel_id: req.body.responsavel_id,
        incluir_finais_semana: req.body.incluir_finais_semana,
        incluir_feriados: req.body.incluir_feriados,
        datas_individuais: req.body.datas_individuais
      };
      
      // Fallback para req.body direto se produtos_com_tarefas não existir
      if (!grupoUnico.produtos_com_tarefas && (req.body.produto_ids || req.body.tarefa_ids)) {
         // Construção manual simplificada para fallback
         const pMap = {};
         const pIds = req.body.produto_ids || []; 
         const tList = [];
         
         const tIds = req.body.tarefa_ids || [];
         if (tIds.length > 0) {
           tIds.forEach(tid => tList.push({
             tarefa_id: tid,
             tempo_estimado_dia: req.body.tempo_estimado_dia,
             responsavel_id: req.body.responsavel_id
           }));
         } else if (req.body.tarefas) {
            req.body.tarefas.forEach(t => tList.push(t));
         }

         if (Array.isArray(pIds)) {
            pIds.forEach(pid => pMap[pid] = tList);
         }
         grupoUnico.produtos_com_tarefas = pMap;
      }
      
      if (!grupoUnico.produtos_com_tarefas || Object.keys(grupoUnico.produtos_com_tarefas).length === 0) {
        // Se ainda assim falhar, lançar erro ou deixar processarGrupo reclamar
      }

      const regras = await processarGrupo(grupoUnico);
      regrasParaInserirTotal.push(...regras);
    }

    // Deletar TODAS as regras antigas deste agrupador (Operação Atômica Lógica)
    const { error: deleteError } = await supabase
      .schema('up_gestaointeligente')
      .from('tempo_estimado_regra')
      .delete()
      .eq('agrupador_id', agrupador_id);

    if (deleteError) {
      return res.status(500).json({ success: false, error: 'Erro ao limpar regras antigas', details: deleteError.message });
    }

    // Inserir Novas Regras
    if (regrasParaInserirTotal.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < regrasParaInserirTotal.length; i += batchSize) {
        const lote = regrasParaInserirTotal.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .schema('up_gestaointeligente')
          .from('tempo_estimado_regra')
          .insert(lote);

        if (insertError) {
          console.error('❌ Erro ao inserir lote de regras:', insertError);
          return res.status(500).json({ success: false, error: 'Erro ao salvar novas regras', details: insertError.message });
        }
      }
    }

    console.log(`✅ Agrupamento ${agrupador_id} atualizado com ${regrasParaInserirTotal.length} novas regras.`);
    
    // Atualizar período do histórico
    await recalcularPeriodoHistorico(agrupador_id);

    return res.json({
      success: true,
      message: 'Atribuição atualizada com sucesso',
      count: regrasParaInserirTotal.length
    });

  } catch (error) {
    console.error('Erro inesperado ao atualizar agrupamento:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    });
  }
}
"""

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_index = -1
end_index = -1
target_start = "async function atualizarTempoEstimadoPorAgrupador(req, res) {"
target_end_marker = "// DELETE - Deletar todas as regras de um agrupamento"

for i, line in enumerate(lines):
    if target_start in line:
        start_index = i
    if target_end_marker in line:
        end_index = i
        break

if start_index != -1 and end_index != -1:
    # Adjust end_index to exclude the marker and include the closing brace of the previous function
    # Check backwards from end_index for the closing brace '}'
    j = end_index - 1
    while j > start_index and '}' not in lines[j]:
        j -= 1
    
    # We want to replace up to the closing brace line
    replace_end_index = j + 1
    
    # Check if there was a comment block header before the function
    # line 2015: // PUT - Atualizar todos os registros de um agrupamento
    if start_index > 0 and "// PUT - Atualizar todos os registros de um agrupamento" in lines[start_index - 1]:
        start_index -= 1 # Include the comment in replacement (since our new code has it)

    new_content = lines[:start_index] + [new_function_code + "\n\n"] + lines[end_index:]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_content)
    print("File updated successfully.")
else:
    print(f"Start or End marker not found. Start: {start_index}, End: {end_index}")
