import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Octokit } from '@octokit/rest';
dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8370263454:AAH8kyMqQMkSWewPK9tXgaYosFbRyjknV04';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '-1002812250240';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const NOVELAS_JSON_GITHUB_PATH = 'data/novelas-1.json';
const NOVELAS_ANUNCIADAS_GITHUB_PATH = 'data/novelasAnunciadasTelegram.json';

const bot = new TelegramBot(TELEGRAM_TOKEN);
const octokit = new Octokit({ auth: GITHUB_TOKEN });

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
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
  console.error('Error leyendo novelas desde GitHub:', e?.message || e);
    return [];
  }
}

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
  } catch (e) {
    // Si no existe el archivo, retorna set vacío
    return new Set();
  }
}

async function guardarNovelasAnunciadas(set) {
  const arr = Array.from(set);
  let sha = undefined;
  try {
    // Obtener SHA si el archivo existe
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: NOVELAS_ANUNCIADAS_GITHUB_PATH,
      ref: GITHUB_BRANCH
    });
    sha = data.sha;
  } catch (e) {
    // Si no existe, lo creamos
  }
  await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: NOVELAS_ANUNCIADAS_GITHUB_PATH,
    message: 'Actualizar novelas anunciadas en Telegram',
    content: Buffer.from(JSON.stringify(arr, null, 2)).toString('base64'),
    branch: GITHUB_BRANCH,
    sha
  });
}

async function getNuevasNovelas() {
  const novelas = await cargarNovelasDesdeGitHub();
  const anunciadas = await cargarNovelasAnunciadas();
  return novelas.filter(novela => !anunciadas.has(novela.id));
}

async function enviarNovelaTelegram(novela) {
    let mensaje = `📖 *${novela.titulo}*\n`;
    mensaje += `${novela.desc ? novela.desc + '\n' : ''}`;
    if (novela.generos && novela.generos.length > 0) {
      mensaje += `🎭 *Géneros:* ${novela.generos.join(', ')}\n`;
    }
    if (novela.estado) {
      mensaje += `📊 *Estado:* ${novela.estado}\n`;
    }
    if (novela.peso) {
      mensaje += `💾 *Peso:* ${novela.peso}\n`;
    }
    if (novela.fecha) {
      mensaje += `📅 *Fecha:* ${novela.fecha}\n`;
    }
    // No mostrar texto de spoilers ni enlaces, solo las imágenes
    if (novela.android) {
      mensaje += `📱 [Android](<${novela.android}>)\n`;
    }
    if (novela.android_vip) {
      mensaje += `🔒 [Android VIP](<${novela.android_vip}>)\n`;
    }
    if (novela.pc) {
      mensaje += `💻 [PC](<${novela.pc}>)\n`;
    }
    if (novela.pc_traduccion) {
      mensaje += `🌐 [PC Traducción](<${novela.pc_traduccion}>)\n`;
    }
    if (novela.pc_vip) {
      mensaje += `🔒 [PC VIP](<${novela.pc_vip}>)\n`;
    }
    if (novela.pc_traduccion_vip) {
      mensaje += `🌐🔒 [PC Traducción VIP](<${novela.pc_traduccion_vip}>)\n`;
    }
    // Acortar el enlace público usando la API de Cuty
    const enlaceOriginal = `https://eroverse.onrender.com/novela.html?id=${novela.id}`;
    let enlaceCuty = enlaceOriginal;
    try {
      const cutyToken = process.env.CUTY_TOKEN_AMIGO || '1da78acf599a92323be9c1f53';
      const cutyRes = await fetch(`https://cutt.ly/api/api.php?key=${cutyToken}&short=${encodeURIComponent(enlaceOriginal)}`);
      const cutyJson = await cutyRes.json();
      if (cutyJson.url && cutyJson.url.status === 7) {
        enlaceCuty = cutyJson.url.shortLink;
      } else {
        console.error('Error acortando enlace con Cuty:', cutyJson.url);
      }
    } catch (e) {
      console.error('Error llamando a la API de Cuty:', e?.message || e);
    }
    mensaje += `\n[Ver en Eroverse](${enlaceCuty})`;

    // Enviar portada y spoilers como imágenes antes del mensaje
    // Filtrar solo imágenes válidas para Telegram
    const isValidImage = url => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
    const images = [];
    if (novela.portada && isValidImage(novela.portada)) images.push(novela.portada);
    if (novela.spoilers && Array.isArray(novela.spoilers)) {
      images.push(...novela.spoilers.filter(isValidImage));
    }

    // Enviar todas las imágenes como grupo si hay más de una
    if (images.length > 0) {
      const mediaGroup = images.map((url, idx) => ({
        type: 'photo',
        media: url,
        caption: idx === 0 ? mensaje : undefined,
        parse_mode: idx === 0 ? 'Markdown' : undefined
      }));
      // Enviar el grupo y si alguna imagen falla, Telegram la omite automáticamente
      return bot.sendMediaGroup(TELEGRAM_CHANNEL_ID, mediaGroup).catch(async err => {
        if (err?.response?.body?.error_code === 429) {
          console.error(`Rate limit de Telegram: espera ${err.response.body.parameters.retry_after} segundos`);
        } else {
          console.error(`Error enviando grupo de imágenes: ${err?.message || err}`);
        }
        // Si el grupo falla, intenta enviar la primera imagen válida con el mensaje como caption
        try {
          await bot.sendPhoto(TELEGRAM_CHANNEL_ID, images[0], {
            caption: mensaje,
            parse_mode: 'Markdown'
          });
        } catch (imgErr) {
          if (imgErr?.response?.body?.error_code === 429) {
            console.error(`Rate limit de Telegram: espera ${imgErr.response.body.parameters.retry_after} segundos`);
          } else {
            console.error(`Error enviando imagen individual: ${imgErr?.message || imgErr}`);
          }
          // Si también falla, enviar solo el mensaje
          return bot.sendMessage(TELEGRAM_CHANNEL_ID, mensaje, { parse_mode: 'Markdown', disable_web_page_preview: false });
        }
      });
    } else {
      return bot.sendMessage(TELEGRAM_CHANNEL_ID, mensaje, { parse_mode: 'Markdown', disable_web_page_preview: false });
    }
}

async function anunciarNuevasNovelas() {
  const nuevas = await getNuevasNovelas();
  if (nuevas.length === 0) {
  console.log('No hay novelas nuevas para anunciar.');
    return;
  }
  const anunciadas = await cargarNovelasAnunciadas();
  for (const novela of nuevas) {
    try {
      await enviarNovelaTelegram(novela);
  console.log(`✅ Novela anunciada en Telegram: ${novela.titulo}`);
      anunciadas.add(novela.id);
      await guardarNovelasAnunciadas(anunciadas);
    } catch (err) {
      if (err?.response?.body?.error_code === 429) {
        console.error(`Rate limit de Telegram: espera ${err.response.body.parameters.retry_after} segundos`);
      } else {
        console.error(`❌ Error enviando a Telegram: ${err?.message || err}`);
      }
    }
  }
}

// Ejecuta el anuncio al iniciar
anunciarNuevasNovelas();

// Si quieres que revise cada cierto tiempo, descomenta:
// setInterval(anunciarNuevasNovelas, 5 * 60 * 1000); // cada 5 minutos
