"""
Script para executar a aplicação FastAPI
"""
import uvicorn
import os
import sys

# Adicionar o diretório atual ao path para importar a aplicação
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 Iniciando UP Gestão Inteligente - Versão Python")
    print("📍 Servidor rodando em: http://localhost:3001")
    print("🔄 Versão híbrida - Frontend JavaScript + Backend Python")
    print("=" * 60)
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3001,
        reload=True,  # Recarregar automaticamente em desenvolvimento
        log_level="info"
    )