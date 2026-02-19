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
const running = {};
const binsValidos = ['411111', '555555', '543111', '601111', '601100', '353111', '560221'];

function filtrarTarjetas(ccs) {
  return ccs.filter(cc => {
    const parts = cc.split('|');
    if (parts.length < 4) return false;

    const num = parts[0];
    const mes = parseInt(parts[1], 10);
    const anyo = parseInt(parts[2], 10);
    const bin = num.slice(0, 6);

    const invalidMonth = isNaN(mes) || mes <= 0 || mes > 12;
    const invalidYear =
      isNaN(anyo) ||
      anyo < new Date().getFullYear() - 10 ||
      anyo > new Date().getFullYear() + 5;
    const binNoValido = !binsValidos.includes(bin);

    return !invalidMonth && !invalidYear && !binNoValido;
  });
}

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
  const chatId = q.message?.chat?.id;

  try {
    await bot.answerCallbackQuery(q.id);

    if (!chatId) return;

    switch (q.data) {
      case 'back_main':
        return bot.sendMessage(chatId, 'Menú principal', mainMenu);
      default:
        return;
    }
  } catch (e) {
    console.error('Callback error:', e.message);
  }
});

/* ================== TEXT INPUT HANDLERS ================== */
bot.on('message', (msg) => {
  try {
    const text = msg.text || '';
    if (text.startsWith('/')) return;
    // handlers intencionalmente vacíos (no crashea)
  } catch (e) {
    console.error('Message error:', e.message);
  }
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});

console.log('🤖 Bot iniciado correctamente');
