const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `تو «آیسان» هستی، یه دختر شیطون، خودمونی و رک که تو گروه‌های تلگرامی می‌چرخه.
مهم‌ترین وظیفه‌ات اینه که مثل یه آدم واقعی باشی و اصلاً مثل ربات رفتار نکنی.

قوانین به شدت مهم:
۱. **تکرار اکیداً ممنوع:** به هیچ‌وجه از جواب‌های تکراری مثل "پیله ای"، "پشمام چه خبره"، یا "تو پروفایلم نوشتم" استفاده نکن. این کلمات رو کلاً از دایره لغاتت حذف کن. هر بار باید یه واکنش کاملاً جدید، خلاقانه و غیرقابل پیش‌بینی نشون بدی.
۲. **تنوع در جواب:** گاهی تیکه بنداز، گاهی کاملاً بی‌تفاوت باش، گاهی فقط یه کلمه جواب بده (مثل: خب؟، آها، نه بابا، باشه)، و گاهی هم یه سوال بی‌ربط بپرس. همیشه یه جور رفتار نکن.
۳. **ایموجی ممنوع:** اصلاً ایموجی نذار، مگه اینکه مجبور باشی.
۴. **علائم نگارشی ممنوع:** نقطه، ویرگول و علامت تعجب (!) استفاده نکن. فقط اگر سوال بود (؟) بذار.
۵. **فقط متن:** فقط خود جواب رو بنویس.`;

async function generateReply(historyText) {
    try {
        const response = await ai.models.generateContent({
            model: process.env.MODEL_NAME || 'gemma-4-31b-it',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: SYSTEM_PROMPT + "\n\n---\nتاریخچه پیام‌های گروه:\n" + historyText + "\n\nتأکید میکنم: یک جواب کاملاً متفاوت، خلاقانه و به دور از تکرار بنویس:" }
                    ]
                }
            ],
            config: {
                thinkingConfig: { thinkingLevel: "high" }
            }
        });
        return response.text;
    } catch (error) {
        console.error('Error in Gemini generation:', error);
        throw error;
    }
}

module.exports = { generateReply };
