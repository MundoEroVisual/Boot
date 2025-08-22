
import dotenv from 'dotenv';
dotenv.config();
import snoowrap from 'snoowrap';
import { Octokit } from '@octokit/rest';
import fs from 'fs';

// Colores para consola
const color = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  fgGreen: '\x1b[32m',
  fgRed: '\x1b[31m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgCyan: '\x1b[36m',
  fgMagenta: '\x1b[35m',
  fgWhite: '\x1b[37m',
  fgGray: '\x1b[90m',
};

// Config Reddit
const reddit = new snoowrap({
  userAgent: 'EroverseBot/1.0 by ' + process.env.REDDIT_USERNAME,
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD
});

const REDDIT_SUBREDDIT = process.env.REDDIT_SUBREDDIT || 'MundoEroVisual';

// Config GitHub
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const NOVELAS_JSON_GITHUB_PATH = process.env.NOVELAS_JSON_GITHUB_PATH;
const NOVELAS_ANUNCIADAS_GITHUB_PATH = process.env.NOVELAS_ANUNCIADAS_GITHUB_PATH;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

// Cargar novelas desde GitHub
async function cargarNovelasDesdeGitHub() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_JSON_GITHUB_PATH,
      ref: GITHUB_BRANCH
    });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const arr = JSON.parse(content);
    console.log(`${color.fgCyan}📦 Novelas cargadas desde GitHub: ${color.fgGreen}${Array.isArray(arr) ? arr.length : 0}${color.reset}`);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.error(`${color.fgRed}❌ Error leyendo novelas desde GitHub:${color.reset} ${e.message || e}`);
    return [];
  }
}

// Cargar novelas ya anunciadas
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
    console.log(`${color.fgCyan}📚 Novelas ya anunciadas: ${color.fgYellow}${Array.isArray(arr) ? arr.length : 0}${color.reset}`);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    console.log(`${color.fgGray}ℹ️  No hay registro previo de novelas anunciadas.${color.reset}`);
    return new Set();
  }
}

// Guardar novelas anunciadas
async function guardarNovelasAnunciadas(set) {
  const arr = Array.from(set);
  let sha;
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_ANUNCIADAS_GITHUB_PATH,
      ref: GITHUB_BRANCH
    });
    sha = data.sha;
  } catch {}
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: NOVELAS_ANUNCIADAS_GITHUB_PATH,
    message: 'Actualizar novelas anunciadas en Reddit',
    content: Buffer.from(JSON.stringify(arr, null, 2)).toString('base64'),
    branch: GITHUB_BRANCH,
    sha
  });
  console.log(`${color.fgMagenta}💾 Registro actualizado de novelas anunciadas (${arr.length})${color.reset}`);
}

// Obtener nuevas novelas
async function getNuevasNovelas() {
  const novelas = await cargarNovelasDesdeGitHub();
  const anunciadas = await cargarNovelasAnunciadas();
  const nuevas = novelas.filter(n => !anunciadas.has(n.id));
  console.log(`${color.fgBlue}🔎 Novelas nuevas para anunciar: ${color.fgGreen}${nuevas.length}${color.reset}`);
  return nuevas;
}

// Subir novela a Reddit como link post (para que se vea la imagen)
async function enviarNovelaReddit(novela) {
  // Log de depuración para ver los datos reales de la novela
  console.log(`${color.fgYellow}📝 Datos de la novela a publicar:${color.reset}`);
  console.dir(novela, { depth: null, colors: true });
  // Sanitizar y asegurar que no haya undefined
  const titulo = `📖 ${novela.titulo || 'Sin título'}`;
  const descripcion = novela.desc || 'Sin descripción.';
  const estado = novela.estado || 'Desconocido';
  const peso = novela.peso || 'Desconocido';
  const portada = novela.portada && novela.portada.startsWith('http') ? novela.portada : null;
  const enlace = `https://eroverse.onrender.com/novela.html?id=${novela.id || ''}`;

  // Formato bonito en Markdown
  let mensaje = `**${titulo}**\n\n`;
  mensaje += `> ${descripcion}\n\n`;
  mensaje += `📊 **Estado:** ${estado}  \n`;
  mensaje += `💾 **Peso:** ${peso}  \n`;
  mensaje += `🌐 **Idioma:** Español  \n`;
  mensaje += `\n[🔗 Enlace público a la novela](${enlace})`;
  if (portada) {
    mensaje += `\n\n---\n\n`;
    mensaje += `![Portada de la novela](${portada})`;
  }

  try {
    // Siempre usar selfpost para poder mostrar Markdown y la imagen embebida
    await reddit.getSubreddit(REDDIT_SUBREDDIT).submitSelfpost({
      title: titulo,
      text: mensaje
    });
    console.log(`${color.fgGreen}✅ Publicada en Reddit:${color.reset} ${color.bright}${novela.titulo}${color.reset} ${color.fgCyan}[ID: ${novela.id}]${color.reset}`);
  } catch (err) {
    console.error(`${color.fgRed}❌ Error publicando en Reddit:${color.reset} ${err?.message || err}`);
  }
}

// Función principal
async function anunciarNuevasNovelas() {
  const nuevas = await getNuevasNovelas();
  if (!nuevas.length) {
    console.log(`${color.fgYellow}✨ No hay novelas nuevas para anunciar.${color.reset}`);
    return;
  }
  console.log(`${color.fgMagenta}🚀 Anunciando ${nuevas.length} novela(s) nueva(s)...${color.reset}`);
  const anunciadas = await cargarNovelasAnunciadas();
  for (const novela of nuevas) {
    try {
      await enviarNovelaReddit(novela);
      anunciadas.add(novela.id);
      await guardarNovelasAnunciadas(anunciadas);
    } catch (err) {
      console.error(`${color.fgRed}❌ Error publicando en Reddit:${color.reset} ${err?.message || err}`);
    }
  }
  console.log(`${color.fgGreen}🎉 Proceso de anuncios finalizado.${color.reset}`);
}

// El bot solo se ejecutará cuando se llame manualmente desde el frontend (no automático)
