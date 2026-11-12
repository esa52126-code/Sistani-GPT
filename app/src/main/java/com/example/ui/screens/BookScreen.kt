package com.example.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.Masla
import com.example.ui.UiStrings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Browse the book chapter by chapter, or search its full text offline.
 * [target] jumps straight to a masla (used by "open in book" on a reference).
 */
@Composable
fun BookScreen(
    language: AppLanguage,
    s: UiStrings,
    actions: MaslaActions,
    target: Masla?,
    onTargetConsumed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var chapterIndex by rememberSaveable { mutableStateOf(-1) }
    var query by rememberSaveable { mutableStateOf("") }
    var scrollTo by remember { mutableStateOf<Masla?>(null) }

    LaunchedEffect(target) {
        if (target != null) {
            query = ""
            chapterIndex = target.chapter
            scrollTo = target
            onTargetConsumed()
        }
    }

    BackHandler(enabled = query.isNotEmpty() || chapterIndex >= 0) {
        if (query.isNotEmpty()) query = "" else chapterIndex = -1
    }

    val results by produceState<List<Masla>?>(initialValue = null, query) {
        value = null
        if (query.trim().length >= 2) {
            delay(250)
            value = withContext(Dispatchers.Default) { BookRepository.search(query, limit = 40) }
        }
    }

    Column(modifier.fillMaxSize()) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text(s.searchBook) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            trailingIcon = {
                if (query.isNotEmpty()) {
                    IconButton(onClick = { query = "" }) { Icon(Icons.Default.Close, contentDescription = s.close) }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp).testTag("book_search"),
        )

        val listPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 12.dp)
        when {
            query.trim().length >= 2 -> {
                val found = results
                if (found != null && found.isEmpty()) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(s.noResults) }
                } else {
                    LazyColumn(contentPadding = listPadding, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        items(found ?: emptyList(), key = { it.index }) { m ->
                            MaslaCard(m, language, s, actions)
                        }
                    }
                }
            }

            chapterIndex < 0 -> {
                LazyColumn(contentPadding = listPadding, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(BookRepository.chapters, key = { it.index }) { ch ->
                        Card(
                            onClick = { chapterIndex = ch.index },
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                            modifier = Modifier.fillMaxWidth().testTag("chapter_card"),
                        ) {
                            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp)) {
                                Text(
                                    ch.title,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp,
                                    lineHeight = 30.sp,
                                    style = MaterialTheme.typography.bodyLarge.copy(textDirection = TextDirection.Rtl),
                                    textAlign = TextAlign.Start,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                                if (ch.maslaFrom > 0) {
                                    Text(
                                        "${ch.maslaFrom} – ${ch.maslaTo}",
                                        fontSize = 13.sp,
                                        color = MaterialTheme.colorScheme.secondary,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            else -> {
                val chapter = BookRepository.chapters[chapterIndex]
                val chapterItems = remember(chapterIndex) { BookRepository.chapterItems(chapterIndex) }
                val listState = rememberLazyListState()
                LaunchedEffect(scrollTo, chapterIndex) {
                    val wanted = scrollTo
                    if (wanted != null && wanted.chapter == chapterIndex) {
                        val position = chapterItems.indexOfFirst { it.index == wanted.index }
                        if (position >= 0) listState.scrollToItem(position)
                        scrollTo = null
                    }
                }
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { chapterIndex = -1 }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = s.back)
                    }
                    Text(
                        chapter.title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp,
                        maxLines = 2,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.weight(1f),
                    )
                }
                LazyColumn(
                    state = listState,
                    contentPadding = listPadding,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(chapterItems, key = { it.index }) { m ->
                        MaslaCard(m, language, s, actions)
                    }
                }
            }
        }
    }
}

@Composable
fun SavedScreen(
    saved: List<Masla>,
    language: AppLanguage,
    s: UiStrings,
    actions: MaslaActions,
    modifier: Modifier = Modifier,
) {
    if (saved.isEmpty()) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(s.noSaved, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    } else {
        LazyColumn(
            modifier = modifier.fillMaxSize(),
            contentPadding = PaddingValues(12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(saved, key = { it.index }) { m ->
                MaslaCard(m, language, s, actions, maxLines = 6, onClick = { actions.openInBook(m) })
            }
        }
    }
}
