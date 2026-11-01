import { requireOptionalNativeModule } from "expo";

type ShutterSoundModule = {
  /** The phone's camera shutter click. */
  play(): void;
};

/** Android only; null on iOS and in builds made before this module was added. */
export default requireOptionalNativeModule<ShutterSoundModule>("ShutterSound");
