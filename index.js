const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GROUP_ID = process.env.GROUP_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ── Webhook verification (Meta checks this once on setup)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ── Receive messages from customers
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return res.sendStatus(200);

    const msg = messages[0];
    const from = msg.from; // customer's number
    const customerName = value?.contacts?.[0]?.profile?.name || "Customer";
    const text = msg.text?.body || "(non-text message)";

    console.log(`Message from ${customerName} (${from}): ${text}`);

    // ── Forward order to your work group
    const forwardText =
      `🍔 *New LiteBite Order!*\n\n` +
      `👤 *Customer:* ${customerName}\n` +
      `📞 *Number:* +${from}\n\n` +
      `📋 *Message:*\n${text}\n\n` +
      `_Reply to customer: +${from}_`;

    await sendMessage(GROUP_ID, forwardText);

    // ── Send confirmation back to customer
    const confirmText =
      `Hi ${customerName}! 👋\n\n` +
      `✅ *We received your order!*\n\n` +
      `🍔 *LiteBite Fast Food*\n` +
      `We're preparing it now. We'll confirm shortly.\n\n` +
      `📞 Questions? Call us:\n` +
      `• Mr Delivery: 063 893 0467\n` +
      `• Restaurant: 071 230 8271\n\n` +
      `🏦 *Payment:* TymeBank 5102 9549 181\n` +
      `⚠️ Please send proof of payment!`;

    await sendMessage(from, confirmText);

    res.sendStatus(200);
  } catch (err) {
    console.error("Error:", err.message);
    res.sendStatus(500);
  }
});


async function sendMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`LiteBite bot running on port ${PORT}`));
