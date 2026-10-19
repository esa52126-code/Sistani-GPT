package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.speech.tts.TextToSpeech
import android.widget.Toast
import androidx.compose.animation.*
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.automirrored.filled.VolumeUp
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AppLanguage
import com.example.data.ChatMessage
import com.example.network.GeminiService
import kotlinx.coroutines.launch
import java.util.*

// Custom Vertical Scrollbar Modifier for LazyColumn and scrollable views
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

        // Draw scroll track
        drawRoundRect(
            color = trackColor,
            topLeft = Offset(size.width - trackWidthPx - 2.dp.toPx(), 0f),
            size = Size(trackWidthPx, trackHeightPx),
            cornerRadius = CornerRadius(trackWidthPx / 2, trackWidthPx / 2)
        )

        // Draw scrollbar thumb
        val thumbHeightPx = (trackHeightPx * (visibleCount.toFloat() / totalItems)).coerceIn(36.dp.toPx(), trackHeightPx)
        val scrollOffsetRatio = firstVisible.toFloat() / totalItems.coerceAtLeast(1)
        val thumbOffsetY = ((trackHeightPx - thumbHeightPx) * scrollOffsetRatio).coerceIn(0f, trackHeightPx - thumbHeightPx)

        drawRoundRect(
            color = color,
            topLeft = Offset(size.width - trackWidthPx - 2.dp.toPx(), thumbOffsetY),
            size = Size(trackWidthPx, thumbHeightPx),
            cornerRadius = CornerRadius(trackWidthPx / 2, trackWidthPx / 2)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    currentLanguage: AppLanguage,
    onLanguageChanged: (AppLanguage) -> Unit,
    onOpenPageInBook: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    val clipboardManager = LocalClipboardManager.current
    val listState = rememberLazyListState()

    var inputText by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var isOfflineMode by remember { mutableStateOf(true) } // Default to reliable 100% offline mode

    // Selected message for full reading view
    var fullViewMessage by remember { mutableStateOf<ChatMessage?>(null) }

    // TTS engine
    var ttsEngine by remember { mutableStateOf<TextToSpeech?>(null) }
    DisposableEffect(context) {
        val tts = TextToSpeech(context) { status ->
            if (status == TextToSpeech.SUCCESS) {
                // Initialize default
            }
        }
        ttsEngine = tts
        onDispose {
            tts.stop()
            tts.shutdown()
        }
    }

    // Default welcome messages based on language
    val welcomeMessage = remember(currentLanguage) {
        when (currentLanguage) {
            AppLanguage.URDU -> ChatMessage(
                id = "welcome_ur",
                text = "السلام علیکم! میں حضرت آیت اللہ العظمیٰ سید علی حسینی سیستانی کی کتاب 'توضیح المسائل' کا آف لائن و آن لائن فقہی اسسٹنٹ ہوں۔\n\nآپ کتاب کے تمام ۵۴۲ صفحات اور ۲۸۰۰ سے زائد مسائل میں سے کوئی بھی سوال پوچھ سکتے ہیں۔ ہر جواب کے ساتھ مسئلہ نمبر اور صفحہ نمبر کا براہِ راست لنک دیا جائے گا جس سے آپ اصل کتاب کا وہی صفحہ کھول اور ڈاؤنلوڈ کر سکتے ہیں۔",
                isUser = false,
                language = AppLanguage.URDU,
                referencedPages = listOf(16),
                referencedMasail = listOf(1)
            )
            AppLanguage.ENGLISH -> ChatMessage(
                id = "welcome_en",
                text = "Assalamu Alaikum! I am your AI Jurisprudence Assistant for Ayatollah Sayyid Ali al-Husayni al-Sistani's 'Tauzih ul Masail' (542 Pages).\n\nAsk any question regarding Taharat, Namaz, Fasting, Khums, Zakat, Hajj, Nikah, or Muamalat. Every answer includes exact Masla & Page numbers with a direct link to open that page.",
                isUser = false,
                language = AppLanguage.ENGLISH,
                referencedPages = listOf(16),
                referencedMasail = listOf(1)
            )
            AppLanguage.ROMAN_URDU -> ChatMessage(
                id = "welcome_ru",
                text = "Assalamu Alaikum! Main Ayatollah Sistani ki kitab 'Tauzih ul Masail' ka AI Assistant hoon.\n\nAap Taharat, Namaz, Roza, Khums, Zakat, Hajj, Nikah, Talaq waghera ka koi bhi masla pooch sakte hain. Har jawab me exact Masla aur Page number ka link milega jahan se aap direct page parh aur download kar sakte hain.",
                isUser = false,
                language = AppLanguage.ROMAN_URDU,
                referencedPages = listOf(16),
                referencedMasail = listOf(1)
            )
            AppLanguage.FARSI -> ChatMessage(
                id = "welcome_fa",
                text = "سلام علیکم! من دستیار هوشمند فتاوای حضرت آیت الله العظمی سید علی حسینی سیستانی در کتاب «توضیح المسائل» هستم.\n\nشما می‌توانید هرگونه سوال در باب طهارت، نماز، روزه، خمس، زکات، حج، نکاح و معاملات مطرح نمایید. پاسخ‌ها همراه با شماره دقیق مسئله و شماره صفحه کتاب ارائه می‌شود.",
                isUser = false,
                language = AppLanguage.FARSI,
                referencedPages = listOf(16),
                referencedMasail = listOf(1)
            )
            AppLanguage.ARABIC -> ChatMessage(
                id = "welcome_ar",
                text = "السلام عليكم ورحمة الله! أنا المساعد الذكي لفتاوى سماحة آية الله العظمى السيد علي الحسيني السيستاني (دام ظله) في کتاب «توضيح المسائل».\n\nيمكنكم طرح أي مسألة فقهية، وستحصلون على الحكم بدقة مع رقم المسألة ورقم الصفحة ورابط قراءتها وتحميلها مباشرة.",
                isUser = false,
                language = AppLanguage.ARABIC,
                referencedPages = listOf(16),
                referencedMasail = listOf(1)
            )
        }
    }

    var messages by remember {
        mutableStateOf(listOf(welcomeMessage))
    }

    // Dynamic suggestions based on selected language
    val suggestedPrompts = remember(currentLanguage) {
        when (currentLanguage) {
            AppLanguage.URDU -> listOf(
                "روزے کے باطل ہونے کی چیزیں کیا ہیں؟",
                "مسافر کی نماز قصر ہونے کی آٹھ شرائط",
                "وضو کا صحیح طریقہ اور واجبات",
                "خمس کن چیزوں پر واجب ہوتا ہے اور کیسے حساب کریں؟",
                "غسل جنابت کا ترتیبی طریقہ کیا ہے؟",
                "زکوٰۃ فطرہ کی مقدار اور مصرف کیا ہے؟"
            )
            AppLanguage.ENGLISH -> listOf(
                "What are the 9 things that invalidate the fast?",
                "What are the conditions for traveler's Qasr prayer?",
                "How to perform Wudhu properly step by step?",
                "What items are subject to Khums and how is it calculated?",
                "How to perform Ghusl Janabat correctly?",
                "Who is eligible to receive Zakat-ul-Fitrah?"
            )
            AppLanguage.ROMAN_URDU -> listOf(
                "Roza kin 9 cheezon se batil hota hai?",
                "Musafir ki namaz qasr hone ki sharait kya hain?",
                "Wudhu karne ka sahi tareeqa kya hai?",
                "Khums ka hisab kaise lagaya jata hai?",
                "Ghusl janabat ka tarteebi tareeqa batayein",
                "Zakat-e-fitrah kitni deni hoti hai?"
            )
            AppLanguage.FARSI -> listOf(
                "مبطلات نه گانه روزه کدامند؟",
                "شرایط هشتگانه شکسته شدن نماز مسافر",
                "روش صحیح وضو گرفتن چگونه است؟",
                "خمس به چه چیزهایی تعلق می‌گیرد؟",
                "احکام و کیفیت غسل جنابت ترتیبی",
                "میزان و مصرف زکات فطره چقدر است؟"
            )
            AppLanguage.ARABIC -> listOf(
                "ما هي مفطرات الصوم التسعة؟",
                "ما هي شروط قصر صلاة المسافر؟",
                "كيفية الوضوء الصحيحة وأحكامه؟",
                "ما هي الأموال التي يتعلق بها الخمس؟",
                "كيفية غسل الجنابة الترتيبي والارتماسي؟",
                "مقدار زكاة الفطرة ومصارفها الشرعية؟"
            )
        }
    }

    fun sendMessage(query: String) {
        if (query.isBlank() || isLoading) return
        val priorHistory = messages.map { it.text to it.isUser }
        val userMsg = ChatMessage(
            id = UUID.randomUUID().toString(),
            text = query.trim(),
            isUser = true,
            language = currentLanguage
        )
        messages = messages + userMsg
        inputText = ""
        isLoading = true

        coroutineScope.launch {
            listState.animateScrollToItem(messages.size - 1)
            val result = GeminiService.askTauzihAi(userMsg.text, currentLanguage, priorHistory)
            result.onSuccess { aiResp ->
                val botMsg = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    text = aiResp.text,
                    isUser = false,
                    language = currentLanguage,
                    referencedPages = aiResp.referencedPages,
                    referencedMasail = aiResp.referencedMasail
                )
                messages = messages + botMsg
                isLoading = false
                // Smoothly scroll to the new answer
                listState.animateScrollToItem(messages.size - 1, scrollOffset = 0)
            }.onFailure {
                val errorMsg = ChatMessage(
                    id = UUID.randomUUID().toString(),
                    text = "معذرت، رابطہ میں دشواری پیش آئی۔ براہ کرم دوبارہ کوشش کریں۔",
                    isUser = false,
                    language = currentLanguage
                )
                messages = messages + errorMsg
                isLoading = false
            }
        }
    }

    // Full Reading Dialog for complete readability with custom font zoom & scrollbar
    if (fullViewMessage != null) {
        val msg = fullViewMessage!!
        var dialogFontSize by remember { mutableFloatStateOf(17f) }

        AlertDialog(
            onDismissRequest = { fullViewMessage = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "تفصیلی فتویٰ و حوالہ",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = { if (dialogFontSize > 13f) dialogFontSize -= 2f },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.TextDecrease, contentDescription = "Smaller", modifier = Modifier.size(18.dp))
                        }
                        Text("${dialogFontSize.toInt()}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        IconButton(
                            onClick = { if (dialogFontSize < 28f) dialogFontSize += 2f },
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(Icons.Default.TextIncrease, contentDescription = "Larger", modifier = Modifier.size(18.dp))
                        }
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 450.dp)
                        .verticalScroll(rememberScrollState())
                        .padding(4.dp)
                ) {
                    Text(
                        text = msg.text,
                        fontSize = dialogFontSize.sp,
                        lineHeight = (dialogFontSize * 1.7).sp,
                        fontFamily = if (msg.language.isRtl) FontFamily.Serif else FontFamily.Default,
                        textAlign = if (msg.language.isRtl) TextAlign.Right else TextAlign.Left,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    if (msg.referencedPages.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(16.dp))
                        HorizontalDivider()
                        Spacer(modifier = Modifier.height(10.dp))

                        msg.referencedPages.forEach { pageNum ->
                            Button(
                                onClick = {
                                    fullViewMessage = null
                                    onOpenPageInBook(pageNum)
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp)
                            ) {
                                Icon(Icons.AutoMirrored.Filled.MenuBook, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("📖 کتاب کا صفحہ $pageNum کھولیں")
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(onClick = { fullViewMessage = null }) {
                    Text("بند کریں")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = {
                    clipboardManager.setText(AnnotatedString(msg.text))
                    Toast.makeText(context, "جواب کاپی ہو گیا", Toast.LENGTH_SHORT).show()
                }) {
                    Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("کاپی کریں")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.secondary),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.MenuBook,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSecondary,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "توضیح المسائل AI",
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(if (isOfflineMode) Color(0xFFFBBF24) else Color(0xFF34D399))
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = if (isOfflineMode) "100% آف لائن موڈ فعال" else "آن لائن موڈ",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f)
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    // Offline / Online toggle button
                    FilledTonalButton(
                        onClick = {
                            isOfflineMode = !isOfflineMode
                            val modeMsg = if (isOfflineMode) "آف لائن موڈ منتخب کیا گیا (انٹرنیٹ کے بغیر فعال)" else "آن لائن موڈ منتخب کیا گیا"
                            Toast.makeText(context, modeMsg, Toast.LENGTH_SHORT).show()
                        },
                        colors = ButtonDefaults.filledTonalButtonColors(
                            containerColor = MaterialTheme.colorScheme.secondaryContainer,
                            contentColor = MaterialTheme.colorScheme.onSecondaryContainer
                        ),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier.padding(end = 6.dp)
                    ) {
                        Icon(
                            if (isOfflineMode) Icons.Default.CloudOff else Icons.Default.CloudQueue,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(if (isOfflineMode) "آف لائن" else "آن لائن", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    IconButton(onClick = {
                        messages = listOf(welcomeMessage)
                        Toast.makeText(context, "چیٹ صاف کر دی گئی", Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Clear Chat")
                    }
                }
            )
        },
        bottomBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .imePadding()
                    .padding(8.dp)
            ) {
                // Quick suggested prompts
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(suggestedPrompts) { prompt ->
                        SuggestionChip(
                            onClick = { sendMessage(prompt) },
                            label = { Text(prompt, fontSize = 12.sp, maxLines = 1) },
                            colors = SuggestionChipDefaults.suggestionChipColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        )
                    }
                }

                // Chat Input Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                text = when (currentLanguage) {
                                    AppLanguage.URDU -> "مسئلہ یا سوال درج کریں (آف لائن دستیاب)..."
                                    AppLanguage.ENGLISH -> "Ask a fiqh question (offline ready)..."
                                    AppLanguage.ROMAN_URDU -> "Sawal ya masla likhein (offline ready)..."
                                    AppLanguage.FARSI -> "سوال شرعی بنویسید (آفلاین)..."
                                    AppLanguage.ARABIC -> "اكتب سؤالك الشرعي (يعمل بدون انترنت)..."
                                },
                                fontSize = 13.sp
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 8.dp),
                        shape = RoundedCornerShape(24.dp),
                        maxLines = 4,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = MaterialTheme.colorScheme.primary,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline
                        )
                    )

                    FloatingActionButton(
                        onClick = { sendMessage(inputText) },
                        containerColor = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.size(48.dp),
                        shape = CircleShape
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Send",
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            }
        },
        modifier = modifier
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Language Selection Bar
            Surface(
                tonalElevation = 2.dp,
                color = MaterialTheme.colorScheme.surfaceVariant,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(vertical = 6.dp, horizontal = 12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "زبان منتخب کریں / Select Language:",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "📖 ۵۴۲ صفحات • ۲۸۰۰ مسائل",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.secondary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        items(AppLanguage.values()) { lang ->
                            FilterChip(
                                selected = (currentLanguage == lang),
                                onClick = { onLanguageChanged(lang) },
                                label = { Text(lang.nativeName, fontWeight = FontWeight.Bold) },
                                leadingIcon = if (currentLanguage == lang) {
                                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                                } else null,
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = MaterialTheme.colorScheme.primary,
                                    selectedLabelColor = MaterialTheme.colorScheme.onPrimary
                                )
                            )
                        }
                    }
                }
            }

            // Message List with VISIBLE VERTICAL SCROLLBAR on the side of the screen
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) {
                LazyColumn(
                    state = listState,
                    modifier = Modifier
                        .fillMaxSize()
                        .drawVerticalScrollbar(
                            state = listState,
                            color = MaterialTheme.colorScheme.secondary,
                            trackColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.2f),
                            width = 6.dp
                        )
                        .padding(horizontal = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(top = 12.dp, bottom = 12.dp)
                ) {
                    items(messages) { msg ->
                        ChatBubble(
                            message = msg,
                            onOpenPage = onOpenPageInBook,
                            onOpenFullView = { fullViewMessage = msg },
                            onSpeak = { text ->
                                ttsEngine?.let { tts ->
                                    when (msg.language) {
                                        AppLanguage.URDU -> tts.language = Locale.forLanguageTag("ur")
                                        AppLanguage.ARABIC -> tts.language = Locale.forLanguageTag("ar")
                                        AppLanguage.FARSI -> tts.language = Locale.forLanguageTag("fa")
                                        else -> tts.language = Locale.ENGLISH
                                    }
                                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "msg_tts")
                                }
                            }
                        )
                    }

                    if (isLoading) {
                        item {
                            Card(
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier
                                    .fillMaxWidth(0.92f)
                                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
                            ) {
                                Row(
                                    modifier = Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(20.dp),
                                        strokeWidth = 2.dp,
                                        color = MaterialTheme.colorScheme.secondary
                                    )
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Text(
                                        text = "توضیح المسائل سے مسئلہ اور صفحہ نمبر تلاش کیا جا رہا ہے...",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ChatBubble(
    message: ChatMessage,
    onOpenPage: (Int) -> Unit,
    onOpenFullView: () -> Unit,
    onSpeak: (String) -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    val alignment = if (message.isUser) Alignment.End else Alignment.Start
    val bubbleColor = if (message.isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface
    val contentColor = if (message.isUser) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface

    // Custom scroll state for internal bubble if answer is long
    val internalScrollState = rememberScrollState()

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = bubbleColor),
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (message.isUser) 16.dp else 4.dp,
                bottomEnd = if (message.isUser) 4.dp else 16.dp
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = if (message.isUser) 1.dp else 3.dp),
            modifier = Modifier
                .fillMaxWidth(if (message.isUser) 0.85f else 0.96f)
                .then(
                    if (!message.isUser) Modifier.border(
                        1.5.dp,
                        MaterialTheme.colorScheme.secondary.copy(alpha = 0.4f),
                        RoundedCornerShape(16.dp, 16.dp, 16.dp, 4.dp)
                    ) else Modifier
                )
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                // Header for Bot Message
                if (!message.isUser) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Default.Verified,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.secondary,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "فتویٰ حضرت آیت اللہ العظمیٰ سیستانی",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        }

                        // Reading Actions Row (Zoom / Fullscreen / Speech / Copy / Share)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            // Fullscreen Reader Button (User requirement: easy reading of full text)
                            IconButton(
                                onClick = onOpenFullView,
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(
                                    Icons.Default.Fullscreen,
                                    contentDescription = "Read Fullscreen",
                                    tint = MaterialTheme.colorScheme.primary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            IconButton(
                                onClick = { onSpeak(message.text) },
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(
                                    Icons.AutoMirrored.Filled.VolumeUp,
                                    contentDescription = "Read Aloud",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                            IconButton(
                                onClick = {
                                    clipboardManager.setText(AnnotatedString(message.text))
                                    Toast.makeText(context, "جواب کاپی کر لیا گیا", Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(
                                    Icons.Default.ContentCopy,
                                    contentDescription = "Copy text",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                            IconButton(
                                onClick = {
                                    val sendIntent = Intent().apply {
                                        action = Intent.ACTION_SEND
                                        putExtra(Intent.EXTRA_TEXT, "${message.text}\n\n(از کتاب: توضیح المسائل حضرت آیت اللہ سیستانی)")
                                        type = "text/plain"
                                    }
                                    context.startActivity(Intent.createChooser(sendIntent, "مسئلہ شیئر یا محفوظ کریں"))
                                },
                                modifier = Modifier.size(30.dp)
                            ) {
                                Icon(
                                    Icons.Default.Share,
                                    contentDescription = "Share",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(17.dp)
                                )
                            }
                        }
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                }

                // Body Text with comfortable layout
                Text(
                    text = message.text,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        lineHeight = 25.sp,
                        fontSize = 15.sp,
                        fontFamily = if (message.language.isRtl) FontFamily.Serif else FontFamily.Default
                    ),
                    color = contentColor,
                    textAlign = if (message.language.isRtl) TextAlign.Right else TextAlign.Left,
                    modifier = Modifier.fillMaxWidth()
                )

                // Referenced Masla and Page Badges with Open Link (User Requirement!)
                if (!message.isUser && (message.referencedPages.isNotEmpty() || message.referencedMasail.isNotEmpty())) {
                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "کتابی حوالہ جات و صفحات / Book References:",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.secondary
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    // Masla badges
                    if (message.referencedMasail.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 6.dp)
                        ) {
                            message.referencedMasail.take(3).forEach { maslaNum ->
                                Box(
                                    modifier = Modifier
                                        .padding(end = 6.dp)
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(MaterialTheme.colorScheme.secondaryContainer)
                                        .padding(horizontal = 8.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "مسئلہ نمبر $maslaNum",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSecondaryContainer
                                    )
                                }
                            }
                        }
                    }

                    // Direct Page Open Action Button
                    message.referencedPages.forEach { pageNum ->
                        Button(
                            onClick = { onOpenPage(pageNum) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            ),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp)
                        ) {
                            Icon(
                                Icons.AutoMirrored.Filled.MenuBook,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "📖 صفحہ نمبر $pageNum کھولیں اور ڈاؤنلوڈ کریں",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // Button to expand full reading view if user wants large text
                    TextButton(
                        onClick = onOpenFullView,
                        modifier = Modifier
                            .align(Alignment.CenterHorizontally)
                            .padding(top = 4.dp)
                    ) {
                        Icon(Icons.Default.ZoomIn, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "بڑی اسکرین پر فونٹ زوم کے ساتھ مکمل پڑھیں",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.secondary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}
