// =============================================================
// === MIDDLEWARE DE TELEMETRIA E OBSERVALIBIDADE ===
// =============================================================

const { performance } = require('perf_hooks');

/**
 * Monitor do Event Loop Lag
 * Mede o atraso na execução de callbacks
 */
let lastCheck = performance.now();
let eventLoopLag = 0;

function monitorEventLoop() {
    const start = performance.now();
    setTimeout(() => {
        const end = performance.now();
        // O lag é a diferença entre o tempo planejado (0ms) e o tempo real de execução
        eventLoopLag = Math.max(0, end - start);

        // Log se o lag for crítico (> 100ms)
        if (eventLoopLag > 100) {
            console.log(`[TELEMETRY] {"type": "event_loop_alert", "lag_ms": ${eventLoopLag.toFixed(2)}, "timestamp": "${new Date().toISOString()}"}`);
        }

        lastCheck = end;
        monitorEventLoop();
    }, 1000); // Checagem a cada 1s
}

/**
 * Monitor de Recursos do Sistema
 * Mede RAM e CPU periodicamente
 */
function monitorResources() {
    setInterval(() => {
        const mem = process.memoryUsage();
        const data = {
            type: 'resource_usage',
            timestamp: new Date().toISOString(),
            memory: {
                rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
                heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
                heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
                external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`
            },
            event_loop_lag_ms: eventLoopLag.toFixed(2),
            uptime: `${process.uptime().toFixed(2)}s`
        };

        console.log(`[TELEMETRY] ${JSON.stringify(data)}`);
    }, 5000); // Log a cada 5s
}

/**
 * Middleware para medir latência de requisições
 */
function requestTelemetry(req, res, next) {
    const start = performance.now();

    // Interceptar a finalização da resposta
    res.on('finish', () => {
        const duration = performance.now() - start;
        const logData = {
            type: 'request',
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.baseUrl + req.path,
            status: res.statusCode,
            duration_ms: duration.toFixed(2),
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            user_id: req.session?.user?.id || 'anonymous'
        };

        // Log apenas se não for o healthcheck ou se demorar > 200ms
        if (logData.path !== '/health' || duration > 200) {
            console.log(`[TELEMETRY] ${JSON.stringify(logData)}`);
        }
    });

    next();
}

// Iniciar monitores de background se não for teste
if (process.env.NODE_ENV !== 'test') {
    monitorEventLoop();
    monitorResources();
}

module.exports = {
    requestTelemetry
};
