package com.example.data

/** Guesses which of the app's languages a question is written in. */
object LanguageDetector {
    private val URDU_ONLY = Regex("[ٹڈڑںےھۃۓ]")
    private val PERSIAN_HINT = Regex("(^|\\s)(است|چه|چرا|آیا|می|نمی|را|این|آن|باید|شود|کند|است؟)(\\s|$|؟)")
    private val ARABIC_HINT = Regex("[ةإأ]|(^|\\s)(ما|هل|في|على|عن|الذي|التي|هو|هي|يجوز|حكم)(\\s|$|؟)")
    private val ENGLISH_WORDS = setOf(
        "the", "is", "are", "what", "how", "does", "do", "can", "my", "of", "in", "a", "an", "if",
        "when", "which", "should", "will", "it", "for", "to", "about", "ruling", "allowed", "i", "with",
        "pray", "prayer", "fast", "fasting", "break", "breaks", "wife", "husband", "valid", "invalid"
    )
    private val ROMAN_URDU_WORDS = setOf(
        "hai", "hain", "ka", "ki", "ke", "kya", "kia", "mein", "me", "se", "ko", "par", "pe", "aur",
        "agar", "to", "kaise", "kese", "kab", "kitna", "kitni", "jata", "jati", "hota", "hoti", "karna",
        "kar", "sakta", "sakti", "chahiye", "nahi", "nahin", "batain", "bataen", "batao", "masla",
        "namaz", "roza", "wuzu", "wudu", "ghusl", "ho", "jaye", "wala", "wali", "kis", "kin", "kon"
    )

    /** Language of [text]; [fallback] (the language chosen in the app) when unclear. */
    fun detect(text: String, fallback: AppLanguage): AppLanguage {
        val letters = text.filter { it.isLetter() }
        if (letters.isEmpty()) return fallback
        val arabicScript = letters.count { it in '؀'..'ۿ' }
        if (arabicScript * 2 >= letters.length) {
            return when {
                URDU_ONLY.containsMatchIn(text) -> AppLanguage.URDU
                PERSIAN_HINT.containsMatchIn(text) -> AppLanguage.FARSI
                ARABIC_HINT.containsMatchIn(text) -> AppLanguage.ARABIC
                fallback == AppLanguage.FARSI || fallback == AppLanguage.ARABIC -> fallback
                else -> AppLanguage.URDU
            }
        }
        val words = Regex("[a-zA-Z']+").findAll(text.lowercase()).map { it.value }.toList()
        val en = words.count { it in ENGLISH_WORDS }
        val ru = words.count { it in ROMAN_URDU_WORDS }
        return when {
            ru > en -> AppLanguage.ROMAN_URDU
            en > ru -> AppLanguage.ENGLISH
            fallback == AppLanguage.ENGLISH || fallback == AppLanguage.ROMAN_URDU -> fallback
            else -> AppLanguage.ROMAN_URDU
        }
    }
}
