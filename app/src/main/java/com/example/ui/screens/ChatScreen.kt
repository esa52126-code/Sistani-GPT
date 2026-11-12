package com.example.ui.screens

import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AppLanguage
import com.example.data.ChatMessage
import com.example.data.Masla
import com.example.ui.ChatViewModel
import com.example.ui.UiStrings
import com.example.util.Export

private val AnswerTextStyle = TextStyle(fontSize = 16.sp, lineHeight = 28.sp, textDirection = TextDirection.Content)

@Composable
fun ChatScreen(
    vm: ChatViewModel,
    language: AppLanguage,
    s: UiStrings,
    actions: MaslaActions,
    onShowReference: (Masla) -> Unit,
    modifier: Modifier = Modifier,
) {
    var input by rememberSaveable { mutableStateOf("") }
    val listState = rememberLazyListState()
    val messages = vm.messages

    LaunchedEffect(messages.size, vm.isLoading) {
        val last = messages.size + (if (vm.isLoading) 1 else 0)
        if (last > 0) listState.animateScrollToItem(last)
    }

    fun submit() {
        if (input.isNotBlank() && !vm.isLoading) {
            vm.send(input, language)
            input = ""
        }
    }

    Column(modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            item(key = "welcome") {
                WelcomeCard(s, showSuggestions = messages.isEmpty()) { vm.send(it, language) }
            }
            itemsIndexed(messages, key = { _, m -> m.id }) { index, message ->
                if (message.isUser) {
                    UserBubble(message.text)
                } else {
                    AnswerCard(message, vm.questionFor(index), strings = com.example.ui.strings(message.language), actions, onShowReference)
                }
            }
            if (vm.isLoading) {
                item(key = "loading") {
                    Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(10.dp))
                        Text(s.thinking, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                    }
                }
            }
        }
        Surface(tonalElevation = 3.dp) {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
                verticalAlignment = Alignment.Bottom,
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    placeholder = { Text(s.askHint) },
                    modifier = Modifier.weight(1f).testTag("chat_input"),
                    maxLines = 4,
                    shape = RoundedCornerShape(24.dp),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { submit() }),
                )
                Spacer(Modifier.width(8.dp))
                FilledIconButton(
                    onClick = { submit() },
                    enabled = input.isNotBlank() && !vm.isLoading,
                    modifier = Modifier.size(52.dp).testTag("chat_send"),
                ) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = s.send)
                }
            }
        }
    }
}

@Composable
private fun WelcomeCard(s: UiStrings, showSuggestions: Boolean, onSuggestion: (String) -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(s.welcome, fontSize = 15.sp, lineHeight = 26.sp, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Spacer(Modifier.height(8.dp))
            Text(s.disclaimer, fontSize = 12.sp, lineHeight = 20.sp, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.75f))
        }
    }
    if (showSuggestions) {
        Column(Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            s.suggestions.forEach { q ->
                OutlinedCard(onClick = { onSuggestion(q) }, modifier = Modifier.fillMaxWidth()) {
                    Text(q, Modifier.padding(horizontal = 14.dp, vertical = 12.dp), fontSize = 15.sp)
                }
            }
        }
    }
}

@Composable
private fun UserBubble(text: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Surface(
            color = MaterialTheme.colorScheme.primary,
            shape = RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp),
            modifier = Modifier.widthIn(max = 320.dp),
        ) {
            SelectionContainer {
                Text(
                    text,
                    Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    color = MaterialTheme.colorScheme.onPrimary,
                    style = AnswerTextStyle,
                )
            }
        }
    }
}

@Composable
private fun AnswerCard(
    message: ChatMessage,
    question: String?,
    strings: UiStrings,
    actions: MaslaActions,
    onShowReference: (Masla) -> Unit,
) {
    val context = LocalContext.current
    val s = strings
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        modifier = Modifier.fillMaxWidth().testTag("answer_card"),
    ) {
        Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 4.dp)) {
            if (message.offline) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CloudOff, null, Modifier.size(18.dp), tint = MaterialTheme.colorScheme.secondary)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        if (message.references.isEmpty()) s.notFound else s.offlineNotice,
                        fontSize = 14.sp,
                        lineHeight = 24.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                SelectionContainer {
                    Text(message.text, style = AnswerTextStyle, modifier = Modifier.fillMaxWidth())
                }
            }

            if (message.references.isNotEmpty()) {
                HorizontalDivider(Modifier.padding(vertical = 10.dp))
                Text(s.references, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.secondary)
                Spacer(Modifier.height(4.dp))
                message.references.forEach { m ->
                    ReferenceRow(m, message.language, preview = message.offline) { onShowReference(m) }
                }
            }

            if (!message.offline || message.references.isNotEmpty()) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    SmallAction(Icons.Default.ContentCopy, s.copy) {
                        Export.copy(context, Export.answerText(question, message, s, fullReferences = false))
                        Toast.makeText(context, s.copied, Toast.LENGTH_SHORT).show()
                    }
                    SmallAction(Icons.Default.Download, s.download) {
                        actions.download(
                            Export.answerText(question, message, s, fullReferences = true),
                            "tauzih-answer-${message.id}.pdf",
                        )
                    }
                    SmallAction(Icons.Default.Share, s.share) {
                        Export.share(context, Export.answerText(question, message, s, fullReferences = false))
                    }
                }
            } else {
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun ReferenceRow(m: Masla, language: AppLanguage, preview: Boolean, onClick: () -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp)
            .clickable(onClick = onClick)
            .testTag("reference_row"),
    ) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.Top) {
            Icon(
                Icons.AutoMirrored.Filled.MenuBook,
                contentDescription = null,
                modifier = Modifier.padding(top = 3.dp).size(18.dp),
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.width(8.dp))
            Column(Modifier.weight(1f)) {
                MaslaHeading(m, language)
                Text(
                    m.text,
                    style = BookTextStyle.copy(fontSize = 14.sp, lineHeight = 26.sp),
                    maxLines = if (preview) 6 else 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
