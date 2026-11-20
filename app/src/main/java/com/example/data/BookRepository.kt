package com.example.data

import android.content.Context
import android.util.Log
import org.json.JSONArray

/**
 * Holds the full text of Tauzih ul Masail, bundled in the APK as assets, so the
 * book can be read and searched without any server or internet connection.
 *
 * - assets/tauzih_masail.json: [{"n": masla number, "p": page, "t": text}, ...]
 * - assets/tauzih_pages.json:  ["page 1 text", "page 2 text", ...]
 */
object BookRepository {
    private const val TAG = "BookRepository"

    @Volatile private var appContext: Context? = null
    @Volatile private var index: BookIndex? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    /** Loads and indexes the book once; safe to call from any thread. */
    fun ensureLoaded(): BookIndex? {
        index?.let { return it }
        synchronized(this) {
            index?.let { return it }
            val ctx = appContext ?: return null
            return try {
                val masailJson = JSONArray(readAsset(ctx, "tauzih_masail.json"))
                val masail = ArrayList<Masla>(masailJson.length())
                for (i in 0 until masailJson.length()) {
                    val o = masailJson.getJSONObject(i)
                    masail.add(Masla(o.getInt("n"), o.getInt("p"), o.getString("t"), o.optString("h", "")))
                }
                try {
                    RomanUrdu.load(readAsset(ctx, "roman_urdu.txt").lines())
                } catch (e: Exception) {
                    Log.w(TAG, "Roman Urdu dictionary missing", e)
                }
                val pagesJson = JSONArray(readAsset(ctx, "tauzih_pages.json"))
                val pages = List(pagesJson.length()) { pagesJson.getString(it) }
                BookIndex(masail, pages).also { index = it }
            } catch (e: Exception) {
                Log.e(TAG, "Could not load the bundled book text", e)
                null
            }
        }
    }

    private fun readAsset(ctx: Context, name: String): String =
        ctx.assets.open(name).bufferedReader(Charsets.UTF_8).use { it.readText() }

    fun search(query: String, limit: Int = 6): List<Masla> = ensureLoaded()?.search(query, limit).orEmpty()

    /** Only the masail that clearly answer the query (for offline answers). */
    fun searchRelevant(query: String, max: Int = 3): List<Masla> = ensureLoaded()?.searchRelevant(query, max).orEmpty()

    fun masla(number: Int): Masla? = ensureLoaded()?.masla(number)

    fun pageText(page: Int): String? = ensureLoaded()?.pageText(page)

    fun masailOnPage(page: Int): List<Masla> = ensureLoaded()?.masailOnPage(page).orEmpty()
}
