package com.example.ui.screens

import android.content.Intent
import android.graphics.Bitmap
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.ChatMessage
import com.example.data.MaslaFinder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

// Vertical scrollbar for LazyColumn
fun Modifier.drawVerticalScrollbar(
    state: LazyListState,
    color: Color = Color(0xFFD97706),
    trackColor: Color = Color(0x22000000),
    width: Dp = 6.dp
): Modifier = this.drawWithContent {
    drawContent()
    val layoutInfo = state.layoutInfo
    val totalItems = layoutInfo.totalItemsCount
    val visibleItems = layoutInfo.visibleItemsInfo
    if (totalItems > 0 && visibleItems.isNotEmpty()) {
        val firstVisible = visibleItems.first().index
        val visibleCount = visibleItems.size
        val trackWidthPx = width.toPx()
        val trackHeightPx = size.height
        drawRoundRect(
            color = trackColor,
            topLeft = Offset(size.width - trackWidthPx - 2.dp.toPx(), 0f),
            size = Size(trackWidthPx, trackHeightPx),
            cornerRadius = CornerRadius(trackWidthPx / 2, trackWidthPx / 2)
        )
        val thumbHeightPx = (trackHeightPx * (visibleCount.toFloat() / totalItems)).coerceIn(36.dp.toPx(), trackHeightPx)
        val ratio = firstVisible.toFloat() / totalItems.coerceAtLeast(1)
        val thumbOffsetY = ((trackHeightPx - thumbHeightPx) * ratio).coerceIn(0f, trackHeightPx - thumbHeightPx)
        drawRoundRect(
            color = color,
            topLeft = Offset(size.width - trackWidthPx - 2.dp.toPx(), thumbOffsetY),
            size = Size(trackWidthPx, thumbHeightPx),
            cornerRadius = CornerRadius(trackWidthPx / 2, trackWidthPx / 2)
        )
    }
}

private val welcome = ChatMessage(
    id = "welcome",
    text = "السلام علیکم!\n\nیہ حضرت آیت اللہ العظمیٰ سید علی حسینی سیستانی (دام ظلہ) کی کتاب «توضیح المسائل» ہے۔ " +
        "اپنا سوال اردو میں لکھیں، کتاب میں سے متعلقہ مسئلہ اپنی اصل عبارت کے ساتھ یہیں دکھا دیا جائے گا۔\n\n" +
        "یہ ایپ مکمل آف لائن ہے — انٹرنیٹ کی ضرورت نہیں۔\n\n" +
        "مثال: «روزہ کن چیزوں سے باطل ہوتا ہے» یا «مسئلہ 1581»",
    isUser = false,
    language = AppLanguage.URDU
)

private val suggestions = listOf(
    "روزہ کن چیزوں سے باطل ہوتا ہے",
    "مسافر کی نماز قصر کی شرائط",
    "وضو باطل کرنے والی چیزیں",
    "غسل جنابت کا ترتیبی طریقہ",
    "خمس کن چیزوں پر واجب ہے",
    "فطرہ کی مقدار",
    "نماز میں رکعتوں کا شک",
    "تیمم کا طریقہ"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    currentLanguage: AppLanguage = AppLanguage.URDU,
    onLanguageChanged: (AppLanguage) -> Unit = {},
    onOpenPageInBook: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()

    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var messages by remember { mutableStateOf(listOf(welcome)) }

    // Load the index in the background once, so the first answer is quick
    LaunchedEffect(Unit) { withContext(Dispatchers.IO) { BookRepository.paragraphs(context) } }

    fun send(query: String) {
        val q = query.trim()
        if (q.isEmpty() || isLoading) return
        val userMsg = ChatMessage(id = UUID.randomUUID().toString(), text = q, isUser = true, language = AppLanguage.URDU)
        messages = messages + userMsg
        inputText = ""
        isLoading = true
        scope.launch {
            listState.animateScrollToItem(messages.size - 1)
            val ans = withContext(Dispatchers.IO) { MaslaFinder.answer(context, q) }
            messages = messages + ChatMessage(
                id = UUID.randomUUID().toString(),
                text = ans.text,
                isUser = false,
                language = AppLanguage.URDU,
                referencedPages = ans.pages,
                paragraphs = ans.paragraphs
            )
            isLoading = false
            listState.animateScrollToItem(messages.size - 1)
        }
    }

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier.size(36.dp).clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.secondary),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.MenuBook, contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onSecondary, modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(Modifier.width(10.dp))
                            Column {
                                Text(
                                    "توضیح المسائل", fontWeight = FontWeight.Bold,
                                    style = MaterialTheme.typography.titleMedium,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                                Text(
                                    "آیت اللہ العظمیٰ سیستانی • مکمل آف لائن",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f)
                                )
                            }
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.primary,
                        titleContentColor = MaterialTheme.colorScheme.onPrimary,
                        actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                    ),
                    actions = {
                        IconButton(onClick = {
                            messages = listOf(welcome)
                            Toast.makeText(context, "چیٹ صاف کر دی گئی", Toast.LENGTH_SHORT).show()
                        }) { Icon(Icons.Default.Refresh, contentDescription = "چیٹ صاف کریں") }
                    }
                )
            },
            bottomBar = {
                Column(
                    modifier = Modifier.fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .imePadding()
                        .padding(8.dp)
                ) {
                    LazyRow(
                        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(suggestions) { s ->
                            SuggestionChip(
                                onClick = { send(s) },
                                label = { Text(s, fontSize = 13.sp, maxLines = 1) },
                                colors = SuggestionChipDefaults.suggestionChipColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                                )
                            )
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = inputText,
                            onValueChange = { inputText = it },
                            placeholder = { Text("اپنا سوال اردو میں لکھیں…", fontSize = 14.sp) },
                            modifier = Modifier.weight(1f).padding(end = 8.dp),
                            shape = RoundedCornerShape(24.dp),
                            maxLines = 4,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = MaterialTheme.colorScheme.primary,
                                unfocusedBorderColor = MaterialTheme.colorScheme.outline
                            )
                        )
                        FloatingActionButton(
                            onClick = { send(inputText) },
                            containerColor = MaterialTheme.colorScheme.primary,
                            contentColor = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.size(48.dp),
                            shape = CircleShape
                        ) {
                            if (isLoading) CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary, strokeWidth = 2.dp
                            ) else Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "بھیجیں", modifier = Modifier.size(20.dp))
                        }
                    }
                }
            },
            modifier = modifier
        ) { innerPadding ->
            Box(
                modifier = Modifier.fillMaxSize().padding(innerPadding)
                    .background(MaterialTheme.colorScheme.background)
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize()
                        .drawVerticalScrollbar(
                            state = listState,
                            color = MaterialTheme.colorScheme.secondary,
                            trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f)
                        )
                        .padding(horizontal = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(top = 12.dp, bottom = 12.dp)
                ) {
                    items(messages, key = { it.id }) { msg ->
                        if (msg.isUser) UserBubble(msg.text) else AnswerBubble(msg, onOpenPageInBook)
                    }
                    if (isLoading) {
                        item {
                            Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                                Spacer(Modifier.width(10.dp))
                                Text("کتاب میں مسئلہ تلاش کیا جا رہا ہے…", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UserBubble(text: String) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
            shape = RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp),
            modifier = Modifier.fillMaxWidth(0.85f)
        ) {
            Text(
                text, modifier = Modifier.padding(14.dp), fontSize = 17.sp, lineHeight = 28.sp,
                color = MaterialTheme.colorScheme.onPrimary, textAlign = TextAlign.Start
            )
        }
    }
}

@Composable
private fun AnswerBubble(msg: ChatMessage, onOpenPage: (Int) -> Unit) {
    val context = LocalContext.current
    var showAll by remember(msg.id) { mutableStateOf(false) }
    val paras = remember(msg.id) {
        val all = BookRepository.paragraphs(context)
        msg.paragraphs.mapNotNull { all.getOrNull(it) }
    }
    // First masla (plus its continuation on the next page) is shown; the rest behind a button
    val firstGroup = remember(msg.id) {
        if (paras.isEmpty()) emptyList()
        else {
            val head = paras.first()
            val cont = paras.getOrNull(1)?.takeIf { it.isContinuation && it.page == head.page + 1 && it.index == head.index + 1 }
            listOfNotNull(head, cont)
        }
    }
    val visible = if (showAll) paras else firstGroup

    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            shape = RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp),
            elevation = CardDefaults.cardElevation(3.dp),
            modifier = Modifier.fillMaxWidth(0.98f)
                .border(1.5.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.4f), RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp))
        ) {
            Column(Modifier.padding(12.dp)) {
                Text(
                    msg.text, fontSize = 16.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                visible.forEachIndexed { i, p ->
                    Spacer(Modifier.height(10.dp))
                    MaslaImage(p, onOpenPage, isContinuation = i > 0 && p.isContinuation && visible[i - 1].page == p.page - 1)
                }
                if (paras.size > firstGroup.size) {
                    Spacer(Modifier.height(8.dp))
                    TextButton(onClick = { showAll = !showAll }, modifier = Modifier.fillMaxWidth()) {
                        Icon(if (showAll) Icons.Default.ExpandLess else Icons.Default.ExpandMore, contentDescription = null)
                        Spacer(Modifier.width(6.dp))
                        Text(
                            if (showAll) "کم دکھائیں" else "مزید متعلقہ مسائل (${paras.size - firstGroup.size})",
                            fontSize = 15.sp, fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MaslaImage(p: BookRepository.Paragraph, onOpenPage: (Int) -> Unit, isContinuation: Boolean) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var zoomed by remember { mutableStateOf(false) }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val boxWidth = maxWidth
        val widthPx = with(LocalDensity.current) { boxWidth.toPx() }.toInt()
        val bmp by produceState<Bitmap?>(null, p.index, widthPx) {
            value = withContext(Dispatchers.IO) { BookRepository.renderParagraph(context, p, (widthPx * 1.6f).toInt()) }
        }
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
                .background(Color.White)
        ) {
            if (isContinuation) {
                Text(
                    "(یہ مسئلہ اگلے صفحے ${p.page} پر جاری ہے)", fontSize = 12.sp,
                    color = Color(0xFF6B7280), modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }
            val b = bmp
            if (b == null) {
                Box(Modifier.fillMaxWidth().height(120.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
                }
            } else {
                Box(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
                    Image(
                        bitmap = b.asImageBitmap(),
                        contentDescription = "توضیح المسائل صفحہ ${p.page}",
                        contentScale = ContentScale.FillWidth,
                        modifier = Modifier.width(if (zoomed) boxWidth * 1.6f else boxWidth)
                            .clickable { zoomed = !zoomed }
                    )
                }
            }
            Row(
                Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    "صفحہ ${p.page}", fontSize = 14.sp, fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp)
                )
                Row {
                    IconButton(onClick = { zoomed = !zoomed }) {
                        Icon(if (zoomed) Icons.Default.ZoomOut else Icons.Default.ZoomIn, contentDescription = "بڑا کریں")
                    }
                    IconButton(onClick = {
                        scope.launch { shareParagraph(context, p) }
                    }) { Icon(Icons.Default.Share, contentDescription = "شیئر کریں") }
                    TextButton(onClick = { onOpenPage(p.page) }) { Text("پورا صفحہ", fontSize = 14.sp) }
                }
            }
        }
    }
}

private suspend fun shareParagraph(context: android.content.Context, p: BookRepository.Paragraph) {
    try {
        val file = withContext(Dispatchers.IO) {
            val bmp = BookRepository.renderParagraph(context, p, 1400) ?: return@withContext null
            val dir = File(context.cacheDir, "shared").apply { mkdirs() }
            val f = File(dir, "tauzih_masla_${p.page}_${p.index}.jpg")
            f.outputStream().use { bmp.compress(Bitmap.CompressFormat.JPEG, 90, it) }
            f
        } ?: return
        val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/jpeg"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "توضیح المسائل (آیت اللہ سیستانی) — صفحہ ${p.page}")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "مسئلہ شیئر کریں"))
    } catch (e: Exception) {
        Toast.makeText(context, "شیئر نہیں ہو سکا", Toast.LENGTH_SHORT).show()
    }
}
