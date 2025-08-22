import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import path from 'path';
import snoowrap from 'snoowrap';

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

// Lista de novelas (puedes cargarla desde un JSON o GitHub)
let novelas = [
  { id: 1, titulo: 'The Perfect Paradise', desc: 'Un juego épico...', peso: '230 MB', estado: 'En desarrollo' },
  { id: 2, titulo: 'Grandma\'s House', desc: 'MC llega a casa...', peso: '1.7 GB', estado: 'En desarrollo' },
  { id: 3, titulo: 'Price of Power', desc: 'Aventura medieval...', peso: '645 MB', estado: 'En desarrollo' }
];
let indiceActual = 0;

// Ruta para obtener la siguiente novela
app.get('/siguiente-novela', (req, res) => {
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

app.listen(3000, () => console.log('Servidor escuchando en http://localhost:3000'));
