package com.example.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Fully offline access to the book.
 *
 * Assets (generated from urdu-tozih.pdf, see tools/):
 *  - book/tauzih.pdf     the original 542-page book (shown as images – always exact)
 *  - book/masail.tsv     one row per paragraph (masla) with its position on the page and OCR text:
 *                        page, x0, y0, x1, y1 (0..10000 of page size), estimatedMasla, continuation, text
 * The OCR text is only used to *find* a masla; the user always sees the real printed paragraph.
 */
object BookRepository {
    const val TOTAL_PAGES = 542

    private const val PDF_ASSET = "book/tauzih.pdf"
    private const val MASAIL_ASSET = "book/masail.tsv"
    private const val HEADINGS_ASSET = "book/headings.tsv"

    data class Paragraph(
        val index: Int,
        val page: Int,
        val x0: Float, val y0: Float, val x1: Float, val y1: Float,
        val estimatedMasla: Int,
        val isContinuation: Boolean,
        val norm: String
    )

    /** A heading from the book's table of contents, located on its page. */
    data class Heading(val title: String, val page: Int, val y: Float, val words: List<String>, val titleWordCount: Int)

    @Volatile private var paragraphs: List<Paragraph>? = null
    @Volatile private var headings: List<Heading>? = null
    private var pdfFile: File? = null
    private val renderLock = Any()

    // ------------------------------------------------------------------ loading

    fun paragraphs(context: Context): List<Paragraph> {
        paragraphs?.let { return it }
        synchronized(this) {
            paragraphs?.let { return it }
            val list = ArrayList<Paragraph>(3200)
            context.assets.open(MASAIL_ASSET).bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    val p = line.split('\t')
                    if (p.size >= 8) {
                        list.add(
                            Paragraph(
                                index = list.size,
                                page = p[0].toInt(),
                                x0 = p[1].toInt() / 10000f, y0 = p[2].toInt() / 10000f,
                                x1 = p[3].toInt() / 10000f, y1 = p[4].toInt() / 10000f,
                                estimatedMasla = p[5].toInt(),
                                isContinuation = p[6] == "1",
                                norm = compact(normalize(p[7]))
                            )
                        )
                    }
                }
            }
            paragraphs = list
            return list
        }
    }

    fun headings(context: Context): List<Heading> {
        headings?.let { return it }
        synchronized(this) {
            headings?.let { return it }
            val list = ArrayList<Heading>(320)
            context.assets.open(HEADINGS_ASSET).bufferedReader(Charsets.UTF_8).useLines { lines ->
                lines.forEach { line ->
                    val p = line.split('\t')
                    if (p.size >= 3) {
                        val y = p[2].toInt()
                        val extra = p.getOrNull(3).orEmpty()
                        list.add(Heading(p[0], p[1].toInt(), if (y < 0) -1f else y / 10000f, words("${p[0]} $extra"), words(p[0]).size))
                    }
                }
            }
            headings = list
            return list
        }
    }

    private fun words(s: String): List<String> =
        normalize(s).split(Regex("[^\\p{L}\\p{N}]+")).filter { it.length >= 2 && it !in normStopWords }

    private fun stem(w: String): String = when {
        w.length >= 5 && (w.endsWith("وں") || w.endsWith("یں")) -> w.dropLast(2)
        w.length >= 4 && (w.last() == 'ہ' || w.last() == 'ی' || w.last() == 'ا') -> w.dropLast(1)
        else -> w
    }

    // Endings Urdu adds to a word (plural, oblique, feminine, verb forms)
    private val endings = listOf("ی", "ے", "ا", "ہ", "وں", "یں", "یاں", "ات", "نا", "نی", "نے", "تا", "تی", "تے")

    private fun sameWord(a: String, b: String): Boolean {
        val x = stem(a); val y = stem(b)
        if (x == y) return true
        val short = if (x.length <= y.length) x else y
        val long = if (x.length <= y.length) y else x
        if (short.length < 3 || !long.startsWith(short)) return false
        // only a known grammatical ending may follow (so دوران ≠ دور, مسجد ≠ مس)
        return long.substring(short.length) in endings
    }

    /** Each question word with its alternatives (synonyms / plural forms). */
    private fun queryGroups(query: String): List<List<String>> {
        val words = normalize(query)
            .split(Regex("[^\\p{L}\\p{N}]+"))
            .map { it.trim() }
            .filter { it.length >= 2 && it !in normStopWords && it.any { c -> c.isLetter() } }
        return words.map { w -> (listOf(w) + (synonyms[w] ?: emptyList())).distinct() }
            .distinctBy { stem(it.first()) }
    }

    data class HeadingHit(val heading: Heading, val score: Double, val coverage: Double)

    /** Match a question against the clean table-of-contents headings. */
    fun searchHeadings(context: Context, query: String, limit: Int = 3): List<HeadingHit> {
        val hs = headings(context)
        val groups = queryGroups(query)
        if (groups.isEmpty()) return emptyList()
        val n = hs.size.toDouble()
        fun idfOf(t: String): Double {
            val df = hs.count { h -> h.words.any { sameWord(it, t) } }
            return if (df == 0) 0.0 else Math.log(1 + n / df)
        }
        // a group's weight is that of the word the user typed; synonyms only stand in when the
        // typed word itself never appears in a heading
        val weights = groups.map { g -> idfOf(g.first()).takeIf { it > 0 } ?: g.maxOf { idfOf(it) } }
        val total = weights.sum()
        if (total <= 0) return emptyList()
        val rarest = groups.indices.maxByOrNull { weights[it] }!!
        return hs.map { h ->
            var score = 0.0
            var hasRarest = false
            groups.forEachIndexed { i, g ->
                if (g.any { t -> h.words.any { sameWord(it, t) } }) {
                    score += weights[i]
                    if (i == rarest) hasRarest = true
                }
            }
            // coverage weighted by how rare (specific) each matched word is;
            // a heading containing the most specific word of the question gets a bonus
            val coverage = score / total
            // the most specific word of the question breaks ties
            HeadingHit(h, score - 0.03 * h.titleWordCount + (if (hasRarest) 0.5 else 0.0), coverage)
        }.filter { it.score > 0 }
            .sortedWith(compareByDescending<HeadingHit> { it.coverage }.thenByDescending { it.score })
            .take(limit)
    }

    /** The paragraph that starts at (or contains) a heading. */
    fun paragraphAtHeading(context: Context, h: Heading): Paragraph? {
        val onPage = paragraphs(context).filter { it.page == h.page }
        if (onPage.isEmpty()) return null
        if (h.y < 0) return onPage.firstOrNull { !it.isContinuation } ?: onPage.first()
        return onPage.firstOrNull { it.y1 >= h.y + 0.005f } ?: onPage.last()
    }

    /** Approximate masail printed on a page. */
    fun masailOnPage(context: Context, page: Int): IntRange? {
        val nums = paragraphs(context).filter { it.page == page && it.estimatedMasla > 0 }.map { it.estimatedMasla }
        return if (nums.isEmpty()) null else nums.min()..nums.max()
    }

    /** The paragraph that continues [p] on the next page, if any. */
    fun continuationOf(context: Context, p: Paragraph): Paragraph? {
        val all = paragraphs(context)
        val next = all.getOrNull(p.index + 1) ?: return null
        val isLastOnPage = next.page != p.page
        return if (isLastOnPage && next.isContinuation && next.page == p.page + 1) next else null
    }

    // ------------------------------------------------------------------ text normalisation

    /** Normalise Arabic-script variants that OCR mixes up. */
    fun normalize(s: String): String {
        val sb = StringBuilder(s.length)
        for (ch in s) {
            when (ch) {
                'ي', 'ى', 'ے', 'ۓ', 'ئ' -> sb.append('ی')
                'ك' -> sb.append('ک')
                'ه', 'ة', 'ۃ', 'ۂ', 'ھ' -> sb.append('ہ')
                'أ', 'إ', 'آ', 'ٱ' -> sb.append('ا')
                'ؤ' -> sb.append('و')
                in 'ً'..'ٟ', 'ٰ', 'ـ', '‌', '‍', '‎', '‏' -> {}
                in '۰'..'۹' -> sb.append('0' + (ch - '۰'))
                in '٠'..'٩' -> sb.append('0' + (ch - '٠'))
                else -> sb.append(ch.lowercaseChar())
            }
        }
        return sb.toString()
    }

    private fun compact(s: String): String = s.filter { it.isLetterOrDigit() }

    private val stopWords = setOf(
        "کے", "کی", "کا", "ہے", "ہیں", "میں", "اور", "کیا", "سے", "کو", "پر", "یا", "نہ", "جو", "وہ", "یہ",
        "کر", "ہو", "کون", "کب", "کیسے", "کس", "کسی", "کوئی", "تو", "بھی", "اگر", "لئے", "لیے", "ایک", "اس",
        "ان", "جب", "تک", "والا", "والی", "والے", "ہوتا", "ہوتی", "ہوتے", "کرنا", "کرے", "کریں", "سکتا",
        "سکتی", "سکتے", "چاہیے", "چاہئے", "بتائیں", "بتاو", "بتائے", "مسئلہ", "حکم", "ہوں", "تھا", "گا", "گی",
        "نے", "کیوں", "جاتا", "جاتی", "جاتے", "رہا", "رہی", "کچھ", "کتنا", "کتنی", "کتنے", "کیسا", "کیسی", "شرعی",
        "شرع", "بارے", "کن", "کونسی", "کونسے", "متعلق", "صورت", "لازم", "ضروری", "جائز", "صحیح", "درست"
    )
    private val normStopWords: Set<String> by lazy { stopWords.map { normalize(it) }.toSet() }

    /** Everyday words → the words the book uses. */
    private val synonyms: Map<String, List<String>> by lazy {
        mapOf(
            "ٹوٹ" to listOf("باطل"), "ٹوٹتا" to listOf("باطل"), "ٹوٹتی" to listOf("باطل"), "توڑ" to listOf("باطل"),
            "توڑتی" to listOf("باطل"), "توڑتا" to listOf("باطل"), "خراب" to listOf("باطل"),
            "ناپاک" to listOf("نجس"), "پلید" to listOf("نجس"), "گندا" to listOf("نجس"),
            "پیشاب" to listOf("پیشاب"), "قے" to listOf("قے"), "الٹی" to listOf("قے"),
            "سفر" to listOf("مسافر", "سفر"), "مسافر" to listOf("مسافر", "قصر"),
            "شادی" to listOf("نکاح", "عقد"), "بیوی" to listOf("زوجہ", "بیوی"), "شوہر" to listOf("شوہر"),
            "زکات" to listOf("زکوہ"), "زکوٰۃ" to listOf("زکوہ"), "فطرانہ" to listOf("فطرہ"),
            "ورثہ" to listOf("میراث", "ارث"), "وراثت" to listOf("میراث", "ارث"),
            "دعا" to listOf("دعا"), "سجدہ" to listOf("سجدہ", "سجدے"), "بھول" to listOf("سہو", "بھول"),
            "شک" to listOf("شک"), "قضا" to listOf("قضا"), "روزے" to listOf("روزہ", "روزے"),
            "ناخن" to listOf("ناخن"), "خون" to listOf("خون"), "حیض" to listOf("حیض"),
            "ماہواری" to listOf("حیض"), "کتا" to listOf("کتا", "کتے"), "سور" to listOf("سور"),
            "شراب" to listOf("شراب", "مسکر"), "سود" to listOf("سود", "ربا"), "بینک" to listOf("بینک", "سود"),
            "طریقہ" to listOf("طریقہ", "کیفیت"), "میراث" to listOf("میراث", "وراثت"), "حصہ" to listOf("حصہ", "میراث"),
            "چاند" to listOf("چاند", "مہینے"), "اجرت" to listOf("اجرت", "اجیر"), "کرایہ" to listOf("کرائے", "اجارہ"),
            "قرضہ" to listOf("قرض"), "ادھار" to listOf("قرض", "ادھار"), "گروی" to listOf("رہن", "گروی"),
            "نذر" to listOf("نذر", "منت"), "منت" to listOf("منت", "نذر"), "ذبح" to listOf("ذبح", "ذبیحہ"),
            "کفن" to listOf("کفن"), "جنازہ" to listOf("میت", "جنازہ"), "مردہ" to listOf("میت", "مردار")
        ).mapKeys { normalize(it.key) }.mapValues { e -> e.value.map { normalize(it) } }
    }

    private fun queryTerms(query: String): List<String> {
        val words = normalize(query)
            .split(Regex("[^\\p{L}\\p{N}]+"))
            .map { it.trim() }
            .filter { it.length >= 2 && it !in normStopWords && it.any { c -> c.isLetter() } }
        val out = LinkedHashSet<String>()
        for (w in words) {
            out.add(w)
            synonyms[w]?.let { out.addAll(it) }
            // simple Urdu plural/oblique stripping: روزے→روز, نمازوں→نماز
            if (w.length >= 4) {
                when {
                    w.endsWith("وں") -> out.add(w.dropLast(2))
                    w.endsWith("یں") -> out.add(w.dropLast(2))
                }
            }
        }
        return out.toList()
    }

    // ------------------------------------------------------------------ search

    data class Hit(val paragraph: Paragraph, val score: Double)

    /** Find the paragraphs (masail) that best match an Urdu question. */
    fun search(context: Context, query: String, chapterHint: IntRange? = null, limit: Int = 5): List<Hit> {
        val all = paragraphs(context)
        val terms = queryTerms(query).map { compact(it) }.filter { it.length >= 2 }
        if (terms.isEmpty()) return emptyList()
        val n = all.size.toDouble()
        val scores = DoubleArray(all.size)
        val matchedTerms = IntArray(all.size)

        for (t in terms) {
            var df = 0
            for (p in all) if (p.norm.contains(t)) df++
            if (df == 0) {
                // OCR may have broken letters: fuzzy trigram match for longer words
                if (t.length >= 4) {
                    val grams = (0..t.length - 3).map { t.substring(it, it + 3) }.distinct()
                    for (p in all) {
                        val hit = grams.count { p.norm.contains(it) }.toDouble() / grams.size
                        if (hit >= 0.67) { scores[p.index] += hit * 0.8; matchedTerms[p.index]++ }
                    }
                }
                continue
            }
            if (df > n * 0.35) continue // too common to be useful
            val idf = Math.log(1 + n / df)
            for (p in all) {
                var count = 0
                var from = 0
                while (count < 4) {
                    val i = p.norm.indexOf(t, from)
                    if (i < 0) break
                    count++; from = i + t.length
                }
                if (count > 0) {
                    scores[p.index] += idf * (1 + 0.5 * Math.log(count.toDouble()))
                    matchedTerms[p.index]++
                }
            }
        }
        // Phrase bonus: two consecutive query words appearing together
        val words = queryTerms(query).map { compact(it) }
        for (i in 0 until words.size - 1) {
            val phrase = words[i] + words[i + 1]
            if (phrase.length < 5) continue
            for (p in all) if (p.norm.contains(phrase)) scores[p.index] += 3.0
        }
        for (p in all) {
            if (scores[p.index] <= 0) continue
            // reward paragraphs matching many different words of the question
            scores[p.index] *= 1.0 + 0.35 * (matchedTerms[p.index] - 1).coerceAtLeast(0)
            if (chapterHint != null && p.page in chapterHint) scores[p.index] *= 1.5
            // very short fragments (headings) are rarely the answer
            if (p.norm.length < 25) scores[p.index] *= 0.5
        }
        return all.indices
            .filter { scores[it] > 0 }
            .sortedByDescending { scores[it] }
            .take(limit)
            .map { Hit(all[it], scores[it]) }
    }

    /** Paragraph for a masla number (best effort, the number in the image is authoritative). */
    fun findMasla(context: Context, masla: Int): Paragraph? {
        val all = paragraphs(context)
        val near = all.filter { it.estimatedMasla > 0 }.minByOrNull { Math.abs(it.estimatedMasla - masla) } ?: return null
        // The estimate can be a few masail off: look nearby for a paragraph whose printed (OCR)
        // number matches the requested one, fully or by its last digits.
        val target = masla.toString()
        var best: Paragraph = near
        var bestScore = 0
        for (off in -12..12) {
            val p = all.getOrNull(near.index + off) ?: continue
            val lead = Regex("\\d{1,4}").find(p.norm.take(40))?.value ?: continue
            val score = when {
                lead == target -> 100
                lead.length >= 2 && target.endsWith(lead) -> 10 * lead.length
                else -> 0
            } - Math.abs(off)
            if (score > bestScore) { bestScore = score; best = p }
        }
        return best
    }

    /** Paragraphs around a given one (for "show more"). */
    fun neighbour(context: Context, p: Paragraph, offset: Int): Paragraph? =
        paragraphs(context).getOrNull(p.index + offset)

    // ------------------------------------------------------------------ PDF rendering

    private fun pdf(context: Context): File {
        pdfFile?.let { if (it.exists()) return it }
        val f = File(context.filesDir, "tauzih.pdf")
        if (!f.exists() || f.length() == 0L) {
            context.assets.open(PDF_ASSET).use { input -> f.outputStream().use { input.copyTo(it) } }
        }
        pdfFile = f
        return f
    }

    /** Render a book page (1-based) to a bitmap of the given width. */
    fun renderPage(context: Context, page: Int, widthPx: Int): Bitmap? = synchronized(renderLock) {
        runCatching {
            ParcelFileDescriptor.open(pdf(context), ParcelFileDescriptor.MODE_READ_ONLY).use { fd ->
                PdfRenderer(fd).use { renderer ->
                    val idx = (page - 1).coerceIn(0, renderer.pageCount - 1)
                    renderer.openPage(idx).use { p ->
                        val w = widthPx.coerceIn(300, 2400)
                        val h = (w.toFloat() * p.height / p.width).toInt()
                        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        bmp.eraseColor(Color.WHITE)
                        p.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        bmp
                    }
                }
            }
        }.getOrNull()
    }

    /** Render just one paragraph (masla) of a page, cropped from the real printed page. */
    fun renderParagraph(context: Context, p: Paragraph, widthPx: Int): Bitmap? {
        // Render the page wide enough that the cropped text area is about widthPx wide
        val textWidthFraction = (p.x1 - p.x0).coerceAtLeast(0.6f)
        val pageWidth = (widthPx / (textWidthFraction + 0.04f)).toInt()
        val page = renderPage(context, p.page, pageWidth) ?: return null
        val padX = 0.015f
        val padY = 0.008f
        val left = ((minOf(p.x0, 0.12f) - padX).coerceAtLeast(0f) * page.width).toInt()
        val right = ((maxOf(p.x1, 0.88f) + padX).coerceAtMost(1f) * page.width).toInt()
        val top = ((p.y0 - padY).coerceAtLeast(0f) * page.height).toInt()
        val bottom = ((p.y1 + padY * 1.6f).coerceAtMost(1f) * page.height).toInt()
        if (right - left < 10 || bottom - top < 10) return page
        val crop = Bitmap.createBitmap(page, left, top, right - left, bottom - top)
        if (crop != page) page.recycle()
        return crop
    }

    /** JPEG bytes of a page, for sharing. */
    fun pageJpeg(context: Context, page: Int, widthPx: Int = 1100, quality: Int = 82): ByteArray? {
        val bmp = renderPage(context, page, widthPx) ?: return null
        return ByteArrayOutputStream().use { out ->
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
            bmp.recycle()
            out.toByteArray()
        }
    }
}
