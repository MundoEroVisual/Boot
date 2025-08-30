
import express from 'express';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint básico para ping
app.get('/', (req, res) => res.send('Servidor en funcionamiento ✅'));

// Mantener el bot principal y el bot de comercio siempre encendidos
function keepBotAlive(script) {
    const lanzar = () => {
        const proceso = spawn('node', [script], { stdio: 'inherit' });
        proceso.on('close', () => {
            setTimeout(lanzar, 5000);
        });
        proceso.on('error', () => {
            setTimeout(lanzar, 5000);
        });
    };
    lanzar();
}

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
    keepBotAlive('bot.js');
    keepBotAlive('bot-comercio.js');
    setInterval(() => {
        fetch(`http://localhost:${PORT}/`).catch(() => {});
    }, 3 * 60 * 1000);
});
