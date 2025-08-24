import { exec } from "node:child_process";
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';

const app = express();
app.use(fileUpload());
app.use(express.static('public'));

// Función para ejecutar un bot y mostrar toda la información
function ejecutarBot(nombre, comando) {
  console.log(`🚀 Iniciando ${nombre}...`);

  const proceso = exec(comando);

  proceso.stdout.on('data', data => {
    process.stdout.write(`[${nombre} STDOUT] ${data}`);
  });

  proceso.stderr.on('data', data => {
    process.stderr.write(`[${nombre} STDERR] ${data}`);
  });

  proceso.on('error', err => {
    console.error(`[${nombre} ERROR]`, err);
  });

  proceso.on('close', code => {
    console.log(`[${nombre}] proceso cerrado con código: ${code}`);
    if (code === 0) {
      console.log(`✅ ${nombre} finalizó correctamente.`);
    } else {
      console.warn(`⚠️ ${nombre} terminó con errores.`);
    }
  });

  return proceso;
}

// Ejecutar bots automáticamente
ejecutarBot("Bot Discord", "node bot.js");
ejecutarBot("Bot Telegram", "node bot-telegram-novelas.js");

// Config GitHub
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const NOVELAS_JSON_GITHUB_PATH = process.env.NOVELAS_JSON_GITHUB_PATH;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const NOVELAS_ANUNCIADAS_GITHUB_PATH = process.env.NOVELAS_ANUNCIADAS_GITHUB_PATH;

let novelas = [];
let indiceActual = 0;

// Cargar novelas ya anunciadas desde GitHub
async function cargarNovelasAnunciadas() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_ANUNCIADAS_GITHUB_PATH,
      ref: GITHUB_BRANCH
    });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const arr = JSON.parse(content);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

// Cargar novelas desde GitHub y filtrar las ya anunciadas
async function cargarNovelasDesdeGitHub() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_JSON_GITHUB_PATH,
      ref: GITHUB_BRANCH
    });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    let arr = JSON.parse(content);
    if (!Array.isArray(arr)) arr = [];

    const anunciadas = await cargarNovelasAnunciadas();
    const nuevas = arr.filter(n => !anunciadas.has(n.id));

    nuevas.forEach(novela => {
      if (!novela.titulo || !novela.desc || !novela.peso || !novela.estado) {
        console.warn(`[ADVERTENCIA] Novela incompleta:`, novela);
      }
    });

    console.log(`[DEBUG] Novelas nuevas desde GitHub: ${nuevas.length}`);
    return nuevas;
  } catch (e) {
    console.error(`[ERROR] No se pudo cargar JSON de novelas:`, e.message || e);
    return [];
  }
}

// Ruta para obtener la siguiente novela (solo no anunciadas)
app.get('/siguiente-novela', async (req, res) => {
  if (!novelas.length) {
    novelas = await cargarNovelasDesdeGitHub();
    indiceActual = 0;
  }
  if (indiceActual >= novelas.length) return res.json(null);
  res.json(novelas[indiceActual]);
});

// Iniciar servidor
app.listen(3000, () => console.log('Servidor escuchando en http://localhost:3000'));
