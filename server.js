import dotenv from "dotenv";
dotenv.config();

import { exec } from "node:child_process";
import express from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import { Octokit } from "@octokit/rest";

// ---------------------------
// Servidor Express
// ---------------------------
const app = express();
app.use(fileUpload());
app.use(express.static("public"));

// ---------------------------
// Función para ejecutar bots con logs completos
// ---------------------------
function ejecutarBot(nombre, comando) {
  console.log(`🚀 Iniciando ${nombre}...`);

  const proceso = exec(comando);

  proceso.stdout.on("data", (data) => {
    process.stdout.write(`[${nombre} STDOUT] ${data}`);
  });

  proceso.stderr.on("data", (data) => {
    process.stderr.write(`[${nombre} STDERR] ${data}`);
  });

  proceso.on("error", (err) => {
    console.error(`[${nombre} ERROR]`, err);
  });

  proceso.on("close", (code) => {
    console.log(`[${nombre}] proceso cerrado con código: ${code}`);
    if (code === 0) {
      console.log(`✅ ${nombre} finalizó correctamente.`);
    } else {
      console.warn(`⚠️ ${nombre} terminó con errores.`);
    }
  });

  return proceso;
}

// ---------------------------
// Configuración GitHub
// ---------------------------
const REQUIRED_ENV_VARS = [
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO",
  "NOVELAS_JSON_GITHUB_PATH",
  "NOVELAS_ANUNCIADAS_GITHUB_PATH",
];

for (const v of REQUIRED_ENV_VARS) {
  if (!process.env[v]) {
    console.error(`❌ Error: La variable de entorno ${v} no está definida en .env`);
    process.exit(1);
  }
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const NOVELAS_JSON_GITHUB_PATH = process.env.NOVELAS_JSON_GITHUB_PATH;
const NOVELAS_ANUNCIADAS_GITHUB_PATH = process.env.NOVELAS_ANUNCIADAS_GITHUB_PATH;

let novelas = [];
let indiceActual = 0;

// ---------------------------
// Funciones para GitHub
// ---------------------------
async function cargarNovelasAnunciadas() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_ANUNCIADAS_GITHUB_PATH,
      ref: GITHUB_BRANCH,
    });
    const content = Buffer.from(data.content, "base64").toString("utf-8");
    const arr = JSON.parse(content);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (e) {
    if (e.status === 404) {
      console.warn(`[ADVERTENCIA] Archivo ${NOVELAS_ANUNCIADAS_GITHUB_PATH} no encontrado. Se usará lista vacía.`);
    } else {
      console.error(`[ERROR] No se pudo cargar novelas anunciadas:`, e.message || e);
    }
    return new Set();
  }
}

async function cargarNovelasDesdeGitHub() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_JSON_GITHUB_PATH,
      ref: GITHUB_BRANCH,
    });

    const content = Buffer.from(data.content, "base64").toString("utf-8");
    let arr = JSON.parse(content);
    if (!Array.isArray(arr)) arr = [];

    const anunciadas = await cargarNovelasAnunciadas();
    const nuevas = arr.filter((n) => !anunciadas.has(n.id));

    nuevas.forEach((novela) => {
      if (!novela.titulo || !novela.desc || !novela.peso || !novela.estado) {
        console.warn(`[ADVERTENCIA] Novela incompleta:`, novela);
      }
    });

    console.log(`[DEBUG] Novelas nuevas desde GitHub: ${nuevas.length}`);
    return nuevas;
  } catch (e) {
    if (e.status === 404) {
      console.warn(`[ADVERTENCIA] Archivo ${NOVELAS_JSON_GITHUB_PATH} no encontrado.`);
    } else {
      console.error(`[ERROR] No se pudo cargar JSON de novelas:`, e.message || e);
    }
    return [];
  }
}

// ---------------------------
// Rutas del servidor
// ---------------------------
app.get("/siguiente-novela", async (req, res) => {
  try {
    if (!novelas.length) {
      novelas = await cargarNovelasDesdeGitHub();
      indiceActual = 0;
    }
    if (indiceActual >= novelas.length) return res.json(null);
    res.json(novelas[indiceActual]);
  } catch (e) {
    console.error(`[ERROR] Al obtener la siguiente novela:`, e.message || e);
    res.status(500).json({ error: "Error al obtener la novela" });
  }
});

app.get("/", (req, res) => {
  res.send("Servidor en funcionamiento ✅");
});

// ---------------------------
// Iniciar servidor y luego ejecutar bots
// ---------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);

  // Ejecutar bots después de iniciar servidor
  ejecutarBot("Bot Discord", "node bot.js");
  ejecutarBot("Bot Telegram", "node bot-telegram-novelas.js");
});
