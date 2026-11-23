package com.example.network

import android.content.Context
import android.util.Base64
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.SettingsStore
import com.example.data.TauzihChapter
import com.example.data.TauzihDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Answers questions from the real book:
 *  1. find candidate pages (OCR text index + chapter hints + masla number lookup)
 *  2. send the actual page images (rendered from the bundled PDF) to Gemini
 *  3. Gemini answers only from those pages, citing masla and page numbers.
 * Without an API key (or in offline mode) the app shows the matching book pages instead.
 */
object GeminiService {
    private const val BASE = "https://generativelanguage.googleapis.com/v1beta/models/"

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val BOOK_GUIDE = """
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
    """.trimIndent()

    private class ApiException(val userMessage: String) : Exception(userMessage)

    private fun languageInstruction(language: AppLanguage): String = when (language) {
        AppLanguage.URDU -> "جواب سلیس اردو میں دیں۔"
        AppLanguage.ENGLISH -> "Answer in clear English."
        AppLanguage.ROMAN_URDU -> "Jawab Roman Urdu (English huroof mein Urdu) mein dein."
        AppLanguage.FARSI -> "پاسخ را به زبان فارسی بدهید."
        AppLanguage.ARABIC -> "أجب باللغة العربية الفصحى."
    }

    suspend fun askTauzihAi(
        context: Context,
        userQuery: String,
        language: AppLanguage,
        conversationHistory: List<Pair<String, Boolean>> = emptyList(),
        offlineMode: Boolean = false
    ): Result<AiResponse> = withContext(Dispatchers.IO) {
        try {
            val query = userQuery.trim()
            val chapter = guessChapter(query)
            val maslaAsked = explicitMasla(query)
            val apiKey = SettingsStore.apiKey(context)

            if (offlineMode || apiKey.isEmpty()) {
                val note = if (apiKey.isEmpty()) noKeyNote(language) else offlineNote(language)
                return@withContext Result.success(offlineAnswer(context, query, language, chapter, maslaAsked, emptyList(), note))
            }

            val model = SettingsStore.model(context)
            try {
                // Step 1: let the AI turn the question into Urdu book keywords (handles Roman Urdu / English)
                val kw = runCatching { extractKeywords(apiKey, model, query) }.getOrNull()
                val keywords = kw?.first.orEmpty()
                val masla = maslaAsked ?: kw?.second

                // Step 2: pick candidate pages
                val pages = candidatePages(context, query, keywords, chapter, masla)

                // Step 3: answer from the page images
                val raw = answerFromPages(context, apiKey, model, query, language, conversationHistory, pages)
                Result.success(parseResponse(context, raw, pages))
            } catch (e: ApiException) {
                Result.success(offlineAnswer(context, query, language, chapter, maslaAsked, emptyList(), "⚠️ AI جواب نہیں دے سکا:\n" + e.userMessage + "\n\n(🔑 بٹن میں «Key ٹیسٹ کریں» سے مسئلہ چیک کریں)"))
            } catch (e: IOException) {
                Result.success(offlineAnswer(context, query, language, chapter, maslaAsked, emptyList(), "⚠️ " + networkError(language)))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Quick check that the key + model work. Returns a user-facing message. */
    suspend fun testKey(apiKey: String, model: String): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        if (apiKey.isBlank()) return@withContext false to "پہلے API key درج کریں۔"
        try {
            val body = JSONObject().put("contents", JSONArray().put(
                JSONObject().put("role", "user").put("parts", JSONArray().put(textPart("Reply with the single word OK")))))
            post(apiKey.trim(), model.ifBlank { SettingsStore.DEFAULT_MODEL }.trim(), body)
            true to "✅ Key درست ہے اور ماڈل کام کر رہا ہے۔"
        } catch (e: ApiException) {
            false to "❌ " + e.userMessage
        } catch (e: IOException) {
            false to "❌ انٹرنیٹ سے رابطہ نہیں ہو سکا: ${e.message}"
        } catch (e: Exception) {
            false to "❌ خرابی: ${e.message}"
        }
    }

    // ------------------------------------------------------------------ page selection

    private fun explicitMasla(q: String): Int? {
        val n = BookRepository.normalize(q)
        Regex("(?:مسیلہ|مسئلہ|مسالہ|masl[ae]h?|masala|masail|issue|ruling)\\s*(?:نمبر|no\\.?|number|#)?\\s*[:#]?\\s*(\\d{1,4})", RegexOption.IGNORE_CASE)
            .find(n)?.let { return it.groupValues[1].toIntOrNull()?.takeIf { v -> v in 1..2900 } }
        val only = n.trim()
        if (only.all { it.isDigit() } && only.length in 1..4) return only.toIntOrNull()
        return null
    }

    private fun explicitPage(q: String): Int? {
        val n = BookRepository.normalize(q)
        return Regex("(?:صفحہ|safha|page|p\\.)\\s*(?:نمبر|no\\.?|number)?\\s*[:#]?\\s*(\\d{1,3})", RegexOption.IGNORE_CASE)
            .find(n)?.groupValues?.get(1)?.toIntOrNull()?.takeIf { it in 1..BookRepository.TOTAL_PAGES }
    }

    private fun candidatePages(
        context: Context,
        query: String,
        keywords: List<String>,
        chapter: TauzihChapter?,
        masla: Int?
    ): List<Int> {
        val result = LinkedHashSet<Int>()
        explicitPage(query)?.let { result.add(it) }
        masla?.let { m ->
            BookRepository.pageForMasla(context, m)?.let { est ->
                // index is approximate (±1 page): send the neighbours too
                listOf(est, est - 1, est + 1).filter { it in 1..BookRepository.TOTAL_PAGES }.forEach { result.add(it) }
            }
        }
        val hint = chapter?.let { it.pageStart..it.pageEnd }
        val hits = BookRepository.search(context, query, keywords, hint, limit = 4)
        hits.forEach { if (result.size < 4) result.add(it.page) }
        if (result.isEmpty() && chapter != null) {
            result.add(chapter.pageStart); result.add(chapter.pageStart + 1)
        }
        // The best hit's ruling may continue on the next page
        if (result.size < 5 && hits.isNotEmpty()) {
            val next = hits.first().page + 1
            if (next <= BookRepository.TOTAL_PAGES) result.add(next)
        }
        return result.take(5)
    }

    // ------------------------------------------------------------------ Gemini calls

    private fun post(apiKey: String, model: String, body: JSONObject): String {
        val request = Request.Builder()
            .url("$BASE$model:generateContent")
            .header("x-goog-api-key", apiKey)
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        okHttpClient.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val apiMsg = runCatching { JSONObject(text).getJSONObject("error").optString("message") }.getOrDefault("")
                val msg = when (response.code) {
                    400 -> if (apiMsg.contains("API key", true)) "API key درست نہیں ہے۔ سیٹنگز (🔑) میں صحیح key درج کریں۔" else "درخواست میں خرابی (400): $apiMsg"
                    401, 403 -> "API key درست نہیں یا اس کی اجازت نہیں ہے۔ سیٹنگز (🔑) میں key چیک کریں۔"
                    404 -> "ماڈل '$model' دستیاب نہیں۔ سیٹنگز میں ماڈل کا نام '${SettingsStore.DEFAULT_MODEL}' کر دیں۔"
                    429 -> "Gemini کی مفت حد (quota) ختم ہو گئی ہے، تھوڑی دیر بعد کوشش کریں۔"
                    in 500..599 -> "Gemini سرور مصروف ہے، دوبارہ کوشش کریں۔"
                    else -> "خرابی ${response.code}: $apiMsg"
                }
                throw ApiException(msg)
            }
            val root = JSONObject(text)
            val parts = root.optJSONArray("candidates")?.optJSONObject(0)
                ?.optJSONObject("content")?.optJSONArray("parts") ?: return ""
            val sb = StringBuilder()
            for (i in 0 until parts.length()) {
                val p = parts.optJSONObject(i) ?: continue
                if (p.optBoolean("thought", false)) continue
                sb.append(p.optString("text"))
            }
            return sb.toString().trim()
        }
    }

    private fun textPart(t: String) = JSONObject().put("text", t)

    /** Returns Urdu keywords for searching the book, plus a masla number if the question names one. */
    private fun extractKeywords(apiKey: String, model: String, query: String): Pair<List<String>, Int?> {
        val prompt = """
You help search the Urdu book "Tauzih ul Masail" (Ayatollah Sistani). For the user's question below,
return JSON only: {"keywords": [...], "masla": number or null}
- keywords: 4 to 8 short Urdu words/phrases exactly as they would be written in the Urdu book text
  (e.g. روزہ, باطل, قے, غسل جنابت, نماز قصر, مسافر, خمس), in Urdu script even if the question is Roman Urdu/English.
- masla: only if the user explicitly asks about a specific masla number.

Book guide:
$BOOK_GUIDE

Question: $query
        """.trimIndent()
        val body = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("role", "user").put("parts", JSONArray().put(textPart(prompt)))))
            .put("generationConfig", JSONObject().put("temperature", 0).put("responseMimeType", "application/json"))
        val raw = post(apiKey, model, body)
        val json = JSONObject(raw.substring(raw.indexOf('{').coerceAtLeast(0), raw.lastIndexOf('}') + 1))
        val arr = json.optJSONArray("keywords") ?: JSONArray()
        val list = (0 until arr.length()).map { arr.optString(it) }.filter { it.isNotBlank() }
        val m = if (json.isNull("masla")) null else json.optInt("masla", -1).takeIf { it > 0 }
        return list to m
    }

    private fun answerFromPages(
        context: Context,
        apiKey: String,
        model: String,
        query: String,
        language: AppLanguage,
        history: List<Pair<String, Boolean>>,
        pages: List<Int>
    ): String {
        val system = """
You are a careful assistant for Ayatollah Sayyid Ali al-Sistani's Urdu book "توضیح المسائل" (Tauzih ul Masail, 542 pages).
You are given images of actual pages of the book, each labelled with its page number.
RULES:
1. Answer ONLY from what is written on these page images. Do not use outside knowledge or guess.
2. Quote or closely paraphrase the relevant ruling text, and cite the exact masla number exactly as printed
   on the page (numbers like ۱۵۸۱ at the start of a paragraph) and the page number from the label.
3. Always include the tags [MASLA: number] and [PAGE: number] for every ruling you cite.
4. If the answer is not on the given pages, say clearly that it was not found on these pages, mention the
   closest related masail you do see, and suggest the user rephrase. Never invent a masla or page number.
5. If the question is not about fiqh in this book (e.g. a greeting), reply briefly and politely.
6. ${languageInstruction(language)}

Book guide (for orientation only):
$BOOK_GUIDE
        """.trimIndent()

        val contents = JSONArray()
        // Recent conversation (text only)
        val valid = mutableListOf<Pair<String, Boolean>>()
        var expectUser = true
        for (item in history) {
            if (item.first.isNotBlank() && item.second == expectUser) { valid.add(item); expectUser = !expectUser }
        }
        if (valid.isNotEmpty() && valid.last().second) valid.removeAt(valid.size - 1)
        valid.takeLast(4).forEach { (msg, isUser) ->
            contents.put(JSONObject().put("role", if (isUser) "user" else "model").put("parts", JSONArray().put(textPart(msg.take(1500)))))
        }

        val parts = JSONArray()
        for (p in pages) {
            val jpeg = BookRepository.pageJpeg(context, p) ?: continue
            parts.put(textPart("Book page $p:"))
            parts.put(JSONObject().put("inline_data", JSONObject()
                .put("mime_type", "image/jpeg")
                .put("data", Base64.encodeToString(jpeg, Base64.NO_WRAP))))
        }
        parts.put(textPart("Question: $query"))
        contents.put(JSONObject().put("role", "user").put("parts", parts))

        val body = JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(textPart(system))))
            .put("contents", contents)
            .put("generationConfig", JSONObject().put("temperature", 0.2))
        val text = post(apiKey, model, body)
        if (text.isBlank()) throw ApiException("AI سے کوئی جواب نہیں ملا، دوبارہ کوشش کریں۔")
        return text
    }

    private fun parseResponse(context: Context, rawText: String, sentPages: List<Int>): AiResponse {
        val masail = (Regex("\\[MASLA:\\s*([\\d۰-۹]+)\\]", RegexOption.IGNORE_CASE).findAll(rawText)
            .mapNotNull { BookRepository.normalize(it.groupValues[1]).toIntOrNull() }).distinct().toList()
        var pages = Regex("\\[PAGE:\\s*([\\d۰-۹]+)\\]", RegexOption.IGNORE_CASE).findAll(rawText)
            .mapNotNull { BookRepository.normalize(it.groupValues[1]).toIntOrNull() }
            .filter { it in 1..BookRepository.TOTAL_PAGES }.distinct().toList()
        if (pages.isEmpty()) pages = masail.mapNotNull { BookRepository.pageForMasla(context, it) }.distinct()
        if (pages.isEmpty()) pages = sentPages.take(2)
        val clean = rawText
            .replace(Regex("\\[MASLA:\\s*([\\d۰-۹]+)\\]", RegexOption.IGNORE_CASE), "(مسئلہ $1)")
            .replace(Regex("\\[PAGE:\\s*([\\d۰-۹]+)\\]", RegexOption.IGNORE_CASE), "(صفحہ $1)")
            .trim()
        return AiResponse(text = clean, referencedPages = pages, referencedMasail = masail)
    }

    // ------------------------------------------------------------------ offline answer

    private fun noKeyNote(language: AppLanguage) = when (language) {
        AppLanguage.URDU, AppLanguage.FARSI, AppLanguage.ARABIC ->
            "ℹ️ AI جواب کے لئے Gemini API key درکار ہے (اوپر 🔑 بٹن)۔ فی الحال کتاب میں تلاش کے نتائج دکھائے جا رہے ہیں — درست حکم کے لئے نیچے دیئے گئے صفحات کھول کر پڑھیں۔"
        else -> "ℹ️ An AI answer needs a Gemini API key (🔑 button at top). Showing book search results for now — open the pages below to read the exact ruling."
    }

    private fun offlineNote(language: AppLanguage) = when (language) {
        AppLanguage.URDU, AppLanguage.FARSI, AppLanguage.ARABIC ->
            "📖 آف لائن موڈ: کتاب میں تلاش کے نتائج — درست حکم کے لئے صفحہ کھول کر پڑھیں۔"
        else -> "📖 Offline mode: book search results — open a page to read the exact ruling."
    }

    private fun networkError(language: AppLanguage) = when (language) {
        AppLanguage.URDU, AppLanguage.FARSI, AppLanguage.ARABIC -> "انٹرنیٹ سے رابطہ نہیں ہو سکا۔ کتاب میں تلاش کے نتائج:"
        else -> "Could not connect to the internet. Book search results:"
    }

    private fun offlineAnswer(
        context: Context,
        query: String,
        language: AppLanguage,
        chapter: TauzihChapter?,
        masla: Int?,
        keywords: List<String>,
        note: String
    ): AiResponse {
        val pages = LinkedHashSet<Int>()
        explicitPage(query)?.let { pages.add(it) }
        masla?.let { m -> BookRepository.pageForMasla(context, m)?.let { pages.add(it) } }
        val hint = chapter?.let { it.pageStart..it.pageEnd }
        BookRepository.search(context, query, keywords, hint, limit = 3).forEach { pages.add(it.page) }
        if (pages.isEmpty() && chapter != null) pages.add(chapter.pageStart)

        val sb = StringBuilder(note).append("\n\n")
        if (pages.isEmpty()) {
            sb.append(
                if (language == AppLanguage.ENGLISH || language == AppLanguage.ROMAN_URDU)
                    "No matching page found. Try Urdu words from the book (e.g. روزہ، وضو، نماز) or the Chapters tab."
                else "کوئی مطابقت رکھنے والا صفحہ نہیں ملا۔ کتاب کے الفاظ (مثلاً روزہ، وضو، نماز) میں سوال لکھیں یا ابواب والے حصے سے دیکھیں۔"
            )
        }
        if (pages.isNotEmpty()) {
            sb.append(
                if (language == AppLanguage.ENGLISH || language == AppLanguage.ROMAN_URDU)
                    "Your answer is most likely on these pages of the book:\n\n"
                else "آپ کے سوال کا جواب غالباً کتاب کے ان صفحات پر ہے:\n\n"
            )
        }
        pages.take(3).forEach { p ->
            val range = BookRepository.masailOnPage(context, p)
            val ch = TauzihDatabase.findChapterForPage(p)
            sb.append("📄 صفحہ $p")
            if (ch != null) sb.append(" — ${ch.titleUrdu}")
            if (range != null) sb.append("\n     (مسائل تقریباً ${range.first} تا ${range.last})")
            sb.append("\n\n")
        }
        if (pages.isNotEmpty()) {
            sb.append(
                if (language == AppLanguage.ENGLISH || language == AppLanguage.ROMAN_URDU)
                    "Tap a page button below to read the original page."
                else "اصل صفحہ پڑھنے کے لئے نیچے صفحہ والے بٹن پر کلک کریں۔"
            )
        }
        return AiResponse(
            text = sb.toString().trim(),
            referencedPages = pages.take(3).toList(),
            referencedMasail = listOfNotNull(masla)
        )
    }

    private fun guessChapter(query: String): TauzihChapter? {
        val q = query.lowercase().trim()
        return when {
                        q.contains("روزہ") || q.contains("روزے") || q.contains("roza") || q.contains("fast") || q.contains("افطار") || q.contains("صوم") || q.contains("رمضان") || q.contains("سحر") || q.contains("کفارہ") ->
                TauzihDatabase.chapters.find { it.id == "roza" }
            q.contains("قصر") || q.contains("مسافر") || q.contains("qasr") || q.contains("safar") || q.contains("travel") || q.contains("فرسخ") || q.contains("ترخص") ->
                TauzihDatabase.chapters.find { it.id == "musafir_namaz" }
            q.contains("وضو") || q.contains("wudu") || q.contains("wudhu") || q.contains("wuzu") || q.contains("مسح") || q.contains("جبیرہ") ->
                TauzihDatabase.chapters.find { it.id == "wudhu" }
            q.contains("خمس") || q.contains("khums") || q.contains("سہم") || q.contains("سادات") || q.contains("منافع") ->
                TauzihDatabase.chapters.find { it.id == "khums" }
            q.contains("زکو") || q.contains("فطرہ") || q.contains("فطره") || q.contains("zakat") || q.contains("fitra") ->
                TauzihDatabase.chapters.find { it.id == "zakat" }
            q.contains("غسل") || q.contains("جنابت") || q.contains("ghusl") || q.contains("janabat") || q.contains("مجنب") ->
                TauzihDatabase.chapters.find { it.id == "ghusl_janabat" }
            q.contains("نجس") || q.contains("نجاست") || q.contains("پیشاب") || q.contains("پاخانہ") || q.contains("خون") || q.contains("منی") || q.contains("کتا") || q.contains("شراب") || q.contains("najasat") || q.contains("پاک") ->
                TauzihDatabase.chapters.find { it.id == "najasat" }
            q.contains("مطہر") || q.contains("پانی") || q.contains("کُر") || q.contains("قلیل") || q.contains("جاری") || q.contains("بارش") || q.contains("kurr") || q.contains("water") ->
                TauzihDatabase.chapters.find { it.id == "mutahhirat" }
            q.contains("استبراء") || q.contains("istibra") || q.contains("بیت الخلاء") || q.contains("ٹائلٹ") || q.contains("toilet") ->
                TauzihDatabase.chapters.find { it.id == "baitulkhala" }
            q.contains("حیض") || q.contains("استحاضہ") || q.contains("نفاس") || q.contains("عورت") || q.contains("haiz") || q.contains("nifas") || q.contains("istihaza") ->
                TauzihDatabase.chapters.find { it.id == "women_rulings" }
            q.contains("میت") || q.contains("کفن") || q.contains("دفن") || q.contains("جنازہ") || q.contains("قبر") || q.contains("وحشت") || q.contains("mayyit") ->
                TauzihDatabase.chapters.find { it.id == "mayyit" }
            q.contains("تیمم") || q.contains("tayammum") || q.contains("مٹی") ->
                TauzihDatabase.chapters.find { it.id == "tayammum" }
            q.contains("نکاح") || q.contains("شادی") || q.contains("متعہ") || q.contains("مہر") || q.contains("nikah") || q.contains("marriage") || q.contains("رضاعت") || q.contains("دودھ") ->
                TauzihDatabase.chapters.find { it.id == "nikah" }
            q.contains("طلاق") || q.contains("عدت") || q.contains("خلع") || q.contains("talaq") || q.contains("divorce") ->
                TauzihDatabase.chapters.find { it.id == "talaq" }
            q.contains("حج") || q.contains("عمرہ") || q.contains("طواف") || q.contains("hajj") || q.contains("umrah") ->
                TauzihDatabase.chapters.find { it.id == "hajj" }
            q.contains("سود") || q.contains("ربا") || q.contains("خرید") || q.contains("فروخت") || q.contains("بیع") || q.contains("riba") || q.contains("trade") || q.contains("خیار") ->
                TauzihDatabase.chapters.find { it.id == "muamalat_buying" }
            q.contains("اجارہ") || q.contains("کرایہ") || q.contains("مکان") || q.contains("شراکت") || q.contains("صلح") || q.contains("rent") ->
                TauzihDatabase.chapters.find { it.id == "ijarah_shirakat" }
            q.contains("قرض") || q.contains("امانت") || q.contains("رہن") || q.contains("گروی") || q.contains("ضمانت") || q.contains("loan") ->
                TauzihDatabase.chapters.find { it.id == "qarz_amanat" }
            q.contains("ذبح") || q.contains("شکار") || q.contains("گوشت") || q.contains("حلال") || q.contains("حرام") || q.contains("مچھلی") || q.contains("halal") || q.contains("meat") ->
                TauzihDatabase.chapters.find { it.id == "food_slaughter" }
            q.contains("میراث") || q.contains("وراثت") || q.contains("ترکہ") || q.contains("ارث") || q.contains("وارث") || q.contains("inheritance") ->
                TauzihDatabase.chapters.find { it.id == "meeras" }
            q.contains("نماز") || q.contains("رکعت") || q.contains("سجدہ") || q.contains("رکوع") || q.contains("قنوت") || q.contains("تشہد") || q.contains("اذان") || q.contains("جماعت") || q.contains("namaz") || q.contains("prayer") ->
                TauzihDatabase.chapters.find { it.id == "namaz_wajibat" }
            else -> null
        }
    }
}

data class AiResponse(
    val text: String,
    val referencedPages: List<Int>,
    val referencedMasail: List<Int>
)
