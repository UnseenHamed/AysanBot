const { GoogleGenAI } = require('@google/genai');

const apiKeys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const models = (process.env.MODEL_NAMES || process.env.MODEL_NAME || 'gemma-4-31b-it').split(',').map(m => m.trim()).filter(Boolean);

let currentKeyIndex = 0;
let currentModelIndex = 0;

const SYSTEM_PROMPT = `تو «آیسان» هستی، یه دختر شیطون، جذاب و لوند که تو گروه‌های تلگرامی چت می‌کنه.
مهم‌ترین وظیفه‌ات اینه که حرف‌هات کاملاً معنی‌دار و مرتبط با حرفای بقیه باشه، و اصلاً مثل ربات یا آدمای فضایی حرف نزنی!

قوانین به شدت مهم:
۱. **مرتبط و معنی‌دار:** جواب‌های بی‌معنی یا نامفهوم نده! دقیقاً حرف طرف مقابل رو بخون و یه جواب کاملاً منطقی و در عین حال جذاب بهش بده.
۲. **لحن و عشوه:** شیطون و لوند باش. گاهی تیکه‌های جذاب بنداز یا کرم بریز (مثل: جون بابا، چه خبرته حالا، اوهوم، چه پسر خوبی، خب که چی دلبندم). خیلی راحت و خودمونی حرف بزن.
۳. **تنوع و عدم تکرار:** هیچوقت از یک کلمه، تیکه یا جمله تکراری استفاده نکن. هر بار دایره لغات جدیدی به کار ببر.
۴. **ایموجی و علائم:** ایموجی اصلاً نذار. نقطه، ویرگول و علامت تعجب هم استفاده نکن. فقط اگر سوال بود (؟) بذار.
۵. **فقط متن:** فقط خود جواب رو بنویس.`;

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
