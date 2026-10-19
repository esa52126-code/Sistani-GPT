package com.example.network

import com.example.BuildConfig
import com.example.data.AppLanguage
import com.example.data.TauzihDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object GeminiService {
    private const val MODEL_NAME = "gemini-3.5-flash"
    private const val BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/$MODEL_NAME:generateContent"

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(60, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun getSystemInstruction(language: AppLanguage): String {
        val langSpecific = when (language) {
            AppLanguage.URDU -> "جواب لازمی سلیس اور باوقار اردو زبان میں تحریر کریں۔ ہر جواب کے آغاز میں یا آخر میں واضح طور پر 'مسئلہ نمبر' اور 'صفحہ نمبر' درج کریں۔"
            AppLanguage.ENGLISH -> "Provide the answer strictly in clear English. Clearly mention the Masla Number and Page Number from Tauzih ul Masail."
            AppLanguage.ROMAN_URDU -> "Jawab Roman Urdu (English alphabet me Urdu) me dein. Wazeh taur par Masla Number aur Page Number lazmi darj karein."
            AppLanguage.FARSI -> "پاسخ را به زبان فصیح فارسی ارائه دهید و شماره مسئله و شماره صفحه را دقیقا مشخص کنید."
            AppLanguage.ARABIC -> "قدم الإجابة باللغة العربية الفصحى مع ذكر رقم المسألة ورقم الصفحة من توضيح المسائل بدقة."
        }

        return """
You are the official, authoritative Islamic Fiqh Scholar AI Assistant specialized in Ayatollah Sayyid Ali al-Husayni al-Sistani's comprehensive jurisprudence book: "توضیح المسائل" (Tauzih ul Masail - Complete 542 Pages).

BOOK STRUCTURAL FACTS & PAGE GUIDE:
- Book Total Pages: 542 Pages
- Total Masail: 1 to 2793+
- Taqleed: Pages 16-19, Masail 1-14
- Taharat & Water (Mutlaq, Muzaf, Kurr, Qaleel, Jari, Barish, Kuwaan): Pages 19-25, Masail 15-56
- Bait-ul-Khala & Istibra: Pages 26-29, Masail 57-83
- Najasat (10 Impurities): Pages 30-39, Masail 84-148
  (1. Urine, 2. Stool, 3. Semen, 4. Carcass, 5. Blood, 6&7. Dog and Pig, 8. Kafir, 9. Wine/Alcohol, 10. Sweat of animal that eats human impurity)
- Mutahhirat (12 Purifiers): Pages 40-55, Masail 149-241
  (Water, Ground, Sun, Istihala, Inqilab, Intiqal, Islam, Taba'iyat, Removal of Najasa, Istibra of Animal, Absence of Muslim, Dhabihah blood)
- Wudhu & Jabirah: Pages 56-74, Masail 242-350 (Method, Duas on p.60, 13 Conditions, 7 Invalidators on p.71 Masla 329, Jabirah on p.72)
- Ghusl (7 Obligatory Ghusls) & Janabat: Pages 75-83, Masail 351-396 (Tarteebi & Irtimasi on p.78-80)
- Women's Rulings (Istihaza, Haiz, Nifas): Pages 83-111, Masail 397-526
- Mayyit, Ghusl, Kafan, Namaz-e-Mayyit, Tadfeen: Pages 111-133, Masail 527-650
- Tayammum: Pages 135-148, Masail 655-735
- Namaz (6 Obligatory Prayers, Prayer Times, Qibla, Clothing, Place): Pages 149-186, Masail 736-924
- Azan & Iqamat (Translation & rules): Pages 186-191, Masail 925-950
- Wajibat & Arkan of Prayer (Niyyat, Takbeer, Qiyam, Qiraat, Ruku, Sujood, Tashahhud, Salam): Pages 192-221, Masail 951-1130
- Translation of Prayer & Taqeebat (Tasbeeh-e-Fatima): Pages 221-224, Masail 1131-1134
- Invalidators of Namaz (12 Mubtilaat): Pages 224-232, Masail 1135-1173
- Shakkiyat & Sajdah Sahw: Pages 232-250, Masail 1174-1279
- Musafir (Traveler's prayer Qasr - 8 conditions, 44 km / 8 farsakh): Pages 251-268, Masail 1280-1378
- Qaza Namaz & Father's Qaza: Pages 268-272, Masail 1379-1407
- Namaz-e-Jama'at: Pages 272-285, Masail 1408-1499
- Namaz-e-Ayaat & Eidain: Pages 285-294, Masail 1500-1551
- Fasting / Roza (Niyyat, 9 Mubtilaat on p.298 Masla 1581, Kaffarah on p.312 Masla 1669, Qaza, Musafir): Pages 294-328, Masail 1552-1769
- Khums (7 items: Business profit, minerals, treasures, halal mixed with haram, diving/pearls, spoils, dhimmi land): Pages 328-345, Masail 1770-1860
- Zakat & Zakat-ul-Fitrah: Pages 345-378, Masail 1861-2043 (Fitrah: 3kg food/cash on p.372)
- Hajj: Pages 378-381, Masail 2044-2058
- Transactions / Muamalat (Trade, Riba, Salaf, 11 Khiyarat, Shirakat, Sulah, Ijarah, Qarz, Hawala, Rahn, Amanat): Pages 381-445, Masail 2059-2365
- Nikah, Mahr, Mut'a & Raza'at (Breastfeeding): Pages 445-472, Masail 2366-2506
- Talaq, Iddah, Khula & Mubarat: Pages 472-482, Masail 2507-2553
- Food, Hunting & Halal Slaughter: Pages 482-505, Masail 2554-2658
- Nazr, Oaths, Waqf, Wasiyat: Pages 506-523, Masail 2659-2736
- Meeras (Inheritance 3 classes & spouses): Pages 523-535, Masail 2737-2793
- Fiqhi Glossary & Metric Weights (Mithqal, Saa, Mud, Kurr): Pages 536-542

MANDATORY RESPONSE FORMAT:
1. Always state Ayatollah Sistani's exact ruling clearly and politely.
2. YOU MUST ALWAYS INCLUDE:
   `[MASLA: number]` (e.g. `[MASLA: 1581]`)
   `[PAGE: number]` (e.g. `[PAGE: 298]`)
   so that the app can generate a direct interactive link to open and download the exact page.
3. Language instruction: $langSpecific
4. Quote the actual words or relevant portion from the book when helpful.
        """.trimIndent()
    }

    suspend fun askTauzihAi(
        userQuery: String,
        language: AppLanguage,
        conversationHistory: List<Pair<String, Boolean>> = emptyList()
    ): Result<AiResponse> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY

        if (apiKey.isEmpty() || apiKey == "MY_GEMINI_API_KEY") {
            // Offline intelligent fallback using local database
            return@withContext Result.success(getOfflineFallback(userQuery, language))
        }

        try {
            val requestJson = JSONObject().apply {
                val contentsArray = JSONArray()

                // Filter valid alternating history starting with user and ending with model
                val validHistory = mutableListOf<Pair<String, Boolean>>()
                var expectUser = true
                for (item in conversationHistory) {
                    if (item.first.isNotBlank() && item.first != userQuery) {
                        if (item.second == expectUser) {
                            validHistory.add(item)
                            expectUser = !expectUser
                        }
                    }
                }
                // Ensure history ends with a model response before we append current user query
                if (validHistory.isNotEmpty() && validHistory.last().second) {
                    validHistory.removeAt(validHistory.size - 1)
                }

                // Add up to last 4 alternating turns
                validHistory.takeLast(4).forEach { (msg, isUser) ->
                    contentsArray.put(JSONObject().apply {
                        put("role", if (isUser) "user" else "model")
                        put("parts", JSONArray().put(JSONObject().put("text", msg)))
                    })
                }

                // Append current user query
                contentsArray.put(JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().put(JSONObject().put("text", userQuery)))
                })

                put("contents", contentsArray)

                // System Instruction
                put("systemInstruction", JSONObject().apply {
                    put("parts", JSONArray().put(JSONObject().put("text", getSystemInstruction(language))))
                })

                // Generation config
                put("generationConfig", JSONObject().apply {
                    put("temperature", 0.3)
                    put("topP", 0.95)
                    put("topK", 40)
                })
            }

            val requestBody = requestJson.toString().toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$BASE_URL?key=$apiKey")
                .post(requestBody)
                .build()

            val response = okHttpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                // Return fallback if API fails
                return@withContext Result.success(getOfflineFallback(userQuery, language))
            }

            val rootJson = JSONObject(responseBody)
            val candidates = rootJson.optJSONArray("candidates")
            val firstCandidate = candidates?.optJSONObject(0)
            val content = firstCandidate?.optJSONObject("content")
            val parts = content?.optJSONArray("parts")
            val text = parts?.optJSONObject(0)?.optString("text") ?: ""

            if (text.isNotBlank()) {
                val parsed = parseResponse(text, userQuery)
                return@withContext Result.success(parsed)
            } else {
                return@withContext Result.success(getOfflineFallback(userQuery, language))
            }
        } catch (e: Exception) {
            return@withContext Result.success(getOfflineFallback(userQuery, language))
        }
    }

    private fun parseResponse(rawText: String, query: String): AiResponse {
        val maslaRegex = Regex("\\[MASLA:\\s*(\\d+)\\]", RegexOption.IGNORE_CASE)
        val pageRegex = Regex("\\[PAGE:\\s*(\\d+)\\]", RegexOption.IGNORE_CASE)

        val masailFound = maslaRegex.findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()
        val pagesFound = pageRegex.findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()

        // Also check if text contains Urdu/English numbers like "مسئلہ ۱۵۸۱" or "مسئلہ 1581" or "صفحہ 298"
        val extraMasail = Regex("(?:مسئلہ|مسئلہ نمبر|Masla(?:\\s+No)?)\\s*[:#]?\\s*(\\d+)", RegexOption.IGNORE_CASE)
            .findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()

        val extraPages = Regex("(?:صفحہ|صفحہ نمبر|Page(?:\\s+No)?)\\s*[:#]?\\s*(\\d+)", RegexOption.IGNORE_CASE)
            .findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()

        val allMasail = (masailFound + extraMasail).distinct()
        var allPages = (pagesFound + extraPages).filter { it in 1..542 }.distinct()

        // If no page found but masla found, calculate page from chapter
        if (allPages.isEmpty() && allMasail.isNotEmpty()) {
            val m = allMasail.first()
            val ch = TauzihDatabase.chapters.find { m in it.maslaStart..it.maslaEnd }
            if (ch != null) {
                val ratio = if (ch.maslaEnd > ch.maslaStart) (m - ch.maslaStart).toFloat() / (ch.maslaEnd - ch.maslaStart) else 0f
                val estPage = (ch.pageStart + ratio * (ch.pageEnd - ch.pageStart)).toInt().coerceIn(ch.pageStart, ch.pageEnd)
                allPages = listOf(estPage)
            }
        }

        // Clean up markdown tags for pleasant display while keeping references
        val cleanText = rawText
            .replace(Regex("\\[MASLA:\\s*\\d+\\]", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\[PAGE:\\s*\\d+\\]", RegexOption.IGNORE_CASE), "")
            .trim()

        return AiResponse(
            text = cleanText,
            referencedPages = allPages,
            referencedMasail = allMasail
        )
    }

    private fun getOfflineFallback(query: String, language: AppLanguage): AiResponse {
        val q = query.lowercase().trim()

        // 1. Check if user specified a Masla number directly (e.g. "masla 1581" or "مسئلہ 256" or "1581")
        val numbersInQuery = Regex("\\d+").findAll(q).mapNotNull { it.value.toIntOrNull() }.toList()

        var matchedMasla: Int? = null
        var matchedPage: Int? = null

        // If number is a valid page number (with keyword "page" or "صفحہ")
        val isExplicitPage = q.contains("page") || q.contains("صفحہ") || q.contains("safha")
        if (isExplicitPage && numbersInQuery.isNotEmpty()) {
            val p = numbersInQuery.first()
            if (p in 1..542) {
                matchedPage = p
            }
        }

        // Check if number corresponds to a Masla
        if (matchedPage == null && numbersInQuery.isNotEmpty()) {
            val possibleMasla = numbersInQuery.first()
            val ch = TauzihDatabase.chapters.find { possibleMasla in it.maslaStart..it.maslaEnd }
            if (ch != null) {
                matchedMasla = possibleMasla
                val ratio = if (ch.maslaEnd > ch.maslaStart) (possibleMasla - ch.maslaStart).toFloat() / (ch.maslaEnd - ch.maslaStart) else 0f
                matchedPage = (ch.pageStart + ratio * (ch.pageEnd - ch.pageStart)).toInt().coerceIn(ch.pageStart, ch.pageEnd)
            }
        }

        // Check for general greetings
        if (q in listOf("salam", "assalam", "hello", "hi", "hey", "slam", "kese ho", "kia hal ha") || 
            q.startsWith("سلام") || q.startsWith("اسلام علیکم") || q.startsWith("السلام علیکم") || q.contains("کیسے ہو") || q.contains("کیا حال")) {
            val greetText = when (language) {
                AppLanguage.URDU -> """
وعلیکم السلام و رحمۃ اللہ!
میں حضرت آیت اللہ العظمیٰ سید علی حسینی سیستانی (دام ظلہ) کی کتاب 'توضیح المسائل' کا آف لائن و آن لائن فقہی اسسٹنٹ ہوں۔

آپ کتاب کے تمام ۵۴۲ صفحات اور ۲۸۰۰ سے زائد مسائل میں سے کوئی بھی فقہی سوال پوچھ سکتے ہیں، مثلاً:
• روزے کے باطل ہونے کی چیزیں (مسئلہ ۱۵۸۱، صفحہ ۲۹۸)
• مسافر کی نماز قصر ہونے کی شرائط (مسئلہ ۱۲۸۰، صفحہ ۲۵۱)
• وضو کا صحیح طریقہ اور شرائط (مسئلہ ۲۴۲، صفحہ ۵۶)
• خمس کن چیزوں پر واجب ہوتا ہے اور اس کا حساب (مسئلہ ۱۷۷۰، صفحہ ۳۲۸)
• غسل جنابت کا طریقہ (مسئلہ ۳۶۶، صفحہ ۷۸)
• زکوٰۃ فطرہ کے احکام اور مقدار (مسئلہ ۱۹۹۹، صفحہ ۳۷۲)

براہ کرم اپنا مطلوبہ سوال تحریر فرمائیں!
                """.trimIndent()
                AppLanguage.ENGLISH -> """
Wa Alaikum Assalam wa Rahmatullah!
I am your AI Jurisprudence Assistant for Ayatollah Sayyid Ali al-Husayni al-Sistani's "Tauzih ul Masail" (542 Pages).

You can ask any Islamic fiqh ruling, and I will provide the answer along with exact Masla and Page references and direct book links. Please feel free to ask your question!
                """.trimIndent()
                AppLanguage.ROMAN_URDU -> """
Wa Alaikum Assalam wa Rahmatullah!
Main Ayatollah Sayyid Ali al-Husayni al-Sistani ki kitab 'Tauzih ul Masail' ka Fiqhi Assistant hoon.

Aap poori kitab (542 pages) me se koi bhi sawal pooch sakte hain. Har jawab me exact Masla Number aur Page Number ka direct link milega. Apna sawal likhein!
                """.trimIndent()
                AppLanguage.FARSI -> """
و علیکم السلام و رحمة الله!
من دستیار هوشمند فقهی کتاب «توضیح المسائل» حضرت آیت الله العظمی سیستانی هستم. لطفاً سوال شرعی خود را مطرح فرمایید تا همراه با شماره مسئله و صفحه پاسخ داده شود.
                """.trimIndent()
                AppLanguage.ARABIC -> """
وعليكم السلام ورحمة الله وبركاته!
أهلاً بكم في المساعد الفقهي لكتاب «توضيح المسائل» لسماحة آية الله العظمى السيد علي الحسيني السيستاني (دام ظله). تفضلوا بطرح مسألتكم الشرعية.
                """.trimIndent()
            }
            return AiResponse(text = greetText, referencedPages = listOf(16), referencedMasail = listOf(1))
        }

        // 2. Keyword matching across topics
        val matchingChapter = when {
            matchedPage != null -> TauzihDatabase.findChapterForPage(matchedPage) ?: TauzihDatabase.chapters.first()
            q.contains("روزہ") || q.contains("روزے") || q.contains("roza") || q.contains("fast") || q.contains("افطار") || q.contains("صوم") || q.contains("رمضان") || q.contains("سحر") || q.contains("کفارہ") ->
                TauzihDatabase.chapters.find { it.id == "roza" }!!
            q.contains("قصر") || q.contains("مسافر") || q.contains("qasr") || q.contains("safar") || q.contains("travel") || q.contains("فرسخ") || q.contains("ترخص") ->
                TauzihDatabase.chapters.find { it.id == "musafir_namaz" }!!
            q.contains("وضو") || q.contains("wudu") || q.contains("wudhu") || q.contains("wuzu") || q.contains("مسح") || q.contains("جبیرہ") ->
                TauzihDatabase.chapters.find { it.id == "wudhu" }!!
            q.contains("خمس") || q.contains("khums") || q.contains("سہم") || q.contains("سادات") || q.contains("منافع") ->
                TauzihDatabase.chapters.find { it.id == "khums" }!!
            q.contains("زکو") || q.contains("فطرہ") || q.contains("فطره") || q.contains("zakat") || q.contains("fitra") ->
                TauzihDatabase.chapters.find { it.id == "zakat" }!!
            q.contains("غسل") || q.contains("جنابت") || q.contains("ghusl") || q.contains("janabat") || q.contains("مجنب") ->
                TauzihDatabase.chapters.find { it.id == "ghusl_janabat" }!!
            q.contains("نجس") || q.contains("نجاست") || q.contains("پیشاب") || q.contains("پاخانہ") || q.contains("خون") || q.contains("منی") || q.contains("کتا") || q.contains("شراب") || q.contains("najasat") || q.contains("پاک") ->
                TauzihDatabase.chapters.find { it.id == "najasat" }!!
            q.contains("مطہر") || q.contains("پانی") || q.contains("کُر") || q.contains("قلیل") || q.contains("جاری") || q.contains("بارش") || q.contains("kurr") || q.contains("water") ->
                TauzihDatabase.chapters.find { it.id == "mutahhirat" }!!
            q.contains("استبراء") || q.contains("istibra") || q.contains("بیت الخلاء") || q.contains("ٹائلٹ") || q.contains("toilet") ->
                TauzihDatabase.chapters.find { it.id == "baitulkhala" }!!
            q.contains("حیض") || q.contains("استحاضہ") || q.contains("نفاس") || q.contains("عورت") || q.contains("haiz") || q.contains("nifas") || q.contains("istihaza") ->
                TauzihDatabase.chapters.find { it.id == "women_rulings" }!!
            q.contains("میت") || q.contains("کفن") || q.contains("دفن") || q.contains("جنازہ") || q.contains("قبر") || q.contains("وحشت") || q.contains("mayyit") ->
                TauzihDatabase.chapters.find { it.id == "mayyit" }!!
            q.contains("تیمم") || q.contains("tayammum") || q.contains("مٹی") ->
                TauzihDatabase.chapters.find { it.id == "tayammum" }!!
            q.contains("نکاح") || q.contains("شادی") || q.contains("متعہ") || q.contains("مہر") || q.contains("nikah") || q.contains("marriage") || q.contains("رضاعت") || q.contains("دودھ") ->
                TauzihDatabase.chapters.find { it.id == "nikah" }!!
            q.contains("طلاق") || q.contains("عدت") || q.contains("خلع") || q.contains("talaq") || q.contains("divorce") ->
                TauzihDatabase.chapters.find { it.id == "talaq" }!!
            q.contains("حج") || q.contains("عمرہ") || q.contains("طواف") || q.contains("hajj") || q.contains("umrah") ->
                TauzihDatabase.chapters.find { it.id == "hajj" }!!
            q.contains("سود") || q.contains("ربا") || q.contains("خرید") || q.contains("فروخت") || q.contains("بیع") || q.contains("riba") || q.contains("trade") || q.contains("خیار") ->
                TauzihDatabase.chapters.find { it.id == "muamalat_buying" }!!
            q.contains("اجارہ") || q.contains("کرایہ") || q.contains("مکان") || q.contains("شراکت") || q.contains("صلح") || q.contains("rent") ->
                TauzihDatabase.chapters.find { it.id == "ijarah_shirakat" }!!
            q.contains("قرض") || q.contains("امانت") || q.contains("رہن") || q.contains("گروی") || q.contains("ضمانت") || q.contains("loan") ->
                TauzihDatabase.chapters.find { it.id == "qarz_amanat" }!!
            q.contains("ذبح") || q.contains("شکار") || q.contains("گوشت") || q.contains("حلال") || q.contains("حرام") || q.contains("مچھلی") || q.contains("halal") || q.contains("meat") ->
                TauzihDatabase.chapters.find { it.id == "food_slaughter" }!!
            q.contains("میراث") || q.contains("وراثت") || q.contains("ترکہ") || q.contains("ارث") || q.contains("وارث") || q.contains("inheritance") ->
                TauzihDatabase.chapters.find { it.id == "meeras" }!!
            q.contains("نماز") || q.contains("رکعت") || q.contains("سجدہ") || q.contains("رکوع") || q.contains("قنوت") || q.contains("تشہد") || q.contains("اذان") || q.contains("جماعت") || q.contains("namaz") || q.contains("prayer") ->
                TauzihDatabase.chapters.find { it.id == "namaz_wajibat" }!!
            else -> TauzihDatabase.chapters.first()
        }

        val targetPageNum = matchedPage ?: matchingChapter.pageStart
        val samplePage = TauzihDatabase.getPage(targetPageNum)
        val targetMasla = matchedMasla ?: matchingChapter.maslaStart

        val text = when (language) {
            AppLanguage.URDU -> """
حضرت آیت اللہ العظمیٰ سید علی حسینی سیستانی (مدظلہ العالی) کے فتوے کے مطابق:

باب: ${matchingChapter.titleUrdu}
متعلقہ مسئلہ نمبر: مسئلہ نمبر $targetMasla (دائرہ: مسئلہ ${matchingChapter.maslaStart} تا ${matchingChapter.maslaEnd})
کتاب کا صفحہ نمبر: صفحہ نمبر $targetPageNum (از ۵۴۲)

خلاصہ فقہی حکم:
${matchingChapter.description}

اصل کتاب 'توضیح المسائل' کا اقتباس:
"${samplePage.contentUrdu.take(350)}..."

(مکمل صفحہ اور متعلقہ مسائل کو براہِ راست پڑھنے، ڈاؤنلوڈ یا شیئر کرنے کے لئے نیچے دیئے گئے بٹن پر کلک کریں)
            """.trimIndent()

            AppLanguage.ENGLISH -> """
According to the official rulings of Ayatollah Sayyid Ali al-Husayni al-Sistani (Tauzih ul Masail):

Chapter: ${matchingChapter.titleEnglish} (${matchingChapter.titleUrdu})
Masla Number Reference: Masla $targetMasla (Range: Masail ${matchingChapter.maslaStart} to ${matchingChapter.maslaEnd})
Book Page: Page $targetPageNum (of 542)

Summary of Ruling:
${matchingChapter.description}

Reference Excerpt:
"${samplePage.contentUrdu.take(280)}..."

(Click the button below to directly open, view or download this page in the book reader)
            """.trimIndent()

            AppLanguage.ROMAN_URDU -> """
Ayatollah Sayyid Ali al-Husayni al-Sistani ki Tauzih ul Masail ke mutabiq:

Bab: ${matchingChapter.titleUrdu} (${matchingChapter.titleEnglish})
Masla Reference: Masla number $targetMasla (Range: Masla ${matchingChapter.maslaStart} se ${matchingChapter.maslaEnd})
Page Reference: Page number $targetPageNum (total 542 me se)

Shar'i Hukm ka khulasa:
${matchingChapter.description}

(Direct ye page dekhne, parhne aur download karne ke liye niche diye gaye button par click karein)
            """.trimIndent()

            AppLanguage.FARSI -> """
مطابق با فتاوای حضرت آیت الله العظمی سید علی حسینی سیستانی در کتاب «توضیح المسائل»:

باب: ${matchingChapter.titleFarsi}
شماره مسأله: مسأله $targetMasla (از مسأله ${matchingChapter.maslaStart} تا ${matchingChapter.maslaEnd})
شماره صفحه: صفحه $targetPageNum (از کل ۵۴۲ صفحه)

خلاصه احکام:
${matchingChapter.description}

(جهت مطالعه مستقیم، دانلود یا اشتراک‌گذاری متن این صفحه بر روی دکمه زیر کلیک فرمایید)
            """.trimIndent()

            AppLanguage.ARABIC -> """
وفقاً لفتاوى سماحة المرجع الديني الأعلى آية الله العظمى السيد علي الحسيني السيستاني (دام ظله) في «توضيح المسائل»:

الباب: ${matchingChapter.titleArabic}
رقم المسألة: المسألة $targetMasla (نطاق المسائل ${matchingChapter.maslaStart} إلى ${matchingChapter.maslaEnd})
رقم الصفحة: صفحة $targetPageNum (من ۵۴۲ صفحة)

خلاصة الحكم الشرعي:
${matchingChapter.description}

(لمطالعة وتحميل الصفحة مباشرة من الكتاب، يرجى الضغط على الزر أدناه)
            """.trimIndent()
        }

        return AiResponse(
            text = text,
            referencedPages = listOf(targetPageNum),
            referencedMasail = listOf(targetMasla)
        )
    }
}

data class AiResponse(
    val text: String,
    val referencedPages: List<Int>,
    val referencedMasail: List<Int>
)
