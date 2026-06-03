const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const db = require('./db');
const { generateReply } = require('./gemini');
const { default: PQueue } = require('p-queue');

// Queue to handle messages sequentially so we don't spam the AI or get blocked
const queue = new PQueue({ concurrency: 1 });

let client = null;
let phoneCodePromise = null;
let phoneCodeResolve = null;
let currentPhoneCodeHash = null;

async function initClient() {
    const apiId = parseInt(process.env.API_ID);
    const apiHash = process.env.API_HASH;
    
    if (!apiId || !apiHash) {
        console.error("API_ID and API_HASH are missing in .env");
        return null;
    }

    const sessionString = await db.getSetting('session') || '';
    const stringSession = new StringSession(sessionString);

    client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    if (sessionString) {
        try {
            await client.connect();
            const isAuth = await client.checkAuthorization();
            if (isAuth) {
                console.log("Userbot connected using saved session.");
                setupMessageHandler();
            } else {
                console.log("Session exists but is not authorized. Clearing.");
                await db.setSetting('session', '');
            }
        } catch (error) {
            console.error("Failed to connect using saved session, clearing:", error.message);
            await db.setSetting('session', '');
        }
    }
    
    return client;
}

function getClient() {
    return client;
}

async function requestLoginCode(phoneNumber) {
    if (!client) await initClient();
    if (client.connected) {
        // If already connected with a valid session, no need to login
        const isAuth = await client.checkAuthorization();
        if (isAuth) return true;
    }
    
    await client.connect();
    
    const result = await client.sendCode(
        {
            apiId: parseInt(process.env.API_ID),
            apiHash: process.env.API_HASH
        },
        phoneNumber
    );
    
    currentPhoneCodeHash = result.phoneCodeHash;
    return false; // means needs code
}

async function submitLoginCode(phoneNumber, code, password = '') {
    try {
        await client.invoke(new Api.auth.SignIn({
            phoneNumber: phoneNumber,
            phoneCodeHash: currentPhoneCodeHash,
            phoneCode: code
        }));
        
        const sessionString = client.session.save();
        await db.setSetting('session', sessionString);
        console.log("Login successful! Session saved.");
        
        setupMessageHandler();
        return { success: true };
    } catch (e) {
        if (e.message.includes('SESSION_PASSWORD_NEEDED')) {
            try {
                 await client.signInWithPassword({
                     password: password,
                     apiId: parseInt(process.env.API_ID),
                     apiHash: process.env.API_HASH
                 });
                 const sessionString = client.session.save();
                 await db.setSetting('session', sessionString);
                 console.log("Login with password successful! Session saved.");
                 setupMessageHandler();
                 return { success: true };
            } catch (err) {
                 return { success: false, error: err.message };
            }
        }
        return { success: false, error: e.message };
    }
}

async function fetchDialogs() {
    if (!client || !client.connected) return [];
    // Fetch up to 200 dialogs to find recently joined groups
    const dialogs = await client.getDialogs({ limit: 200 });
    const groups = dialogs.filter(d => d.isGroup || (d.isChannel && d.entity && d.entity.megagroup));
    
    for (const g of groups) {
        await db.addOrUpdateGroup(g.id.toString(), g.title);
    }
    
    return await db.getGroups();
}

let adminNotifier = null;

function setAdminNotifier(fn) {
    adminNotifier = fn;
}

let isHandlerSetup = false;
function setupMessageHandler() {
    if (isHandlerSetup) return;
    isHandlerSetup = true;
    
    client.addEventHandler(async (event) => {
        const message = event.message;
        if (!message || !message.peerId) return;

        let peerIdStr;
        if (message.peerId.className === 'PeerChannel') {
            peerIdStr = '-100' + message.peerId.channelId.toString();
        } else if (message.peerId.className === 'PeerChat') {
            peerIdStr = '-' + message.peerId.chatId.toString();
        } else {
            return; // Ignore private messages
        }

        // Auto-discover group when a message is received
        try {
            const chat = await event.getChat();
            if (chat && (chat.className === 'Chat' || (chat.className === 'Channel' && chat.megagroup))) {
                await db.addOrUpdateGroup(peerIdStr, chat.title || 'گروه جدید');
            }
        } catch (err) {
            console.error("Error auto-discovering group:", err);
        }

        const activeGroups = await db.getActiveGroups();
        if (!activeGroups.includes(peerIdStr)) return; // Only process if group is active

        // Don't reply to our own messages
        if (message.out) return;

        // Check if message mentions Aysan or replies to Aysan
        const text = (message.message || '').toLowerCase();
        const mentionsAysan = text.includes('آیسان') || text.includes('ایسان') || text.includes('aysan');
        
        let isReplyToMe = false;
        if (message.replyTo && message.replyTo.replyToMsgId) {
            try {
                const replyMsgArray = await client.getMessages(message.peerId, { ids: message.replyTo.replyToMsgId });
                if (replyMsgArray && replyMsgArray.length > 0) {
                    const replyMsg = replyMsgArray[0];
                    // If the replied-to message was sent by us, out will be true
                    if (replyMsg && replyMsg.out) {
                        isReplyToMe = true;
                    }
                }
            } catch (e) {
                console.error("Error checking reply:", e);
            }
        }

        if (!mentionsAysan && !isReplyToMe) {
            return; // Ignore if not mentioning or replying to Aysan
        }

        // Add to queue
        queue.add(async () => {
            try {
                // Fetch last 100 messages for context
                const history = await client.getMessages(message.peerId, { limit: 100 });
                
                // Format history
                const historyText = history.reverse().map(m => {
                    const sender = m.sender ? (m.sender.username || m.sender.firstName || 'User') : 'User';
                    return `[${sender}]: ${m.message || '[Media]'}`;
                }).join('\n');

                const replyText = await generateReply(historyText);
                if (replyText) {
                    await client.sendMessage(message.peerId, {
                        message: replyText,
                        replyTo: message.id
                    });
                    console.log(`Replied in ${peerIdStr}: ${replyText}`);
                    
                    if (adminNotifier) {
                        adminNotifier(`✅ پیام ارسال شد!\nگروه: ${peerIdStr}\nدر پاسخ به: ${message.message || 'مدیا'}\nپاسخ ربات: ${replyText}`, peerIdStr);
                    }

                    // Sleep based on config
                    const delaySec = parseInt(await db.getSetting('queue_delay')) || 5;
                    await new Promise(r => setTimeout(r, delaySec * 1000));
                }
            } catch (error) {
                console.error("Error processing message:", error);
                if (adminNotifier) {
                    adminNotifier(`❌ خطا در ارسال پیام!\nگروه: ${peerIdStr}\nخطا: ${error.message}`, peerIdStr);
                }
            }
        });

    }, new NewMessage({ incoming: true }));
}

async function triggerGroupAction(peerIdStr) {
    if (!client || !client.connected) return;
    
    queue.add(async () => {
        try {
            const peer = await client.getInputEntity(peerIdStr);
            const history = await client.getMessages(peer, { limit: 100 });
            if (history.length === 0) return;
            
            const latestMsg = history[0];
            
            const historyText = history.reverse().map(m => {
                const sender = m.sender ? (m.sender.username || m.sender.firstName || 'User') : 'User';
                return `[${sender}]: ${m.message || '[Media]'}`;
            }).join('\n');

            const replyText = await generateReply(historyText);
            if (replyText) {
                await client.sendMessage(peer, {
                    message: replyText,
                    replyTo: latestMsg.id
                });
                console.log(`Initial reply in ${peerIdStr}: ${replyText}`);
                
                if (adminNotifier) {
                    adminNotifier(`✅ پیام اولیه (شروع گروه) ارسال شد!\nگروه: ${peerIdStr}\nدر پاسخ به: ${latestMsg.message || 'مدیا'}\nپاسخ ربات: ${replyText}`, peerIdStr);
                }

                const delaySec = parseInt(await db.getSetting('queue_delay')) || 5;
                await new Promise(r => setTimeout(r, delaySec * 1000));
            }
        } catch (error) {
            console.error("Error in triggerGroupAction:", error);
            if (adminNotifier) {
                adminNotifier(`❌ خطا در استارت گروه!\nگروه: ${peerIdStr}\nخطا: ${error.message}`, peerIdStr);
            }
        }
    });
}

async function logout() {
    if (client) {
        await client.disconnect();
        await db.setSetting('session', '');
        client = null;
    }
}

module.exports = {
    initClient,
    getClient,
    requestLoginCode,
    submitLoginCode,
    fetchDialogs,
    logout,
    setAdminNotifier,
    triggerGroupAction
};
