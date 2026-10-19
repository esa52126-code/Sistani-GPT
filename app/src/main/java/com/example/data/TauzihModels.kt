package com.example.data

enum class AppLanguage(val code: String, val displayName: String, val nativeName: String, val isRtl: Boolean) {
    URDU("ur", "Urdu", "اردو", true),
    ENGLISH("en", "English", "English", false),
    ROMAN_URDU("ur-Latn", "Roman Urdu", "Roman Urdu", false),
    FARSI("fa", "Farsi", "فارسی", true),
    ARABIC("ar", "Arabic", "العربية", true)
}

data class TauzihChapter(
    val id: String,
    val titleUrdu: String,
    val titleEnglish: String,
    val titleFarsi: String,
    val titleArabic: String,
    val pageStart: Int,
    val pageEnd: Int,
    val maslaStart: Int,
    val maslaEnd: Int,
    val description: String,
    val category: String
)

data class TauzihPage(
    val pageNumber: Int,
    val chapterTitleUrdu: String,
    val chapterTitleEnglish: String,
    val masailRange: String,
    val subHeadings: List<String>,
    val contentUrdu: String,
    val primaryMasail: List<Int>
)

data class ChatMessage(
    val id: String,
    val text: String,
    val isUser: Boolean,
    val timestamp: Long = System.currentTimeMillis(),
    val language: AppLanguage,
    val referencedPages: List<Int> = emptyList(),
    val referencedMasail: List<Int> = emptyList()
)

data class BookmarkItem(
    val id: String,
    val pageNumber: Int,
    val maslaNumber: Int? = null,
    val title: String,
    val previewText: String,
    val timestamp: Long = System.currentTimeMillis()
)
