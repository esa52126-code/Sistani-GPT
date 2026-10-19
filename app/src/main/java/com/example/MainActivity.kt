package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.ListAlt
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.AppLanguage
import com.example.data.BookmarkItem
import com.example.ui.screens.BookReaderScreen
import com.example.ui.screens.BookmarksScreen
import com.example.ui.screens.ChatScreen
import com.example.ui.screens.TopicsScreen
import com.example.ui.theme.MyApplicationTheme
import java.util.UUID

enum class AppScreen(val titleUrdu: String, val titleEnglish: String, val icon: ImageVector) {
    CHAT("AI سوال و جواب", "AI Chat", Icons.AutoMirrored.Filled.Chat),
    READER("کتاب پڑھیں", "Book Reader", Icons.Default.AutoStories),
    TOPICS("فہارس و ابواب", "Chapters", Icons.AutoMirrored.Filled.ListAlt),
    BOOKMARKS("محفوظات", "Bookmarks", Icons.Default.Bookmark)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                MainApp()
            }
        }
    }
}

@Composable
fun MainApp() {
    var currentScreen by remember { mutableStateOf(AppScreen.CHAT) }
    var previousScreen by remember { mutableStateOf(AppScreen.CHAT) }
    var currentLanguage by remember { mutableStateOf(AppLanguage.URDU) }
    var readerInitialPage by remember { mutableIntStateOf(16) }
    var bookmarks by remember {
        mutableStateOf(
            listOf(
                BookmarkItem(
                    id = UUID.randomUUID().toString(),
                    pageNumber = 16,
                    maslaNumber = 1,
                    title = "احکام تقلید (مسئلہ 1)",
                    previewText = "ہر مسلمان کے لئے اصول دین کو از روئے بصیرت جاننا ضروری ہے..."
                ),
                BookmarkItem(
                    id = UUID.randomUUID().toString(),
                    pageNumber = 298,
                    maslaNumber = 1581,
                    title = "مبطلات روزہ (نو چیزیں)",
                    previewText = "چند چیزیں روزے کو باطل کر دیتی ہیں: کھانا پینا، جماع..."
                ),
                BookmarkItem(
                    id = UUID.randomUUID().toString(),
                    pageNumber = 251,
                    maslaNumber = 1280,
                    title = "مسافر کی نماز قصر",
                    previewText = "مسافر کے سفر کی آٹھ شرائط اور 44 کلومیٹر (8 فرسخ)..."
                )
            )
        )
    }

    // Handle back button for secondary screens
    if (currentScreen != AppScreen.CHAT) {
        BackHandler {
            currentScreen = AppScreen.CHAT
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 6.dp
            ) {
                AppScreen.values().forEach { screen ->
                    val selected = (currentScreen == screen)
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            if (currentScreen != screen) {
                                previousScreen = currentScreen
                                currentScreen = screen
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = screen.icon,
                                contentDescription = screen.titleEnglish
                            )
                        },
                        label = {
                            Text(
                                text = if (currentLanguage.isRtl) screen.titleUrdu else screen.titleEnglish,
                                fontSize = 11.sp,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.onPrimary,
                            indicatorColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary
                        ),
                        modifier = Modifier.testTag("nav_item_${screen.name.lowercase()}")
                    )
                }
            }
        },
        modifier = Modifier.fillMaxSize()
    ) { innerPadding ->
        when (currentScreen) {
            AppScreen.CHAT -> {
                ChatScreen(
                    currentLanguage = currentLanguage,
                    onLanguageChanged = { currentLanguage = it },
                    onOpenPageInBook = { pageNum ->
                        readerInitialPage = pageNum
                        previousScreen = AppScreen.CHAT
                        currentScreen = AppScreen.READER
                    },
                    modifier = Modifier.padding(innerPadding)
                )
            }
            AppScreen.READER -> {
                BookReaderScreen(
                    initialPage = readerInitialPage,
                    language = currentLanguage,
                    onAskAboutTopic = { query ->
                        currentScreen = AppScreen.CHAT
                    },
                    onBookmarkToggled = { pageNum, title ->
                        val existing = bookmarks.find { it.pageNumber == pageNum }
                        bookmarks = if (existing != null) {
                            bookmarks.filter { it.pageNumber != pageNum }
                        } else {
                            bookmarks + BookmarkItem(
                                id = UUID.randomUUID().toString(),
                                pageNumber = pageNum,
                                title = title,
                                previewText = "صفحہ نمبر $pageNum محفوظ شدہ"
                            )
                        }
                    },
                    isBookmarked = { pageNum ->
                        bookmarks.any { it.pageNumber == pageNum }
                    },
                    modifier = Modifier.padding(innerPadding)
                )
            }
            AppScreen.TOPICS -> {
                TopicsScreen(
                    language = currentLanguage,
                    onOpenPageInBook = { pageNum ->
                        readerInitialPage = pageNum
                        previousScreen = AppScreen.TOPICS
                        currentScreen = AppScreen.READER
                    },
                    onAskAboutTopic = { topicText ->
                        currentScreen = AppScreen.CHAT
                    },
                    modifier = Modifier.padding(innerPadding)
                )
            }
            AppScreen.BOOKMARKS -> {
                BookmarksScreen(
                    bookmarks = bookmarks,
                    language = currentLanguage,
                    onOpenPageInBook = { pageNum ->
                        readerInitialPage = pageNum
                        previousScreen = AppScreen.BOOKMARKS
                        currentScreen = AppScreen.READER
                    },
                    onRemoveBookmark = { bookmarkId ->
                        bookmarks = bookmarks.filter { it.id != bookmarkId }
                    },
                    modifier = Modifier.padding(innerPadding)
                )
            }
        }
    }
}
