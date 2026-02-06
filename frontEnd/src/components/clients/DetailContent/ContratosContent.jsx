import React from 'react';

const ContratosContent = ({ contratos }) => {
  if (!contratos || contratos.length === 0) {
    return <div style={{ color: '#6b7280', fontSize: '13px' }}>Nenhum contrato encontrado</div>;
  }

  const formatDate = (dateValue) => {
    if (!dateValue && dateValue !== 0) return '—';
    try {
      let date;
      if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      } else if (typeof dateValue === 'string' && /^\d+$/.test(dateValue)) {
        date = new Date(parseInt(dateValue));
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return '—';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '—';
    }
  };

  const formatCNPJ = (cnpj) => {
    if (!cnpj) return '—';
    const cleaned = String(cnpj).replace(/\D/g, '');
    if (cleaned.length === 14) {
      return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    return cnpj;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: 'calc(50vh - 80px)', overflowY: 'auto', paddingRight: '8px' }}>
      {contratos.map((contrato, index) => {
        const nomeContrato = contrato.nome_contrato || contrato.nome || 'Contrato sem nome';
        const dataInicio = formatDate(contrato.dt_inicio);
        const dataRenovacao = formatDate(contrato.proxima_renovacao || contrato.dt_renovacao || contrato.ultima_renovacao);
        const cnpj = formatCNPJ(contrato.cpf_cnpj || contrato.cnpj);
        const status = contrato.status || '—';

        return (
          <div
            key={index}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: '#111827', fontSize: '16px', letterSpacing: '.2px' }}>
                {nomeContrato}
              </span>
              {contrato.url_atividade && (
                <button
                  onClick={() => window.open(contrato.url_atividade, '_blank')}
                  title="Abrir contrato"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  <i className="fas fa-external-link-alt" style={{ color: '#6b7280', fontSize: '14px' }}></i>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#374151' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 500 }}>Data Início:</span>
                <span>{dataInicio}</span>
              </div>
              {dataRenovacao !== '—' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 500 }}>Prx. Renovação:</span>
                  <span>{dataRenovacao}</span>
                </div>
              )}
              {cnpj !== '—' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 500 }}>CNPJ:</span>
                  <span>{cnpj}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 500 }}>Status:</span>
                <span>{status}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ContratosContent;

