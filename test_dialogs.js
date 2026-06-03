const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const db = require('./db');
require('dotenv').config();

async function test() {
    await db.initDB();
    const sessionString = await db.getSetting('session') || '';
    if (!sessionString) { console.log('no session'); return; }
    
    const client = new TelegramClient(new StringSession(sessionString), parseInt(process.env.API_ID), process.env.API_HASH, { connectionRetries: 1 });
    await client.connect();
    
    const dialogs = await client.getDialogs({ limit: 15 });
    for (const d of dialogs) {
        let isMega = d.entity && d.entity.megagroup;
        let isBroad = d.entity && d.entity.broadcast;
        console.log(`Title: ${d.title}, isGroup: ${d.isGroup}, isChannel: ${d.isChannel}, megagroup: ${isMega}, broadcast: ${isBroad}`);
    }
    await client.disconnect();
}
test();
