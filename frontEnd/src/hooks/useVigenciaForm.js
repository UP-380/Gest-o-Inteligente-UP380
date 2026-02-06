import { useState, useCallback } from 'react';

/**
 * Hook para gerenciar estado e lógica de formulários de vigência
 * 
 * @param {Object} initialData - Dados iniciais do formulário
 * @returns {Object} Estado e funções do formulário
 */
export const useVigenciaForm = (initialData = {}) => {
  const [formData, setFormData] = useState({
    dt_vigencia: '',
    horascontratadasdia: '',
    salariobase: '',
    tipo_contrato: '',
    ajudacusto: '0',
    valetransporte: '0',
    vale_refeicao: '0',
    ferias: '0',
    terco_ferias: '0',
    decimoterceiro: '0',
    fgts: '0',
    custo_hora: '0',
    descricao: '',
    ...initialData
  });

  const [formErrors, setFormErrors] = useState({});

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Limpar erro do campo quando ele for atualizado
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [formErrors]);

  const updateFormData = useCallback((newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      dt_vigencia: '',
      horascontratadasdia: '',
      salariobase: '',
      tipo_contrato: '',
      ajudacusto: '0',
      valetransporte: '0',
      vale_refeicao: '0',
      ferias: '0',
      terco_ferias: '0',
      decimoterceiro: '0',
      fgts: '0',
      custo_hora: '0',
      descricao: ''
    });
    setFormErrors({});
  }, []);

  const validateForm = useCallback((requireMembroId = false, membroId = null) => {
    const errors = {};

    if (requireMembroId && !membroId) {
      errors.membro_id = 'Colaborador é obrigatório';
    }

    if (!formData.dt_vigencia || !formData.dt_vigencia.trim()) {
      errors.dt_vigencia = 'Data de Vigência é obrigatória';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  return {
    formData,
    setFormData,
    formErrors,
    setFormErrors,
    updateField,
    updateFormData,
    resetForm,
    validateForm
  };
};

