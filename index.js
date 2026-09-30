const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const readline = require("readline");
const fs = require("fs");

const sessionsDir = "./sessions";

fs.mkdirSync(sessionsDir, { recursive: true });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = q => new Promise(resolve => rl.question(q, resolve));

async function startAccount(number) {
  const sessionPath = `${sessionsDir}/${number}`;

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
    try {
      console.log("\n⏳ Requesting pairing code...");

      const code = await sock.requestPairingCode(number);

      console.log(`
╔════════════════════════════╗
║        🌿 RICK XMD         ║
║       PAIRING CODE         ║
╠════════════════════════════╣
║          ${code}          ║
╚════════════════════════════╝

WhatsApp → Linked Devices
→ Link a device
→ Link with phone number instead
→ Enter the code above.
`);
    } catch (error) {
      console.log("❌ Pairing failed:", error.message);
      sock.end(undefined);
      return;
    }
  }

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log(`\n✅ ${number} → RICK XMD ONLINE`);
    }

    if (connection === "close") {
      const status =
        lastDisconnect?.error?.output?.statusCode;

      if (status !== DisconnectReason.loggedOut) {
        console.log(`🔄 ${number} → reconnecting...`);

        setTimeout(() => {
          startAccount(number);
        }, 5000);
      } else {
        console.log(`❌ ${number} → logged out`);
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
        text:
`╔════════════════════╗
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

async function main() {
  console.log(`
╔════════════════════════════════╗
║          🌿 RICK XMD           ║
║       MULTI-ACCOUNT BOT        ║
╚════════════════════════════════╝
`);

  const number = await ask(
    "📱 Enter WhatsApp number with country code: "
  );

  const cleanNumber = number.replace(/\D/g, "");

  if (!cleanNumber) {
    console.log("❌ Invalid number.");
    rl.close();
    return;
  }

  await startAccount(cleanNumber);
}

main().catch(console.error);
