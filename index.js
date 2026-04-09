const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ── In-memory order store
const orders = {};

// ── CORS so website can talk to this bot
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// ── Receive order from website
app.post("/order", async (req, res) => {
  try {
    const { orderNum, name, phone, items, total, payMethod, residence } = req.body;

    // Save order in memory
    orders[orderNum] = {
      orderNum, name, phone, items, total, payMethod,
      status: "pending",
      date: new Date().toISOString()
    };

    // Get current date and time (South African format)
    const now = new Date();
    const formattedDateTime = now.toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

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

// ── Telegram button clicks (✅ Ready / 📦 Collected)
app.post("/telegram", async (req, res) => {
  try {
    const callback = req.body.callback_query;
    if (!callback) return res.sendStatus(200);

    const data = callback.data;
    const messageId = callback.message.message_id;
    const chatId = callback.message.chat.id;

    if (data.startsWith("ready_") || data.startsWith("collected_")) {
      const [status, orderNum] = data.split("_");

      if (orders[orderNum]) {
        orders[orderNum].status = status;
        const label = status === "ready" ? "✅ READY for collection!" : "📦 COLLECTED";

        // Update button in Telegram to show status
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageReplyMarkup`, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[
              { text: `${label} — #${orderNum}`, callback_data: "done" }
            ]]
          }
        });

        // Notify the person who tapped the button
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callback.id,
          text: `Order #${orderNum} marked as ${label}`,
          show_alert: false
        });
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Callback error:", err.message);
    res.sendStatus(200);
  }
});

// ── Website polls this to get order status
app.get("/status/:orderNum", (req, res) => {
  const order = orders[req.params.orderNum.toUpperCase()];
  if (!order) return res.json({ ok: false, status: "not_found" });
  res.json({ ok: true, status: order.status, orderNum: order.orderNum, name: order.name });
});

// ── Health check
app.get("/", (req, res) => res.send("LiteBite Bot is running! 🍔"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LiteBite bot running on port ${PORT}`));
