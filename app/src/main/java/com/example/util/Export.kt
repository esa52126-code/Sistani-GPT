package com.example.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.text.StaticLayout
import android.text.TextDirectionHeuristics
import android.text.TextPaint
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.ChatMessage
import com.example.data.Masla
import com.example.network.TauzihAi
import com.example.ui.UiStrings

/** Text building for copy / share / download, and the PDF writer. */
object Export {

    fun refTitle(m: Masla, language: AppLanguage): String = TauzihAi.citationLabel(m, language)

    fun refSubtitle(m: Masla): String {
        val chapter = BookRepository.chapterOf(m).title
        return when {
            m.number == 0 -> m.section
            m.section.isBlank() -> chapter
            else -> "$chapter › ${m.section}"
        }
    }

    private fun refLine(m: Masla, language: AppLanguage): String {
        val sub = refSubtitle(m)
        return if (sub.isBlank()) refTitle(m, language) else "${refTitle(m, language)} — $sub"
    }

    /** A single masla with its heading and the link to the official text. */
    fun maslaText(m: Masla, language: AppLanguage, s: UiStrings): String =
        "${refLine(m, language)}\n\n${m.text}\n\n${s.bookName}\n${BookRepository.chapterOf(m).url}"

    /**
     * An answer with its question and references. With [fullReferences] the original text of every
     * cited masla is included (used for downloads); otherwise only the reference list.
     */
    fun answerText(
        question: String?,
        message: ChatMessage,
        s: UiStrings,
        fullReferences: Boolean,
        withBookName: Boolean = true,
    ): String = buildString {
        val language = message.language
        if (!question.isNullOrBlank()) append(s.question).append(": ").append(question.trim()).append("\n\n")
        when {
            message.offline && message.references.isEmpty() -> append(s.notFound)
            message.offline -> append(s.offlineNotice)
            else -> append(s.answer).append(": ").append(message.text)
        }
        if (message.references.isNotEmpty()) {
            append("\n\n").append(s.references).append(":\n")
            message.references.forEach { m ->
                append("• ").append(refLine(m, language)).append('\n')
                if (fullReferences || message.offline) append(m.text).append("\n\n")
            }
        }
        if (withBookName) {
            append('\n').append(s.bookName).append('\n').append(BookRepository.SOURCE_URL)
        }
    }.trim()

    fun chatText(messages: List<ChatMessage>, s: UiStrings): String = buildString {
        var question: String? = null
        for (m in messages) {
            if (m.isUser) {
                question = m.text
            } else {
                append(answerText(question, m, s, fullReferences = true, withBookName = false))
                append("\n\n────────────\n\n")
                question = null
            }
        }
        append(s.bookName).append('\n').append(BookRepository.SOURCE_URL)
    }

    fun copy(context: Context, text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("Tauzih ul Masail", text))
    }

    fun share(context: Context, text: String) {
        val intent = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        context.startActivity(Intent.createChooser(intent, null))
    }

    fun openUrl(context: Context, url: String) {
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
    }

    /** Writes [text] as a paginated A4 PDF to [uri]. Handles right-to-left text per paragraph. */
    fun writePdf(context: Context, uri: Uri, text: String): Boolean {
        val pageWidth = 595
        val pageHeight = 842
        val margin = 42
        val doc = PdfDocument()
        return try {
            val paint = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
                textSize = 12.5f
                color = Color.BLACK
            }
            val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, pageWidth - 2 * margin)
                .setLineSpacing(5f, 1.3f)
                .setTextDirection(TextDirectionHeuristics.FIRSTSTRONG_LTR)
                .build()
            val contentHeight = pageHeight - 2 * margin
            var line = 0
            var pageNumber = 1
            while (line < layout.lineCount) {
                val top = layout.getLineTop(line)
                var end = line
                while (end < layout.lineCount && layout.getLineBottom(end) - top <= contentHeight) end++
                if (end == line) end = line + 1
                val page = doc.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber++).create())
                val canvas = page.canvas
                canvas.save()
                canvas.translate(margin.toFloat(), (margin - top).toFloat())
                canvas.clipRect(0f, top.toFloat(), layout.width.toFloat(), layout.getLineTop(end).toFloat())
                layout.draw(canvas)
                canvas.restore()
                doc.finishPage(page)
                line = end
            }
            val out = context.contentResolver.openOutputStream(uri) ?: return false
            out.use { doc.writeTo(it) }
            true
        } catch (e: Exception) {
            false
        } finally {
            doc.close()
        }
    }
}

/** Saved (bookmarked) masail and the chosen language, kept in SharedPreferences. */
class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("tauzih", Context.MODE_PRIVATE)

    var savedIds: List<String>
        get() = prefs.getString("saved", "").orEmpty().split(',').filter { it.isNotBlank() }
        set(value) = prefs.edit().putString("saved", value.joinToString(",")).apply()

    var language: AppLanguage
        get() = AppLanguage.entries.firstOrNull { it.code == prefs.getString("lang", null) } ?: AppLanguage.URDU
        set(value) = prefs.edit().putString("lang", value.code).apply()
}
