import React from 'react';

const AssuntoForm = ({ formData, setFormData, formErrors, setFormErrors, submitting }) => {

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        if (formErrors[name]) {
            setFormErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    return (
        <div className="assunto-form">
            <div className="form-group mb-3">
                <label className="form-label">Nome do Assunto *</label>
                <input
                    type="text"
                    name="nome"
                    className={`form-control ${formErrors.nome ? 'is-invalid' : ''}`}
                    placeholder="Ex: Problema com o Upmap, Dúvida sobre Faturamento..."
                    value={formData.nome || ''}
                    onChange={handleChange}
                    disabled={submitting}
                />
                {formErrors.nome && <div className="invalid-feedback">{formErrors.nome}</div>}
            </div>
        </div>
    );
};

export default AssuntoForm;
