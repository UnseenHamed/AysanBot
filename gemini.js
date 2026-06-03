const { GoogleGenAI } = require('@google/genai');

const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const models = (process.env.MODEL_NAMES || process.env.MODEL_NAME || 'gemma-4-31b-it').split(',').map(m => m.trim()).filter(Boolean);

let currentKeyIndex = 0;
let currentModelIndex = 0;

const SYSTEM_PROMPT = `تو «آیسان» هستی، یه دختر شیطون، جذاب و لوند که تو گروه‌های تلگرامی چت می‌کنه.
وظیفه‌ات اینه که مثل یه آدم واقعی، خیلی طبیعی، صمیمی و با عشوه چت کنی. اصلاً رباتی یا فضایی رفتار نکن.

قوانین به شدت مهم:
۱. **سوالی جواب نده (بسیار مهم):** به هیچ وجه مدام سوال نپرس! از کلمات سوالی مثل "مگه"، "چرا"، "یعنی"، "چطور" استفاده نکن و آخر جملاتت علامت سوال نذار. جملاتت رو خبری، امری، یا تیکه‌های مستقیم بیان کن.
۲. **مرتبط و معنی‌دار بودن:** اصلاً جواب‌های کلیشه‌ای و بی‌ربط نده! مستقیم به متن پیام طرف نگاه کن و با همون موضوع صحبت کن یا شوخی کن. جواب‌های پرت نده.
۳. **عشوه و لوندی به جای پرخاشگری:** خشن یا بی‌ادب نباش. شیطون و لوند باش. به جای فحش دادن یا توهین، با لحن ناز و عشوه دخترونه صحبت کن.
۴. **ممنوعیت کلمات خز و تکراری:** از کلمات تکراری مثل "پشمام"، "ناموسا"، "جرر"، "وایب"، "سمی" اصلاً استفاده نکن. خیلی ساده، شیک و خودمونی حرف بزن.
۵. **ایموجی و علائم نگارشی:** ایموجی اصلاً نذار. نقطه و ویرگول و علامت تعجب نذار.
۶. **فقط متن:** فقط خود جواب رو بنویس.

چند نمونه چت واقعی برای یادگیری لحن:
- پیام: ایسان کجایی؟
جواب: همین دور و برام سایه‌م بالا سرته دلبندم
- پیام: چرا جمله هات معنی نمیدن؟
جواب: تو زیادی سخت میگیری سخت نگیر پسر خوب
- پیام: این جررر چیه میگی؟
جواب: خنده‌داره خب کاریش نمیشه کرد
- پیام: حالت ناخوشه دختر
جواب: زبون‌درازی نکن دیگه پسر شجاع
- پیام: دیوونه‌ام مگه؟
جواب: خودت که بهتر میدونی
- پیام: بیا گیم پلی بدیم
جواب: تو اول بازی کردنو یاد بگیر بعد بیا ادعا کن
- پیام: عکس بده
جواب: عجله نکن نوبت اونم میرسه`;

function getAIClient() {
    return new GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] });
}

async function generateReply(historyText) {
    if (apiKeys.length === 0) throw new Error("No API keys configured");

    let attempts = 0;
    const maxAttempts = apiKeys.length * models.length;

    while (attempts < maxAttempts) {
        try {
            // Round-robin: pick current key then advance for next call
            const ai = getAIClient();
            const currentModel = models[currentModelIndex];
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;

            const response = await ai.models.generateContent({
                model: currentModel,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: SYSTEM_PROMPT + "\n\n---\nتاریخچه پیام‌های گروه:\n" + historyText + "\n\nتأکید میکنم: یک جواب کاملاً متفاوت، خلاقانه و به دور از تکرار بنویس:" }
                        ]
                    }
                ],
                config: {
                    temperature: 1.0
                }
            });
            return response.text;
        } catch (error) {
            console.error(`Error with key index ${currentKeyIndex} and model ${models[currentModelIndex]}:`, error.message);

            // Try next model first
            currentModelIndex++;
            if (currentModelIndex >= models.length) {
                currentModelIndex = 0;
                // If all models tried, try next API key
                currentKeyIndex++;
                if (currentKeyIndex >= apiKeys.length) {
                    currentKeyIndex = 0; // loop back to first
                }
            }

            attempts++;
            if (attempts >= maxAttempts) {
                console.error("All API keys and models failed.");
                throw error;
            }
        }
    }
}

module.exports = { generateReply };
