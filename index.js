const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const orders = {};

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.post("/order", async (req, res) => {
  try {
    const { orderNum, name, phone, items, total, payMethod, residence } = req.body;

    orders[orderNum] = {
      orderNum, name, phone, items, total, payMethod,
      status: "pending",
      date: new Date().toISOString()
    };

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const formattedDateTime = `${day}/${month}/${year} at ${hours}:${minutes}`;

    let msg = `🍔 *NEW LITEBITE ORDER*\n`;
    msg += `📅 ${formattedDateTime}\n`;
    msg += `────────────────\n`;
    msg += `🔢 *Order #${orderNum}*\n`;
    msg += `👤 ${name}\n`;
    msg += `📞 ${phone}\n`;
    if (residence) msg += `🎓 ${residence}\n`;
    msg += `💳 ${payMethod === "eft" ? "EFT (awaiting proof)" : "Cash on collection"}\n`;
    msg += `────────────────\n`;

    const nmuItems = items.filter(i => i.nmu);
    const colItems = items.filter(i => !i.nmu);

    if (nmuItems.length) {
      msg += `🎓 *NMU DELIVERY (13:30–14:20)*\n`;
      nmuItems.forEach(i => {
        msg += `• ${i.emoji} ${i.name} x${i.qty} — R${i.price * i.qty}\n`;
        if (i.removed && i.removed.length) msg += `  ❌ No: ${i.removed.join(", ")}\n`;
        if (i.extras && i.extras.length) msg += `  ➕ Add: ${i.extras.join(", ")}\n`;
        if (i.note) msg += `  📝 ${i.note}\n`;
      });
    }
    if (colItems.length) {
      msg += `🏠 *COLLECT AT RESTAURANT*\n`;
      colItems.forEach(i => {
        msg += `• ${i.emoji} ${i.name} x${i.qty} — R${i.price * i.qty}\n`;
        if (i.removed && i.removed.length) msg += `  ❌ No: ${i.removed.join(", ")}\n`;
        if (i.extras && i.extras.length) msg += `  ➕ Add: ${i.extras.join(", ")}\n`;
        if (i.note) msg += `  📝 ${i.note}\n`;
      });
    }

    msg += `────────────────\n`;
    msg += `💰 *TOTAL: R${total}*\n`;
    msg += payMethod === "eft"
      ? `🏦 TymeBank: 5102 9549 181\n⚠️ Awaiting proof of payment`
      : `💵 Customer pays cash on collection`;
    msg += `\n────────────────\n`;
    msg += `⏳ Pending`;

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

app.post("/telegram", async (req, res) => {
  try {
    const callback = req.body.callback_query;
    if (!callback) return res.sendStatus(200);

    const data = callback.data;
    const messageId = callback.message.message_id;
    const chatId = callback.message.chat.id;
    const originalMessageText = callback.message.text;

    if (data.startsWith("ready_") || data.startsWith("collected_")) {
      const [status, orderNum] = data.split("_");

      if (orders[orderNum]) {
        const newStatus = status;
        orders[orderNum].status = newStatus;
        const statusLabel = newStatus === "ready" ? "✅ READY for collection!" : "📦 COLLECTED";

        let updatedText = originalMessageText;
        const statusLineRegex = /(✅ READY for collection!|📦 COLLECTED|⏳ Pending).*\n?/;
        if (updatedText.match(statusLineRegex)) {
          updatedText = updatedText.replace(statusLineRegex, `${statusLabel}\n`);
        } else {
          updatedText += `\n${statusLabel}`;
        }

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
          chat_id: chatId,
          message_id: messageId,
          text: updatedText,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Mark Ready", callback_data: `ready_${orderNum}` },
              { text: "📦 Mark Collected", callback_data: `collected_${orderNum}` }
            ]]
          }
        });

        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callback.id,
          text: `Order #${orderNum} marked as ${newStatus}`,
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

app.get("/status/:orderNum", (req, res) => {
  const order = orders[req.params.orderNum.toUpperCase()];
  if (!order) return res.json({ ok: false, status: "not_found" });
  res.json({ ok: true, status: order.status, orderNum: order.orderNum, name: order.name });
});

app.get("/", (req, res) => res.send("LiteBite Bot is running! 🍔"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LiteBite bot running on port ${PORT}`));
