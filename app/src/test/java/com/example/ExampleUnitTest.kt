package com.example

import com.example.data.AppLanguage
import com.example.data.TauzihDatabase
import org.junit.Assert.*
import org.junit.Test

class ExampleUnitTest {
    @Test
    fun testChaptersCoverage() {
        val chapters = TauzihDatabase.chapters
        assertTrue("Chapters should not be empty", chapters.isNotEmpty())
        assertEquals(16, chapters.first().pageStart)
        assertEquals(542, chapters.last().pageEnd)
    }

    @Test
    fun testPageLookup() {
        val page298 = TauzihDatabase.getPage(298)
        assertEquals(298, page298.pageNumber)
        assertTrue(page298.contentUrdu.contains("روزے کو باطل کرتی ہیں"))

        val page251 = TauzihDatabase.getPage(251)
        assertEquals(251, page251.pageNumber)
        assertTrue(page251.contentUrdu.contains("مسافر کی نماز"))

        val page542 = TauzihDatabase.getPage(542)
        assertEquals(542, page542.pageNumber)
        assertTrue(page542.contentUrdu.contains("شرعی اوزان"))
    }

    @Test
    fun testSearchFunctionality() {
        val results = TauzihDatabase.search("خمس")
        assertTrue("Should find Khums chapter", results.any { it.id == "khums" })

        val rozaResults = TauzihDatabase.search("روزہ")
        assertTrue("Should find Roza chapter", rozaResults.any { it.id == "roza" })
    }

    @Test
    fun testSupportedLanguages() {
        val languages = AppLanguage.values()
        assertTrue(languages.any { it.name == "URDU" })
        assertTrue(languages.any { it.name == "ENGLISH" })
        assertTrue(languages.any { it.name == "ROMAN_URDU" })
        assertTrue(languages.any { it.name == "FARSI" })
        assertTrue(languages.any { it.name == "ARABIC" })
    }
}
