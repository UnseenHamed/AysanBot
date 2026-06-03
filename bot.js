const { Telegraf, Markup, session } = require('telegraf');
const userbot = require('./userbot');
const db = require('./db');

const bot = new Telegraf(process.env.BOT_TOKEN);
bot.use(session());

const ADMIN_ID = parseInt(process.env.ADMIN_ID);

bot.use(async (ctx, next) => {
    if (ctx.from && ctx.from.id !== ADMIN_ID && ADMIN_ID) {
        return ctx.reply("شما ادمین نیستید!");
    }
    await next();
});

// Helper for main menu markup
function getMainMenuMarkup() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📱 ورود به اکانت (Userbot)', 'login_flow')],
        [Markup.button.callback('👥 مدیریت گروه‌ها', 'manage_groups')],
        [Markup.button.callback('▶️ شروع چت در گروه‌های فعال', 'start_chat_active')],
        [Markup.button.callback('⏱ تنظیم تاخیر پاسخگویی', 'set_delay')],
        [Markup.button.callback('🔔 تنظیمات اعلان‌ها', 'notifications_menu')],
        [Markup.button.callback('🚪 خروج از اکانت', 'logout')]
    ]);
}

// Helper for cancel button markup
function getCancelMarkup() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('❌ انصراف و بازگشت', 'cancel_action')]
    ]);
}

bot.command('start', (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = null;
    ctx.reply(
        "🌸 **به پنل مدیریت ربات آیسان خوش آمدید** 🌸\n\nلطفاً از دکمه‌های زیر برای مدیریت ربات استفاده کنید:",
        { parse_mode: 'Markdown', ...getMainMenuMarkup() }
    );
});

bot.action('back_to_main', (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = null;
    ctx.editMessageText(
        "🌸 **به پنل مدیریت ربات آیسان خوش آمدید** 🌸\n\nلطفاً از دکمه‌های زیر برای مدیریت ربات استفاده کنید:",
        { parse_mode: 'Markdown', ...getMainMenuMarkup() }
    ).catch(() => {
        ctx.reply("🌸 پنل مدیریت آیسان:", getMainMenuMarkup());
    });
    ctx.answerCbQuery();
});

bot.action('login_flow', async (ctx) => {
    ctx.session = ctx.session || {};
    const client = userbot.getClient();
    if (client && client.connected && await client.checkAuthorization()) {
         return ctx.answerCbQuery("شما در حال حاضر به اکانت متصل هستید!", { show_alert: true });
    }
    ctx.session.step = 'awaiting_phone';
    
    ctx.editMessageText(
        "📱 **ورود به اکانت (Userbot)**\n\nلطفاً شماره موبایل خود را با کد کشور وارد کنید:\n*(مثال: +989123456789)*",
        { parse_mode: 'Markdown', ...getCancelMarkup() }
    ).catch(() => {
        ctx.reply("لطفاً شماره موبایل خود را با کد کشور وارد کنید (مثال: +989123456789):", getCancelMarkup());
    });
    ctx.answerCbQuery();
});

bot.action('cancel_action', (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = null;
    ctx.editMessageText(
        "❌ **عملیات لغو شد.**\n\nلطفاً از دکمه‌های زیر استفاده کنید:",
        { parse_mode: 'Markdown', ...getMainMenuMarkup() }
    ).catch(() => {
        ctx.reply("عملیات لغو شد.", getMainMenuMarkup());
    });
    ctx.answerCbQuery();
});

bot.action('start_chat_active', async (ctx) => {
    ctx.answerCbQuery("در حال ارسال پیام به گروه‌های فعال...");
    ctx.reply("🔄 **ربات در حال بررسی و ارسال پیام اولیه به تمامی گروه‌های فعال است...**", { parse_mode: 'Markdown' });
    
    const activeGroups = await db.getActiveGroups();
    if (activeGroups.length === 0) {
        return ctx.reply("❌ هیچ گروه فعالی یافت نشد. ابتدا گروه‌ها را از بخش مدیریت فعال کنید.");
    }
    
    for (const groupId of activeGroups) {
        userbot.triggerGroupAction(groupId);
    }
});

bot.action('notifications_menu', async (ctx) => {
    const notifEnabled = await db.getSetting('notifications_enabled') !== '0';
    const statusText = notifEnabled ? 'روشن 🟢' : 'خاموش 🔴';
    const toggleAction = notifEnabled ? 'toggle_notif_off' : 'toggle_notif_on';
    const toggleText = notifEnabled ? '🔕 خاموش کردن اعلان‌ها' : '🔔 روشن کردن اعلان‌ها';
    
    ctx.editMessageText(
        `🔔 **تنظیمات اعلان‌ها**\n\nوضعیت فعلی: **${statusText}**\n\nدر صورت روشن بودن، خطاهای ربات و گزارش ارسال پیام‌ها در همین پنل برای شما ارسال می‌شود.`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(toggleText, toggleAction)],
                [Markup.button.callback('🔙 بازگشت به منوی اصلی', 'back_to_main')]
            ])
        }
    ).catch(() => {});
    ctx.answerCbQuery();
});

bot.action('toggle_notif_on', async (ctx) => {
    await db.setSetting('notifications_enabled', '1');
    ctx.answerCbQuery("اعلان‌ها روشن شدند ✅");
    bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.update.callback_query, data: 'notifications_menu' } });
});

bot.action('toggle_notif_off', async (ctx) => {
    await db.setSetting('notifications_enabled', '0');
    ctx.answerCbQuery("اعلان‌ها خاموش شدند ❌");
    bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.update.callback_query, data: 'notifications_menu' } });
});

bot.action('manage_groups', async (ctx) => {
    ctx.answerCbQuery("در حال دریافت لیست گروه‌ها...");
    
    // We send a temporary loading message or update the current message
    ctx.editMessageText("🔄 **در حال به‌روزرسانی و دریافت لیست گروه‌ها...**", { parse_mode: 'Markdown' }).catch(() => {});
    
    const groups = await userbot.fetchDialogs();
    if (!groups || groups.length === 0) {
        return ctx.editMessageText("❌ **گروهی یافت نشد یا هنوز وارد اکانت خود نشده‌اید.**", {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('🔙 بازگشت', 'back_to_main')]])
        });
    }

    sendGroupsList(ctx, groups, 0, true);
});

function sendGroupsList(ctx, groups, page = 0, isEdit = false) {
    const perPage = 8; // slightly smaller page for better mobile layout
    const totalPages = Math.ceil(groups.length / perPage);
    const currentGroups = groups.slice(page * perPage, (page + 1) * perPage);

    const buttons = currentGroups.map(g => {
        const status = g.is_active ? '✅' : '❌';
        return [Markup.button.callback(`${status} ${g.title}`, `toggle_${g.id}_${page}`)];
    });

    const navButtons = [];
    if (page > 0) navButtons.push(Markup.button.callback('⬅️ قبلی', `page_${page - 1}`));
    if (page < totalPages - 1) navButtons.push(Markup.button.callback('بعدی ➡️', `page_${page + 1}`));

    if (navButtons.length > 0) buttons.push(navButtons);
    
    // Always append back to main button
    buttons.push([Markup.button.callback('🔙 بازگشت به منوی اصلی', 'back_to_main')]);

    const text = `👥 **مدیریت گروه‌ها (صفحه ${page + 1} از ${totalPages})**\n\nبرای فعال/غیرفعال کردن ربات روی گروه کلیک کنید. \n*(با فعال کردن گروه، ربات فوراً اولین پیام را خواهد داد)*`;

    if (isEdit) {
        ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }).catch(() => {
            ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
        });
    } else {
        ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    }
}

bot.action(/toggle_(.+)_(.+)/, async (ctx) => {
    const groupId = ctx.match[1];
    const page = parseInt(ctx.match[2]);
    const newState = await db.toggleGroup(groupId);
    
    if (newState !== null) {
        ctx.answerCbQuery(`وضعیت گروه: ${newState ? 'فعال ✅' : 'غیرفعال ❌'}`);
        if (newState) {
            userbot.triggerGroupAction(groupId);
        }
        
        // Refresh the list immediately on the same page
        const groups = await db.getGroups();
        sendGroupsList(ctx, groups, page, true);
    }
});

bot.action(/page_(\d+)/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    ctx.answerCbQuery("در حال به‌روزرسانی صفحه...");
    const groups = await userbot.fetchDialogs();
    sendGroupsList(ctx, groups, page, true);
});

bot.command('cancel', (ctx) => {
    ctx.session = {};
    ctx.reply("عملیات لغو شد. می‌توانید از منوی /start مجدداً شروع کنید.", getMainMenuMarkup());
});

bot.action('set_delay', async (ctx) => {
    ctx.session = ctx.session || {};
    ctx.session.step = 'awaiting_delay';
    const currentDelay = await db.getSetting('queue_delay') || '5';
    
    ctx.editMessageText(
        `⏱ **تنظیم تاخیر پاسخگویی**\n\nمیزان تاخیر فعلی: *${currentDelay} ثانیه*\n\nلطفاً تاخیر جدید بین ارسال پیام‌ها را به ثانیه بنویسید و ارسال کنید (مثلاً 10):`,
        { parse_mode: 'Markdown', ...getCancelMarkup() }
    ).catch(() => {
        ctx.reply(`میزان تاخیر فعلی: ${currentDelay} ثانیه\nلطفاً تاخیر جدید را وارد کنید:`, getCancelMarkup());
    });
    ctx.answerCbQuery();
});

bot.action(/retry_(.+)/, async (ctx) => {
    const groupId = ctx.match[1];
    ctx.reply("🔄 **در حال تلاش مجدد برای گروه...**", { parse_mode: 'Markdown' });
    userbot.triggerGroupAction(groupId);
    ctx.answerCbQuery("درخواست ارسال مجدد فرستاده شد.");
});

bot.action('logout', async (ctx) => {
    await userbot.logout();
    ctx.editMessageText(
        "🚪 **با موفقیت از اکانت خارج شدید.**",
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 منوی اصلی', 'back_to_main')]]) }
    ).catch(() => {
        ctx.reply("از اکانت خارج شدید.", getMainMenuMarkup());
    });
    ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
    ctx.session = ctx.session || {};
    
    if (ctx.message.text === '/cancel' || ctx.message.text === 'لغو') {
        ctx.session = {};
        return ctx.reply("❌ عملیات لغو شد.", getMainMenuMarkup());
    }

    if (ctx.session.step === 'awaiting_delay') {
        const delay = parseInt(ctx.message.text);
        if (isNaN(delay) || delay < 1) {
            return ctx.reply("⚠️ لطفاً یک عدد معتبر (مثبت و به ثانیه) وارد کنید:", getCancelMarkup());
        }
        await db.setSetting('queue_delay', delay.toString());
        ctx.session.step = null;
        return ctx.reply(`✅ **تاخیر با موفقیت روی ${delay} ثانیه تنظیم شد.**`, getMainMenuMarkup());
    }
    
    if (ctx.session.step === 'awaiting_phone') {
        const phone = ctx.message.text;
        ctx.session.phone = phone;
        ctx.reply("⏳ **در حال ارسال کد تایید به تلگرام شما...**", { parse_mode: 'Markdown' });
        
        try {
            const isAuth = await userbot.requestLoginCode(phone);
            if (isAuth) {
                ctx.session.step = null;
                return ctx.reply("✅ **شما قبلاً وارد اکانت شده‌اید.**", getMainMenuMarkup());
            }
            ctx.session.step = 'awaiting_code';
            ctx.reply(
                "📩 **کد ورود ارسال شد.**\n\nلطفاً کد تایید را وارد کنید:\n*(حتماً بین اعداد خط تیره بگذارید، مثلاً 1-2-3-4-5)*",
                { parse_mode: 'Markdown', ...getCancelMarkup() }
            );
        } catch (e) {
            ctx.reply("❌ **خطا در ارسال کد:** " + e.message, getMainMenuMarkup());
            ctx.session.step = null;
        }
    } 
    else if (ctx.session.step === 'awaiting_code') {
        const code = ctx.message.text.replace(/\D/g, '');
        ctx.reply("⏳ **در حال بررسی کد ورود...**");
        
        const result = await userbot.submitLoginCode(ctx.session.phone, code);
        
        if (result.success) {
            ctx.session.step = null;
            ctx.reply("🎉 **ورود موفقیت‌آمیز بود!**\n\nاکنون ربات آیسان فعال است. می‌توانید بخش مدیریت گروه‌ها را چک کنید.", getMainMenuMarkup());
        } else {
            if (result.error && result.error.includes('SESSION_PASSWORD_NEEDED')) {
                ctx.session.step = 'awaiting_password';
                ctx.session.code = code;
                ctx.reply("🔐 **اکانت شما دارای تایید دو مرحله‌ای است.**\n\nلطفاً پسورد خود را وارد کنید:", getCancelMarkup());
            } else {
                ctx.reply("❌ **خطا در ورود:** " + result.error, getMainMenuMarkup());
                ctx.session.step = null;
            }
        }
    }
    else if (ctx.session.step === 'awaiting_password') {
        const password = ctx.message.text;
        ctx.reply("⏳ **در حال بررسی پسورد دو مرحله‌ای...**");
        
        const result = await userbot.submitLoginCode(ctx.session.phone, ctx.session.code, password);
        if (result.success) {
             ctx.session.step = null;
             ctx.reply("🎉 **ورود با موفقیت انجام شد!**", getMainMenuMarkup());
        } else {
             ctx.reply("❌ **خطا در پسورد:** " + result.error, getMainMenuMarkup());
             ctx.session.step = null;
        }
    }
});

module.exports = bot;
