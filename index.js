const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const http = require("http");

const PORT = process.env.PORT || 3000;
const NUMBER = (process.env.WA_NUMBER || "").replace(/\D/g, "");

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("🌿 RICK XMD ONLINE");
}).listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

async function startBot() {
  if (!NUMBER) {
    console.log("❌ WA_NUMBER is not set.");
    return;
  }

  const sessionPath = `./sessions/${NUMBER}`;
  fs.mkdirSync(sessionPath, { recursive: true });

  const { state, saveCreds } =
    await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Rick XMD", "Chrome", "1.0.0"]
  });

  sock.ev.on("creds.update", saveCreds);

  if (!state.creds.registered) {
    console.log("⏳ Requesting pairing code...");

    try {
      const code = await sock.requestPairingCode(NUMBER);
      console.log(`🌿 RICK XMD PAIRING CODE: ${code}`);
    } catch (error) {
      console.log("❌ Pairing failed:", error.message);
    }
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log("✅ RICK XMD ONLINE");
    }

    if (connection === "close") {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      if (status !== DisconnectReason.loggedOut) {
        console.log("🔄 Reconnecting...");
        setTimeout(startBot, 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg?.message) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    const command = text.trim().toLowerCase();
    const jid = msg.key.remoteJid;

    if (command === ".ping") {
      await sock.sendMessage(jid, {
        text: "🏓 RICK XMD: PONG!"
      });
    }

    if (command === ".alive") {
      await sock.sendMessage(jid, {
        text: "🌿 RICK XMD is alive!"
      });
    }

    if (command === ".menu") {
      await sock.sendMessage(jid, {
        text: `╔════════════════════╗
║      🌿 RICK XMD   ║
╚════════════════════╝

⚡ .ping
💚 .alive
📋 .menu

Multi-Account Edition`
      });
    }
  });
}

startBot().catch(console.error);
