package com.example

import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.network.TauzihAi
import com.example.ui.strings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.File

/** Plain JVM tests over the real bundled book (run from the app module directory). */
class BookTest {
    @Before
    fun loadBook() {
        File("src/main/assets/tauzih.json").inputStream().use { BookRepository.load(it) }
    }

    private fun topChapters(query: String, n: Int = 5) =
        BookRepository.search(query, limit = n).map { BookRepository.chapterOf(it).title }

    @Test
    fun bookIsComplete() {
        assertEquals(60, BookRepository.chapters.size)
        assertTrue(BookRepository.items.count { it.number > 0 } > 2800)
        assertTrue(BookRepository.byNumber(1)!!.text.contains("اصول دین"))
        assertEquals("روزے کے احکام", BookRepository.chapterOf(BookRepository.byNumber(1529)!!).title)
        assertNotNull(BookRepository.byNumber(2883))
    }

    @Test
    fun searchWorksInUrdu() {
        assertTrue(topChapters("روزہ کن چیزوں سے باطل ہوتا ہے").any { it.contains("روزے") })
        assertTrue(topChapters("خمس کن چیزوں پر واجب ہے").any { it.contains("خمس") })
    }

    @Test
    fun searchWorksInOtherLanguages() {
        assertTrue(topChapters("What things invalidate a fast?").any { it.contains("روزے") })
        assertTrue(topChapters("Khums kin cheezon par wajib hai?").any { it.contains("خمس") })
        assertTrue(topChapters("musafir ki namaz qasr").any { it.contains("مسافر") })
        assertTrue(topChapters("ما هي مبطلات الصوم؟").any { it.contains("روزے") })
        assertTrue(topChapters("چه چیزهایی روزه را باطل می‌کند؟").any { it.contains("روزے") })
        assertTrue(topChapters("is insurance allowed").any { it.contains("انشورنس") })
    }

    @Test
    fun onlyCitationsFromTheGivenExcerptsAreKept() {
        val context = listOf(BookRepository.byNumber(1529)!!, BookRepository.byNumber(1530)!!)
        val answer = TauzihAi.parseAnswer(
            "Niyyat zaroori hai [M1529]. **Har raat** niyyat ho sakti hai [M:1530, M9999]. Ghalat hawala [M2000].",
            context,
            AppLanguage.ROMAN_URDU,
        )
        assertEquals(listOf(1529, 1530), answer.references.map { it.number })
        assertTrue(answer.text.contains("(Masla 1529)"))
        assertTrue(answer.text.contains("(Masla 1530)"))
        assertFalse(answer.text.contains("9999"))
        assertFalse(answer.text.contains("2000"))
        assertFalse(answer.text.contains("**"))
    }

    @Test
    fun explicitMaslaNumbersAreRecognised() {
        assertEquals(1529, TauzihAi.explicitMasla("masla 1529 kya hai")?.number)
        assertEquals(12, TauzihAi.explicitMasla("مسئلہ نمبر ۱۲ بتائیں")?.number)
        assertEquals(null, TauzihAi.explicitMasla("namaz ka waqt"))
    }

    @Test
    fun allFiveLanguagesHaveStrings() {
        AppLanguage.entries.forEach { lang ->
            val s = strings(lang)
            assertEquals(4, s.suggestions.size)
            assertTrue(s.explainMasla.contains("%d"))
        }
    }
}
