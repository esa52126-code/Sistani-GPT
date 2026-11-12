package com.example.data

enum class AppLanguage(
    val code: String,
    val nativeName: String,
    val isRtl: Boolean,
    /** How the language is described to the AI model. */
    val promptName: String,
) {
    URDU("ur", "اردو", true, "Urdu (Urdu script)"),
    ENGLISH("en", "English", false, "English"),
    ROMAN_URDU("ur-Latn", "Roman Urdu", false, "Roman Urdu (Urdu written in Latin letters)"),
    FARSI("fa", "فارسی", true, "Persian (Farsi)"),
    ARABIC("ar", "العربية", true, "Arabic"),
}

data class Chapter(
    val index: Int,
    val title: String,
    val url: String,
    val maslaFrom: Int,
    val maslaTo: Int,
)

/**
 * One entry of the book: either a numbered masla ([number] > 0) or an unnumbered section such as
 * a chapter introduction or the glossary ([number] == 0).
 */
data class Masla(
    val index: Int,
    val number: Int,
    val chapter: Int,
    val section: String,
    val text: String,
) {
    /** Stable id used for citations and bookmarks: "M1529" for a masla, "S42" for a section. */
    val id: String
        get() = if (number > 0) "M$number" else "S$index"
}

data class ChatMessage(
    val id: Long,
    val text: String,
    val isUser: Boolean,
    val language: AppLanguage,
    /** Entries of the book this answer is based on. Always real entries, never model output. */
    val references: List<Masla> = emptyList(),
    /** True when the answer is a plain book search because the AI could not be reached. */
    val offline: Boolean = false,
)
