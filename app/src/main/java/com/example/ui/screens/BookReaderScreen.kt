package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AppLanguage
import com.example.data.TauzihDatabase

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookReaderScreen(
    initialPage: Int = 16,
    language: AppLanguage = AppLanguage.URDU,
    onAskAboutTopic: (String) -> Unit = {},
    onBookmarkToggled: (Int, String) -> Unit = { _, _ -> },
    isBookmarked: (Int) -> Boolean = { false },
    modifier: Modifier = Modifier
) {
    var currentPage by remember(initialPage) { mutableIntStateOf(initialPage.coerceIn(1, 542)) }
    var fontSizeSp by remember { mutableFloatStateOf(17f) }
    var showJumpDialog by remember { mutableStateOf(false) }
    var jumpInputText by remember { mutableStateOf("") }
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    val pageData = remember(currentPage) {
        TauzihDatabase.getPage(currentPage)
    }

    val bookmarked = isBookmarked(currentPage)

    if (showJumpDialog) {
        AlertDialog(
            onDismissRequest = { showJumpDialog = false },
            title = {
                Text(
                    text = if (language.isRtl) "صفحہ پر جائیں (1 تا 542)" else "Jump to Page (1 - 542)",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                OutlinedTextField(
                    value = jumpInputText,
                    onValueChange = { jumpInputText = it.filter { ch -> ch.isDigit() } },
                    label = { Text(if (language.isRtl) "صفحہ نمبر" else "Page Number") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val num = jumpInputText.toIntOrNull()
                        if (num != null && num in 1..542) {
                            currentPage = num
                            showJumpDialog = false
                            jumpInputText = ""
                        } else {
                            Toast.makeText(context, "براہ کرم 1 تا 542 کے درمیان صفحہ درج کریں", Toast.LENGTH_SHORT).show()
                        }
                    }
                ) {
                    Text(if (language.isRtl) "کھولیں" else "Open")
                }
            },
            dismissButton = {
                TextButton(onClick = { showJumpDialog = false }) {
                    Text(if (language.isRtl) "منسوخ" else "Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "توضیح المسائل",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                        Text(
                            text = "صفحہ $currentPage از 542  •  ${pageData.chapterTitleUrdu}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.85f),
                            maxLines = 1
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    // Jump to page
                    IconButton(onClick = {
                        jumpInputText = currentPage.toString()
                        showJumpDialog = true
                    }) {
                        Icon(Icons.Default.Numbers, contentDescription = "Jump to page")
                    }
                    // Bookmark
                    IconButton(onClick = {
                        onBookmarkToggled(currentPage, "${pageData.chapterTitleUrdu} (صفحہ $currentPage)")
                        val msg = if (!bookmarked) "صفحہ $currentPage محفوظ کر لیا گیا" else "محفوظات سے ہٹا دیا گیا"
                        Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                    }) {
                        Icon(
                            if (bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                            contentDescription = "Bookmark",
                            tint = if (bookmarked) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onPrimary
                        )
                    }
                    // Share / Download page text
                    IconButton(onClick = {
                        val shareText = "توضیح المسائل - حضرت آیت اللہ العظمیٰ سید علی حسینی سیستانی\nصفحہ: $currentPage\nباب: ${pageData.chapterTitleUrdu}\nمسائل: ${pageData.masailRange}\n\n${pageData.contentUrdu}"
                        val sendIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, shareText)
                            type = "text/plain"
                        }
                        context.startActivity(Intent.createChooser(sendIntent, "صفحہ $currentPage شیئر / ڈاؤنلوڈ کریں"))
                    }) {
                        Icon(Icons.Default.Share, contentDescription = "Share or download page")
                    }
                }
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 6.dp,
                shadowElevation = 8.dp,
                color = MaterialTheme.colorScheme.surface
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    // Slider for fast page scrolling
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "1",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Slider(
                            value = currentPage.toFloat(),
                            onValueChange = { currentPage = it.toInt() },
                            valueRange = 1f..542f,
                            modifier = Modifier
                                .weight(1f)
                                .padding(horizontal = 8.dp),
                            colors = SliderDefaults.colors(
                                thumbColor = MaterialTheme.colorScheme.secondary,
                                activeTrackColor = MaterialTheme.colorScheme.primary
                            )
                        )
                        Text(
                            text = "542",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Navigation Controls & Font Size
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = { if (currentPage > 1) currentPage-- },
                            enabled = currentPage > 1
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Previous Page")
                        }

                        // Text size controls
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { if (fontSizeSp > 13f) fontSizeSp -= 2f }) {
                                Icon(Icons.Default.TextDecrease, contentDescription = "Smaller Text")
                            }
                            Text(
                                text = "${fontSizeSp.toInt()}sp",
                                style = MaterialTheme.typography.labelMedium
                            )
                            IconButton(onClick = { if (fontSizeSp < 28f) fontSizeSp += 2f }) {
                                Icon(Icons.Default.TextIncrease, contentDescription = "Larger Text")
                            }
                        }

                        IconButton(
                            onClick = { if (currentPage < 542) currentPage++ },
                            enabled = currentPage < 542
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "Next Page")
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Page Header Card
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(MaterialTheme.colorScheme.primary)
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "صفحہ نمبر $currentPage",
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Bold,
                                style = MaterialTheme.typography.labelLarge
                            )
                        }

                        AssistChip(
                            onClick = { onAskAboutTopic("وضاحت برائے صفحہ $currentPage: ${pageData.chapterTitleUrdu}") },
                            leadingIcon = {
                                Icon(
                                    Icons.Default.SmartToy,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.secondary,
                                    modifier = Modifier.size(18.dp)
                                )
                            },
                            label = { Text("اس صفحہ پر AI سے پوچھیں", fontSize = 12.sp) }
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = pageData.chapterTitleUrdu,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )

                    Text(
                        text = pageData.masailRange,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.secondary,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            // Main Page Content Book Canvas
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.3f), RoundedCornerShape(16.dp))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
                            fontFamily = FontFamily.Serif,
                            color = MaterialTheme.colorScheme.secondary,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f)
                        )
                        IconButton(
                            onClick = {
                                clipboardManager.setText(AnnotatedString(pageData.contentUrdu))
                                Toast.makeText(context, "صفحہ کا متن کاپی کر لیا گیا", Toast.LENGTH_SHORT).show()
                            },
                            modifier = Modifier.size(36.dp)
                        ) {
                            Icon(Icons.Default.ContentCopy, contentDescription = "Copy text", modifier = Modifier.size(18.dp))
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

                    // Clean text rendering
                    Text(
                        text = pageData.contentUrdu,
                        fontSize = fontSizeSp.sp,
                        lineHeight = (fontSizeSp * 1.75).sp,
                        fontFamily = FontFamily.Serif,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Right,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    HorizontalDivider()

                    Spacer(modifier = Modifier.height(12.dp))

                    // Download / Export Notice
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "مرجع عالی قدر آیت اللہ سید علی سیستانی",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        FilledTonalButton(
                            onClick = {
                                val shareText = "توضیح المسائل - صفحہ $currentPage\n${pageData.chapterTitleUrdu}\n\n${pageData.contentUrdu}"
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_TEXT, shareText)
                                }
                                context.startActivity(Intent.createChooser(intent, "ڈاؤنلوڈ / محفوظ کریں"))
                            },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("محفوظ یا شیئر کریں", fontSize = 12.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Quick Topic Navigation for surrounding chapters
            val surroundingChapter = TauzihDatabase.findChapterForPage(currentPage)
            if (surroundingChapter != null) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            text = "متعلقہ باب: ${surroundingChapter.titleUrdu}",
                            fontWeight = FontWeight.Bold,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "مسائل: ${surroundingChapter.maslaStart} تا ${surroundingChapter.maslaEnd} (صفحات ${surroundingChapter.pageStart} تا ${surroundingChapter.pageEnd})",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }
            }
        }
    }
}
