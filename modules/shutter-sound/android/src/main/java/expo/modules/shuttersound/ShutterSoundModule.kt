package expo.modules.shuttersound

import android.media.MediaActionSound
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Plays the phone's own camera shutter sound (on Samsung phones, the Samsung click) instead of
 * expo-camera's short beep. Loaded once so the first press does not lag.
 */
class ShutterSoundModule : Module() {
  private var sound: MediaActionSound? = null

  override fun definition() = ModuleDefinition {
    Name("ShutterSound")

    OnCreate {
      sound = MediaActionSound().apply { load(MediaActionSound.SHUTTER_CLICK) }
    }

    OnDestroy {
      sound?.release()
      sound = null
    }

    Function("play") {
      sound?.play(MediaActionSound.SHUTTER_CLICK)
    }
  }
}
