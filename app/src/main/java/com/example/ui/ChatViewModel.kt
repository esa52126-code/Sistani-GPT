package com.example.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.AppLanguage
import com.example.data.ChatMessage
import com.example.network.TauzihAi
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

class ChatViewModel : ViewModel() {
    val messages = mutableStateListOf<ChatMessage>()
    var isLoading by mutableStateOf(false)
        private set

    private var nextId = 1L
    private var job: Job? = null

    fun send(question: String, language: AppLanguage) {
        val text = question.trim()
        if (text.isEmpty() || isLoading) return
        val history = messages.map { it.text to it.isUser }
        messages += ChatMessage(nextId++, text, isUser = true, language = language)
        isLoading = true
        job = viewModelScope.launch {
            try {
                val answer = TauzihAi.ask(text, language, history)
                messages += ChatMessage(
                    id = nextId++,
                    text = answer.text,
                    isUser = false,
                    language = language,
                    references = answer.references,
                    offline = answer.offline,
                )
            } finally {
                isLoading = false
            }
        }
    }

    fun clear() {
        job?.cancel()
        messages.clear()
        isLoading = false
    }

    /** The question that the answer at [answerIndex] replies to. */
    fun questionFor(answerIndex: Int): String? =
        messages.getOrNull(answerIndex - 1)?.takeIf { it.isUser }?.text
}
