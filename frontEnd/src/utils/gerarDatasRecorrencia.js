export function gerarDatasRecorrencia({ inicio, fim, tipo, diasSemana, mensalOpcao, personalizado, feriados = {} }) {
    if (!inicio || !fim) {
        return [];
    }

    const dtInicio = new Date(inicio + 'T00:00:00');
    const dtFim = new Date(fim + 'T00:00:00');

    if (isNaN(dtInicio.getTime()) || isNaN(dtFim.getTime())) return [];

    const arrayDatas = [];
    let loop = new Date(dtInicio);
    let count = 0;

    // Aumentamos o limite para suportar recorrências de longo prazo (5 anos)
    const MAX_DATAS = 2000;

    const isDiaUtil = (date) => {
        const day = date.getDay();
        const dateStr = date.toISOString().split('T')[0];
        const isFeriado = feriados && feriados[dateStr];
        return day !== 0 && day !== 6 && !isFeriado;
    };

    if (tipo === 'diariamente' || (tipo === 'personalizado' && personalizado?.intervalo === 'dias')) {
        const step = tipo === 'diariamente' ? 1 : parseInt(personalizado?.repeteCada || 1);
        while (loop <= dtFim && count < 5000) {
            pushData(arrayDatas, loop);
            if (arrayDatas.length > MAX_DATAS) break;
            loop.setDate(loop.getDate() + step);
            count++;
        }
    } else if (tipo === 'semanalmente' || (tipo === 'personalizado' && personalizado?.intervalo === 'semanas')) {
        const step = tipo === 'semanalmente' ? 1 : parseInt(personalizado?.repeteCada || 1);
        const diasSelecionados = tipo === 'semanalmente' ? (Array.isArray(diasSemana) ? diasSemana : []) : [dtInicio.getDay()];

        if (diasSelecionados.length === 0) return [];

        let currentWeekStart = new Date(loop);
        currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Início da semana (Dom)

        while (currentWeekStart <= dtFim && count < 1000) {
            for (const dia of diasSelecionados) {
                let d = new Date(currentWeekStart);
                d.setDate(d.getDate() + dia);
                if (d >= dtInicio && d <= dtFim) {
                    pushData(arrayDatas, d);
                }
            }
            if (arrayDatas.length > MAX_DATAS) break;
            currentWeekStart.setDate(currentWeekStart.getDate() + (step * 7));
            count++;
        }
    } else if (tipo === 'mensalmente' || (tipo === 'personalizado' && personalizado?.intervalo === 'meses')) {
        const step = (tipo === 'mensalmente') ? 1 : parseInt(personalizado?.repeteCada || 1);
        const opcao = (tipo === 'mensalmente') ? mensalOpcao : 'mesmo_dia_mes';

        const inicioMonthDay = dtInicio.getDate();
        const inicioWeekDay = dtInicio.getDay();
        const inicioWeekNumber = Math.ceil(inicioMonthDay / 7);

        let currentMonth = new Date(dtInicio.getFullYear(), dtInicio.getMonth(), 1);

        while (currentMonth <= dtFim && count < 500) {
            let targetDate = null;

            if (opcao === 'mesmo_dia_mes') {
                targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), inicioMonthDay);
                // Ajuste para meses mais curtos (ex: 31 de Abril -> 30 de Abril)
                if (targetDate.getMonth() !== currentMonth.getMonth()) {
                    targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                }
            } else if (opcao === 'mesmo_dia_semana') {
                // n-ésimo dia da semana do mês
                targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                while (targetDate.getDay() !== inicioWeekDay) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
                targetDate.setDate(targetDate.getDate() + (inicioWeekNumber - 1) * 7);
                // Se passou do mês (ex: 5ª terça mas o mês só tem 4), pega a última? 
                // ClickUp geralmente oferece "Last Tuesday" explicitamente.
                // Aqui vamos manter a lógica do n-ésimo dia.
                if (targetDate.getMonth() !== currentMonth.getMonth()) {
                    targetDate = null;
                }
            } else if (opcao === 'primeiro_dia_util') {
                targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                while (!isDiaUtil(targetDate)) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }
            } else if (opcao === 'ultimo_dia_util') {
                targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                while (!isDiaUtil(targetDate)) {
                    targetDate.setDate(targetDate.getDate() - 1);
                }
            }

            if (targetDate && targetDate >= dtInicio && targetDate <= dtFim) {
                pushData(arrayDatas, targetDate);
            }

            if (arrayDatas.length > MAX_DATAS) break;
            currentMonth.setMonth(currentMonth.getMonth() + step);
            count++;
        }
    }

    // Ordenar e remover duplicatas (pode acontecer com step mensal/semanal complexo)
    return [...new Set(arrayDatas)].sort();
}

function pushData(array, date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    array.push(`${year}-${month}-${day}`);
}
