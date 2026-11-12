package com.example

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.data.AppLanguage
import com.example.data.BookRepository
import com.example.data.Masla
import com.example.ui.ChatViewModel
import com.example.ui.UiStrings
import com.example.ui.screens.BookScreen
import com.example.ui.screens.ChatScreen
import com.example.ui.screens.MaslaActions
import com.example.ui.screens.MaslaSheet
import com.example.ui.screens.SavedScreen
import com.example.ui.strings
import com.example.ui.theme.IslamicEmerald
import com.example.ui.theme.MyApplicationTheme
import com.example.util.Export
import com.example.util.Prefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class AppTab(val icon: ImageVector) {
    CHAT(Icons.AutoMirrored.Filled.Chat),
    BOOK(Icons.Default.AutoStories),
    SAVED(Icons.Default.Bookmark),
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The top bar is always dark emerald, so status bar icons stay light.
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
        setContent {
            MyApplicationTheme {
                MainApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainApp(vm: ChatViewModel = viewModel()) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { Prefs(context.applicationContext) }

    var language by remember { mutableStateOf(prefs.language) }
    val s = strings(language)
    var tab by rememberSaveable { mutableStateOf(AppTab.CHAT) }
    var bookLoaded by remember { mutableStateOf(BookRepository.isLoaded) }
    var savedIds by remember { mutableStateOf(prefs.savedIds) }
    var sheetMasla by remember { mutableStateOf<Masla?>(null) }
    var bookTarget by remember { mutableStateOf<Masla?>(null) }
    var pendingPdfText by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        BookRepository.ensureLoaded(context.applicationContext)
        bookLoaded = true
    }

    val pdfLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        val text = pendingPdfText
        pendingPdfText = null
        if (uri != null && text != null) {
            scope.launch {
                val ok = withContext(Dispatchers.IO) { Export.writePdf(context.applicationContext, uri, text) }
                Toast.makeText(context, if (ok) s.downloaded else s.downloadFailed, Toast.LENGTH_SHORT).show()
            }
        }
    }

    val actions = remember(savedIds, language) {
        MaslaActions(
            isSaved = { it.id in savedIds },
            toggleSave = { m ->
                savedIds = if (m.id in savedIds) savedIds - m.id else listOf(m.id) + savedIds
                prefs.savedIds = savedIds
            },
            askAi = { m ->
                sheetMasla = null
                tab = AppTab.CHAT
                val question = if (m.number > 0) s.explainMasla.format(m.number) else Export.refTitle(m, language)
                vm.send(question, language)
            },
            openInBook = { m ->
                bookTarget = m
                tab = AppTab.BOOK
            },
            download = { text, fileName ->
                pendingPdfText = text
                runCatching { pdfLauncher.launch(fileName) }
                    .onFailure { Toast.makeText(context, s.downloadFailed, Toast.LENGTH_SHORT).show() }
            },
        )
    }

    BackHandler(enabled = tab != AppTab.CHAT) { tab = AppTab.CHAT }

    CompositionLocalProvider(
        LocalLayoutDirection provides if (language.isRtl) LayoutDirection.Rtl else LayoutDirection.Ltr
    ) {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(s.appTitle, fontWeight = FontWeight.Bold, fontSize = 19.sp, maxLines = 1)
                            Text(s.subtitle, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = IslamicEmerald,
                        titleContentColor = Color.White,
                        actionIconContentColor = Color.White,
                    ),
                    actions = {
                        LanguageMenu(language, s) {
                            language = it
                            prefs.language = it
                        }
                        if (tab == AppTab.CHAT) {
                            ChatMenu(
                                s = s,
                                hasMessages = vm.messages.any { !it.isUser },
                                onNewChat = { vm.clear() },
                                onDownloadChat = {
                                    actions.download(Export.chatText(vm.messages.toList(), s), "tauzih-chat.pdf")
                                },
                            )
                        }
                    },
                )
            },
            bottomBar = {
                NavigationBar {
                    AppTab.entries.forEach { t ->
                        val label = when (t) {
                            AppTab.CHAT -> s.tabChat
                            AppTab.BOOK -> s.tabBook
                            AppTab.SAVED -> s.tabSaved
                        }
                        NavigationBarItem(
                            selected = tab == t,
                            onClick = { tab = t },
                            icon = { Icon(t.icon, contentDescription = label) },
                            label = { Text(label, fontSize = 12.sp, maxLines = 1) },
                            modifier = Modifier.testTag("nav_${t.name.lowercase()}"),
                        )
                    }
                }
            },
        ) { innerPadding ->
            val contentModifier = Modifier
                .padding(innerPadding)
                .consumeWindowInsets(innerPadding)
                .imePadding()
            if (!bookLoaded) {
                Box(contentModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator()
                        Spacer(Modifier.height(12.dp))
                        Text(s.loadingBook)
                    }
                }
            } else {
                when (tab) {
                    AppTab.CHAT -> ChatScreen(vm, language, s, actions, onShowReference = { sheetMasla = it }, modifier = contentModifier)
                    AppTab.BOOK -> BookScreen(language, s, actions, bookTarget, { bookTarget = null }, contentModifier)
                    AppTab.SAVED -> SavedScreen(
                        saved = remember(savedIds) { savedIds.mapNotNull { BookRepository.byId(it) } },
                        language = language,
                        s = s,
                        actions = actions,
                        modifier = contentModifier,
                    )
                }
            }
        }

        sheetMasla?.let { m ->
            MaslaSheet(m, language, s, actions, onDismiss = { sheetMasla = null })
        }
    }
}

@Composable
private fun LanguageMenu(current: AppLanguage, s: UiStrings, onSelect: (AppLanguage) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        TextButton(onClick = { open = true }, modifier = Modifier.testTag("language_button")) {
            Icon(Icons.Default.Language, contentDescription = s.language, tint = Color.White)
            Text(" " + current.nativeName, color = Color.White, fontSize = 14.sp)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            AppLanguage.entries.forEach { lang ->
                DropdownMenuItem(
                    text = { Text(lang.nativeName, fontWeight = if (lang == current) FontWeight.Bold else FontWeight.Normal) },
                    onClick = {
                        open = false
                        onSelect(lang)
                    },
                    modifier = Modifier.testTag("language_${lang.code}"),
                )
            }
        }
    }
}

@Composable
private fun ChatMenu(s: UiStrings, hasMessages: Boolean, onNewChat: () -> Unit, onDownloadChat: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }) { Icon(Icons.Default.MoreVert, contentDescription = null) }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(s.newChat) },
                leadingIcon = { Icon(Icons.Default.Add, contentDescription = null) },
                onClick = {
                    open = false
                    onNewChat()
                },
            )
            DropdownMenuItem(
                text = { Text(s.downloadChat) },
                leadingIcon = { Icon(Icons.Default.Download, contentDescription = null) },
                enabled = hasMessages,
                onClick = {
                    open = false
                    onDownloadChat()
                },
            )
        }
    }
}
