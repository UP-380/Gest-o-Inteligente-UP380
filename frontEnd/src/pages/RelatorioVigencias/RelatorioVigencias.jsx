import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import CardContainer from '../../components/common/CardContainer';
import LoadingState from '../../components/common/LoadingState';
import ButtonPrimary from '../../components/common/ButtonPrimary';
import DataTable from '../../components/common/DataTable';
import { useToast } from '../../hooks/useToast';
import { formatarDataBR, formatarMoeda, removerFormatacaoMoeda } from '../../utils/vigenciaUtils';

// Função auxiliar para formatar moeda com tratamento de strings
const formatarMoedaSegura = (valor) => {
  if (!valor && valor !== 0) return '0,00';
  if (typeof valor === 'string') {
    const num = parseFloat(removerFormatacaoMoeda(valor));
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  return formatarMoeda(valor);
};
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './RelatorioVigencias.css';

const API_BASE_URL = '/api';

const RelatorioVigencias = () => {
  const navigate = useNavigate();
  const showToast = useToast();

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState([]);
  const [tiposContrato, setTiposContrato] = useState([]);

  // Carregar tipos de contrato
  const loadTiposContrato = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/tipo-contrato-membro?limit=1000`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTiposContrato(result.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar tipos de contrato:', error);
    }
  }, []);

  // Carregar dados do relatório
  const loadDados = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/custo-colaborador-vigencia/relatorio`, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setDados(result.data || []);
      } else {
        setDados([]);
        showToast('error', result.error || 'Erro ao carregar dados do relatório');
      }
    } catch (error) {
      console.error('Erro ao carregar dados do relatório:', error);
      showToast('error', 'Erro ao carregar dados do relatório. Tente novamente.');
      setDados([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Obter nome do tipo de contrato
  const getNomeTipoContrato = useCallback((tipoContratoId) => {
    if (!tipoContratoId && tipoContratoId !== 0) return '-';
    if (!tiposContrato || tiposContrato.length === 0) return '-';
    
    const idNum = typeof tipoContratoId === 'string' ? parseInt(tipoContratoId, 10) : tipoContratoId;
    if (isNaN(idNum)) return '-';
    
    const tipo = tiposContrato.find(t => {
      const tipoId = typeof t.id === 'string' ? parseInt(t.id, 10) : t.id;
      return tipoId === idNum || t.id === idNum || String(t.id) === String(idNum);
    });
    
    return tipo ? tipo.nome : '-';
  }, [tiposContrato]);

  // Exportar para PDF
  const exportarPDF = useCallback(() => {
    if (!dados || dados.length === 0) {
      showToast('warning', 'Não há dados para exportar');
      return;
    }

    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');
      
      // Título
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Vigências - Colaboradores', 14, 15);
      
      // Data de geração
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const dataGeracao = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${dataGeracao}`, 14, 22);

      // Preparar dados da tabela
      const tableData = dados.map(item => {
        const vigencia = item.vigencia;
        return [
          item.colaborador.nome || '-',
          item.colaborador.cpf || '-',
          item.colaborador.status === 'ativo' ? 'Ativo' : 'Inativo',
          vigencia ? formatarDataBR(vigencia.dt_vigencia) : '-',
          vigencia ? getNomeTipoContrato(vigencia.tipo_contrato) : '-',
          vigencia ? (vigencia.horascontratadasdia || '-') : '-',
          vigencia ? formatarMoedaSegura(vigencia.salariobase) : '-',
          vigencia ? formatarMoedaSegura(vigencia.ferias || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.um_terco_ferias || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.decimoterceiro || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.fgts || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.valetransporte || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.vale_refeicao || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.ajudacusto || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.custo_total_mensal || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.custo_diario_total || '0') : '-',
          vigencia ? formatarMoedaSegura(vigencia.custo_hora || '0') : '-'
        ];
      });

      // Cabeçalhos da tabela
      const headers = [
        'Colaborador',
        'CPF',
        'Status',
        'Data Vigência',
        'Tipo Contrato',
        'Horas/Dia',
        'Salário Base',
        'Férias',
        '1/3 Férias',
        '13º Salário',
        'FGTS',
        'Vale Transporte',
        'Vale Refeição',
        'Ajuda de Custo',
        'Custo Total Mensal',
        'Custo Diário Total',
        'Custo Hora'
      ];

      // Adicionar tabela
      doc.autoTable({
        head: [headers],
        body: tableData,
        startY: 28,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          overflow: 'linebreak',
          cellWidth: 'wrap'
        },
        headStyles: {
          fillColor: [14, 59, 111],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        margin: { top: 28, left: 14, right: 14 },
        tableWidth: 'auto'
      });

      // Salvar PDF
      const fileName = `Relatorio_Vigencias_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      
      showToast('success', 'PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      showToast('error', 'Erro ao gerar PDF. Tente novamente.');
    }
  }, [dados, getNomeTipoContrato, showToast]);

  // Exportar para Excel
  const exportarExcel = useCallback(() => {
    if (!dados || dados.length === 0) {
      showToast('warning', 'Não há dados para exportar');
      return;
    }

    try {
      // Preparar dados para o Excel
      const excelData = dados.map(item => {
        const vigencia = item.vigencia;
        return {
          'Colaborador': item.colaborador.nome || '-',
          'CPF': item.colaborador.cpf || '-',
          'Status': item.colaborador.status === 'ativo' ? 'Ativo' : 'Inativo',
          'Data de Vigência': vigencia ? formatarDataBR(vigencia.dt_vigencia) : '-',
          'Tipo de Contrato': vigencia ? getNomeTipoContrato(vigencia.tipo_contrato) : '-',
          'Horas/Dia': vigencia ? (vigencia.horascontratadasdia || '-') : '-',
          'Salário Base': vigencia ? formatarMoedaSegura(vigencia.salariobase) : '-',
          'Custo Total Mensal': vigencia ? formatarMoedaSegura(vigencia.custo_total_mensal || '0') : '-',
          'Custo Diário Total': vigencia ? formatarMoedaSegura(vigencia.custo_diario_total || '0') : '-',
          'Custo Hora': vigencia ? formatarMoedaSegura(vigencia.custo_hora || '0') : '-',
          // Campos adicionais da vigência
          'Férias': vigencia ? formatarMoedaSegura(vigencia.ferias || '0') : '-',
          '1/3 Férias': vigencia ? formatarMoedaSegura(vigencia.um_terco_ferias || '0') : '-',
          '13º Salário': vigencia ? formatarMoedaSegura(vigencia.decimoterceiro || '0') : '-',
          'FGTS': vigencia ? formatarMoedaSegura(vigencia.fgts || '0') : '-',
          'Vale Transporte': vigencia ? formatarMoedaSegura(vigencia.valetransporte || '0') : '-',
          'Vale Refeição': vigencia ? formatarMoedaSegura(vigencia.vale_refeicao || '0') : '-',
          'Ajuda de Custo': vigencia ? formatarMoedaSegura(vigencia.ajudacusto || '0') : '-'
        };
      });

      // Criar workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 25 }, // Colaborador
        { wch: 15 }, // CPF
        { wch: 10 }, // Status
        { wch: 15 }, // Data de Vigência
        { wch: 20 }, // Tipo de Contrato
        { wch: 12 }, // Horas/Dia
        { wch: 15 }, // Salário Base
        { wch: 18 }, // Custo Total Mensal
        { wch: 18 }, // Custo Diário Total
        { wch: 15 }, // Custo Hora
        { wch: 15 }, // Férias
        { wch: 15 }, // 1/3 Férias
        { wch: 15 }, // 13º Salário
        { wch: 15 }, // FGTS
        { wch: 15 }, // Vale Transporte
        { wch: 15 }, // Vale Refeição
        { wch: 15 }  // Ajuda de Custo
      ];
      ws['!cols'] = colWidths;

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Vigências');

      // Gerar arquivo Excel
      const fileName = `Relatorio_Vigencias_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      showToast('success', 'Excel gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar Excel:', error);
      showToast('error', 'Erro ao gerar Excel. Tente novamente.');
    }
  }, [dados, getNomeTipoContrato, showToast]);

  useEffect(() => {
    loadTiposContrato();
    loadDados();
  }, [loadTiposContrato, loadDados]);

  // Preparar dados para a tabela
  const dadosTabela = dados.map(item => ({
    id: item.colaborador.id,
    colaborador: item.colaborador.nome,
    cpf: item.colaborador.cpf || '-',
    status: item.colaborador.status || 'ativo',
    vigencia: item.vigencia
  }));

  return (
    <Layout>
      <div className="container">
        <main className="main-content">
          <CardContainer>
            {/* Header */}
            <div className="relatorio-vigencias-header">
              <div>
                <h1 className="relatorio-vigencias-title">Relatório de Vigências</h1>
                <p className="relatorio-vigencias-subtitle">
                  Lista de colaboradores com suas últimas vigências cadastradas
                </p>
              </div>
              <div className="relatorio-vigencias-actions">
                <button
                  className="btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  <i className="fas fa-arrow-left"></i>
                  Voltar
                </button>
                <ButtonPrimary
                  onClick={exportarPDF}
                  icon="fas fa-file-pdf"
                >
                  Exportar PDF
                </ButtonPrimary>
                <ButtonPrimary
                  onClick={exportarExcel}
                  icon="fas fa-file-excel"
                >
                  Exportar Excel
                </ButtonPrimary>
              </div>
            </div>

            {/* Tabela de dados */}
            <div className="listing-table-container">
              {loading ? (
                <LoadingState message="Carregando dados do relatório..." />
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'colaborador',
                      label: 'Colaborador',
                      render: (item) => item.colaborador
                    },
                    {
                      key: 'cpf',
                      label: 'CPF',
                      render: (item) => item.cpf
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      render: (item) => (
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: item.status === 'ativo' ? '#d1fae5' : '#fee2e2',
                          color: item.status === 'ativo' ? '#065f46' : '#991b1b'
                        }}>
                          {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      )
                    },
                    {
                      key: 'dt_vigencia',
                      label: 'Data de Vigência',
                      render: (item) => item.vigencia ? formatarDataBR(item.vigencia.dt_vigencia) : '-'
                    },
                    {
                      key: 'tipo_contrato',
                      label: 'Tipo de Contrato',
                      render: (item) => item.vigencia ? getNomeTipoContrato(item.vigencia.tipo_contrato) : '-'
                    },
                    {
                      key: 'horas_dia',
                      label: 'Horas/Dia',
                      render: (item) => item.vigencia ? (item.vigencia.horascontratadasdia || '-') : '-'
                    },
                    {
                      key: 'salario_base',
                      label: 'Salário Base',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.salariobase) : '-'
                    },
                    {
                      key: 'ferias',
                      label: 'Férias',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.ferias || '0') : '-'
                    },
                    {
                      key: 'terco_ferias',
                      label: '1/3 Férias',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.um_terco_ferias || '0') : '-'
                    },
                    {
                      key: 'decimoterceiro',
                      label: '13º Salário',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.decimoterceiro || '0') : '-'
                    },
                    {
                      key: 'fgts',
                      label: 'FGTS',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.fgts || '0') : '-'
                    },
                    {
                      key: 'valetransporte',
                      label: 'Vale Transporte',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.valetransporte || '0') : '-'
                    },
                    {
                      key: 'vale_refeicao',
                      label: 'Vale Refeição',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.vale_refeicao || '0') : '-'
                    },
                    {
                      key: 'ajudacusto',
                      label: 'Ajuda de Custo',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.ajudacusto || '0') : '-'
                    },
                    {
                      key: 'custo_total_mensal',
                      label: 'Custo Total Mensal',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.custo_total_mensal || '0') : '-'
                    },
                    {
                      key: 'custo_diario_total',
                      label: 'Custo Diário Total',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.custo_diario_total || '0') : '-'
                    },
                    {
                      key: 'custo_hora',
                      label: 'Custo Hora',
                      render: (item) => item.vigencia ? formatarMoedaSegura(item.vigencia.custo_hora || '0') : '-'
                    }
                  ]}
                  data={dadosTabela}
                  emptyMessage="Nenhum colaborador encontrado"
                  emptyIcon="fa-users"
                />
              )}
            </div>
          </CardContainer>
        </main>
      </div>
    </Layout>
  );
};

export default RelatorioVigencias;
