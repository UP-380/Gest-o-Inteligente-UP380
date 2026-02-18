/**
 * HTML customizado para Swagger UI com CSS injetado
 * Usa as cores da marca UPMAP: Azul Vibrante, Laranja, Azul Escuro
 */

// Cores da marca UPMAP
const UPMAP_COLORS = {
  vibrantBlue: '#007BFF',    // Azul vibrante do ícone 'U'
  orange: '#FF6B35',         // Laranja das barras internas
  darkBlue: '#1F4782',       // Azul escuro do texto "UPMAP" (padrão da logo)
  darkBlueLight: '#2d4a6b',  // Variação mais clara do azul escuro
  textPrimary: '#333333',    // Cinza escuro para texto principal
  textSecondary: '#444444',  // Cinza médio para texto secundário
};

// Padrão de fonte UPMAP (sans-serif moderna)
const UPMAP_FONTS = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
`;

// CSS customizado com cores e tipografia da marca UPMAP
const customCSS = `
/* ============================================================================
   Tipografia UPMAP - Padrão Sans-Serif
   ============================================================================ */

* {
  ${UPMAP_FONTS}
}

body {
  ${UPMAP_FONTS}
  color: ${UPMAP_COLORS.textPrimary};
}

/* ============================================================================
   Scheme Container (Seleção de Servidores) - Cores UPMAP
   ============================================================================ */

.scheme-container {
  background: linear-gradient(135deg, ${UPMAP_COLORS.vibrantBlue} 0%, ${UPMAP_COLORS.darkBlue} 100%);
  border-radius: 12px;
  padding: 16px 20px;
  margin: 16px 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.scheme-container:hover {
  box-shadow: 0 10px 15px rgba(0, 123, 255, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.scheme-container label {
  color: #ffffff !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  margin-bottom: 8px !important;
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.scheme-container select {
  background: rgba(255, 255, 255, 0.95) !important;
  border: 2px solid rgba(255, 255, 255, 0.3) !important;
  border-radius: 8px !important;
  padding: 10px 16px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  color: ${UPMAP_COLORS.darkBlue} !important;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  max-width: 100%;
}

.scheme-container select:hover {
  background: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.5) !important;
}

.scheme-container select:focus {
  outline: none;
  border-color: #ffffff !important;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3);
}

/* ============================================================================
   Header com Logo UPMAP
   ============================================================================ */

.swagger-ui .topbar {
  background: ${UPMAP_COLORS.darkBlue} !important;
  padding: 16px 20px;
  border-bottom: 3px solid ${UPMAP_COLORS.orange};
}

.upmap-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 0;
  margin-bottom: 20px;
  border-bottom: 2px solid #e2e8f0;
}

.upmap-logo {
  height: 60px;
  width: auto;
  object-fit: contain;
}

.upmap-header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upmap-title {
  ${UPMAP_FONTS}
  font-size: 32px;
  font-weight: 700;
  color: ${UPMAP_COLORS.darkBlue};
  margin: 0;
  letter-spacing: -0.5px;
  text-transform: uppercase;
}

.upmap-subtitle {
  ${UPMAP_FONTS}
  font-size: 14px;
  color: ${UPMAP_COLORS.textSecondary};
  margin: 0;
  font-weight: 400;
}

/* ============================================================================
   Melhorias Gerais do Swagger UI - Cores UPMAP
   ============================================================================ */

.swagger-ui .info {
  margin-bottom: 30px;
}

.swagger-ui .info .title {
  ${UPMAP_FONTS}
  color: ${UPMAP_COLORS.darkBlue};
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Span dentro do título (versão e OAS) - Estilo clean e simples */
.swagger-ui .info .title span {
  ${UPMAP_FONTS}
  background: none !important;
  color: ${UPMAP_COLORS.textSecondary};
  padding: 0;
  border-radius: 0;
  font-weight: 400;
  font-size: 14px;
  letter-spacing: 0;
  box-shadow: none !important;
  display: inline-block;
  margin-left: 8px;
  line-height: 1.5;
}

/* Badge de versão melhorado */
.swagger-ui .info hgroup.main h2.title span {
  ${UPMAP_FONTS}
  background: linear-gradient(135deg, ${UPMAP_COLORS.vibrantBlue} 0%, ${UPMAP_COLORS.darkBlue} 100%);
  color: #ffffff;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: inline-block;
  margin-left: 0;
}

.swagger-ui .info .description {
  ${UPMAP_FONTS}
  color: ${UPMAP_COLORS.textPrimary};
  font-size: 16px;
  line-height: 1.6;
  font-weight: 400;
}

.swagger-ui .opblock-tag {
  ${UPMAP_FONTS}
  background: #f7fafc;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 12px;
  border-left: 4px solid ${UPMAP_COLORS.vibrantBlue};
  transition: all 0.2s ease;
  font-weight: 400;
}

.swagger-ui .opblock-tag:hover {
  background: #edf2f7;
  transform: translateX(4px);
  border-left-color: ${UPMAP_COLORS.orange};
}

.swagger-ui .opblock {
  border-radius: 8px;
  margin-bottom: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.swagger-ui .opblock:hover {
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.1);
}

/* Wrapper de descrição da operação - Remover background colorido e ajustar tipografia */
.swagger-ui .opblock-description-wrapper {
  ${UPMAP_FONTS}
  background: none !important;
  background-color: transparent !important;
  background-image: none !important;
  color: ${UPMAP_COLORS.textPrimary};
  font-weight: 400;
  font-size: 14px;
  line-height: 1.6;
  padding: 16px;
}

.swagger-ui .opblock-description {
  ${UPMAP_FONTS}
  color: ${UPMAP_COLORS.textPrimary};
  font-weight: 400;
  font-size: 14px;
  line-height: 1.6;
}

/* Botão Try it out - Cor Laranja UPMAP */
.swagger-ui .btn.try-out__btn {
  ${UPMAP_FONTS}
  background: ${UPMAP_COLORS.orange};
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
  padding: 8px 16px;
  transition: all 0.2s ease;
  text-transform: none;
}

.swagger-ui .btn.try-out__btn:hover {
  background: #e55a2b;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(255, 107, 53, 0.3);
}

/* Botão Execute - Cor Azul Vibrante UPMAP */
.swagger-ui .btn.execute {
  ${UPMAP_FONTS}
  background: ${UPMAP_COLORS.vibrantBlue};
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
  padding: 10px 24px;
  transition: all 0.2s ease;
  text-transform: none;
}

.swagger-ui .btn.execute:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 123, 255, 0.3);
}

.swagger-ui input[type="text"],
.swagger-ui input[type="password"],
.swagger-ui input[type="search"],
.swagger-ui input[type="email"],
.swagger-ui textarea {
  ${UPMAP_FONTS}
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 400;
  color: ${UPMAP_COLORS.textPrimary};
  transition: all 0.2s ease;
}

/* Input de filtro - Traduzido para português */
.swagger-ui .operation-filter-input {
  ${UPMAP_FONTS}
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 400;
  color: ${UPMAP_COLORS.textPrimary};
  transition: all 0.2s ease;
}

.swagger-ui .operation-filter-input::placeholder {
  color: #94a3b8;
  opacity: 1;
}

.swagger-ui .operation-filter-input::-webkit-input-placeholder {
  color: #94a3b8;
}

.swagger-ui .operation-filter-input::-moz-placeholder {
  color: #94a3b8;
  opacity: 1;
}

.swagger-ui .operation-filter-input:-ms-input-placeholder {
  color: #94a3b8;
}

.swagger-ui label {
  ${UPMAP_FONTS}
  font-weight: 400;
  color: ${UPMAP_COLORS.textPrimary};
  font-size: 14px;
}

.swagger-ui input[type="text"]:focus,
.swagger-ui input[type="password"]:focus,
.swagger-ui input[type="search"]:focus,
.swagger-ui input[type="email"]:focus,
.swagger-ui textarea:focus {
  border-color: ${UPMAP_COLORS.vibrantBlue};
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.swagger-ui .response-col_status[data-code="200"] {
  ${UPMAP_FONTS}
  color: #38a169;
  font-weight: 700;
}

.swagger-ui .response-col_status[data-code="400"],
.swagger-ui .response-col_status[data-code="401"],
.swagger-ui .response-col_status[data-code="403"],
.swagger-ui .response-col_status[data-code="404"] {
  ${UPMAP_FONTS}
  color: ${UPMAP_COLORS.orange};
  font-weight: 700;
}

.swagger-ui .response-col_status[data-code="500"] {
  ${UPMAP_FONTS}
  color: #c53030;
  font-weight: 700;
}

.swagger-ui ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.swagger-ui ::-webkit-scrollbar-track {
  background: #f7fafc;
  border-radius: 4px;
}

.swagger-ui ::-webkit-scrollbar-thumb {
  background: ${UPMAP_COLORS.vibrantBlue};
  border-radius: 4px;
}

.swagger-ui ::-webkit-scrollbar-thumb:hover {
  background: ${UPMAP_COLORS.darkBlue};
}

.swagger-ui .info .version {
  ${UPMAP_FONTS}
  background: none !important;
  color: ${UPMAP_COLORS.textSecondary};
  padding: 0;
  border-radius: 0;
  font-weight: 400;
  font-size: 14px;
  display: inline-block;
  margin-left: 8px;
  letter-spacing: 0;
  box-shadow: none !important;
}

/* Título principal com versão melhorada */
.swagger-ui .info hgroup.main h2.title {
  ${UPMAP_FONTS}
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Badge de versão dentro do título - Estilo clean e simples */
.swagger-ui .info hgroup.main h2.title span {
  ${UPMAP_FONTS}
  background: none !important;
  color: ${UPMAP_COLORS.textSecondary};
  padding: 0;
  border-radius: 0;
  font-weight: 400;
  font-size: 14px;
  letter-spacing: 0;
  box-shadow: none !important;
  display: inline-block;
  margin-left: 8px;
  line-height: 1.5;
}

/* Tipografia para todos os textos do Swagger UI */
.swagger-ui,
.swagger-ui p,
.swagger-ui span,
.swagger-ui div,
.swagger-ui h1,
.swagger-ui h2,
.swagger-ui h3,
.swagger-ui h4,
.swagger-ui h5,
.swagger-ui h6 {
  ${UPMAP_FONTS}
}

.swagger-ui .opblock-summary {
  ${UPMAP_FONTS}
  font-weight: 400;
}

.swagger-ui .opblock-summary-method {
  ${UPMAP_FONTS}
  font-weight: 700;
}

.swagger-ui .parameter__name {
  ${UPMAP_FONTS}
  font-weight: 400;
  color: ${UPMAP_COLORS.textPrimary};
}

.swagger-ui .parameter__type {
  ${UPMAP_FONTS}
  font-weight: 400;
  color: ${UPMAP_COLORS.textSecondary};
}

/* Descrição da operação - Tipografia e cores corretas */
.swagger-ui .opblock-description-wrapper,
.swagger-ui .opblock-description-wrapper * {
  ${UPMAP_FONTS}
  background: none !important;
  background-color: transparent !important;
  background-image: none !important;
}

.swagger-ui .opblock-description-wrapper p,
.swagger-ui .opblock-description-wrapper div,
.swagger-ui .opblock-description-wrapper span {
  ${UPMAP_FONTS}
  color: ${UPMAP_COLORS.textPrimary};
  font-weight: 400;
  font-size: 14px;
  line-height: 1.6;
}

/* Elementos code dentro da descrição - Cor Laranja UPMAP */
.swagger-ui .opblock-description-wrapper code,
.swagger-ui .opblock-description code,
.swagger-ui .renderedMarkdown code {
  ${UPMAP_FONTS}
  background: rgba(255, 107, 53, 0.1) !important;
  background-color: rgba(255, 107, 53, 0.1) !important;
  background-image: none !important;
  color: ${UPMAP_COLORS.orange};
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: 'Courier New', Courier, monospace;
}

.swagger-ui .opblock-description-wrapper code:hover,
.swagger-ui .opblock-description code:hover,
.swagger-ui .renderedMarkdown code:hover {
  background: rgba(255, 107, 53, 0.15) !important;
  border-color: rgba(255, 107, 53, 0.3);
}

.swagger-ui .wrapper {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.swagger-ui .model-example {
  background: #f7fafc;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

/* Links e elementos interativos */
.swagger-ui a {
  color: ${UPMAP_COLORS.vibrantBlue};
  transition: color 0.2s ease;
}

.swagger-ui a:hover {
  color: ${UPMAP_COLORS.orange};
}

/* Badge de método HTTP */
.swagger-ui .opblock.opblock-get .opblock-summary-method {
  background: ${UPMAP_COLORS.vibrantBlue};
}

.swagger-ui .opblock.opblock-post .opblock-summary-method {
  background: ${UPMAP_COLORS.orange};
}

.swagger-ui .opblock.opblock-put .opblock-summary-method {
  background: #fca130;
}

.swagger-ui .opblock.opblock-delete .opblock-summary-method {
  background: #f93e3e;
}

/* Input Download URL - Sem contorno */
.swagger-ui .download-url-input {
  ${UPMAP_FONTS}
  border: none !important;
  border-radius: 6px !important;
  padding: 10px 12px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  color: ${UPMAP_COLORS.textPrimary} !important;
  transition: all 0.2s ease !important;
  background: #ffffff !important;
  outline: none !important;
}

.swagger-ui .download-url-input:hover {
  box-shadow: none !important;
}

.swagger-ui .download-url-input:focus {
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

/* Botão Explore (Download URL) - Cor Laranja UPMAP */
.swagger-ui .download-url-button.button {
  ${UPMAP_FONTS}
  background: ${UPMAP_COLORS.orange} !important;
  border: none !important;
  border-radius: 6px !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  font-size: 14px !important;
  padding: 10px 20px !important;
  transition: all 0.2s ease !important;
  text-transform: none !important;
  cursor: pointer !important;
}

.swagger-ui .download-url-button.button:hover {
  background: #e55a2b !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 6px rgba(255, 107, 53, 0.3) !important;
}

.swagger-ui .download-url-button.button:focus {
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.3) !important;
}

.swagger-ui .download-url-button.button:active {
  transform: translateY(0) !important;
  box-shadow: 0 2px 4px rgba(255, 107, 53, 0.2) !important;
}
`;

export function getSwaggerUIHTML(docUrl: string, logoUrl: string = '/assets/logo.png'): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API UPMAP - Documentação</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    ${customCSS}
  </style>
</head>
<body>
  <!-- Header com Logo UPMAP -->
  <div class="upmap-header">
    <img src="${logoUrl}" alt="UPMAP Logo" class="upmap-logo" onerror="this.style.display='none';" />
    <div class="upmap-header-text">
      <h1 class="upmap-title">API UPMAP</h1>
      <p class="upmap-subtitle">Documentação da API - Gestão Inteligente</p>
    </div>
  </div>
  
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: "${docUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
      
      // Traduzir placeholder do filtro para português
      setTimeout(function() {
        const filterInput = document.querySelector('.operation-filter-input');
        if (filterInput) {
          filterInput.setAttribute('placeholder', 'Filtrar por tag');
        }
      }, 100);
      
      // Observar mudanças no DOM para garantir tradução
      const observer = new MutationObserver(function(mutations) {
        const filterInput = document.querySelector('.operation-filter-input');
        if (filterInput && filterInput.getAttribute('placeholder') !== 'Filtrar por tag') {
          filterInput.setAttribute('placeholder', 'Filtrar por tag');
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    };
  </script>
</body>
</html>`;
}
