package com.example.network

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.security.MessageDigest

/**
 * Package name and signing-certificate SHA-1 of this app. Sent as the
 * X-Android-Package / X-Android-Cert headers so a Gemini API key restricted
 * to this Android app (in Google Cloud console) is accepted only from it.
 */
object AppIdentity {
    @Volatile var packageName: String = ""
        private set
    @Volatile var certSha1: String = ""
        private set

    fun init(context: Context) {
        packageName = context.packageName
        certSha1 = try {
            val pm = context.packageManager
            val sig = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val info = pm.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                val si = info.signingInfo
                if (si == null) null
                else if (si.hasMultipleSigners()) si.apkContentsSigners.firstOrNull()
                else si.signingCertificateHistory.lastOrNull()
            } else {
                @Suppress("DEPRECATION")
                pm.getPackageInfo(packageName, PackageManager.GET_SIGNATURES).signatures?.firstOrNull()
            }
            sig?.let { s ->
                MessageDigest.getInstance("SHA-1").digest(s.toByteArray()).joinToString("") { "%02X".format(it) }
            } ?: ""
        } catch (e: Exception) {
            ""
        }
    }
}
