package com.example.ui.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.filled.OpenInNew
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.Masla
import com.example.ui.UiStrings
import com.example.util.Export

/** The book is in Urdu, so its text is always laid out right-to-left whatever the UI language. */
val BookTextStyle = TextStyle(fontSize = 17.sp, lineHeight = 32.sp, textDirection = TextDirection.Rtl)

/** Callbacks shared by every place that shows a masla. */
class MaslaActions(
    val isSaved: (Masla) -> Boolean,
    val toggleSave: (Masla) -> Unit,
    val askAi: (Masla) -> Unit,
    val openInBook: (Masla) -> Unit,
    val download: (text: String, fileName: String) -> Unit,
)

@Composable
fun SmallAction(icon: ImageVector, label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 8.dp)) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(4.dp))
        Text(label, fontSize = 13.sp, maxLines = 1)
    }
}

@Composable
fun MaslaHeading(m: Masla, language: AppLanguage, modifier: Modifier = Modifier) {
    Column(modifier) {
        Text(
            Export.refTitle(m, language),
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            fontSize = 16.sp,
        )
        val sub = Export.refSubtitle(m)
        if (sub.isNotBlank()) {
            Text(
                sub,
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
fun MaslaCard(
    m: Masla,
    language: AppLanguage,
    s: UiStrings,
    actions: MaslaActions,
    modifier: Modifier = Modifier,
    maxLines: Int = Int.MAX_VALUE,
    onClick: (() -> Unit)? = null,
) {
    val context = LocalContext.current
    val colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    val content: @Composable () -> Unit = {
        Column(Modifier.padding(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 4.dp)) {
            MaslaHeading(m, language)
            Spacer(Modifier.height(6.dp))
            if (maxLines == Int.MAX_VALUE) {
                SelectionContainer {
                    Text(m.text, style = BookTextStyle, textAlign = TextAlign.Start, modifier = Modifier.fillMaxWidth())
                }
            } else {
                Text(
                    m.text,
                    style = BookTextStyle,
                    textAlign = TextAlign.Start,
                    maxLines = maxLines,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                SmallAction(Icons.Default.ContentCopy, s.copy) {
                    Export.copy(context, Export.maslaText(m, language, s))
                    Toast.makeText(context, s.copied, Toast.LENGTH_SHORT).show()
                }
                val saved = actions.isSaved(m)
                SmallAction(
                    if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                    if (saved) s.unsave else s.save,
                ) { actions.toggleSave(m) }
                SmallAction(Icons.Default.AutoAwesome, s.askAi) { actions.askAi(m) }
            }
        }
    }
    if (onClick != null) {
        Card(onClick = onClick, modifier = modifier.fillMaxWidth(), colors = colors) { content() }
    } else {
        Card(modifier = modifier.fillMaxWidth(), colors = colors) { content() }
    }
}

/** Full original text of a referenced masla, with copy / download / share / open actions. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MaslaSheet(m: Masla, language: AppLanguage, s: UiStrings, actions: MaslaActions, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            Modifier
                .padding(horizontal = 18.dp)
                .navigationBarsPadding()
                .verticalScroll(rememberScrollState())
        ) {
            MaslaHeading(m, language)
            HorizontalDivider(Modifier.padding(vertical = 10.dp))
            SelectionContainer {
                Text(m.text, style = BookTextStyle, textAlign = TextAlign.Start, modifier = Modifier.fillMaxWidth())
            }
            Spacer(Modifier.height(8.dp))
            val text = Export.maslaText(m, language, s)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                SmallAction(Icons.Default.ContentCopy, s.copy) {
                    Export.copy(context, text)
                    Toast.makeText(context, s.copied, Toast.LENGTH_SHORT).show()
                }
                SmallAction(Icons.Default.Download, s.download) { actions.download(text, "tauzih-${m.id}.pdf") }
                SmallAction(Icons.Default.Share, s.share) { Export.share(context, text) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                val saved = actions.isSaved(m)
                SmallAction(
                    if (saved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                    if (saved) s.unsave else s.save,
                ) { actions.toggleSave(m) }
                SmallAction(Icons.AutoMirrored.Filled.MenuBook, s.openInBook) {
                    onDismiss()
                    actions.openInBook(m)
                }
            }
            SmallAction(Icons.AutoMirrored.Filled.OpenInNew, s.officialSource) {
                Export.openUrl(context, BookRepository.chapterOf(m).url)
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}
