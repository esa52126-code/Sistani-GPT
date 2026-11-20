package com.example.network

import com.example.BuildConfig
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.LanguageDetector
import com.example.data.RomanUrdu
import com.example.data.Masla
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
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(40, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun getSystemInstruction(language: AppLanguage): String {
        val langSpecific = when (language) {
            AppLanguage.URDU -> "جواب لازمی سلیس اور باوقار اردو زبان میں تحریر کریں۔ ہر جواب کے آغاز میں یا آخر میں واضح طور پر 'مسئلہ نمبر' اور 'صفحہ نمبر' درج کریں۔"
            AppLanguage.ROMAN_URDU -> "Jawab Roman Urdu (English alphabet me Urdu) me dein. Wazeh taur par Masla Number aur Page Number lazmi darj karein."
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
        selectedLanguage: AppLanguage,
        conversationHistory: List<Pair<String, Boolean>> = emptyList()
    ): Result<AiResponse> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.GEMINI_API_KEY
        // Answer in the language the question is written in (falls back to the app's language).
        val language = LanguageDetector.detect(userQuery, selectedLanguage)

        if (apiKey.isEmpty() || apiKey == "MY_GEMINI_API_KEY") {
            // No API key: answer straight from the book, fully offline
            return@withContext Result.success(offlineAnswer(userQuery, language, emptyList()))
        }

        // Passages from the bundled book text keep online answers grounded.
        val bookHits = try { BookRepository.search(userQuery, 6) } catch (e: Exception) { emptyList() }

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

                // Append current user query together with the matching masail from the book
                contentsArray.put(JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().put(JSONObject().put("text", userQuery + buildBookContext(bookHits))))
                })

                put("contents", contentsArray)

                // System Instruction
                put("systemInstruction", JSONObject().apply {
                    put("parts", JSONArray().put(JSONObject().put("text", getSystemInstruction(language) + BOOK_CONTEXT_RULES)))
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
                .url(BASE_URL)
                .header("x-goog-api-key", apiKey)
                .apply {
                    // Lets a key restricted to this Android app in Google Cloud work only from it.
                    if (AppIdentity.packageName.isNotEmpty()) header("X-Android-Package", AppIdentity.packageName)
                    if (AppIdentity.certSha1.isNotEmpty()) header("X-Android-Cert", AppIdentity.certSha1)
                }
                .post(requestBody)
                .build()

            val response = okHttpClient.newCall(request).execute()
            val responseBody = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                // API failed (no internet, quota, ...): answer from the book offline
                return@withContext Result.success(offlineAnswer(userQuery, language, bookHits))
            }

            val rootJson = JSONObject(responseBody)
            val candidates = rootJson.optJSONArray("candidates")
            val firstCandidate = candidates?.optJSONObject(0)
            val content = firstCandidate?.optJSONObject("content")
            val parts = content?.optJSONArray("parts")
            val text = parts?.optJSONObject(0)?.optString("text") ?: ""

            if (text.isNotBlank()) {
                val parsed = parseResponse(text, userQuery, bookHits, language)
                return@withContext Result.success(parsed)
            } else {
                return@withContext Result.success(offlineAnswer(userQuery, language, bookHits))
            }
        } catch (e: Exception) {
            return@withContext Result.success(offlineAnswer(userQuery, language, bookHits))
        }
    }

    private const val BOOK_CONTEXT_RULES = """

BOOK TEXT PROVIDED WITH EACH QUESTION:
- The user's message may end with a section "BOOK EXCERPTS" containing the exact text of the most relevant masail from Tauzih ul Masail, each labelled [MASLA: n | PAGE: p].
- Base your answer on these excerpts. Use their masla and page numbers exactly as given; never invent or estimate numbers.
- If the excerpts do not answer the question, say so honestly and suggest which topic of the book to look at, instead of guessing a ruling.
- Give ONE answer only: pick the single masla that best answers the question and explain only that ruling. Ignore excerpts that are not about the question; do not list or mention other masail. Include exactly one [MASLA: n] and one [PAGE: p].
- Write the whole answer in the language required above (translate the Urdu book text into that language when needed).
"""

    /** Adds the matching masail (exact book text) to the user's message for grounding. */
    private fun buildBookContext(hits: List<Masla>): String {
        if (hits.isEmpty()) return ""
        val sb = StringBuilder("\n\n---\nBOOK EXCERPTS (Tauzih ul Masail, exact text):\n")
        hits.forEach { m ->
            sb.append("\n[MASLA: ${m.number} | PAGE: ${m.page}]\n")
            sb.append(if (m.text.length > 1500) m.text.take(1500) + " …" else m.text)
            sb.append('\n')
        }
        return sb.toString()
    }

    /** Offline answer: the single best matching masla, quoted straight from the book. */
    private fun offlineAnswer(query: String, language: AppLanguage, @Suppress("UNUSED_PARAMETER") hits: List<Masla>): AiResponse {
        if (isGreeting(query.lowercase().trim())) return getOfflineFallback(query, language)
        val m = try { BookRepository.searchRelevant(query, 1).firstOrNull() } catch (e: Exception) { null }
            ?: return notFoundAnswer(language)
        val text = when (language) {
            AppLanguage.URDU ->
                "مسئلہ ${m.number} (صفحہ ${m.page})\n\n${m.text}"
            AppLanguage.ROMAN_URDU ->
                "Masla ${m.number} (Page ${m.page})\n\n${RomanUrdu.transliterate(m.text)}\n\n" +
                    "(Offline: kitab ka text Roman huroof me badla gaya hai. Internet hone par AI behtar jawab dega.)"
        }
        return AiResponse(text = text, referencedPages = listOf(m.page), referencedMasail = listOf(m.number), language = language)
    }

    /** Shown offline when no masla matches the question clearly enough. */
    private fun notFoundAnswer(language: AppLanguage): AiResponse {
        val text = when (language) {
            AppLanguage.URDU -> "معذرت، آف لائن تلاش میں اس سوال سے واضح طور پر متعلق کوئی مسئلہ نہیں ملا۔\n\nبراہ کرم سوال میں اصل موضوع کا لفظ لکھیں، مثلاً: \"روزہ کن چیزوں سے باطل ہوتا ہے\"، \"مسافر کی نماز\"، \"غسل جنابت کا طریقہ\" یا مسئلہ نمبر لکھیں (مثلاً مسئلہ ۱۵۸۱)۔ انٹرنیٹ ہونے پر AI تفصیلی جواب دے گا۔"
            AppLanguage.ROMAN_URDU -> "Maazrat, offline search me is sawal se wazeh taur par mutalliq koi masla nahi mila.\n\nSawal me asal mauzu ka lafz likhein, maslan: \"roza kin cheezon se toot jata hai\", \"musafir ki namaz\", \"ghusl janabat ka tareeqa\" ya masla number likhein (maslan masla 1581). Internet hone par AI tafseeli jawab dega."
        }
        return AiResponse(text = text, referencedPages = emptyList(), referencedMasail = emptyList(), language = language)
    }

    private fun isGreeting(q: String): Boolean =
        q in listOf("salam", "assalam", "hello", "hi", "hey", "slam", "kese ho", "kia hal ha") ||
            q.startsWith("سلام") || q.startsWith("اسلام علیکم") || q.startsWith("السلام علیکم") ||
            q.contains("کیسے ہو") || q.contains("کیا حال")

    private fun parseResponse(rawText: String, query: String, bookHits: List<Masla> = emptyList(), language: AppLanguage = AppLanguage.URDU): AiResponse {
        val maslaRegex = Regex("\\[MASLA:\\s*(\\d+)\\]", RegexOption.IGNORE_CASE)
        val pageRegex = Regex("\\[PAGE:\\s*(\\d+)\\]", RegexOption.IGNORE_CASE)

        val masailFound = maslaRegex.findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()
        val pagesFound = pageRegex.findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()

        // Also check if text contains Urdu/English numbers like "مسئلہ ۱۵۸۱" or "مسئلہ 1581" or "صفحہ 298"
        val extraMasail = Regex("(?:مسئلہ|مسئلہ نمبر|Masla(?:\\s+No)?)\\s*[:#]?\\s*(\\d+)", RegexOption.IGNORE_CASE)
            .findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()

        val extraPages = Regex("(?:صفحہ|صفحہ نمبر|Page(?:\\s+No)?)\\s*[:#]?\\s*(\\d+)", RegexOption.IGNORE_CASE)
            .findAll(rawText).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()

        // One answer only: keep the first masla the model cites.
        var allMasail = (masailFound + extraMasail).distinct().take(1)
        if (allMasail.isEmpty()) allMasail = bookHits.take(1).map { it.number }
        // Exact page of each cited masla from the bundled book text
        val exactPages = allMasail.mapNotNull { BookRepository.masla(it)?.page }
        var allPages = (if (exactPages.isNotEmpty()) exactPages else (pagesFound + extraPages).filter { it in 1..542 }).distinct().take(1)

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
            referencedMasail = allMasail,
            language = language
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
        if (isGreeting(q)) {
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
                AppLanguage.ROMAN_URDU -> """
Wa Alaikum Assalam wa Rahmatullah!
Main Ayatollah Sayyid Ali al-Husayni al-Sistani ki kitab 'Tauzih ul Masail' ka Fiqhi Assistant hoon.

Aap poori kitab (542 pages) me se koi bhi sawal pooch sakte hain. Har jawab me exact Masla Number aur Page Number ka direct link milega. Apna sawal likhein!
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

            AppLanguage.ROMAN_URDU -> """
Ayatollah Sayyid Ali al-Husayni al-Sistani ki Tauzih ul Masail ke mutabiq:

Bab: ${matchingChapter.titleUrdu} (${matchingChapter.titleEnglish})
Masla Reference: Masla number $targetMasla (Range: Masla ${matchingChapter.maslaStart} se ${matchingChapter.maslaEnd})
Page Reference: Page number $targetPageNum (total 542 me se)

Shar'i Hukm ka khulasa:
${matchingChapter.description}

(Direct ye page dekhne, parhne aur download karne ke liye niche diye gaye button par click karein)
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
    val referencedMasail: List<Int>,
    /** Language the answer is written in (used for text direction in the chat). */
    val language: AppLanguage? = null
)
