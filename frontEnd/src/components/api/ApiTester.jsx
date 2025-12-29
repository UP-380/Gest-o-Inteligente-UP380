import React, { useState } from 'react';
import './ApiTester.css';

const ApiTester = ({ 
  defaultMethod = 'GET', 
  defaultEndpoint = '', 
  defaultBody = null,
  defaultQueryParams = {},
  requireAuth = true 
}) => {
  const [method, setMethod] = useState(defaultMethod);
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [queryParams, setQueryParams] = useState(defaultQueryParams);
  const [body, setBody] = useState(defaultBody ? JSON.stringify(defaultBody, null, 2) : '');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [responseTime, setResponseTime] = useState(null);

  const API_BASE_URL = '/api';

  const handleAddQueryParam = () => {
    const newKey = `param${Object.keys(queryParams).length + 1}`;
    setQueryParams({ ...queryParams, [newKey]: '' });
  };

  const handleQueryParamChange = (oldKey, newKey, newValue) => {
    const newParams = { ...queryParams };
    if (oldKey !== newKey) {
      delete newParams[oldKey];
    }
    if (newKey && newValue !== undefined) {
      newParams[newKey] = newValue;
    } else if (newKey) {
      newParams[newKey] = '';
    }
    // Remove parâmetros vazios
    Object.keys(newParams).forEach(key => {
      if (!key || !newParams[key]) {
        delete newParams[key];
      }
    });
    setQueryParams(newParams);
  };

  const handleRemoveQueryParam = (key) => {
    const newParams = { ...queryParams };
    delete newParams[key];
    setQueryParams(newParams);
  };

  const buildUrl = () => {
    let url = `${API_BASE_URL}${endpoint}`;
    const params = Object.entries(queryParams)
      .filter(([key, value]) => key && value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    
    if (params) {
      url += `?${params}`;
    }
    return url;
  };

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setResponseTime(null);

    const startTime = Date.now();

    try {
      const url = buildUrl();
      let requestBody = null;
      
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        try {
          requestBody = JSON.parse(body);
        } catch (e) {
          setError('Body JSON inválido. Verifique a sintaxe.');
          setLoading(false);
          return;
        }
      }

      const options = {
        method: method,
        credentials: 'include', // Importante para enviar cookies
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      };

      if (requestBody) {
        options.body = JSON.stringify(requestBody);
      }

      const fetchResponse = await fetch(url, options);
      const endTime = Date.now();
      setResponseTime(endTime - startTime);

      // Tentar ler como JSON
      let responseData;
      const contentType = fetchResponse.headers.get('content-type') || '';
      
      try {
        const text = await fetchResponse.text();
        if (text) {
          responseData = JSON.parse(text);
        } else {
          responseData = null;
        }
      } catch (e) {
        responseData = { error: 'Resposta não é JSON válido', raw: await fetchResponse.text() };
      }

      // Capturar headers
      const headers = {};
      fetchResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });

      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: headers,
        data: responseData,
        ok: fetchResponse.ok
      });

    } catch (err) {
      const endTime = Date.now();
      setResponseTime(endTime - startTime);
      setError(err.message || 'Erro ao fazer requisição');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return '#10b981'; // verde
    if (status >= 400 && status < 500) return '#f59e0b'; // amarelo
    if (status >= 500) return '#ef4444'; // vermelho
    return '#6b7280'; // cinza
  };

  return (
    <div className="api-tester-container">
      <div className="api-tester-header">
        <h3>
          <i className="fas fa-flask"></i> Testar API
        </h3>
        <p>Preencha os campos abaixo e clique em "Enviar Requisição" para testar o endpoint</p>
      </div>

      <div className="api-tester-form">
        <div className="api-tester-row">
          <div className="api-tester-field">
            <label>Método HTTP</label>
            <select 
              value={method} 
              onChange={(e) => setMethod(e.target.value)}
              className="api-tester-select"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
          </div>

          <div className="api-tester-field api-tester-field-endpoint">
            <label>Endpoint</label>
            <div className="api-tester-endpoint-input">
              <span className="api-tester-endpoint-prefix">{API_BASE_URL}</span>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="/clientes ou /clientes/:id"
                className="api-tester-input"
              />
            </div>
          </div>
        </div>

        {/* Query Parameters */}
        <div className="api-tester-section">
          <div className="api-tester-section-header">
            <label>Query Parameters</label>
            <button 
              type="button"
              onClick={handleAddQueryParam}
              className="api-tester-btn-add"
            >
              <i className="fas fa-plus"></i> Adicionar
            </button>
          </div>
          {Object.keys(queryParams).length === 0 ? (
            <p className="api-tester-empty">Nenhum parâmetro adicionado</p>
          ) : (
            <div className="api-tester-params">
              {Object.entries(queryParams).map(([key, value], index) => (
                <div key={`${key}-${index}`} className="api-tester-param-row">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => handleQueryParamChange(key, e.target.value, value)}
                    placeholder="Nome do parâmetro"
                    className="api-tester-param-key"
                  />
                  <span>=</span>
                  <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => handleQueryParamChange(key, key, e.target.value)}
                    placeholder="Valor"
                    className="api-tester-param-value"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveQueryParam(key)}
                    className="api-tester-btn-remove"
                    title="Remover parâmetro"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Request Body */}
        {['POST', 'PUT', 'PATCH'].includes(method) && (
          <div className="api-tester-section">
            <label>Request Body (JSON)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder='{"campo": "valor"}'
              className="api-tester-textarea"
              rows={8}
            />
          </div>
        )}

        <div className="api-tester-actions">
          <button
            onClick={handleTest}
            disabled={loading || !endpoint}
            className="api-tester-btn-submit"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Enviando...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i> Enviar Requisição
              </>
            )}
          </button>
        </div>
      </div>

      {/* Response */}
      {(response || error) && (
        <div className="api-tester-response">
          <div className="api-tester-response-header">
            <h4>Resposta</h4>
            {responseTime && (
              <span className="api-tester-time">
                <i className="fas fa-clock"></i> {responseTime}ms
              </span>
            )}
          </div>

          {error && (
            <div className="api-tester-error">
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          {response && (
            <>
              <div className="api-tester-status">
                <span 
                  className="api-tester-status-badge"
                  style={{ backgroundColor: getStatusColor(response.status) }}
                >
                  {response.status} {response.statusText}
                </span>
                {response.ok && (
                  <span className="api-tester-success">
                    <i className="fas fa-check-circle"></i> Sucesso
                  </span>
                )}
              </div>

              <div className="api-tester-tabs">
                <div className="api-tester-tab-content">
                  <h5>Response Body</h5>
                  <pre className="api-tester-code">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              </div>

              {Object.keys(response.headers).length > 0 && (
                <div className="api-tester-section">
                  <h5>Response Headers</h5>
                  <div className="api-tester-headers">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="api-tester-header-row">
                        <code className="api-tester-header-key">{key}:</code>
                        <code className="api-tester-header-value">{value}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {requireAuth && (
        <div className="api-tester-info">
          <i className="fas fa-info-circle"></i>
          <span>Este endpoint requer autenticação. Certifique-se de estar logado.</span>
        </div>
      )}
    </div>
  );
};

export default ApiTester;

