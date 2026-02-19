require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);
const API_BASE = 'https://auto-shopify-api-production.up.railway.app/index.php';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN no definido');
  process.exit(1);
}

/* =====================================================
   DATA
   ===================================================== */
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

/* =====================================================
   RESET + ARRANQUE CONTROLADO
   ===================================================== */
async function startBot() {
  try {
    // 1️⃣ Reset Telegram
    const tmpBot = new TelegramBot(BOT_TOKEN, { polling: false });
    await tmpBot.deleteWebhook({ drop_pending_updates: true });
    console.log('✅ Telegram polling reset OK');

    // 2️⃣ Espera para que Telegram libere sesión
    await new Promise(r => setTimeout(r, 5000));

    // 3️⃣ Arranque REAL del bot
    const bot = new TelegramBot(BOT_TOKEN, {
      polling: {
        interval: 300,
        autoStart: true
      }
    });

    console.log('🤖 Bot iniciado correctamente');

    /* ================= START ================= */
    bot.onText(/\/start/, (msg) => {
      bot.sendMessage(
        msg.chat.id,
`🤖 *Bot activo*

🌐 Sites: ${data.sites.length}
🧰 Proxies: ${data.proxies.length}

*Comandos*

• /addsites
• /listsites
• /delsite <n>
• /clearsites

• /addproxies
• /listproxies
• /delproxy <n>
• /clearproxies

• /chk <datos>
• /stop`,
        { parse_mode: 'Markdown' }
      );
    });

    /* ================= SITES ================= */
    bot.onText(/\/addsites/, (msg) => {
      if (!isOwner(msg.from.id)) return;
      bot.sendMessage(msg.chat.id, '📥 Envía los sites (uno por línea):');
      bot.once('message', (m) => {
        const lines = m.text.split('\n').map(x => x.trim()).filter(Boolean);
        data.sites.push(...lines);
        saveData();
        bot.sendMessage(msg.chat.id, `✅ ${lines.length} sites agregados`);
      });
    });

    bot.onText(/\/listsites/, (msg) => {
      if (!isOwner(msg.from.id)) return;
      if (!data.sites.length) return bot.sendMessage(msg.chat.id, '❌ No hay sites');
      const list = data.sites.map((s, i) => `${i + 1}. ${s}`).join('\n');
      bot.sendMessage(msg.chat.id, `🌐 *Sites*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/clearsites/, (msg) => {
      if (!isOwner(msg.from.id)) return;
      data.sites = [];
      saveData();
      bot.sendMessage(msg.chat.id, '🧹 Sites eliminados');
    });

    /* ================= PROXIES ================= */
    bot.onText(/\/addproxies/, (msg) => {
      if (!isOwner(msg.from.id)) return;
      bot.sendMessage(msg.chat.id, '📥 Envía los proxies (uno por línea):');
      bot.once('message', (m) => {
        const lines = m.text.split('\n').map(x => x.trim()).filter(Boolean);
        data.proxies.push(...lines);
        saveData();
        bot.sendMessage(msg.chat.id, `✅ ${lines.length} proxies agregados`);
      });
    });

    bot.onText(/\/listproxies/, (msg) => {
      if (!isOwner(msg.from.id)) return;
      if (!data.proxies.length) return bot.sendMessage(msg.chat.id, '❌ No hay proxies');
      const list = data.proxies.map((p, i) => `${i + 1}. ${p}`).join('\n');
      bot.sendMessage(msg.chat.id, `🧰 *Proxies*\n\n${list}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/clearproxies/, (msg) => {
      if (!isOwner(msg.from.id)) return;
      data.proxies = [];
      saveData();
      bot.sendMessage(msg.chat.id, '🧹 Proxies eliminados');
    });

    bot.onText(/\/stop/, (msg) => {
      bot.sendMessage(msg.chat.id, '🛑 Proceso detenido');
    });

  } catch (e) {
    console.error('❌ Error iniciando bot:', e.message);
  }
}

startBot();
