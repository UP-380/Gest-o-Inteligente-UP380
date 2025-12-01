# 🚀 Backend - UP Gestão Inteligente

## 📁 Estrutura

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js       # Configuração Supabase
│   │   └── cache.js          # Sistema de Cache
│   ├── controllers/
│   │   └── auth.controller.js # Controller de autenticação
│   ├── middleware/
│   │   └── auth.js           # Middleware de autenticação
│   ├── routes/
│   │   └── index.js          # Rotas principais
│   ├── services/
│   │   ├── api-clientes.js # Serviços de API (clientes, membros, contratos, etc.)
│   │   └── custo-membro-vigencia.service.js # Service de vigências de custo
│   ├── servers/
│   │   └── dashboard-clientes.js # Servidor separado (porta 4001)
│   └── index.js              # Ponto de entrada principal
└── package.json
```

## 🚀 Como Usar

### Servidor Principal (Porta 4000)
```bash
cd backend
npm install
npm start
# ou
node src/index.js
```

### Servidor Dashboard Clientes (Porta 4001)
```bash
cd backend
npm run dashboard-clientes
# ou
node src/servers/dashboard-clientes.js
```

## 📝 Notas de Migração

- Os arquivos originais (`node.js`, `api-clientes.js`) ainda estão na raiz
- Durante a migração gradual, o backend importa os arquivos originais
- As rotas e controllers serão migrados progressivamente
- O sistema continua funcionando normalmente durante a migração

## 🔄 Próximos Passos

1. Migrar rotas de `routes.js` para controllers individuais
2. Migrar serviços de `api-clientes.js` para `services/`
3. Atualizar imports após migração completa
4. Remover arquivos originais após migração completa

