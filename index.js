require('dotenv').config();
const db = require('./db');
const userbot = require('./userbot');
const bot = require('./bot');

const { Markup } = require('telegraf');
const express = require('express');

const app = express();
app.get('/', (req, res) => {
    res.send('Aysan Bot is running!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});
async function main() {
    console.log("Initializing database...");
    await db.initDB();

    console.log("Initializing userbot...");
    await userbot.initClient();

    userbot.setAdminNotifier((msg, peerIdStr) => {
        if (peerIdStr && msg.includes('❌')) {
            bot.telegram.sendMessage(process.env.ADMIN_ID, msg, Markup.inlineKeyboard([
                 [Markup.button.callback('🔄 تلاش مجدد', `retry_${peerIdStr}`)]
            ])).catch(console.error);
        } else {
            bot.telegram.sendMessage(process.env.ADMIN_ID, msg).catch(console.error);
        }
    });

    console.log("Starting admin bot...");
    bot.launch();

    console.log("Bot is running!");
}

main().catch(console.error);

// Enable graceful stop
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    process.exit(0);
});
