import { useEffect } from 'react';
import { calcularVigencia } from '../utils/calcularVigencia';

/**
 * Hook para gerenciar cálculos automáticos de vigência
 * 
 * @param {Object} formData - Dados do formulário
 * @param {Function} setFormData - Função para atualizar dados do formulário
 * @param {Function} formatarValorParaInput - Função para formatar valores para input
 * @param {Function} removerFormatacaoMoeda - Função para remover formatação de moeda
 * @param {Number} debounceMs - Tempo de debounce em milissegundos (padrão: 300)
 */
export const useVigenciaCalculations = (
  formData,
  setFormData,
  formatarValorParaInput,
  removerFormatacaoMoeda,
  debounceMs = 300
) => {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const salarioValido = formData.salariobase &&
                            formData.salariobase.trim() !== '' &&
                            formData.salariobase !== '0' &&
                            formData.salariobase !== '0,00' &&
                            parseFloat(removerFormatacaoMoeda(formData.salariobase)) > 0;

      if (salarioValido) {
        const calcular = async () => {
          try {
            const dataVigencia = formData.dt_vigencia || null;
            const diasUteis = formData.diasuteis ? parseFloat(formData.diasuteis) : null;
            
            console.log('🔄 Calculando benefícios para salário:', formData.salariobase, 'data:', dataVigencia, 'dias úteis:', diasUteis);
            
            const beneficios = await calcularVigencia(formData.salariobase, dataVigencia, diasUteis);
            
            console.log('✅ Benefícios calculados:', beneficios);
            
            // Calcular custo hora (apenas se não for PJ - tipo_contrato !== '2')
            let custoHora = '0';
            if (formData.tipo_contrato && formData.tipo_contrato !== '2') {
              const salarioBase = parseFloat(removerFormatacaoMoeda(formData.salariobase));
              const horasDia = parseFloat(formData.horascontratadasdia) || 0;
              const diasUteisMes = diasUteis || 22; // Padrão: 22 dias úteis
              
              if (horasDia > 0 && diasUteisMes > 0) {
                const horasMes = horasDia * diasUteisMes;
                const custoHoraCalculado = salarioBase / horasMes;
                custoHora = formatarValorParaInput(custoHoraCalculado);
                console.log('💰 Custo hora calculado:', custoHora, '(Salário:', salarioBase, '/ Horas mês:', horasMes, ')');
              }
            }
            
            setFormData(prev => ({
              ...prev,
              ferias: formatarValorParaInput(beneficios.ferias),
              terco_ferias: formatarValorParaInput(beneficios.terco_ferias),
              decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
              fgts: formatarValorParaInput(beneficios.fgts),
              valetransporte: formatarValorParaInput(beneficios.valetransporte),
              // Custo hora só é calculado se não for PJ
              ...(formData.tipo_contrato && formData.tipo_contrato !== '2' ? { custo_hora: custoHora } : {})
            }));
          } catch (error) {
            console.error('❌ Erro ao calcular benefícios:', error);
          }
        };
        calcular();
      } else {
        setFormData(prev => ({
          ...prev,
          ferias: '0',
          terco_ferias: '0',
          decimoterceiro: '0',
          fgts: '0',
          valetransporte: '0',
          // Se não for PJ, resetar custo hora também
          ...(formData.tipo_contrato && formData.tipo_contrato !== '2' ? { custo_hora: '0' } : {})
        }));
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [formData.salariobase, formData.dt_vigencia, formData.diasuteis, formData.horascontratadasdia, formData.tipo_contrato, formatarValorParaInput, removerFormatacaoMoeda, setFormData]);
};

