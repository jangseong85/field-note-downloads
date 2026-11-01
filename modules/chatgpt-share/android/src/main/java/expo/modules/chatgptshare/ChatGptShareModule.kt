package expo.modules.chatgptshare

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHATGPT_PACKAGE = "com.openai.chatgpt"

/**
 * Hands the prescription images and the analysis prompt straight to the ChatGPT app. React Native's Share
 * cannot pin a package, so it would open the system chooser instead.
 */
class ChatGptShareModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ChatGptShare")

    Function("isInstalled") {
      try {
        context.packageManager.getPackageInfo(CHATGPT_PACKAGE, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    AsyncFunction("share") { contentUris: List<String>, prompt: String ->
      val uris = contentUris.map(Uri::parse)
      if (uris.isEmpty()) throw IllegalArgumentException("No image to share")
      // Some ChatGPT versions ignore EXTRA_TEXT; the prompt is also on the clipboard to paste.
      val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newPlainText("처방전 분석 프롬프트", prompt))
      // ChatGPT registers SEND_MULTIPLE for images, so several prescriptions go in one message.
      val intent = Intent(if (uris.size > 1) Intent.ACTION_SEND_MULTIPLE else Intent.ACTION_SEND).apply {
        type = "image/jpeg"
        setPackage(CHATGPT_PACKAGE)
        if (uris.size > 1) putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
        else putExtra(Intent.EXTRA_STREAM, uris[0])
        putExtra(Intent.EXTRA_TEXT, prompt)
        // ClipData carries the read grant for every content URI on Android 10+.
        clipData = ClipData.newRawUri("", uris[0]).apply { uris.drop(1).forEach { addItem(ClipData.Item(it)) } }
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }
}
