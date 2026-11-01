package expo.modules.shuttersound

import android.media.AudioAttributes
import android.media.SoundPool
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Below full volume so the click is heard without startling the patient. */
private const val VOLUME = 0.45f

/**
 * Plays a short, soft shutter click (res/raw/soft_shutter.wav) instead of expo-camera's beep. The
 * system shutter sound was too sharp and loud on Korean phones, where its volume cannot be lowered.
 * Loaded once so the first press does not lag.
 */
class ShutterSoundModule : Module() {
  private var pool: SoundPool? = null
  private var click = 0

  override fun definition() = ModuleDefinition {
    Name("ShutterSound")

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      pool = SoundPool.Builder()
        .setMaxStreams(1)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        .build()
        .also { click = it.load(context, R.raw.soft_shutter, 1) }
    }

    OnDestroy {
      pool?.release()
      pool = null
    }

    Function("play") {
      pool?.play(click, VOLUME, VOLUME, 1, 0, 1f)
    }
  }
}
