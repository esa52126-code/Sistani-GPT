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
import com.example.data.BookRepository
import androidx.compose.foundation.Image
import androidx.compose.foundation.horizontalScroll
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

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
    var zoom by remember { mutableFloatStateOf(1f) }
    var showJumpDialog by remember { mutableStateOf(false) }
    var jumpInputText by remember { mutableStateOf("") }
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    val pageData = remember(currentPage) {
        TauzihDatabase.getPage(currentPage)
    }

    val bookmarked = isBookmarked(currentPage)
    val masailRangeText by produceState(initialValue = "", currentPage) {
        value = withContext(Dispatchers.IO) {
            BookRepository.masailOnPage(context, currentPage)?.let { "مسائل تقریباً ${it.first} تا ${it.last}" } ?: ""
        }
    }

    fun sharePageImage() {
        try {
            val bytes = BookRepository.pageJpeg(context, currentPage, 1400, 90) ?: return
            val dir = File(context.cacheDir, "shared").apply { mkdirs() }
            val file = File(dir, "tauzih_page_$currentPage.jpg")
            file.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "image/jpeg"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, "توضیح المسائل (آیت اللہ سیستانی) — صفحہ $currentPage")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(intent, "صفحہ $currentPage شیئر / محفوظ کریں"))
        } catch (e: Exception) {
            Toast.makeText(context, "شیئر نہیں ہو سکا: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

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
                    IconButton(onClick = { sharePageImage() }) {
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
                            IconButton(onClick = { if (zoom > 1f) zoom -= 0.25f }) {
                                Icon(Icons.Default.ZoomOut, contentDescription = "Zoom out")
                            }
                            Text(
                                text = "${(zoom * 100).toInt()}%",
                                style = MaterialTheme.typography.labelMedium
                            )
                            IconButton(onClick = { if (zoom < 3f) zoom += 0.25f }) {
                                Icon(Icons.Default.ZoomIn, contentDescription = "Zoom in")
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
                        text = masailRangeText,
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
                Column(modifier = Modifier.padding(8.dp)) {
                    BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                        val density = LocalDensity.current
                        val boxWidth = maxWidth
                        val baseWidthPx = with(density) { maxWidth.toPx() }.toInt()
                        val bitmap by produceState<android.graphics.Bitmap?>(initialValue = null, currentPage, zoom, baseWidthPx) {
                            value = withContext(Dispatchers.IO) {
                                BookRepository.renderPage(context, currentPage, (baseWidthPx * zoom * 1.5f).toInt())
                            }
                        }
                        val bmp = bitmap
                        if (bmp == null) {
                            Box(
                                modifier = Modifier.fillMaxWidth().height(400.dp),
                                contentAlignment = Alignment.Center
                            ) { CircularProgressIndicator() }
                        } else {
                            Box(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())) {
                                Image(
                                    bitmap = bmp.asImageBitmap(),
                                    contentDescription = "صفحہ $currentPage",
                                    contentScale = ContentScale.FillWidth,
                                    modifier = Modifier.width(boxWidth * zoom)
                                )
                            }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "اصل کتاب کا صفحہ $currentPage",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        FilledTonalButton(
                            onClick = { sharePageImage() },
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
