const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ── ENV VARIABLES
const TOKEN = process.env.ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// ⚠️ WhatsApp Cloud API does NOT support groups directly
// const GROUP_ID = process.env.GROUP_ID;

// ── WEBHOOK VERIFICATION (Meta uses this)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ── RECEIVE MESSAGES
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const msg = messages[0];

    const from = msg.from;
    const text = msg.text?.body || "(non-text message)";
    const customerName =
      value?.contacts?.[0]?.profile?.name || "Customer";

    console.log("📩 Incoming message:");
    console.log("From:", from);
    console.log("Name:", customerName);
    console.log("Text:", text);

    // ── FORMAT ORDER MESSAGE
    const orderMessage =
      `🍔 *New LiteBite Order!*\n\n` +
      `👤 Customer: ${customerName}\n` +
      `📞 Number: +${from}\n\n` +
      `📋 Message:\n${text}`;

    // ⚠️ Instead of GROUP (not supported), log it or send to admin number
    console.log("📦 ORDER:", orderMessage);

    // ── AUTO REPLY TO CUSTOMER
    const replyMessage =
      `Hi ${customerName}! 👋\n\n` +
      `✅ We received your order!\n\n` +
      `🍔 LiteBite Fast Food\n` +
      `We're preparing it now.\n\n` +
      `📞 Contact us if needed:\n` +
      `• Mr Delivery: 063 893 0467\n` +
      `• Restaurant: 071 230 8271\n\n` +
      `🏦 Payment: TymeBank\n` +
      `⚠️ Please send proof of payment!`;

    await sendMessage(from, replyMessage);

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Error processing webhook:", error.message);
    res.sendStatus(500);
  }
});

// ── SEND MESSAGE FUNCTION
async function sendMessage(to, text) {
  try {
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

    console.log("✅ Message sent to:", to);
  } catch (err) {
    console.error("❌ Failed to send message:", err.response?.data || err.message);
  }
}

// ── TEST ROUTE (for checking if server is alive)
app.get("/test", (req, res) => {
  res.send("🚀 LiteBite bot is running!");
});

// ── START SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 LiteBite bot running on port ${PORT}`);
});
