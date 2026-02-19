require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

/* ================= DATA ================= */
const DATA_FILE = './data.json';
let data = { sites: [], proxies: [] };

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE));
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isOwner(id) {
  return id === OWNER_ID;
}

/* ================= START ================= */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

🌐 Sites: ${data.sites.length}
🧰 Proxies: ${data.proxies.length}

Comandos:
• /addsites
• /listsites
• /clearsites

• /addproxies
• /listproxies
• /clearproxies

• /stop`
  );
});

/* ================= SITES ================= */
bot.onText(/\/addsites/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, 'Envía los sites (uno por línea):');

  bot.once('message', (m) => {
    const lines = m.text.split('\n').map(x => x.trim()).filter(Boolean);
    data.sites.push(...lines);
    saveData();
    bot.sendMessage(msg.chat.id, `Sites agregados: ${lines.length}`);
  });
});

bot.onText(/\/listsites/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  if (!data.sites.length) return bot.sendMessage(msg.chat.id, 'No hay sites');
  bot.sendMessage(msg.chat.id, data.sites.join('\n'));
});

bot.onText(/\/clearsites/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  data.sites = [];
  saveData();
  bot.sendMessage(msg.chat.id, 'Sites eliminados');
});

/* ================= PROXIES ================= */
bot.onText(/\/addproxies/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  bot.sendMessage(msg.chat.id, 'Envía los proxies (uno por línea):');

  bot.once('message', (m) => {
    const lines = m.text.split('\n').map(x => x.trim()).filter(Boolean);
    data.proxies.push(...lines);
    saveData();
    bot.sendMessage(msg.chat.id, `Proxies agregados: ${lines.length}`);
  });
});

bot.onText(/\/listproxies/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  if (!data.proxies.length) return bot.sendMessage(msg.chat.id, 'No hay proxies');
  bot.sendMessage(msg.chat.id, data.proxies.join('\n'));
});

bot.onText(/\/clearproxies/, (msg) => {
  if (!isOwner(msg.from.id)) return;
  data.proxies = [];
  saveData();
  bot.sendMessage(msg.chat.id, 'Proxies eliminados');
});

/* ================= STOP ================= */
bot.onText(/\/stop/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Proceso detenido');
});

console.log('Bot iniciado correctamente');
