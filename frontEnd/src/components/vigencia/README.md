# Componentes de Vigência

Componentes reutilizáveis para formulários de vigência de colaboradores.

## Componentes

### `VigenciaFormFields`

Componente que renderiza todos os campos do formulário de vigência.

**Props:**
- `formData` (Object): Dados do formulário
- `setFormData` (Function): Função para atualizar dados do formulário
- `formErrors` (Object): Erros do formulário
- `setFormErrors` (Function): Função para atualizar erros
- `tiposContrato` (Array): Lista de tipos de contrato
- `loadingTiposContrato` (Boolean): Estado de carregamento dos tipos de contrato
- `submitting` (Boolean): Estado de submissão
- `formatarValorParaInput` (Function): Função para formatar valores para input
- `removerFormatacaoMoeda` (Function): Função para remover formatação de moeda

## Hooks

### `useVigenciaCalculations`

Hook para gerenciar cálculos automáticos de vigência baseados no salário base.

**Parâmetros:**
- `formData` (Object): Dados do formulário
- `setFormData` (Function): Função para atualizar dados do formulário
- `formatarValorParaInput` (Function): Função para formatar valores para input
- `removerFormatacaoMoeda` (Function): Função para remover formatação de moeda
- `debounceMs` (Number, opcional): Tempo de debounce em milissegundos (padrão: 300)

**Exemplo de uso:**
```jsx
import { useVigenciaCalculations } from '../../hooks/useVigenciaCalculations';

const MyComponent = () => {
  const [formData, setFormData] = useState({...});
  
  useVigenciaCalculations(
    formData,
    setFormData,
    formatarValorParaInput,
    removerFormatacaoMoeda
  );
  
  // ...
};
```

### `useVigenciaSubmit`

Hook para gerenciar submissão de formulário de vigência.

**Parâmetros:**
- `API_BASE_URL` (String): URL base da API
- `removerFormatacaoMoeda` (Function): Função para remover formatação de moeda
- `onSuccess` (Function, opcional): Callback chamado em caso de sucesso
- `onError` (Function, opcional): Callback chamado em caso de erro

**Retorna:**
- `submitting` (Boolean): Estado de submissão
- `createVigencia` (Function): Função para criar uma nova vigência
- `updateVigencia` (Function): Função para atualizar uma vigência existente
- `prepareCreatePayload` (Function): Função para preparar payload de criação
- `prepareUpdatePayload` (Function): Função para preparar payload de atualização

**Exemplo de uso:**
```jsx
import { useVigenciaSubmit } from '../../hooks/useVigenciaSubmit';

const MyComponent = () => {
  const { submitting, createVigencia, updateVigencia } = useVigenciaSubmit(
    '/api',
    removerFormatacaoMoeda,
    (data) => {
      console.log('Sucesso!', data);
    },
    (error) => {
      console.error('Erro!', error);
    }
  );
  
  const handleSubmit = async () => {
    try {
      await createVigencia(formData, membroId);
    } catch (error) {
      // Erro já tratado no onError
    }
  };
  
  // ...
};
```

## Exemplo Completo

```jsx
import React, { useState } from 'react';
import { VigenciaFormFields } from '../../components/vigencia';
import { useVigenciaCalculations } from '../../hooks/useVigenciaCalculations';
import { useVigenciaSubmit } from '../../hooks/useVigenciaSubmit';

const VigenciaForm = ({ membroId, tiposContrato, onSuccess }) => {
  const [formData, setFormData] = useState({
    dt_vigencia: '',
    horascontratadasdia: '',
    tipo_contrato: '',
    salariobase: '',
    descricao: '',
    ajudacusto: '0',
    valetransporte: '0',
    ferias: '0',
    terco_ferias: '0',
    decimoterceiro: '0',
    fgts: '0'
  });
  
  const [formErrors, setFormErrors] = useState({});
  
  // Funções auxiliares
  const formatarValorParaInput = (valor) => {
    if (!valor && valor !== 0) return '0';
    return parseFloat(valor).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };
  
  const removerFormatacaoMoeda = (valor) => {
    if (!valor || valor === '' || valor === null || valor === undefined) return '0';
    return valor.toString().replace(/\./g, '').replace(',', '.') || '0';
  };
  
  // Hook de cálculos
  useVigenciaCalculations(
    formData,
    setFormData,
    formatarValorParaInput,
    removerFormatacaoMoeda
  );
  
  // Hook de submissão
  const { submitting, createVigencia } = useVigenciaSubmit(
    '/api',
    removerFormatacaoMoeda,
    (data) => {
      onSuccess && onSuccess(data);
      // Resetar formulário
      setFormData({
        dt_vigencia: '',
        horascontratadasdia: '',
        tipo_contrato: '',
        salariobase: '',
        descricao: '',
        ajudacusto: '0',
        valetransporte: '0',
        ferias: '0',
        terco_ferias: '0',
        decimoterceiro: '0',
        fgts: '0'
      });
    },
    (error) => {
      alert('Erro ao salvar vigência: ' + error.message);
    }
  );
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    const errors = {};
    if (!formData.dt_vigencia) {
      errors.dt_vigencia = 'Data de vigência é obrigatória';
    }
    if (!formData.tipo_contrato) {
      errors.tipo_contrato = 'Tipo de contrato é obrigatório';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      await createVigencia(formData, membroId);
    } catch (error) {
      // Erro já tratado no onError
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <VigenciaFormFields
        formData={formData}
        setFormData={setFormData}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        tiposContrato={tiposContrato}
        loadingTiposContrato={false}
        submitting={submitting}
        formatarValorParaInput={formatarValorParaInput}
        removerFormatacaoMoeda={removerFormatacaoMoeda}
      />
      
      <div className="modal-footer">
        <button type="button" className="btn-secondary" disabled={submitting}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
};

export default VigenciaForm;
```

