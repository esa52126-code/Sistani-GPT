package com.example.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * Access to the real book: the bundled PDF (for exact page images) and an OCR text index
 * (used only to *find* relevant pages – the OCR text is noisy because the book is in Nastaleeq).
 *
 * Assets (generated from urdu-tozih.pdf):
 *  - book/tauzih.pdf          the original 542-page book
 *  - book/ocr.txt             OCR text, pages separated by lines "<<<PAGE n>>>"
 *  - book/masla_index.tsv     page \t firstMasla \t lastMasla  (best-effort, from OCR)
 */
object BookRepository {
    const val TOTAL_PAGES = 542

    private const val PDF_ASSET = "book/tauzih.pdf"
    private const val OCR_ASSET = "book/ocr.txt"
    private const val MASLA_ASSET = "book/masla_index.tsv"

    @Volatile private var pageText: Map<Int, String>? = null
    @Volatile private var pageNorm: Map<Int, String>? = null
    @Volatile private var maslaIndex: Map<Int, IntRange>? = null
    private var pdfFile: File? = null
    private val renderLock = Any()

    // ---------------------------------------------------------------- loading

    private fun ensureLoaded(context: Context) {
        if (pageText != null) return
        synchronized(this) {
            if (pageText != null) return
            val raw = context.assets.open(OCR_ASSET).bufferedReader(Charsets.UTF_8).use { it.readText() }
            val map = HashMap<Int, String>()
            val marker = Regex("<<<PAGE (\\d+)>>>")
            val matches = marker.findAll(raw).toList()
            matches.forEachIndexed { i, m ->
                val page = m.groupValues[1].toInt()
                val start = m.range.last + 1
                val end = if (i + 1 < matches.size) matches[i + 1].range.first else raw.length
                map[page] = raw.substring(start, end).trim()
            }
            val idx = HashMap<Int, IntRange>()
            runCatching {
                context.assets.open(MASLA_ASSET).bufferedReader(Charsets.UTF_8).useLines { lines ->
                    lines.forEach { line ->
                        val p = line.split('\t')
                        if (p.size >= 3) {
                            val pg = p[0].toIntOrNull(); val a = p[1].toIntOrNull(); val b = p[2].toIntOrNull()
                            if (pg != null && a != null && b != null) idx[pg] = a..b
                        }
                    }
                }
            }
            maslaIndex = idx
            pageNorm = map.mapValues { compact(normalize(it.value)) }
            pageText = map
        }
    }

    fun ocrText(context: Context, page: Int): String {
        ensureLoaded(context)
        return pageText?.get(page).orEmpty()
    }

    /** Masail (approximate) printed on a page, from the OCR index. */
    fun masailOnPage(context: Context, page: Int): IntRange? {
        ensureLoaded(context)
        return maslaIndex?.get(page)
    }

    /** Page on which a masla number appears (best effort). */
    fun pageForMasla(context: Context, masla: Int): Int? {
        ensureLoaded(context)
        val idx = maslaIndex ?: return null
        idx.entries.firstOrNull { masla in it.value }?.let { return it.key }
        // Nearest page whose range starts before this masla
        return idx.entries.filter { it.value.first <= masla }.maxByOrNull { it.value.first }?.key
    }

    // ---------------------------------------------------------------- search

    private val stopWords = setOf(
        "کے", "کی", "کا", "ہے", "ہیں", "میں", "اور", "کیا", "سے", "کو", "پر", "یا", "نہ", "جو", "وہ", "یہ",
        "کر", "ہو", "کون", "کب", "کیسے", "کس", "کسی", "کوئی", "تو", "بھی", "اگر", "لئے", "لیے", "ایک", "اس",
        "ان", "جب", "تک", "والا", "والی", "والے", "ہوتا", "ہوتی", "ہوتے", "کرنا", "کرے", "کریں", "سکتا",
        "سکتی", "چاہیے", "بتائیں", "بتاو", "مسئلہ", "مسئله", "حکم", "کیاہے", "ہوں", "تھا", "گا", "گی", "نے",
        "the", "is", "a", "of", "and", "to", "in", "what", "how", "for", "kya", "hai", "ka", "ki", "ke", "me", "mein"
    )

    private val normStopWords: Set<String> by lazy { stopWords.map { normalize(it) }.toSet() }

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

    /** Remove whitespace/punctuation – OCR word spacing is unreliable. */
    private fun compact(s: String): String = s.filter { it.isLetterOrDigit() }

    private fun terms(query: String): List<String> =
        normalize(query)
            .split(Regex("[^\\p{L}\\p{N}]+"))
            .map { it.trim() }
            .filter { it.length >= 2 && it !in normStopWords && it.any { c -> c.isLetter() } }
            .distinct()

    data class SearchHit(val page: Int, val score: Double)

    /**
     * Find pages most relevant to the query. [extraTerms] are additional (Urdu) keywords, e.g.
     * produced by the AI from a Roman-Urdu/English question. [chapterHint] boosts a page range.
     */
    fun search(
        context: Context,
        query: String,
        extraTerms: List<String> = emptyList(),
        chapterHint: IntRange? = null,
        limit: Int = 3
    ): List<SearchHit> {
        ensureLoaded(context)
        val pages = pageNorm ?: return emptyList()
        val allTerms = (terms(query) + extraTerms.flatMap { terms(it) }).distinct()
        if (allTerms.isEmpty()) return emptyList()

        val n = pages.size.toDouble()
        val scores = HashMap<Int, Double>()
        for (term in allTerms) {
            val t = compact(term)
            if (t.length < 2) continue
            val df = pages.values.count { it.contains(t) }
            if (df == 0) {
                // Fuzzy: use trigrams of longer words (OCR may break letters)
                if (t.length >= 4) {
                    val grams = (0..t.length - 3).map { t.substring(it, it + 3) }.distinct()
                    for ((pg, text) in pages) {
                        val hit = grams.count { text.contains(it) }.toDouble() / grams.size
                        if (hit >= 0.6) scores[pg] = (scores[pg] ?: 0.0) + hit * 0.5
                    }
                }
                continue
            }
            if (df > n * 0.6) continue // too common to be useful
            val idf = Math.log(1 + n / df)
            for ((pg, text) in pages) {
                var count = 0
                var from = 0
                while (count < 5) {
                    val i = text.indexOf(t, from)
                    if (i < 0) break
                    count++; from = i + t.length
                }
                if (count > 0) scores[pg] = (scores[pg] ?: 0.0) + idf * (1 + Math.log(count.toDouble()))
            }
        }
        if (chapterHint != null) {
            for (pg in chapterHint) scores[pg]?.let { scores[pg] = it * 1.6 }
        }
        return scores.entries
            .sortedByDescending { it.value }
            .take(limit)
            .map { SearchHit(it.key, it.value) }
    }

    /** Short readable snippet around the best-matching term on a page (OCR text). */
    fun snippet(context: Context, page: Int, query: String, extraTerms: List<String> = emptyList(), maxLen: Int = 260): String {
        val text = ocrText(context, page)
        if (text.isEmpty()) return ""
        val lines = text.lines().filter { it.isNotBlank() }
        val ts = (terms(query) + extraTerms.flatMap { terms(it) }).map { compact(it) }
        val best = lines.withIndex().maxByOrNull { (_, line) ->
            val ln = compact(normalize(line))
            ts.count { ln.contains(it) }
        }?.index ?: 0
        val out = lines.subList(best, minOf(lines.size, best + 3)).joinToString(" ")
        return if (out.length > maxLen) out.take(maxLen) + "…" else out
    }

    // ---------------------------------------------------------------- PDF rendering

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
                        val w = widthPx.coerceIn(300, 2000)
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

    /** JPEG bytes of a page, for sending to the AI or sharing. */
    fun pageJpeg(context: Context, page: Int, widthPx: Int = 1100, quality: Int = 82): ByteArray? {
        val bmp = renderPage(context, page, widthPx) ?: return null
        return ByteArrayOutputStream().use { out ->
            bmp.compress(Bitmap.CompressFormat.JPEG, quality, out)
            bmp.recycle()
            out.toByteArray()
        }
    }
}
