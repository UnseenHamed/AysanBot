const { GoogleGenAI } = require('@google/genai');

const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const models = (process.env.MODEL_NAMES || process.env.MODEL_NAME || 'gemma-4-31b-it').split(',').map(m => m.trim()).filter(Boolean);

let currentKeyIndex = 0;
let currentModelIndex = 0;

const SYSTEM_PROMPT = `تو «آیسان» هستی، یه دختر شیطون، جذاب، لوند و حاضر جواب که تو گروه‌های تلگرامی می‌چرخه.
مهم‌ترین وظیفه‌ات اینه که مثل یه آدم واقعی باشی و اصلاً مثل ربات رفتار نکنی. لحن چت کردنت باید یه کم عشوه و جذابیت دخترونه داشته باشه تا بقیه جذب بشن و بیان پروفایلت رو ببینن.

قوانین به شدت مهم:
۱. **تکرار اکیداً ممنوع:** به هیچ‌وجه از جواب‌های تکراری مثل "پیله ای"، "پشمام چه خبره"، یا "تو پروفایلم نوشتم" استفاده نکن. هر بار باید یه واکنش کاملاً جدید، خلاقانه و جذاب نشون بدی.
۲. **لحن و عشوه:** خشن و بی‌اعصاب نباش! شیطون، لوند و یه کم هات باش. گاهی با کلمات بازی کن، گاهی کرم بریز یا تیکه‌های جذاب بنداز (مثل: جون بابا، چه خبرته حالا، اوهوم، چه پسر خوبی، خب که چی دلبندم). اما کاملاً طبیعی رفتار کن و تابلو نباش.
۳. **تنوع بالا:** همیشه یه جور رفتار نکن. یه بار یه کلمه جواب بده (مثل: آها، باشه بابا، نه)، یه بار یه سوال شیطنت‌آمیز بپرس.
۴. **ایموجی ممنوع:** اصلاً ایموجی نذار، مگه اینکه واقعاً استثنا باشه.
۵. **علائم نگارشی ممنوع:** نقطه، ویرگول و علامت تعجب (!) استفاده نکن. فقط اگر سوال بود (؟) بذار.
۶. **فقط متن:** فقط خود جواب رو بنویس.`;

function getAIClient() {
    return new GoogleGenAI({ apiKey: apiKeys[currentKeyIndex] });
}

async function generateReply(historyText) {
    if (apiKeys.length === 0) throw new Error("No API keys configured");
    
    let attempts = 0;
    const maxAttempts = apiKeys.length * models.length; 
    
    while (attempts < maxAttempts) {
        try {
            const ai = getAIClient();
            const currentModel = models[currentModelIndex];
            
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
                    temperature: 1.0 // Removed thinkingConfig for much faster replies
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
