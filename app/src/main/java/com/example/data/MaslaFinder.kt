package com.example.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Offline question answering: finds the masla (paragraph) in the book that answers an Urdu
 * question. No internet and no AI service are used.
 */
object MaslaFinder {

    data class Answer(
        val text: String,
        val paragraphs: List<Int>,      // indices into BookRepository.paragraphs, best first
        val pages: List<Int>
    )

    suspend fun answer(context: Context, question: String): Answer = withContext(Dispatchers.Default) {
        val q = question.trim()
        val all = BookRepository.paragraphs(context)

        // 1. "مسئلہ 1581" / "1581"
        explicitMasla(q)?.let { m ->
            val p = BookRepository.findMasla(context, m)
            if (p != null) {
                val list = withContinuation(context, listOf(p))
                return@withContext Answer(
                    "مسئلہ نمبر $m (تقریباً) — کتاب کی اصل عبارت:",
                    list, list.map { all[it].page }.distinct()
                )
            }
        }
        // 2. "صفحہ 298"
        explicitPage(q)?.let { pg ->
            val list = all.filter { it.page == pg }.map { it.index }
            if (list.isNotEmpty()) {
                return@withContext Answer("صفحہ نمبر $pg کے مسائل:", list, listOf(pg))
            }
        }
        // 3. free question: first the book's own headings (clean text), then the OCR text of every masla
        val chapter = guessChapter(q)
        val hint = chapter?.let { it.pageStart..it.pageEnd }
        val hits = BookRepository.search(context, q, hint, limit = 4)
        val headingHits = BookRepository.searchHeadings(context, q)
        val topHeading = headingHits.firstOrNull()?.takeIf { it.coverage >= 0.6 }
        if (topHeading != null) {
            val start = BookRepository.paragraphAtHeading(context, topHeading.heading)
            if (start != null) {
                val group = mutableListOf(start)
                BookRepository.continuationOf(context, start)?.let { group.add(it) }
                // the next masail under the same heading, then other matches
                val more = LinkedHashSet<Int>()
                var next = BookRepository.neighbour(context, group.last(), 1)
                var k = 0
                while (next != null && k < 2) { more.add(next.index); next = BookRepository.neighbour(context, next, 1); k++ }
                headingHits.drop(1).filter { it.coverage >= 0.6 }.forEach { hh ->
                    BookRepository.paragraphAtHeading(context, hh.heading)?.let { more.add(it.index) }
                }
                hits.forEach { more.add(it.paragraph.index) }
                val ids = (group.map { it.index } + more.filter { i -> group.none { it.index == i } }).distinct().take(8)
                val h = topHeading.heading
                return@withContext Answer(
                    "«${h.title}» — صفحہ ${h.page}\nتوضیح المسائل کی اصل عبارت:",
                    ids, ids.map { all[it].page }.distinct()
                )
            }
        }
        if (hits.isEmpty()) {
            val text = if (chapter != null)
                "اس سوال کا مخصوص مسئلہ نہیں ملا۔ یہ موضوع «${chapter.titleUrdu}» کے باب میں صفحہ ${chapter.pageStart} سے ${chapter.pageEnd} تک ہے۔ دوسرے الفاظ میں سوال لکھ کر دیکھیں۔"
            else "معذرت، اس سوال سے متعلق مسئلہ نہیں ملا۔ براہ کرم کتاب کے الفاظ استعمال کر کے دوبارہ لکھیں، مثلاً: «روزہ باطل»، «وضو کا طریقہ»، «نماز قصر»۔"
            return@withContext Answer(text, emptyList(), listOfNotNull(chapter?.pageStart))
        }
        val best = hits.first()
        // keep other results only if they are reasonably close to the best one
        val chosen = hits.filter { it.score >= best.score * 0.45 }.map { it.paragraph }
        val ordered = withContinuation(context, chosen)
        val intro = if (chosen.size == 1) "آپ کے سوال کا جواب — توضیح المسائل کی اصل عبارت:"
                    else "آپ کے سوال سے متعلق مسائل — پہلا مسئلہ سب سے زیادہ مطابقت رکھتا ہے:"
        Answer(intro, ordered, ordered.map { all[it].page }.distinct())
    }

    /** Add the part of a masla that continues on the next page. */
    private fun withContinuation(context: Context, list: List<BookRepository.Paragraph>): List<Int> {
        val out = LinkedHashSet<Int>()
        for (p in list) {
            out.add(p.index)
            BookRepository.continuationOf(context, p)?.let { out.add(it.index) }
        }
        return out.toList()
    }

    private fun explicitMasla(q: String): Int? {
        val n = BookRepository.normalize(q)
        Regex("(?:مسیلہ|مسلہ|مسالہ|مسئلہ)\\s*(?:نمبر)?\\s*[:#]?\\s*(\\d{1,4})").find(n)
            ?.let { return it.groupValues[1].toIntOrNull()?.takeIf { v -> v in 1..2900 } }
        val only = n.trim()
        if (only.isNotEmpty() && only.all { it.isDigit() } && only.length <= 4) return only.toIntOrNull()
        return null
    }

    private fun explicitPage(q: String): Int? {
        val n = BookRepository.normalize(q)
        return Regex("صفحہ\\s*(?:نمبر)?\\s*[:#]?\\s*(\\d{1,3})").find(n)?.groupValues?.get(1)
            ?.toIntOrNull()?.takeIf { it in 1..BookRepository.TOTAL_PAGES }
    }

    fun guessChapter(query: String): TauzihChapter? {
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
