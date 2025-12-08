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
 * @param {Array} tiposContrato - Lista de tipos de contrato (opcional, para verificar ESTAGIO)
 */
export const useVigenciaCalculations = (
  formData,
  setFormData,
  formatarValorParaInput,
  removerFormatacaoMoeda,
  debounceMs = 300,
  tiposContrato = []
) => {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Verificar se é PJ (tipo_contrato === '2')
      const isPJ = formData.tipo_contrato === '2';
      
      // Verificar se é ESTAGIO (comparando o nome do tipo de contrato)
      const tipoContratoSelecionado = tiposContrato.find(tipo => tipo.id === formData.tipo_contrato);
      const isEstagio = tipoContratoSelecionado && tipoContratoSelecionado.nome && 
        tipoContratoSelecionado.nome.toUpperCase().includes('ESTAGIO');
      
      // Se for PJ ou ESTAGIO, não calcular automaticamente
      const isManualInput = isPJ || isEstagio;
      
      const salarioValido = formData.salariobase &&
                            formData.salariobase.trim() !== '' &&
                            formData.salariobase !== '0' &&
                            formData.salariobase !== '0,00' &&
                            parseFloat(removerFormatacaoMoeda(formData.salariobase)) > 0;

      if (salarioValido && !isManualInput) {
        const calcular = async () => {
          try {
            const dataVigencia = formData.dt_vigencia || null;
            const diasUteisVigencia = formData.diasuteis ? parseFloat(formData.diasuteis) : null;
            const horasContratadasDia = formData.horascontratadasdia ? parseFloat(formData.horascontratadasdia) : null;
            
            console.log('🔄 Calculando benefícios para salário:', formData.salariobase, 'data:', dataVigencia, 'dias úteis vigência:', diasUteisVigencia);
            
            const beneficios = await calcularVigencia(formData.salariobase, dataVigencia, diasUteisVigencia, horasContratadasDia);
            
            console.log('✅ Benefícios calculados:', beneficios);
            
            setFormData(prev => ({
              ...prev,
              ferias: formatarValorParaInput(beneficios.ferias),
              terco_ferias: formatarValorParaInput(beneficios.terco_ferias),
              decimoterceiro: formatarValorParaInput(beneficios.decimoterceiro),
              fgts: formatarValorParaInput(beneficios.fgts),
              valetransporte: formatarValorParaInput(beneficios.valetransporte),
              vale_refeicao: formatarValorParaInput(beneficios.vale_refeicao),
              custo_total_mensal: formatarValorParaInput(beneficios.custo_total_mensal),
              // Custo hora já vem calculado da função calcularVigencia
              ...(!isManualInput ? { 
                custo_hora: formatarValorParaInput(beneficios.custo_hora)
              } : {})
            }));
          } catch (error) {
            console.error('❌ Erro ao calcular benefícios:', error);
          }
        };
        calcular();
      } else if (!salarioValido && !isManualInput) {
        setFormData(prev => ({
          ...prev,
          ferias: '0',
          terco_ferias: '0',
          decimoterceiro: '0',
          fgts: '0',
          valetransporte: '0',
          vale_refeicao: '0',
          custo_total_mensal: '0',
          // Se não for PJ ou ESTAGIO, resetar custo hora também
          custo_hora: '0'
        }));
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [formData.salariobase, formData.dt_vigencia, formData.diasuteis, formData.horascontratadasdia, formData.tipo_contrato, formatarValorParaInput, removerFormatacaoMoeda, setFormData, tiposContrato]);
};

