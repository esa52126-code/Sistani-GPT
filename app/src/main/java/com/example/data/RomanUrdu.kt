package com.example.data

/**
 * Offline Urdu -> Roman Urdu transliteration.
 *
 * The most frequent words of the book come from a hand-made dictionary
 * (assets/roman_urdu.txt, "urdu roman" per line); other words fall back to a
 * letter-by-letter mapping. Pure Kotlin so it can be tested on the JVM.
 */
object RomanUrdu {
    @Volatile private var dict: Map<String, String> = emptyMap()

    private val MARKS = Regex("[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]")
    // Urdu letters (and diacritics) only; digits and Urdu punctuation stay outside words.
    private const val LETTERS = "\\u0621-\\u063A\\u0640-\\u065F\\u0670-\\u06D3\\u06D5"
    private val TOKEN = Regex("[$LETTERS]+|[^$LETTERS]+")

    /** Loads the dictionary from the lines of roman_urdu.txt. */
    fun load(lines: List<String>) {
        val m = HashMap<String, String>(lines.size * 2)
        for (line in lines) {
            val t = line.trim()
            if (t.isEmpty() || t.startsWith("#")) continue
            val sp = t.indexOf(' ')
            if (sp <= 0) continue
            m[key(t.substring(0, sp))] = t.substring(sp + 1).trim()
        }
        dict = m
    }

    private fun key(word: String): String = MARKS.replace(word, "")
        .replace('ي', 'ی').replace('ى', 'ی').replace('ك', 'ک').replace('ه', 'ہ')

    fun transliterate(text: String): String {
        val sb = StringBuilder(text.length)
        for (m in TOKEN.findAll(text)) {
            val tok = m.value
            val c = tok[0]
            val isWord = c in 'ء'..'غ' || c in 'ـ'..'ٟ' || c in 'ٰ'..'ۓ' || c == 'ە'
            if (isWord) {
                val w = key(tok)
                if (w.isEmpty()) continue
                sb.append(dict[w] ?: dict[w.removePrefix("و").takeIf { w.length > 2 }]?.let { "o $it" } ?: letters(w))
            } else {
                sb.append(digits(tok))
            }
        }
        return sb.toString()
            .replace('۔', '.').replace('،', ',').replace('؟', '?').replace('؛', ';')
            .replace(Regex(" +"), " ")
    }

    private fun digits(w: String): String = buildString {
        for (c in w) append(
            when (c) {
                in '۰'..'۹' -> '0' + (c - '۰')
                in '٠'..'٩' -> '0' + (c - '٠')
                else -> c
            }
        )
    }

    /** Rough letter-by-letter fallback for words missing from the dictionary. */
    private fun letters(w: String): String {
        val out = StringBuilder()
        for (i in w.indices) {
            val c = w[i]
            val first = i == 0
            val last = i == w.length - 1
            out.append(
                when (c) {
                    'ا' -> if (first) "a" else "a"
                    'آ' -> "aa"
                    'ب' -> "b"; 'پ' -> "p"; 'ت', 'ٹ', 'ط' -> "t"; 'ث', 'س', 'ص' -> "s"
                    'ج' -> "j"; 'چ' -> "ch"; 'ح' -> "h"; 'خ' -> "kh"; 'د', 'ڈ' -> "d"
                    'ذ', 'ز', 'ض', 'ظ' -> "z"; 'ر', 'ڑ' -> "r"; 'ژ' -> "zh"; 'ش' -> "sh"
                    'ع' -> if (first) "a" else "'"
                    'غ' -> "gh"; 'ف' -> "f"; 'ق' -> "q"; 'ک' -> "k"; 'گ' -> "g"
                    'ل' -> "l"; 'م' -> "m"; 'ن', 'ں' -> "n"
                    'و' -> if (first) "w" else "o"
                    'ہ', 'ۃ', 'ة' -> if (last && !first) "a" else "h"
                    'ھ' -> "h"
                    'ی' -> if (first) "y" else "i"
                    'ے' -> "e"; 'ئ' -> "i"; 'ؤ' -> "o"; 'ء' -> "'"
                    else -> ""
                }
            )
        }
        return out.toString()
    }
}
