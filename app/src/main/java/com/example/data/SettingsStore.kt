package com.example.data

import android.content.Context
import com.example.BuildConfig

/** Stores the user's own Gemini API key and model on the device (never in the APK). */
object SettingsStore {
    private const val PREFS = "tauzih_settings"
    private const val KEY_API = "gemini_api_key"
    private const val KEY_MODEL = "gemini_model"
    const val DEFAULT_MODEL = "gemini-flash-latest"

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun apiKey(context: Context): String {
        val saved = prefs(context).getString(KEY_API, "").orEmpty().trim()
        if (saved.isNotEmpty()) return saved
        val built = BuildConfig.GEMINI_API_KEY.trim()
        return if (built.isEmpty() || built == "MY_GEMINI_API_KEY") "" else built
    }

    fun hasApiKey(context: Context) = apiKey(context).isNotEmpty()

    fun savedApiKey(context: Context): String = prefs(context).getString(KEY_API, "").orEmpty()

    fun model(context: Context): String =
        prefs(context).getString(KEY_MODEL, "").orEmpty().trim().ifEmpty { DEFAULT_MODEL }

    fun save(context: Context, apiKey: String, model: String) {
        prefs(context).edit()
            .putString(KEY_API, apiKey.trim())
            .putString(KEY_MODEL, model.trim())
            .apply()
    }
}
