package com.example.data

import kotlin.math.ln

/** One masla (ruling) of Tauzih ul Masail as printed in the book. */
/** [heading] is the book's section heading above the masla (may be empty). */
data class Masla(val number: Int, val page: Int, val text: String, val heading: String = "")

/**
 * Offline full-text search over the complete text of Tauzih ul Masail.
 *
 * Pure Kotlin (no Android APIs) so it can be unit tested on the JVM.
 * Ranking is BM25 over lightly stemmed, normalised Urdu tokens. Roman Urdu and
 * English keywords are translated to their Urdu equivalents first.
 */
class BookIndex(val masail: List<Masla>, val pages: List<String>) {

    private val byNumber: Map<Int, Masla> = masail.associateBy { it.number }
    private val byPage: Map<Int, List<Masla>> = masail.groupBy { it.page }

    private val postings: Map<String, IntArray>
    private val postingTf: Map<String, IntArray>
    private val docLen: IntArray
    /** Terms that occur at the start of a masla, where its subject is usually stated. */
    private val leadTerms: Array<Set<String>>
    private val avgLen: Double

    init {
        val tmpDocs = HashMap<String, MutableList<Int>>()
        val tmpTf = HashMap<String, MutableList<Int>>()
        docLen = IntArray(masail.size)
        val leads = ArrayList<Set<String>>(masail.size)
        masail.forEachIndexed { i, m ->
            val counts = HashMap<String, Int>()
            val headingTerms = indexTerms(m.heading)
            // Section headings name the topic ("وضو کا طریقہ"), so they count double.
            val terms = indexTerms(m.text) + headingTerms + headingTerms
            docLen[i] = terms.size
            leads.add((terms.take(LEAD_TERMS) + headingTerms).toHashSet())
            for (t in terms) counts[t] = (counts[t] ?: 0) + 1
            for ((t, c) in counts) {
                tmpDocs.getOrPut(t) { mutableListOf() }.add(i)
                tmpTf.getOrPut(t) { mutableListOf() }.add(c)
            }
        }
        leadTerms = leads.toTypedArray()
        postings = tmpDocs.mapValues { it.value.toIntArray() }
        postingTf = tmpTf.mapValues { it.value.toIntArray() }
        avgLen = if (masail.isEmpty()) 1.0 else docLen.average().coerceAtLeast(1.0)
    }

    fun masla(number: Int): Masla? = byNumber[number]

    /** Text of a printed page (1-based), or null when out of range. */
    fun pageText(page: Int): String? = pages.getOrNull(page - 1)?.takeIf { it.isNotBlank() }

    fun masailOnPage(page: Int): List<Masla> = byPage[page].orEmpty()

    /** A ranked search result. [matched] of the [queryTermCount] query terms occur in the masla. */
    data class Hit(val masla: Masla, val score: Double, val matched: Int, val queryTermCount: Int, val explicit: Boolean)

    /**
     * Finds the masail that best match [query] (broad list, used as context for the AI).
     * An explicit masla number in the query ("masla 1581", "مسئلہ ۱۵۸۱") is always returned first.
     */
    fun search(query: String, limit: Int = 6): List<Masla> = rank(query, limit).map { it.masla }

    /**
     * Only the masail that really answer [query]: the best match, plus others only when they
     * score almost as well and contain as many of the query terms. Used for offline answers,
     * so that unrelated masail are not shown next to the right one.
     */
    fun searchRelevant(query: String, max: Int = 3): List<Masla> {
        val hits = rank(query, max * 3)
        if (hits.isEmpty()) return emptyList()
        val explicit = hits.filter { it.explicit }
        if (explicit.isNotEmpty()) return explicit.take(max).map { it.masla }
        val top = hits.first()
        // A single matched word out of several is too weak to be trusted.
        if (top.queryTermCount >= 3 && top.matched < 2) return emptyList()
        return hits.filter { it === top || (it.score >= top.score * RELEVANCE_RATIO && it.matched >= top.matched) }
            .take(max).map { it.masla }
    }

    private fun rank(query: String, limit: Int): List<Hit> {
        val results = LinkedHashMap<Int, Hit>()
        explicitMaslaNumbers(query).forEach { n ->
            byNumber[n]?.let { results[n] = Hit(it, Double.MAX_VALUE, 0, 0, true) }
        }
        val terms = queryTerms(query)
        if (terms.isEmpty()) return results.values.take(limit)

        val n = masail.size.toDouble()
        val scores = DoubleArray(masail.size)
        val matched = IntArray(masail.size)
        for (t in terms) {
            val docs = postings[t] ?: continue
            val tfs = postingTf.getValue(t)
            val idf = ln(1.0 + (n - docs.size + 0.5) / (docs.size + 0.5))
            for (j in docs.indices) {
                val d = docs[j]
                val tf = tfs[j].toDouble()
                val norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * docLen[d] / avgLen))
                scores[d] += idf * norm
                if (t in leadTerms[d]) scores[d] += idf * LEAD_BONUS
                matched[d]++
            }
        }
        val wantsList = isListQuestion(query)
        for (d in scores.indices) {
            if (scores[d] <= 0) continue
            // Reward masail that contain more of the distinct query terms.
            if (matched[d] > 1) scores[d] *= 1.0 + 0.6 * (matched[d] - 1)
            if (wantsList && isEnumeration(masail[d].text)) scores[d] *= 1.6
        }
        // Reward masail where the query words stand close together (same sentence).
        val candidates = scores.indices.filter { scores[it] > 0 }.sortedByDescending { scores[it] }.take(80)
        if (terms.size > 1) {
            for (d in candidates) {
                if (matched[d] < 2) continue
                val span = minOf(
                    closestSpan(indexTerms(masail[d].text), terms.toSet()),
                    closestSpan(indexTerms(masail[d].heading + " " + masail[d].text.take(200)), terms.toSet())
                )
                scores[d] *= when {
                    span <= 6 -> 1.6
                    span <= 12 -> 1.35
                    span <= 25 -> 1.15
                    else -> 1.0
                }
            }
        }
        candidates.sortedByDescending { scores[it] }.take(limit * 2).forEach { d ->
            results.putIfAbsent(masail[d].number, Hit(masail[d], scores[d], matched[d], terms.size, false))
        }
        return results.values.take(limit)
    }

    /** Length of the shortest run of tokens that contains every query term present in [tokens]. */
    private fun closestSpan(tokens: List<String>, terms: Set<String>): Int {
        val present = terms.filter { it in tokens }.toSet()
        if (present.size < 2) return Int.MAX_VALUE
        val count = HashMap<String, Int>()
        var have = 0
        var best = Int.MAX_VALUE
        var left = 0
        for (right in tokens.indices) {
            val t = tokens[right]
            if (t in present) {
                val c = (count[t] ?: 0) + 1
                count[t] = c
                if (c == 1) have++
            }
            while (have == present.size) {
                best = minOf(best, right - left + 1)
                val lt = tokens[left]
                if (lt in present) {
                    val c = count.getValue(lt) - 1
                    count[lt] = c
                    if (c == 0) have--
                }
                left++
            }
        }
        return best
    }

    companion object {
        private const val K1 = 1.2
        private const val B = 0.3
        private const val LEAD_TERMS = 12
        private const val LEAD_BONUS = 0.8
        private const val RELEVANCE_RATIO = 0.85

        private val MARKS = Regex("[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640\\u200C\\u200D\\u200E\\u200F]")
        private val TOKEN = Regex("[\\p{L}\\p{N}]+")

        private val STOPWORDS: Set<String> get() = STOPWORDS_NORMALIZED
        private val STOPWORDS_RAW = setOf(
            "کا", "کی", "کے", "ہے", "ہیں", "میں", "اور", "سے", "کو", "اگر", "تو", "کیا", "جو", "یہ", "وہ",
            "نہ", "ہو", "پر", "بھی", "ایک", "کر", "کہ", "ہوں", "تھا", "تھی", "تھے", "گا", "گی", "گے", "اس",
            "ان", "جس", "جن", "لئے", "لیے", "یا", "ہوتا", "ہوتی", "ہوتے", "کرے", "کرنا", "دے", "لے", "بعد",
            "پہلے", "والا", "والی", "والے", "اپنے", "اپنی", "اپنا", "کسی", "کوئی", "کچھ", "مسئلہ", "مسئلے",
            "ضروری", "حکم", "شخص", "انسان", "بتائیں", "بتایں", "بارے", "متعلق", "چاہیے", "چاہئے", "سکتا",
            "سکتی", "سکتے", "ہم", "میرا", "میری", "میرے", "آپ", "مجھے", "ہمیں", "کیسے", "کب", "کیوں",
            "کتنا", "کتنی", "کتنے", "نہیں", "کن", "کس", "جاتا", "جاتی", "جاتے", "ہوجاتا", "ہوجاتی"
        )
        private val STOPWORDS_NORMALIZED: Set<String> by lazy { STOPWORDS_RAW.mapTo(HashSet()) { normalize(it) } }

        private val LATIN_STOPWORDS = setOf(
            "ka", "ki", "ke", "hai", "hain", "he", "mein", "me", "main", "aur", "or", "se", "ko", "agar",
            "to", "kya", "kia", "jo", "ye", "yeh", "wo", "woh", "na", "ho", "par", "pe", "bhi", "ek", "kar",
            "kr", "ki", "is", "us", "the", "a", "an", "of", "in", "on", "what", "how", "when", "why",
            "about", "for", "and", "it", "does", "do", "can", "my", "i", "masla", "masail", "mas'ala",
            "page", "safha", "number", "no", "rule", "ruling", "hukm", "hukum", "batain", "batayen",
            "bataen", "btao", "batao", "please", "plz", "sistani", "agha", "ayatollah", "kaisa", "kaise",
            "kesy", "kese", "kab", "nahi", "nahin", "is", "are", "be", "with"
        )

        /** Roman Urdu / English keyword -> Urdu terms as spelt in the book. */
        private val TRANSLATIONS: Map<String, List<String>> = buildMap {
            fun put(vararg keys: String, urdu: String) {
                val terms = urdu.split(' ')
                keys.forEach { put(it, terms) }
            }
            put("namaz", "namaaz", "nimaz", "salat", "salah", "prayer", "prayers", "pray", urdu = "نماز")
            put("roza", "rozah", "rozay", "roze", "rozey", "fast", "fasting", "saum", "sawm", urdu = "روزہ")
            put("wuzu", "wudu", "wudhu", "wazu", "wozu", "vuzu", "ablution", urdu = "وضو")
            put("ghusl", "gusl", "ghusal", "bath", urdu = "غسل")
            put("janabat", "janabah", "junub", urdu = "جنابت")
            put("tayammum", "tayamum", "tayyamum", "tyammum", urdu = "تیمم")
            put("najis", "najas", "napak", "impure", "impurity", urdu = "نجس")
            put("najasat", "najasaat", "najasa", urdu = "نجاست")
            put("pak", "paak", "tahir", "pure", "purify", "purification", urdu = "پاک")
            put("tahara", "taharat", "tahrat", urdu = "طہارت")
            put("pani", "paani", "water", urdu = "پانی")
            put("kurr", "kur", "kar-pani", urdu = "کر")
            put("khoon", "khun", "blood", urdu = "خون")
            put("peshab", "pishab", "urine", urdu = "پیشاب")
            put("pakhana", "stool", "feces", urdu = "پاخانہ")
            put("mani", "semen", urdu = "منی")
            put("kutta", "kuta", "dog", urdu = "کتا")
            put("suar", "soor", "pig", "pork", urdu = "سور")
            put("sharab", "alcohol", "wine", "beer", urdu = "شراب")
            put("khums", "khumus", "khoms", urdu = "خمس")
            put("zakat", "zakaat", "zakah", "zakaat", urdu = "زکوۃ")
            put("fitra", "fitrah", "fitrana", "fitr", urdu = "فطرہ")
            put("hajj", "haj", urdu = "حج")
            put("umrah", "umra", urdu = "عمرہ")
            put("nikah", "nikkah", "marriage", "married", "marry", "shadi", "shaadi", urdu = "نکاح")
            put("mutah", "muta", "mut'ah", "temporary", urdu = "متعہ")
            put("mehr", "mahr", "haq-mehr", "dowry", urdu = "مہر")
            put("talaq", "talaaq", "divorce", "divorced", urdu = "طلاق")
            put("iddat", "iddah", "idda", urdu = "عدت")
            put("khula", "khulla", urdu = "خلع")
            put("haiz", "haid", "haidh", "hayz", "menses", "menstruation", "period", "periods", urdu = "حیض")
            put("nifas", "nifaas", urdu = "نفاس")
            put("istihaza", "istihaaza", "istihadha", urdu = "استحاضہ")
            put("mayyit", "mayyat", "mayat", "maiyat", "dead", "corpse", "deceased", urdu = "میت")
            put("janaza", "janazah", "funeral", urdu = "میت نماز")
            put("kafan", "kafn", "shroud", urdu = "کفن")
            put("dafan", "dafn", "burial", "bury", urdu = "دفن")
            put("qabr", "qabar", "grave", urdu = "قبر")
            put("safar", "travel", "journey", urdu = "سفر")
            put("musafir", "traveler", "traveller", urdu = "مسافر")
            put("qasr", "qasar", "shortened", urdu = "قصر")
            put("qaza", "qada", "qadha", "kaza", "missed", urdu = "قضا")
            put("jamaat", "jamat", "jamaah", "congregation", "congregational", urdu = "جماعت")
            put("imam", urdu = "امام")
            put("sajda", "sajdah", "sajdah", "sujood", "sajde", "prostration", urdu = "سجدہ")
            put("ruku", "rukoo", "rukuh", "bowing", urdu = "رکوع")
            put("qunoot", "qunut", "qanoot", urdu = "قنوت")
            put("tashahhud", "tashahud", "tashhud", urdu = "تشہد")
            put("salam", "salaam", urdu = "سلام")
            put("azan", "adhan", "azaan", urdu = "اذان")
            put("iqamat", "iqamah", "iqama", urdu = "اقامت")
            put("qibla", "qiblah", urdu = "قبلہ")
            put("shak", "shaq", "doubt", "doubts", urdu = "شک")
            put("sahw", "sahv", "sahu", urdu = "سہو")
            put("rakat", "rakaat", "rakah", "rakaats", urdu = "رکعت")
            put("fajr", "subah", "subh", "morning", urdu = "صبح")
            put("zuhr", "zohar", "zohr", "dhuhr", "noon", urdu = "ظہر")
            put("asr", "asar", urdu = "عصر")
            put("maghrib", "magrib", "evening", urdu = "مغرب")
            put("isha", "esha", "ishaa", urdu = "عشا")
            put("juma", "jumah", "jummah", "jumuah", "friday", urdu = "جمعہ")
            put("eid", "id", urdu = "عید")
            put("ayat", "ayaat", "eclipse", "earthquake", urdu = "آیات")
            put("kaffara", "kaffarah", "kafara", "expiation", urdu = "کفارہ")
            put("sehri", "sahri", "sahar", "suhoor", urdu = "سحر")
            put("iftar", "aftar", urdu = "افطار")
            put("ramzan", "ramadan", "ramazan", urdu = "رمضان")
            put("qurbani", "sacrifice", urdu = "قربانی")
            put("zibah", "zabh", "zabiha", "slaughter", urdu = "ذبح")
            put("halal", urdu = "حلال")
            put("haram", urdu = "حرام")
            put("gosht", "meat", urdu = "گوشت")
            put("machli", "fish", urdu = "مچھلی")
            put("shikar", "hunting", "hunt", urdu = "شکار")
            put("sood", "riba", "interest", "usury", urdu = "سود")
            put("qarz", "qarza", "loan", "debt", urdu = "قرض")
            put("tijarat", "business", "trade", "karobar", urdu = "تجارت")
            put("kharid", "khareed", "buy", "buying", "purchase", urdu = "خرید")
            put("farokht", "bech", "sell", "selling", "sale", urdu = "فروخت")
            put("kiraya", "kiraaya", "rent", "ijara", "ijarah", urdu = "اجارہ کرایہ")
            put("wasiyat", "wasiat", "will", urdu = "وصیت")
            put("waqf", urdu = "وقف")
            put("nazr", "nazar", "nadhr", "vow", urdu = "نذر")
            put("qasam", "oath", urdu = "قسم")
            put("meeras", "miras", "wirasat", "virasat", "inheritance", urdu = "میراث ترکہ")
            put("waris", "heir", "heirs", urdu = "وارث")
            put("taqleed", "taqlid", "taqleed", urdu = "تقلید")
            put("mujtahid", urdu = "مجتہد")
            put("aurat", "woman", "women", "wife", urdu = "عورت")
            put("mard", "man", "husband", urdu = "مرد")
            put("bacha", "bachha", "child", "children", "kid", urdu = "بچہ")
            put("baligh", "puberty", "adult", urdu = "بالغ")
            put("doodh", "dudh", "milk", "breastfeeding", urdu = "دودھ")
            put("razaat", "rida", "radaa", urdu = "رضاعت")
            put("masjid", "mosque", urdu = "مسجد")
            put("quran", "koran", urdu = "قرآن")
            put("libas", "kapra", "kapre", "clothes", "clothing", urdu = "لباس")
            put("sona", "gold", urdu = "سونا")
            put("chandi", "silver", urdu = "چاندی")
            put("toilet", "bathroom", "washroom", urdu = "بیت الخلاء")
            put("istibra", "istibraa", urdu = "استبراء")
            put("istinja", "istinjaa", urdu = "استنجا")
            put("mitti", "soil", "earth", "dust", urdu = "مٹی")
            put("niyyat", "niyat", "niyyah", "intention", urdu = "نیت")
            put("batil", "baatil", "invalid", "invalidate", "invalidates", "break", "breaks", "breaking", "toot", "tut", "tootna", "tootta", "tootti", "tutna", "tootay", urdu = "باطل")
            put("cheez", "cheezon", "cheezen", "cheezein", "chiz", "chizon", "chizen", "things", "thing", urdu = "چیز")
            put("shart", "sharait", "sharaet", "shartein", "conditions", "condition", urdu = "شرط شرائط")
            put("miqdar", "quantity", "amount", urdu = "مقدار")
            put("tareeqa", "tarika", "tariqa", "tareeka", "method", "way", urdu = "طریقہ")
            put("waqt", "time", "timing", urdu = "وقت")
            put("kaffara", "kaffarah", urdu = "کفارہ")
            put("ghalti", "galti", "mistake", "bhool", "forget", "forgot", urdu = "بھول غلطی")
            put("khana", "khaana", "eat", "eating", "food", urdu = "کھانا")
            put("peena", "pina", "drink", "drinking", urdu = "پینا")
            put("jhoot", "jhooth", urdu = "جھوٹ")
            put("wajib", "waajib", "obligatory", "compulsory", urdu = "واجب")
            put("mustahab", "recommended", urdu = "مستحب")
            put("makrooh", "makruh", "disliked", urdu = "مکروہ")
            put("jaiz", "jaaiz", "allowed", "permissible", urdu = "جائز")
            put("ihtiyat", "ehtiyat", "precaution", urdu = "احتیاط")
            put("kafir", "kaafir", "nonmuslim", "non-muslim", urdu = "کافر")
            put("sajdagah", "turbah", "turbat", urdu = "سجدہ")
            put("moza", "socks", "khuff", urdu = "موزہ")
            put("masah", "masaah", "masa", "wipe", urdu = "مسح")
            put("kulli", "gargle", urdu = "کلی")
            put("ulti", "vomit", "vomiting", urdu = "قے")
            put("injection", urdu = "انجکشن")
            put("dawa", "medicine", urdu = "دوا")
            put("bimar", "beemar", "sick", "illness", "marz", urdu = "مریض بیماری")
            put("sigret", "cigarette", "smoking", "smoke", urdu = "دھواں")
            put("ghubar", "ghubaar", urdu = "غبار")
            put("jhoot", "jhoot", "lie", "lying", urdu = "جھوٹ")
            put("chand", "moon", urdu = "چاند")
            put("seegha", "sigha", "seeghah", "seegah", "formula", urdu = "صیغہ")
            put("kilometer", "kilometers", "km", "kilometre", "mile", "miles", "distance", "farsakh", urdu = "فرسخ")
            put("teesri", "tisri", "third", urdu = "تیسری")
            put("chothi", "chauthi", "fourth", urdu = "چوتھی")
            put("doosri", "dusri", "second", urdu = "دوسری")
            put("pehli", "pahli", "first", urdu = "پہلی")
            put("kitna", "kitni", "kitne", "how much", urdu = "مقدار")
            put("ghair", "gair", urdu = "غیر")
            put("mahram", "mehram", "muharram", urdu = "محرم")
            put("pardah", "parda", "hijab", urdu = "پردہ")
        }

        private val URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
        private val ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

        fun asciiDigits(s: String): String {
            val sb = StringBuilder(s.length)
            for (c in s) {
                val u = URDU_DIGITS.indexOf(c)
                val a = ARABIC_DIGITS.indexOf(c)
                sb.append(if (u >= 0) ('0' + u) else if (a >= 0) ('0' + a) else c)
            }
            return sb.toString()
        }

        /** Unifies Arabic/Urdu letter variants and strips diacritics. */
        fun normalize(s: String): String {
            val sb = StringBuilder(s.length)
            for (c in MARKS.replace(asciiDigits(s), "")) {
                sb.append(
                    when (c) {
                        'ي', 'ى', 'ئ' -> 'ی'
                        'ك' -> 'ک'
                        'ه', 'ۀ' -> 'ہ'
                        'ة', 'ۃ' -> 'ہ'
                        'أ', 'إ', 'ٱ' -> 'ا'
                        'ؤ' -> 'و'
                        'ۓ' -> 'ے'
                        else -> c.lowercaseChar()
                    }
                )
            }
            return sb.toString()
        }

        /** Light suffix stripping so روزہ / روزے / روزوں match each other. */
        fun stem(token: String): String {
            if (token.isEmpty() || token[0].code < 0x0600) return token
            var t = token
            for (suf in listOf("یوں", "وں", "یں", "ات")) {
                if (t.length >= 5 && t.endsWith(suf)) { t = t.dropLast(suf.length); break }
            }
            if (t.length >= 4 && t.last() in "ہےیا") t = t.dropLast(1)
            return t
        }

        private fun indexTerms(text: String): List<String> =
            TOKEN.findAll(normalize(text)).map { it.value }
                .filter { it !in STOPWORDS && !it.all(Char::isDigit) }
                .map(::stem)
                .toList()

        fun queryTerms(query: String): List<String> {
            val out = LinkedHashSet<String>()
            for (m in TOKEN.findAll(normalize(query))) {
                val tok = m.value
                if (tok.all(Char::isDigit)) continue
                if (tok[0].code < 0x0600) {
                    if (tok in LATIN_STOPWORDS) continue
                    TRANSLATIONS[tok]?.forEach { urdu ->
                        TOKEN.findAll(normalize(urdu)).forEach { out.add(stem(it.value)) }
                    }
                } else if (tok !in STOPWORDS) {
                    out.add(stem(tok))
                }
            }
            return out.toList()
        }

        private val LIST_QUESTION = Regex(
            "(^|\\s)(کن|کون|کونسی|کونسے|کیا کیا|کیسے|طریقہ|طریقے|kin|kon|konsi|konse|kaunsi|which|what|kya kya|kia kia|kaise|kese|kaisay|kesay|tareeqa|tarika|tariqa|how|method)(\\s|$)"
        )
        private val ENUMERATION = Regex("((^|\\s)[۱1]\\s*۔.*\\s[۲2]\\s*۔)|(اول\\).*دوم\\))")

        /** "Which things break the fast?" style questions are best answered by a listing masla. */
        fun isListQuestion(query: String): Boolean = LIST_QUESTION.containsMatchIn(query.lowercase())

        private fun isEnumeration(text: String): Boolean = ENUMERATION.containsMatchIn(text.take(600))

        /** Masla numbers the user asked for explicitly, e.g. "masla 1581" or a bare number. */
        fun explicitMaslaNumbers(query: String): List<Int> {
            val q = normalize(query)
            if (Regex("(page|safha|صفحہ|صفحے)").containsMatchIn(q)) {
                // "page 298" asks for a page, not a masla; only a number tied to a masla keyword counts.
                return Regex("(?:masla|mas'ala|مسئلہ|مسیلہ|مسالہ)\\s*(?:no\\.?|number|نمبر)?\\s*(\\d{1,4})")
                    .findAll(q).mapNotNull { it.groupValues[1].toIntOrNull() }.toList()
            }
            return Regex("\\d{1,4}").findAll(q).mapNotNull { it.value.toIntOrNull() }
                .filter { it in 1..2800 }.toList()
        }
    }
}
