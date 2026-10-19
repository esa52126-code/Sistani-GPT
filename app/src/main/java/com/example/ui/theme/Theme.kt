package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = IslamicEmeraldLight,
    onPrimary = IslamicEmeraldDark,
    primaryContainer = IslamicDarkCard,
    onPrimaryContainer = IslamicGoldLight,
    secondary = IslamicGoldDark,
    onSecondary = Color.Black,
    secondaryContainer = Color(0xFF293B33),
    onSecondaryContainer = IslamicGoldLight,
    background = IslamicDarkBackground,
    onBackground = Color(0xFFE6F4EA),
    surface = IslamicDarkSurface,
    onSurface = Color(0xFFE6F4EA),
    surfaceVariant = IslamicDarkCard,
    onSurfaceVariant = Color(0xFFD1E7DD),
    outline = Color(0xFF2A594D)
)

private val LightColorScheme = lightColorScheme(
    primary = IslamicEmerald,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD1FAE5),
    onPrimaryContainer = IslamicEmeraldDark,
    secondary = IslamicGold,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFFEF3C7),
    onSecondaryContainer = Color(0xFF78350F),
    background = IslamicCream,
    onBackground = Color(0xFF132A22),
    surface = IslamicCardLight,
    onSurface = Color(0xFF132A22),
    surfaceVariant = Color(0xFFF0FDF4),
    onSurfaceVariant = Color(0xFF234E42),
    outline = Color(0xFFB7D5CC)
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Keep distinct Islamic branding consistent
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
