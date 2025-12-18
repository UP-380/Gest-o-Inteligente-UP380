import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './TimerAtivo.css';

const TimerAtivo = () => {
  const { usuario } = useAuth();
  const [registroAtivo, setRegistroAtivo] = useState(null);
  const [tempoDecorrido, setTempoDecorrido] = useState(0);
  const [tarefaNome, setTarefaNome] = useState('');

  // Buscar registro ativo
  const buscarRegistroAtivo = async () => {
    if (!usuario || !usuario.id) {
      return;
    }

    try {
      // Buscar todos os registros ativos do usuário
      const response = await fetch(
        `/api/registro-tempo/ativos?usuario_id=${usuario.id}`,
        {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
          // Pegar o primeiro registro ativo (ou o mais recente)
          const registro = result.data[0];
          setRegistroAtivo(registro);
          
          // Buscar nome da tarefa (opcional, não bloqueia a exibição)
          if (registro.tarefa_id) {
            try {
              const tarefaResponse = await fetch(`/api/atividades/${registro.tarefa_id}`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
              });
              if (tarefaResponse.ok) {
                const tarefaResult = await tarefaResponse.json();
                if (tarefaResult.success && tarefaResult.data) {
                  setTarefaNome(tarefaResult.data.nome || 'Tarefa');
                }
              }
            } catch (error) {
              // Erro silencioso ao buscar nome da tarefa
            }
          }
        } else {
          setRegistroAtivo(null);
          setTarefaNome('');
        }
      } else {
        const errorText = await response.text();
        console.error('[TimerAtivo] Erro na resposta:', response.status, errorText);
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao buscar registro ativo:', error);
    }
  };

  useEffect(() => {
    if (!usuario || !usuario.id) {
      return;
    }

    buscarRegistroAtivo();
    
    // Buscar novamente a cada 3 segundos (mais frequente para detectar mudanças)
    const interval = setInterval(() => {
      buscarRegistroAtivo();
    }, 3000);
    
    // Escutar eventos de início/fim de registro
    const handleRegistroIniciado = () => {
      buscarRegistroAtivo();
    };
    
    const handleRegistroFinalizado = () => {
      buscarRegistroAtivo();
    };
    
    window.addEventListener('registro-tempo-iniciado', handleRegistroIniciado);
    window.addEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('registro-tempo-iniciado', handleRegistroIniciado);
      window.removeEventListener('registro-tempo-finalizado', handleRegistroFinalizado);
    };
  }, [usuario]);

  // Atualizar tempo decorrido em tempo real
  useEffect(() => {
    if (!registroAtivo || !registroAtivo.data_inicio) {
      setTempoDecorrido(0);
      return;
    }

    const atualizarTempo = () => {
      const agora = new Date();
      const inicio = new Date(registroAtivo.data_inicio);
      const diferenca = agora.getTime() - inicio.getTime();
      setTempoDecorrido(diferenca);
    };

    atualizarTempo();
    const interval = setInterval(atualizarTempo, 1000);
    return () => clearInterval(interval);
  }, [registroAtivo]);

  // Formatar tempo em formato HH:MM:SS (ex: "2:32:56")
  const formatarTempo = (milissegundos) => {
    if (!milissegundos || milissegundos === 0) return '0:00:00';
    
    const totalSegundos = Math.floor(milissegundos / 1000);
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    
    const horasStr = String(horas).padStart(1, '0');
    const minutosStr = String(minutos).padStart(2, '0');
    const segundosStr = String(segundos).padStart(2, '0');
    
    return `${horasStr}:${minutosStr}:${segundosStr}`;
  };

  // Parar o timer
  const handleParar = async () => {
    if (!registroAtivo || !usuario) return;

    try {
      const response = await fetch(`/api/registro-tempo/finalizar/${registroAtivo.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          tarefa_id: registroAtivo.tarefa_id,
          usuario_id: usuario.id
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setRegistroAtivo(null);
        setTarefaNome('');
        setTempoDecorrido(0);
        
        // Disparar evento customizado para atualizar o painel
        window.dispatchEvent(new CustomEvent('registro-tempo-finalizado'));
        
        // Buscar novamente para garantir que está atualizado
        setTimeout(() => {
          buscarRegistroAtivo();
        }, 500);
      } else {
        console.error('[TimerAtivo] Erro ao finalizar registro:', result);
        alert(result.error || 'Erro ao parar o timer');
      }
    } catch (error) {
      console.error('[TimerAtivo] Erro ao parar timer:', error);
      alert('Erro ao parar o timer');
    }
  };

  // Não mostrar se não houver registro ativo
  if (!registroAtivo) {
    return null;
  }

  return (
    <div className="timer-ativo-container">
      <div className="timer-ativo-tempo">
        {formatarTempo(tempoDecorrido)}
      </div>
      <button
        className="timer-ativo-stop-btn"
        onClick={handleParar}
        title="Parar registro de tempo"
        aria-label="Parar registro de tempo"
      >
        <i className="fas fa-stop"></i>
      </button>
    </div>
  );
};

export default TimerAtivo;

