package com.example.data

/** The app answers in Urdu or Roman Urdu: Urdu script gets Urdu, Latin script gets Roman Urdu. */
object LanguageDetector {
    fun detect(text: String, fallback: AppLanguage): AppLanguage {
        val letters = text.filter { it.isLetter() }
        if (letters.isEmpty()) return fallback
        val urduScript = letters.count { it in '؀'..'ۿ' }
        return if (urduScript * 2 >= letters.length) AppLanguage.URDU else AppLanguage.ROMAN_URDU
    }
}
