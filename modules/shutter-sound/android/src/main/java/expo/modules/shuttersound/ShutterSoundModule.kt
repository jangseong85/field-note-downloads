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
 *
 * The click is marked audibility-enforced, the same channel camera shutters use, so it still plays
 * when the phone is on silent or vibrate (the plain system stream is muted then). Loaded once so the
 * first press does not lag; if loading is not finished yet, the press plays as soon as it is.
 */
class ShutterSoundModule : Module() {
  private var pool: SoundPool? = null
  private var click = 0
  private var loaded = false
  private var playWhenLoaded = false

  private fun ensurePool(): SoundPool? {
    pool?.let { return it }
    val context = appContext.reactContext ?: return null
    return SoundPool.Builder()
      .setMaxStreams(1)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
          .build(),
      )
      .build()
      .also { created ->
        created.setOnLoadCompleteListener { soundPool, id, status ->
          loaded = status == 0
          if (loaded && playWhenLoaded) {
            playWhenLoaded = false
            soundPool.play(id, VOLUME, VOLUME, 1, 0, 1f)
          }
        }
        click = created.load(context, R.raw.soft_shutter, 1)
        pool = created
      }
  }

  override fun definition() = ModuleDefinition {
    Name("ShutterSound")

    OnCreate {
      ensurePool()
    }

    OnDestroy {
      pool?.release()
      pool = null
      loaded = false
    }

    Function("play") {
      val soundPool = ensurePool() ?: return@Function null
      if (loaded) soundPool.play(click, VOLUME, VOLUME, 1, 0, 1f) else playWhenLoaded = true
    }
  }
}
