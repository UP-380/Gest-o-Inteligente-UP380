import { useState } from 'react';

/**
 * Hook para gerenciar submissão de formulário de vigência
 * 
 * @param {String} API_BASE_URL - URL base da API
 * @param {Function} removerFormatacaoMoeda - Função para remover formatação de moeda
 * @param {Function} onSuccess - Callback chamado em caso de sucesso
 * @param {Function} onError - Callback chamado em caso de erro
 */
export const useVigenciaSubmit = (
  API_BASE_URL,
  removerFormatacaoMoeda,
  onSuccess,
  onError
) => {
  const [submitting, setSubmitting] = useState(false);

  // Função auxiliar para converter valores
  const toNumberOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? null : num;
  };

  const toNumberOrNullAllowZero = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? null : num;
  };

  const toNumberOrZero = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  /**
   * Prepara o payload para criação de vigência
   */
  const prepareCreatePayload = (formData, membroId) => {
    return {
      membro_id: membroId,
      dt_vigencia: formData.dt_vigencia.trim(),
      horascontratadasdia: toNumberOrNull(formData.horascontratadasdia),
      salariobase: formData.salariobase ? toNumberOrNull(removerFormatacaoMoeda(formData.salariobase)) : null,
      tipo_contrato: formData.tipo_contrato ? (isNaN(parseInt(formData.tipo_contrato, 10)) ? null : parseInt(formData.tipo_contrato, 10)) : null,
      // Campos TEXT - enviar como string formatada
      ferias: formData.ferias !== undefined && formData.ferias !== null && formData.ferias !== '' ? formData.ferias : null,
      terco_ferias: formData.terco_ferias !== undefined && formData.terco_ferias !== null && formData.terco_ferias !== '' ? formData.terco_ferias : null,
      decimoterceiro: formData.decimoterceiro !== undefined && formData.decimoterceiro !== null && formData.decimoterceiro !== '' ? formData.decimoterceiro : null,
      fgts: formData.fgts !== undefined && formData.fgts !== null && formData.fgts !== '' ? formData.fgts : null,
      custo_hora: formData.custo_hora !== undefined && formData.custo_hora !== null && formData.custo_hora !== '' ? formData.custo_hora : null,
      ajudacusto: formData.ajudacusto || '0',
      valetransporte: formData.valetransporte || '0',
      vale_refeicao: formData.vale_refeicao || '0',
      descricao: formData.descricao?.trim() || null
    };
  };

  /**
   * Prepara o payload para atualização de vigência
   */
  const prepareUpdatePayload = (formData) => {
    return {
      dt_vigencia: formData.dt_vigencia.trim(),
      horascontratadasdia: toNumberOrNull(formData.horascontratadasdia),
      salariobase: formData.salariobase ? toNumberOrNull(removerFormatacaoMoeda(formData.salariobase)) : null,
      tipo_contrato: formData.tipo_contrato ? (isNaN(parseInt(formData.tipo_contrato, 10)) ? null : parseInt(formData.tipo_contrato, 10)) : null,
      // Campos TEXT - enviar como string formatada
      ferias: formData.ferias !== undefined && formData.ferias !== null && formData.ferias !== '' ? formData.ferias : null,
      terco_ferias: formData.terco_ferias !== undefined && formData.terco_ferias !== null && formData.terco_ferias !== '' ? formData.terco_ferias : null,
      decimoterceiro: formData.decimoterceiro !== undefined && formData.decimoterceiro !== null && formData.decimoterceiro !== '' ? formData.decimoterceiro : null,
      fgts: formData.fgts !== undefined && formData.fgts !== null && formData.fgts !== '' ? formData.fgts : null,
      custo_hora: formData.custo_hora !== undefined && formData.custo_hora !== null && formData.custo_hora !== '' ? formData.custo_hora : null,
      ajudacusto: formData.ajudacusto || '0',
      valetransporte: formData.valetransporte || '0',
      vale_refeicao: formData.vale_refeicao || '0',
      descricao: formData.descricao?.trim() || null
    };
  };

  /**
   * Cria uma nova vigência
   */
  const createVigencia = async (formData, membroId) => {
    setSubmitting(true);
    try {
      const payload = prepareCreatePayload(formData, membroId);
      
      console.log('📤 Criando vigência:', payload);
      
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      console.log('📥 [FRONTEND] Resposta do servidor (texto):', text);
      
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse da resposta:', parseError);
        throw new Error('Resposta inválida do servidor');
      }

      console.log('📥 [FRONTEND] Resultado da API:', result);

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Erro ao criar vigência');
      }

      if (result.success) {
        onSuccess && onSuccess(result.data);
        return result.data;
      } else {
        throw new Error(result.error || 'Erro ao criar vigência');
      }
    } catch (error) {
      console.error('❌ Erro ao criar vigência:', error);
      onError && onError(error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Atualiza uma vigência existente
   */
  const updateVigencia = async (vigenciaId, formData) => {
    setSubmitting(true);
    try {
      const payload = prepareUpdatePayload(formData);
      
      console.log('📤 Atualizando vigência:', payload);
      
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/${vigenciaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse da resposta:', parseError);
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Erro ao atualizar vigência');
      }

      if (result.success) {
        onSuccess && onSuccess(result.data);
        return result.data;
      } else {
        throw new Error(result.error || 'Erro ao atualizar vigência');
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar vigência:', error);
      onError && onError(error);
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    createVigencia,
    updateVigencia,
    prepareCreatePayload,
    prepareUpdatePayload
  };
};

