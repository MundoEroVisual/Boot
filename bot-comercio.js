// Forzar refresco de comandos: eliminar todos los comandos globales y registrar los nuevos
async function forceRefreshCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  try {
    // Eliminar todos los comandos globales
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log('Comandos globales eliminados.');
    // Registrar los comandos nuevos
    await registerCommands();
    console.log('Comandos globales actualizados.');
  } catch (e) {
    console.error('Error forzando refresco de comandos:', e);
  }
}
import { Client, GatewayIntentBits, Partials, REST, Routes, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const DISCORD_TOKEN = process.env.COMERCIO_DISCORD_TOKEN;
const CLIENT_ID = process.env.COMERCIO_CLIENT_ID;
const GITHUB_TOKEN = process.env.COMERCIO_GITHUB_TOKEN;
const GITHUB_REPO = 'MundoEroVisual/Boot';
const GITHUB_BRANCH = process.env.COMERCIO_GITHUB_BRANCH || 'main';
// Ruta del archivo de datos en GitHub (siempre en /data)
const GITHUB_DATA_PATH = 'data/eroshop.json';
const LOCAL_DATA_PATH = './eroshop_temp.json';

// Utilidad para interactuar con el JSON en GitHub
// Estructura base para el JSON si no existe
const BASE_DATA = {
  users: {},
  shop: [
  { id: 'vip1d', name: 'VIP 1 Día', price: 50, emoji: '👑' },
  { id: 'vip7d', name: 'VIP 2 Días', price: 100, emoji: '👑' },
  { id: 'vip1m', name: 'VIP 3 Días', price: 150, emoji: '👑' },
  { id: 'vip3m', name: 'VIP 7 Días', price: 400, emoji: '👑' },
    { id: 'color', name: 'Color de Nickname', price: 25, emoji: '🎨' },
    { id: 'fondo', name: 'Fondo Personalizado', price: 40, emoji: '🖼️' },
    { id: 'titulo', name: 'Título personal', price: 45, emoji: '🧬' },
    { id: 'sticker', name: 'Sticker personalizado', price: 90, emoji: '🖼️' },
    { id: 'anuncio', name: 'Anuncio personalizado', price: 80, emoji: '📢' },
    { id: 'caja', name: 'Caja Sorpresa', price: 70, emoji: '🎁' }
  ],
  missions: [
    { id: 'comentar', name: 'Comentar en Video', desc: 'Comenta en un video', gems: 5, points: 10, emoji: '💬' },
    { id: 'ver', name: 'Ver Video Completo', desc: 'Ver un video completo', gems: 3, points: 5, emoji: '👀' },
    { id: 'compartir', name: 'Compartir Video', desc: 'Comparte un video', gems: 10, points: 15, emoji: '📤' },
    { id: 'suscribir', name: 'Suscribirse al Canal', desc: 'Suscríbete al canal', gems: 20, points: 25, emoji: '🔔' },
    { id: 'creativo', name: 'Comentario Creativo', desc: 'Comentario creativo (10+ palabras)', gems: 7, points: 10, emoji: '✍️' },
    { id: 'pregunta', name: 'Responder Pregunta', desc: 'Responde una pregunta del video', gems: 8, points: 12, emoji: '🧠' },
    { id: 'fanart', name: 'Fanart/Miniatura', desc: 'Crea fanart o miniatura', gems: 30, points: 40, emoji: '🎨' },
    { id: 'easteregg', name: 'Huevo de Pascua', desc: 'Encuentra un huevo de pascua', gems: 15, points: 25, emoji: '🕵️' },
    { id: 'historia', name: 'Historia/Red Social', desc: 'Sube historia con el video', gems: 20, points: 25, emoji: '📸' },
    { id: 'etiqueta', name: 'Etiquetar Amigo', desc: 'Etiqueta a un amigo', gems: 5, points: 10, emoji: '👥' },
    { id: 'encuesta', name: 'Participar en Encuesta', desc: 'Participa en encuesta', gems: 5, points: 10, emoji: '🧪' },
    { id: 'captura', name: 'Captura en #pruebas', desc: 'Envía captura en #pruebas', gems: 3, points: 5, emoji: '📩' },
    { id: 'codigo', name: 'Código Secreto', desc: 'Comenta código secreto', gems: 10, points: 20, emoji: '🎁' },
    { id: 'top', name: 'Top 3 Semana', desc: 'Top 3 más activos', gems: 0, points: 50, emoji: '🔥' },
    { id: 'semanal', name: 'Misión Semanal', desc: 'Misión sorpresa semanal', gems: 0, points: 0, emoji: '🎯' },
    { id: 'trivia', name: 'Trivia', desc: 'Responde trivia', gems: 10, points: 0, emoji: '🧠' }
  ]
};

async function getShopData() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (res.status === 404) {
    // Crear archivo base en GitHub si no existe
    const base = { ...BASE_DATA };
    base.shop = [...BASE_DATA.shop, ...EXTRA_SHOP_ITEMS];
    await saveShopData(base);
    return base;
  }
  const data = await res.json();
  if (!data.content) {
    // Si no hay contenido, crear archivo base
    const base = { ...BASE_DATA };
    base.shop = [...BASE_DATA.shop, ...EXTRA_SHOP_ITEMS];
    await saveShopData(base);
    return base;
  }
  const content = Buffer.from(data.content, 'base64').toString('utf-8');
  const json = JSON.parse(content);
  // Fusionar artículos extra si faltan
  const ids = new Set(json.shop.map(i => i.id));
  EXTRA_SHOP_ITEMS.forEach(item => {
    if (!ids.has(item.id)) json.shop.push(item);
  });
  return json;
}

// Artículos extra para la tienda
const EXTRA_SHOP_ITEMS = [
  { id: 'vip6m', name: 'VIP 10 dias', price: 600, emoji: '👑' },
  { id: 'vip12m', name: 'VIP 1 mes', price: 3000, emoji: '👑' },
  { id: 'caja_premium', name: 'Caja Sorpresa Premium', price: 200, emoji: '🎁' },
  { id: 'emoji_personal', name: 'Emoji Personalizado', price: 120, emoji: '😃' },
  { id: 'rol_personal', name: 'Rol Personalizado', price: 250, emoji: '🏷️' }
];

async function saveLocalTempData(json) {
  await fs.promises.writeFile(LOCAL_DATA_PATH, JSON.stringify(json, null, 2), 'utf-8');
}

async function loadLocalTempData() {
  try {
    const content = await fs.promises.readFile(LOCAL_DATA_PATH, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Modificar saveShopData para reintentar y usar local
async function saveShopData(json, maxRetries = 3) {
  await saveLocalTempData(json); // Guardar local primero
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${GITHUB_DATA_PATH}`;
  let sha = undefined;
  for (let intento = 0; intento < maxRetries; intento++) {
    // Obtener SHA actual
    const res = await fetch(url, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.status === 200) {
      const data = await res.json();
      sha = data.sha;
    }
    const body = {
      message: 'Update eroshop.json by bot',
      content: Buffer.from(JSON.stringify(json, null, 2)).toString('base64'),
      sha: sha,
      branch: GITHUB_BRANCH // <-- importante para rama correcta
    };
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' },
      body: JSON.stringify(body)
    });
    if (putRes.ok) {
      // Si se guarda en GitHub, borrar local
      await fs.promises.unlink(LOCAL_DATA_PATH).catch(() => {});
      return;
    } else {
      const errorText = await putRes.text();
      console.error('Error al guardar en GitHub:', errorText);
    }
    // Si hay conflicto, reintentar
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('No se pudo guardar en GitHub tras varios intentos. El cambio persiste localmente.');
}

// Estructura de datos en GitHub:
// {
//   "users": { "userId": { gems, points, level, inventory, lastDaily, completedMissions: [] } },
//   "shop": [ { id, name, price, emoji } ],
//   "missions": [ { id, name, desc, gems, points, emoji } ]
// }

// Leer tienda y misiones desde GitHub
async function getConfigData() {
  const data = await getShopData();
  if (!data.shop) data.shop = SHOP_ITEMS;
  if (!data.missions) data.missions = [
    { id: 'comentar', name: 'Comentar en Video', desc: 'Comenta en un video', gems: 5, points: 10, emoji: '💬' },
    { id: 'ver', name: 'Ver Video Completo', desc: 'Ver un video completo', gems: 3, points: 5, emoji: '👀' },
    { id: 'compartir', name: 'Compartir Video', desc: 'Comparte un video', gems: 10, points: 15, emoji: '📤' },
    { id: 'suscribir', name: 'Suscribirse al Canal', desc: 'Suscríbete al canal', gems: 20, points: 25, emoji: '🔔' },
    { id: 'creativo', name: 'Comentario Creativo', desc: 'Comentario creativo (10+ palabras)', gems: 7, points: 10, emoji: '✍️' },
    { id: 'pregunta', name: 'Responder Pregunta', desc: 'Responde una pregunta del video', gems: 8, points: 12, emoji: '🧠' },
    { id: 'fanart', name: 'Fanart/Miniatura', desc: 'Crea fanart o miniatura', gems: 30, points: 40, emoji: '🎨' },
    { id: 'easteregg', name: 'Huevo de Pascua', desc: 'Encuentra un huevo de pascua', gems: 15, points: 25, emoji: '🕵️' },
    { id: 'historia', name: 'Historia/Red Social', desc: 'Sube historia con el video', gems: 20, points: 25, emoji: '📸' },
    { id: 'etiqueta', name: 'Etiquetar Amigo', desc: 'Etiqueta a un amigo', gems: 5, points: 10, emoji: '👥' },
    { id: 'encuesta', name: 'Participar en Encuesta', desc: 'Participa en encuesta', gems: 5, points: 10, emoji: '🧪' },
    { id: 'captura', name: 'Captura en #pruebas', desc: 'Envía captura en #pruebas', gems: 3, points: 5, emoji: '📩' },
    { id: 'codigo', name: 'Código Secreto', desc: 'Comenta código secreto', gems: 10, points: 20, emoji: '🎁' },
    { id: 'top', name: 'Top 3 Semana', desc: 'Top 3 más activos', gems: 0, points: 50, emoji: '🔥' },
    { id: 'semanal', name: 'Misión Semanal', desc: 'Misión sorpresa semanal', gems: 0, points: 0, emoji: '🎯' },
    { id: 'trivia', name: 'Trivia', desc: 'Responde trivia', gems: 10, points: 0, emoji: '🧠' }
  ];
  return data;
}

// Productos de la tienda (puedes expandir esto)
const SHOP_ITEMS = [
  { id: 'vip1d', name: 'VIP 1 Día', price: 50, emoji: '👑' },
  { id: 'vip7d', name: 'VIP 2 Días', price: 100, emoji: '👑' },
  { id: 'vip1m', name: 'VIP 3 Días', price: 150, emoji: '👑' },
  { id: 'vip3m', name: 'VIP 7 Días', price: 400, emoji: '👑' },
  { id: 'color', name: 'Color de Nickname', price: 25, emoji: '🎨' },
  { id: 'fondo', name: 'Fondo Personalizado', price: 40, emoji: '🖼️' },
  { id: 'titulo', name: 'Título personal', price: 45, emoji: '🧬' },
  { id: 'sticker', name: 'Sticker personalizado', price: 90, emoji: '🖼️' },
  { id: 'anuncio', name: 'Anuncio personalizado', price: 80, emoji: '📢' },
  { id: 'caja', name: 'Caja Sorpresa', price: 70, emoji: '🎁' },
];

// Categorías de la tienda
const SHOP_CATEGORIES = [
  {
    id: 'vip',
    name: 'VIP y Beneficios',
    color: 0xffd700,
    items: ['vip1d', 'vip7d', 'vip1m', 'vip3m', 'vip6m', 'vip12m']
  },
  {
    id: 'personalizacion',
    name: 'Personalización',
    color: 0x00bfff,
    items: ['color', 'fondo', 'titulo', 'emoji_personal', 'rol_personal']
  },
  {
    id: 'sorpresas',
    name: 'Sorpresas y Otros',
    color: 0x9b59b6,
    items: ['sticker', 'anuncio', 'caja', 'caja_premium']
  }
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel]
});

client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

// IDs de canales (ajusta según tu servidor)
const TIENDA_CHANNEL_ID = '1398744335503200306'; // Canal de tienda
const MISIONES_CHANNEL_ID = '1398757869028901065'; // Canal de misiones
const PRUEBAS_CHANNEL_NAME = 'pruebas-tickets';

// Función para dividir un array en chunks de tamaño n
function chunkArray(arr, n) {
  const res = [];
  for (let i = 0; i < arr.length; i += n) {
    res.push(arr.slice(i, i + n));
  }
  return res;
}

// Evitar mensajes duplicados en canales de tienda y misiones
async function mensajeYaEnviado(channel, titulo) {
  const mensajes = await channel.messages.fetch({ limit: 20 });
  return mensajes.some(m => m.embeds && m.embeds[0] && m.embeds[0].title === titulo);
}

async function enviarTiendaYMisiones(client) {
  const data = await getShopData();
  const tiendaChannel = await client.channels.fetch(TIENDA_CHANNEL_ID).catch(() => null);
  if (tiendaChannel) {
    const yaEnviado = await mensajeYaEnviado(tiendaChannel, '🛍️ Tienda EroGems');
    if (!yaEnviado) {
      const embed = new EmbedBuilder()
        .setTitle('🛍️ Tienda EroGems')
        .setDescription('¡Bienvenido a la tienda oficial de MundoEroVisual!\n\n:gem: **EroGems**\nMoneda principal para comprar en la tienda\n:star: **EroPoints**\nPuntos de experiencia para subir de nivel\n:bar_chart: **Niveles**\nBeneficios automáticos al subir de nivel\n:gift: **Recompensa diaria**\n+5 EroGems cada 24 horas')
        .setColor(0x00bfff);
      // Agregar campos por categoría
      SHOP_CATEGORIES.forEach(cat => {
        const catItems = data.shop.filter(i => cat.items.includes(i.id));
        if (catItems.length) {
          embed.addFields({
            name: `__${cat.name}__`,
            value: catItems.map(i => `${i.emoji} **${i.name}** — ${i.price} 💎`).join(' | ')
          });
        }
      });
      // Botones por categoría, dividiendo en filas de máximo 5
      let rows = [];
      SHOP_CATEGORIES.forEach(cat => {
        const catItems = data.shop.filter(i => cat.items.includes(i.id));
        // Actualizar nombres y precios de los VIP en los botones (con tilde en Días)
        catItems.forEach(item => {
          if (item.id === 'vip1d') { item.name = 'VIP 1 Día'; item.price = 50; }
          if (item.id === 'vip7d') { item.name = 'VIP 2 Días'; item.price = 100; }
          if (item.id === 'vip1m') { item.name = 'VIP 3 Días'; item.price = 150; }
          if (item.id === 'vip3m') { item.name = 'VIP 7 Días'; item.price = 400; }
        });
        const buttonChunks = chunkArray(catItems, 5);
        buttonChunks.forEach(chunk => {
          if (chunk.length > 0) {
            const row = new ActionRowBuilder();
            chunk.forEach(item => {
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`buy_${item.id}`)
                  .setLabel(`${item.emoji} ${item.name}`)
                  .setStyle(ButtonStyle.Primary)
              );
            });
            rows.push(row);
          }
        });
      });
      await tiendaChannel.send({ embeds: [embed], components: rows });
    }
  }
  // Misiones
  const misionesChannel = await client.channels.fetch(MISIONES_CHANNEL_ID).catch(() => null);
  if (misionesChannel) {
    const yaEnviado = await mensajeYaEnviado(misionesChannel, '🎯 Misiones Eroverse');
    if (!yaEnviado) {
      const embed = new EmbedBuilder()
        .setTitle('🎯 Misiones Eroverse')
        .setDescription('¡Completa misiones para ganar EroGems y EroPoints!')
        .setColor(0x00ff99);
      data.missions.forEach(m => {
        embed.addFields({ name: `${m.emoji} ${m.name}`, value: `${m.desc}\nRecompensa: ${m.gems} 💎, ${m.points} ⭐` });
      });
      await misionesChannel.send({ embeds: [embed] });
    }
  }
}

// Crear canal de pruebas y botón para abrir ticket
async function crearCanalPruebas(client) {
  const guild = client.guilds.cache.first();
  if (!guild) return;
  let canal = guild.channels.cache.find(c => c.name === PRUEBAS_CHANNEL_NAME);
  if (!canal) {
    canal = await guild.channels.create({ name: PRUEBAS_CHANNEL_NAME, type: 0 });
  }
  // Verificar si ya existe el mensaje con el botón
  const mensajes = await canal.messages.fetch({ limit: 10 });
  const yaEnviado = mensajes.some(m => m.components && m.components[0] && m.components[0].components.some(btn => btn.customId === 'abrir_ticket'));
  if (!yaEnviado) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('abrir_ticket')
        .setLabel('Abrir Ticket de Prueba')
        .setStyle(ButtonStyle.Success)
    );
    await canal.send({ content: '¿Necesitas enviar una prueba? Haz clic en el botón para abrir un ticket privado.', components: [row] });
  }
}

client.once('clientReady', async () => {
  await enviarTiendaYMisiones(client);
  await crearCanalPruebas(client);
  await registerCommands(); // Forzar registro de comandos admin al iniciar
});

// Comando slash para mostrar la tienda
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  try {
    // /tienda
    if (interaction.isChatInputCommand() && interaction.commandName === 'tienda') {
      await mostrarCategoriasTienda(interaction);
      return;
    }

    // Botón de categoría
    if (interaction.isButton() && interaction.customId.startsWith('cat_')) {
      const catId = interaction.customId.replace('cat_', '');
      await mostrarCategoria(interaction, catId);
      return;
    }

    // Botón volver a categorías
    if (interaction.isButton() && interaction.customId === 'volver_tienda') {
      await mostrarCategoriasTienda(interaction);
      return;
    }

    // Botón de compra
    if (interaction.isButton() && interaction.customId.startsWith('buy_')) {
      const itemId = interaction.customId.replace('buy_', '');
      const data = await getConfigData();
      const item = data.shop.find(i => i.id === itemId);
      if (!item) {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Producto no encontrado.', ephemeral: true });
        return;
      }
      // Cargar datos de usuario
      const userId = interaction.user.id;
      if (!data.users[userId]) data.users[userId] = { gems: 0, points: 0, level: 1, inventory: [] };
      if (data.users[userId].gems < item.price) {
        if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'No tienes suficientes EroGems.', ephemeral: true });
        return;
      }
      data.users[userId].gems -= item.price;
      data.users[userId].inventory.push(item.id);
      await saveShopData(data);
      const guild = interaction.guild;
      const user = interaction.user;
        // Para cualquier compra, crear ticket privado con botón para cerrar
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('cerrar_ticket')
            .setLabel('Cerrar Ticket')
            .setStyle(ButtonStyle.Danger)
        );
        const ticketChannel = await guild.channels.create({
          name: `ticket-compra-${user.username}`,
          type: 0,
          permissionOverwrites: [
            { id: guild.id, deny: ['ViewChannel'] },
            { id: user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles'] }
          ]
        });
        await ticketChannel.send({
          content: `🎁 **Nuevo ticket de compra**\n\nUsuario: <@${user.id}>\nProducto: **${item.emoji} ${item.name}**\nPrecio: ${item.price} 💎\n\nUn administrador revisará tu compra y te entregará la recompensa lo antes posible.`,
          components: [row]
        });
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: `¡Has comprado **${item.name}** por ${item.price} 💎! Se ha creado un ticket privado para que un admin te entregue la recompensa.`, ephemeral: true });
        }
      return;
    }

    // /misiones
    if (interaction.isChatInputCommand() && interaction.commandName === 'misiones') {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
      const data = await getShopData();
      const embed = new EmbedBuilder()
        .setTitle('🎯 Misiones Eroverse')
        .setDescription('¡Completa misiones para ganar EroGems y EroPoints!')
        .setColor(0x00ff99);
      data.missions.forEach(m => {
        embed.addFields({ name: `${m.emoji} ${m.name}`, value: `${m.desc}\nRecompensa: ${m.gems} 💎, ${m.points} ⭐` });
      });
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
      }
      return;
    }

    // Botón abrir ticket
    if (interaction.isButton() && interaction.customId === 'abrir_ticket') {
      const guild = interaction.guild;
      const user = interaction.user;
      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: 0,
        permissionOverwrites: [
          { id: guild.id, deny: ['ViewChannel'] },
          { id: user.id, allow: ['ViewChannel', 'SendMessages', 'AttachFiles'] }
        ]
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cerrar_ticket')
          .setLabel('Cerrar Ticket')
          .setStyle(ButtonStyle.Danger)
      );
      await ticketChannel.send({
        content: `📸 **Canal de Pruebas**\n¡Bienvenido al canal de pruebas!\n\n📋 **Propósito**\nEste canal es para enviar capturas de pantalla de misiones de YouTube\n\n📸 **Cómo usar**\nCompleta una misión de YouTube\nToma una captura de pantalla\nEnvíala aquí\nContacta a un admin para reclamar tu recompensa\n\n🎯 **Misiones disponibles**\nVer video completo, comentar, compartir, etc.\nUsa /misiones para ver todas las misiones disponibles`,
        components: [row]
      });
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: `¡Ticket creado! Ve a ${ticketChannel}`, ephemeral: true });
      return;
    }

    // Botón cerrar ticket
    if (interaction.isButton() && interaction.customId === 'cerrar_ticket') {
      await interaction.channel.delete();
      return;
    }

    // Comando /admin
    if (interaction.isChatInputCommand() && interaction.commandName === 'admin') {
      try {
        if (!esAdmin(interaction.member)) {
          await interaction.reply({ content: 'No tienes permisos de administrador.', ephemeral: true });
          return;
        }
        const sub = interaction.options.getSubcommand();
        const data = await getShopData();
        if (sub === 'darpuntos') {
          const user = interaction.options.getUser('usuario');
          const cantidad = interaction.options.getInteger('cantidad');
          if (!data.users[user.id]) data.users[user.id] = { gems: 0, points: 0, level: 1, inventory: [] };
          data.users[user.id].points += cantidad;
          await saveShopData(data);
          await interaction.reply({ content: `Se han dado ${cantidad} puntos a ${user.tag}.`, ephemeral: true });
          return;
        }
        if (sub === 'dargemas') {
          const user = interaction.options.getUser('usuario');
          const cantidad = interaction.options.getInteger('cantidad');
          if (!data.users[user.id]) data.users[user.id] = { gems: 0, points: 0, level: 1, inventory: [] };
          data.users[user.id].gems += cantidad;
          await saveShopData(data);
          await interaction.reply({ content: `Se han dado ${cantidad} EroGems a ${user.tag}.`, ephemeral: true });
          return;
        }
        if (sub === 'verinventario') {
          const user = interaction.options.getUser('usuario');
          const u = data.users[user.id];
          if (!u) {
            await interaction.reply({ content: 'El usuario no tiene inventario.', ephemeral: true });
            return;
          }
          await interaction.reply({ content: `Inventario de ${user.tag}:\nGemas: ${u.gems}\nPuntos: ${u.points}\nNivel: ${u.level}\nItems: ${u.inventory.join(', ')}`, ephemeral: true });
          return;
        }
        if (sub === 'resettienda') {
          data.shop = [...BASE_DATA.shop, ...EXTRA_SHOP_ITEMS];
          await saveShopData(data);
          await interaction.reply({ content: 'Tienda reseteada.', ephemeral: true });
          return;
        }
        if (sub === 'resetmisiones') {
          data.missions = BASE_DATA.missions;
          await saveShopData(data);
          await interaction.reply({ content: 'Misiones reseteadas.', ephemeral: true });
          return;
        }
        // Si el subcomando no es reconocido
        await interaction.reply({ content: 'Subcomando no reconocido.', ephemeral: true });
      } catch (e) {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Error al ejecutar el comando admin.', ephemeral: true });
        }
        console.error('Error en comando admin:', e);
      }
    }
  } catch (err) {
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Ocurrió un error inesperado.', ephemeral: true });
    }
    console.error('Error en interacción:', err);
  }
}
);

// Utilidad para verificar si un usuario es admin

// Mostrar menú de categorías
async function mostrarCategoriasTienda(interaction) {
  const row = new ActionRowBuilder();
  SHOP_CATEGORIES.forEach(cat => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`cat_${cat.id}`)
        .setLabel(cat.name)
        .setStyle(ButtonStyle.Secondary)
    );
  });
  const embed = new EmbedBuilder()
    .setTitle('🛍️ Tienda EroGems')
    .setDescription('Selecciona una categoría para ver los productos disponibles.')
    .setColor(0x00bfff);
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

// Mostrar productos de una categoría
async function mostrarCategoria(interaction, catId) {
  const data = await getShopData();
  const cat = SHOP_CATEGORIES.find(c => c.id === catId);
  if (!cat) return interaction.reply({ content: 'Categoría no encontrada.', ephemeral: true });
  const catItems = data.shop.filter(i => cat.items.includes(i.id));
  if (!catItems.length) return interaction.reply({ content: 'No hay productos en esta categoría.', ephemeral: true });
  const embed = new EmbedBuilder()
    .setTitle(`🛍️ ${cat.name}`)
    .setDescription('Selecciona un producto para comprarlo.')
    .setColor(cat.color);
  embed.addFields(catItems.map(i => ({ name: `${i.emoji} ${i.name}`, value: `${i.price} 💎`, inline: true })));
  // Botones de productos (máx 5 por fila)
  const buttonChunks = chunkArray(catItems, 5);
  const rows = buttonChunks.map(chunk => {
    const row = new ActionRowBuilder();
    chunk.forEach(item => {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`buy_${item.id}`)
          .setLabel(`${item.emoji} ${item.name}`)
          .setStyle(ButtonStyle.Primary)
      );
    });
    return row;
  });
  // Botón volver
  const volverRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('volver_tienda')
      .setLabel('Volver a categorías')
      .setStyle(ButtonStyle.Secondary)
  );
  rows.push(volverRow);
  await interaction.update({ embeds: [embed], components: rows });
}

// ...existing code...

// Utilidad para verificar si un usuario es admin
function esAdmin(member) {
  return member.permissions.has('Administrator');
}

// Registrar subcomandos admin
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: [
      {
        name: 'tienda',
        description: 'Ver la tienda de EroGems y comprar productos'
      },
      {
        name: 'misiones',
        description: 'Ver y completar misiones diarias'
      },
      {
        name: 'diario',
        description: 'Reclamar recompensa diaria'
      },
      {
        name: 'perfil',
        description: 'Ver tu perfil de usuario'
      },
      {
        name: 'ranking',
        description: 'Ver el ranking de usuarios'
      },
      {
        name: 'admin',
        description: 'Comandos administrativos',
        options: [
          {
            type: 1, name: 'darpuntos', description: 'Dar puntos a un usuario',
            options: [
              { type: 6, name: 'usuario', description: 'Usuario', required: true },
              { type: 4, name: 'cantidad', description: 'Cantidad de puntos', required: true }
            ]
          },
          {
            type: 1, name: 'dargemas', description: 'Dar EroGems a un usuario',
            options: [
              { type: 6, name: 'usuario', description: 'Usuario', required: true },
              { type: 4, name: 'cantidad', description: 'Cantidad de gemas', required: true }
            ]
          },
          {
            type: 1, name: 'verinventario', description: 'Ver inventario de un usuario',
            options: [
              { type: 6, name: 'usuario', description: 'Usuario', required: true }
            ]
          },
          {
            type: 1, name: 'resettienda', description: 'Resetear la tienda', options: []
          },
          {
            type: 1, name: 'resetmisiones', description: 'Resetear las misiones', options: []
          }
        ]
      }
    ] }
  );
  console.log('Comandos registrados.');
}

// Al iniciar, reintentar guardar cambios locales pendientes
async function reintentarCambiosLocales() {
  const temp = await loadLocalTempData();
  if (temp) {
    try {
      await saveShopData(temp);
      console.log('Cambios locales pendientes guardados en GitHub.');
    } catch (e) {
      console.warn('No se pudo guardar cambios locales pendientes en GitHub:', e.message);
    }
  }
}

// Llama a forceRefreshCommands para forzar la actualización inmediata
forceRefreshCommands();
client.login(DISCORD_TOKEN);
reintentarCambiosLocales();
