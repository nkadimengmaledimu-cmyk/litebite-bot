app.post("/order", async (req, res) => {
  try {
    const { orderNum, name, phone, items, total, payMethod, residence } = req.body;

    // Save order in memory
    orders[orderNum] = {
      orderNum, name, phone, items, total, payMethod,
      status: "pending",
      date: new Date().toISOString()
    };

    // Get current date and time (manual formatting, works everywhere)
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const formattedDateTime = `${day}/${month}/${year} at ${hours}:${minutes}`;

    let msg = `🍔 *NEW LITEBITE ORDER!*\n`;
    msg += `📅 *Date/Time:* ${formattedDateTime}\n`;
    msg += `━━━━━━━━━━━━\n`;
    msg += `🔢 *Order:* #${orderNum}\n`;
    msg += `👤 *Name:* ${name}\n`;
    msg += `📞 *Phone:* [${phone}](tel:${phone})\n`;
    if (residence) msg += `🎓 *NMU Residence:* ${residence}\n`;
    msg += `💳 *Payment:* ${payMethod === "eft" ? "💳 EFT (awaiting proof)" : "💵 Cash on collection"}\n`;
    msg += `━━━━━━━━━━━━\n`;

    const nmuItems = items.filter(i => i.nmu);
    const colItems = items.filter(i => !i.nmu);

    if (nmuItems.length) {
      msg += `🎓 *NMU DELIVERY (13:30–14:20):*\n`;
      nmuItems.forEach(i => {
        msg += `• ${i.emoji} ${i.name} x${i.qty} — R${i.price * i.qty}\n`;
        if (i.removed && i.removed.length) msg += `  ❌ Remove: ${i.removed.join(", ")}\n`;
        if (i.extras && i.extras.length) msg += `  ➕ Add: ${i.extras.join(", ")}\n`;
        if (i.note) msg += `  📝 ${i.note}\n`;
      });
    }
    if (colItems.length) {
      msg += `🏠 *COLLECT AT RESTAURANT:*\n`;
      colItems.forEach(i => {
        msg += `• ${i.emoji} ${i.name} x${i.qty} — R${i.price * i.qty}\n`;
        if (i.removed && i.removed.length) msg += `  ❌ Remove: ${i.removed.join(", ")}\n`;
        if (i.extras && i.extras.length) msg += `  ➕ Add: ${i.extras.join(", ")}\n`;
        if (i.note) msg += `  📝 ${i.note}\n`;
      });
    }

    msg += `━━━━━━━━━━━━\n`;
    msg += `💰 *TOTAL: R${total}*\n`;
    msg += payMethod === "eft"
      ? `🏦 TymeBank: 5102 9549 181\n⚠️ Awaiting proof of payment!`
      : `💵 Customer paying CASH on collection`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Mark Ready", callback_data: `ready_${orderNum}` },
          { text: "📦 Mark Collected", callback_data: `collected_${orderNum}` }
        ]]
      }
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Order error:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
