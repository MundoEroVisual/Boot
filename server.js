import dotenv from 'dotenv';
dotenv.config();


import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import snoowrap from 'snoowrap';
import { Octokit } from '@octokit/rest';

const app = express();
app.use(fileUpload());
app.use(express.static('public'));

// Config Reddit
const reddit = new snoowrap({
  userAgent: 'EroverseBot/1.0 by ' + process.env.REDDIT_USERNAME,
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD
});
const SUBREDDIT = process.env.REDDIT_SUBREDDIT;


// Config GitHub
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const NOVELAS_JSON_GITHUB_PATH = process.env.NOVELAS_JSON_GITHUB_PATH;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

let novelas = [];
let indiceActual = 0;


// Cargar novelas ya anunciadas desde GitHub
async function cargarNovelasAnunciadas() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: process.env.NOVELAS_ANUNCIADAS_GITHUB_PATH,
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
    // Filtrar novelas ya anunciadas
    const anunciadas = await cargarNovelasAnunciadas();
    const nuevas = arr.filter(n => !anunciadas.has(n.id));
    // Advertir si faltan campos importantes
    nuevas.forEach(novela => {
      if (!novela.titulo || !novela.desc || !novela.peso || !novela.estado) {
        console.warn(`\x1b[33m[ADVERTENCIA] Novela con datos incompletos:`, novela, '\x1b[0m');
      }
    });
    console.log('\x1b[36m[DEBUG] Novelas nuevas desde GitHub:', nuevas.length, '\x1b[0m');
    return nuevas;
  } catch (e) {
    console.error('\x1b[31m[ERROR] No se pudo cargar el JSON de novelas desde GitHub:', e.message || e, '\x1b[0m');
    return [];
  }
}



// Ruta para obtener la siguiente novela (solo no anunciadas)
app.get('/siguiente-novela', async (req, res) => {
  // Si la lista está vacía o es la primera vez, cargar desde GitHub
  if (!novelas.length) {
    novelas = await cargarNovelasDesdeGitHub();
    indiceActual = 0;
  }
  if (indiceActual >= novelas.length) return res.json(null);
  res.json(novelas[indiceActual]);
});

// Ruta para subir la imagen y publicar en Reddit
app.post('/subir-novela', async (req, res) => {
  if (!req.files || !req.files.imagen) return res.status(400).send('No se subió imagen');

  const imagen = req.files.imagen;
  const { novelaId, titulo, desc, peso, estado } = req.body;
  // Permitir campo android opcional
  const android = req.body.android || '';

  // Log de depuración de los datos recibidos
  console.log('\x1b[36m[DEBUG] Datos recibidos en /subir-novela:\x1b[0m');
  console.dir({ novelaId, titulo, desc, peso, estado, imagen: imagen?.name }, { depth: null, colors: true });
  if (!titulo || !desc || !peso || !estado) {
    console.warn('\x1b[33m[ADVERTENCIA] Algún campo importante está vacío o undefined.\x1b[0m');
  }

  // Guardar imagen
  const uploadPath = path.join('uploads', `${novelaId}`);
  fs.mkdirSync(uploadPath, { recursive: true });
  const filePath = path.join(uploadPath, imagen.name);
  await imagen.mv(filePath);

  // Preparar mensaje para Reddit (texto del post)
  let mensaje = `${desc ? desc + '\n\n' : ''}`;
  mensaje += `📊 Estado: ${estado || 'Desconocido'}\n`;
  mensaje += `💾 Peso: ${peso || 'Desconocido'}\n`;
  mensaje += `🌐 Idioma: Español\n`;
  if (android) {
    mensaje += `📱 [Descargar para Android](${android})\n`;
  }

  // URL pública de la imagen subida
  const urlImagen = `${req.protocol}://${req.get('host')}/uploads/${novelaId}/${imagen.name}`;

  try {
    // Publicar como post tipo link para que se muestre la imagen
    await reddit.getSubreddit(SUBREDDIT).submitLink({
      title: `📖 ${titulo || 'Sin título'}`,
      url: urlImagen,
      sendReplies: false
    });
    // Comentar el post con la descripción y enlaces
    const lastPost = await reddit.getSubreddit(SUBREDDIT).getNew().then(posts => posts[0]);
    if (lastPost) {
      await lastPost.reply(mensaje);
    }
    console.log(`\x1b[32m✅ Novela publicada en Reddit (imagen link): ${titulo || 'Sin título'}\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m❌ Error publicando en Reddit: ${err?.message || err}\x1b[0m`);
  }

  indiceActual++;
  res.json({ ok: true });
});

// Endpoint para ejecutar el bot manualmente desde el frontend
import { exec } from 'child_process';
app.post('/ejecutar-bot', (req, res) => {
  exec('node bot.js', (error, stdout, stderr) => {
    if (error) {
      console.error('Error ejecutando bot.js:', error);
      return res.status(500).send('Error ejecutando el bot');
    }
    console.log('Bot ejecutado manualmente desde el frontend.');
    res.send('Bot ejecutado correctamente');
  });
});

app.listen(3000, () => console.log('Servidor escuchando en http://localhost:3000'));
