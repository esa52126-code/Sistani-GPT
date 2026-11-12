package com.example.network

import com.example.BuildConfig
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.Masla
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class AiAnswer(
    val text: String,
    val references: List<Masla>,
    val offline: Boolean,
)

/**
 * Answers questions strictly from the bundled book text:
 *  1. the question (any language) is turned into Urdu search keywords,
 *  2. the matching masail are found with the offline search,
 *  3. the model answers only from those masail and cites their ids.
 * References shown to the user are always the real book entries, never text produced by the model.
 * Without an API key or a network connection the matching masail are returned verbatim.
 */
object TauzihAi {
    private const val MODEL_NAME = "gemini-3.5-flash"
    private const val BASE_URL =
        "https://generativelanguage.googleapis.com/v1beta/models/$MODEL_NAME:generateContent"
    private const val MAX_EXCERPT_CHARS = 2500
    private const val CONTEXT_SIZE = 12

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val hasApiKey: Boolean
        get() = BuildConfig.GEMINI_API_KEY.isNotBlank() && BuildConfig.GEMINI_API_KEY != "MY_GEMINI_API_KEY"

    /** [history] is the earlier conversation as (text, isUser) pairs, oldest first. */
    suspend fun ask(
        question: String,
        language: AppLanguage,
        history: List<Pair<String, Boolean>> = emptyList(),
    ): AiAnswer = withContext(Dispatchers.IO) {
        val explicit = explicitMasla(question)
        if (!hasApiKey) return@withContext offlineAnswer(question, explicit)

        val rewrite = runCatching { rewriteQuery(question, history) }.getOrNull()
        val target = explicit ?: rewrite?.masla?.let { BookRepository.byNumber(it) }
        val found = BookRepository.search(question, rewrite?.keywords ?: emptyList(), CONTEXT_SIZE)
        val context = (listOfNotNull(target) + found).distinctBy { it.id }.take(CONTEXT_SIZE)
        if (context.isEmpty()) return@withContext offlineAnswer(question, explicit)

        try {
            val raw = generate(
                system = answerInstruction(language),
                contents = historyContents(history).put(userContent(buildPrompt(question, context))),
                temperature = 0.2,
                json = false,
            )
            parseAnswer(raw, context, language)
        } catch (e: Exception) {
            offlineAnswer(question, explicit)
        }
    }

    // ---- prompts ---------------------------------------------------------------------------

    private fun answerInstruction(language: AppLanguage) = """
You are a reference assistant for one book only: "Tawzih al-Masail" (Urdu edition) by Ayatullah al-Uzma Sayyid Ali al-Husayni al-Sistani.

Each user message contains a QUESTION and BOOK EXCERPTS. Every excerpt starts with its id in square brackets, e.g. [M1529] for masla 1529 or [S42] for an unnumbered section.

Rules:
1. Answer ONLY from the BOOK EXCERPTS. Never use outside knowledge, other scholars' opinions, or your own reasoning to create a ruling. Never invent a masla number.
2. After every ruling you state, cite the excerpt it comes from by its exact id in square brackets, e.g. [M1529]. Cite only ids that appear in the excerpts of this message.
3. Keep the book's qualifiers exactly as they are (for example: wajib, haram, mustahab, makruh, ihtiyat wajib / "احتیاط واجب", ihtiyat mustahab / "احتیاط مستحب", "احتیاط لازم"). Never strengthen or weaken a ruling.
4. If the excerpts do not clearly answer the question, say plainly that an explicit ruling for this question was not found in Tawzih al-Masail, mention the closest related masla if there is one, and advise the user to ask the office of the Marja (www.sistani.org). Do not guess.
5. Start with the direct ruling, then give its conditions or exceptions. Be concise. Plain text only: no markdown, no asterisks, no headings.
6. If the message is only a greeting or thanks, reply briefly and invite a fiqh question; cite nothing.
7. Write the whole answer in ${language.promptName}. Keep the citation ids like [M1529] unchanged in Latin letters and digits.
""".trim()

    private const val REWRITE_INSTRUCTION = """
You prepare search keywords for a keyword search over the Urdu text of the fiqh book "Tawzih al-Masail" by Ayatullah Sistani.
The user's question may be in Urdu, English, Roman Urdu, Persian or Arabic, and may be a follow-up to the earlier conversation.
Return JSON: {"keywords": [...], "masla": number or null}
- "keywords": 5 to 10 Urdu-script words or short two-word phrases, exactly as they would be spelled in an Urdu fiqh book, covering the topic, the specific situation, and common fiqh synonyms (for example for breaking a fast by mistake: "روزہ", "بھول", "کھانا", "پینا", "باطل", "مبطلات").
- "masla": the masla number only if the user explicitly asks about a specific masla number, otherwise null.
Return only the JSON."""

    private fun buildPrompt(question: String, context: List<Masla>): String = buildString {
        append("QUESTION:\n").append(question.trim()).append("\n\nBOOK EXCERPTS:\n")
        context.forEach { m ->
            val chapter = BookRepository.chapterOf(m).title
            append('[').append(m.id).append("] (باب: ").append(chapter)
            if (m.section.isNotBlank()) append(" › ").append(m.section)
            append(")\n").append(m.text.take(MAX_EXCERPT_CHARS)).append("\n\n")
        }
    }

    // ---- Gemini calls ----------------------------------------------------------------------

    private class Rewrite(val keywords: List<String>, val masla: Int?)

    private fun rewriteQuery(question: String, history: List<Pair<String, Boolean>>): Rewrite {
        val raw = generate(
            system = REWRITE_INSTRUCTION.trim(),
            contents = historyContents(history).put(userContent(question)),
            temperature = 0.0,
            json = true,
        )
        val obj = JSONObject(raw.substring(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
        val arr = obj.optJSONArray("keywords") ?: JSONArray()
        val keywords = (0 until arr.length()).map { arr.optString(it) }.filter { it.isNotBlank() }.take(12)
        val masla = if (obj.isNull("masla")) null else obj.optInt("masla").takeIf { it > 0 }
        return Rewrite(keywords, masla)
    }

    private fun content(role: String, text: String) = JSONObject()
        .put("role", role)
        .put("parts", JSONArray().put(JSONObject().put("text", text)))

    private fun userContent(text: String) = content("user", text)

    /** The last two complete question/answer turns, as alternating user/model contents. */
    private fun historyContents(history: List<Pair<String, Boolean>>): JSONArray {
        val turns = ArrayList<Pair<String, String>>()
        var pendingQuestion: String? = null
        for ((text, isUser) in history) {
            if (isUser) {
                pendingQuestion = text
            } else if (pendingQuestion != null && text.isNotBlank()) {
                turns += pendingQuestion to text
                pendingQuestion = null
            }
        }
        val arr = JSONArray()
        turns.takeLast(2).forEach { (q, a) ->
            arr.put(userContent(q.take(1000)))
            arr.put(content("model", a.take(1500)))
        }
        return arr
    }

    private fun generate(system: String, contents: JSONArray, temperature: Double, json: Boolean): String {
        val config = JSONObject().put("temperature", temperature)
        if (json) config.put("responseMimeType", "application/json")
        val body = JSONObject()
            .put("contents", contents)
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", system))))
            .put("generationConfig", config)
        val request = Request.Builder()
            .url(BASE_URL)
            .header("x-goog-api-key", BuildConfig.GEMINI_API_KEY)
            .post(body.toString().toRequestBody("application/json".toMediaType()))
            .build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) error("HTTP ${response.code}")
            val parts = JSONObject(text).optJSONArray("candidates")
                ?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")
                ?: error("empty response")
            val out = StringBuilder()
            for (i in 0 until parts.length()) out.append(parts.optJSONObject(i)?.optString("text").orEmpty())
            if (out.isBlank()) error("empty response")
            return out.toString()
        }
    }

    // ---- answer handling -------------------------------------------------------------------

    private val citationBlock = Regex("""\[([^\[\]]{1,80})]""")
    private val citationId = Regex("""([MS])\s*[:#-]?\s*(\d+)""", RegexOption.IGNORE_CASE)

    /** Keeps only citations that point at excerpts the model was actually given. */
    internal fun parseAnswer(raw: String, context: List<Masla>, language: AppLanguage): AiAnswer {
        val allowed = context.associateBy { it.id }
        val cited = LinkedHashMap<String, Masla>()
        val text = citationBlock.replace(raw) { block ->
            val ids = citationId.findAll(block.groupValues[1])
                .map { it.groupValues[1].uppercase() + it.groupValues[2] }
                .toList()
            if (ids.isEmpty()) {
                block.value
            } else {
                val valid = ids.mapNotNull { allowed[it] }
                valid.forEach { cited[it.id] = it }
                if (valid.isEmpty()) "" else valid.joinToString("، ", "(", ")") { citationLabel(it, language) }
            }
        }
        val clean = text.replace("**", "").replace(Regex("(?m)^#+\\s*"), "")
            .replace(Regex("[ \\t]+\\n"), "\n").replace(Regex(" {2,}"), " ").trim()
        return AiAnswer(clean, cited.values.toList(), offline = false)
    }

    fun citationLabel(m: Masla, language: AppLanguage): String = when {
        m.number == 0 -> BookRepository.chapterOf(m).title
        language == AppLanguage.URDU -> "مسئلہ ${m.number}"
        language == AppLanguage.FARSI -> "مسئله ${m.number}"
        language == AppLanguage.ARABIC -> "المسألة ${m.number}"
        else -> "Masla ${m.number}"
    }

    private val maslaNumber = Regex(
        """(?:مسئلہ|مسئله|مسألة|المسألة|masla|masala|mas'ala|issue)\s*(?:نمبر|number|no\.?|#)?\s*[:#(]?\s*([0-9۰-۹٠-٩]{1,4})""",
        RegexOption.IGNORE_CASE,
    )

    internal fun explicitMasla(question: String): Masla? {
        val digits = maslaNumber.find(question)?.groupValues?.get(1) ?: return null
        val n = digits.fold(0) { acc, c ->
            val d = when (c) {
                in '۰'..'۹' -> c - '۰'
                in '٠'..'٩' -> c - '٠'
                else -> c - '0'
            }
            acc * 10 + d
        }
        return BookRepository.byNumber(n)
    }

    /** No AI available: return the best matching book entries; the UI shows their full text. */
    private fun offlineAnswer(question: String, explicit: Masla?): AiAnswer {
        val refs = (listOfNotNull(explicit) + BookRepository.search(question, limit = 4)).distinctBy { it.id }.take(4)
        return AiAnswer("", refs, offline = true)
    }
}
