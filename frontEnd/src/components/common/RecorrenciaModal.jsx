import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { gerarDatasRecorrencia } from '../../utils/gerarDatasRecorrencia';

const RecorrenciaModal = ({ isOpen, onClose, onConfirm }) => {
    const [inicio, setInicio] = useState('');
    const [fim, setFim] = useState('');

    const [diasSemana, setDiasSemana] = useState({
        1: false, // Seg
        2: false, // Ter
        3: false, // Qua
        4: false, // Qui
        5: false, // Sex
        6: false, // Sab
        0: false  // Dom
    });

    if (!isOpen) return null;

    const handleToggleDia = (dia) => {
        setDiasSemana(prev => ({
            ...prev,
            [dia]: !prev[dia]
        }));
    };

    const handleConfirm = () => {
        if (!inicio || !fim) {
            alert("Por favor, selecione as datas de início e fim.");
            return;
        }

        if (new Date(inicio) > new Date(fim)) {
            alert("A data de início deve ser menor ou igual à data de fim.");
            return;
        }

        const diasSelecionados = Object.keys(diasSemana).filter(k => diasSemana[k]).map(Number);

        if (diasSelecionados.length === 0) {
            alert("Selecione pelo menos um dia da semana.");
            return;
        }

        try {
            const datas = gerarDatasRecorrencia({
                inicio,
                fim,
                diasSemana: diasSelecionados
            });

            if (datas.length === 0) {
                alert("Nenhuma data encontrada para as configurações e o período selecionado.");
                return;
            }

            onConfirm(datas);
            onClose();
        } catch (error) {
            alert(error.message);
        }
    };

    const modalContent = (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div style={{
                backgroundColor: '#fff', borderRadius: '8px', width: '400px', maxWidth: '90%', padding: '20px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#0e3b6f' }}>Configurar Recorrência</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#666' }}>&times;</button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px', color: '#475569' }}>Período da Recorrência</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input
                            type="date"
                            value={inicio}
                            onChange={(e) => setInicio(e.target.value)}
                            style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                        <span style={{ fontSize: '13px', color: '#64748b' }}>até</span>
                        <input
                            type="date"
                            value={fim}
                            onChange={(e) => setFim(e.target.value)}
                            style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px', color: '#475569' }}>Dias Específicos</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {[
                            { id: 1, label: 'Segunda' },
                            { id: 2, label: 'Terça' },
                            { id: 3, label: 'Quarta' },
                            { id: 4, label: 'Quinta' },
                            { id: 5, label: 'Sexta' },
                            { id: 6, label: 'Sábado' },
                            { id: 0, label: 'Domingo' }
                        ].map(dia => (
                            <label key={dia.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={diasSemana[dia.id]}
                                    onChange={() => handleToggleDia(dia.id)}
                                    style={{ accentColor: '#0e3b6f', cursor: 'pointer' }}
                                />
                                {dia.label}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#475569', fontWeight: '500' }}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        style={{ padding: '8px 16px', background: '#0ea5e9', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white', fontWeight: '500' }}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default RecorrenciaModal;
