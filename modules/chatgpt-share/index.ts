import { requireOptionalNativeModule } from "expo";

type ChatGptShareModule = {
  isInstalled(): boolean;
  /** Opens ChatGPT with the image and prompt; the prompt is also copied to the clipboard. */
  share(contentUri: string, prompt: string): Promise<void>;
};

/** Android only; null on iOS and in builds made before this module was added. */
export default requireOptionalNativeModule<ChatGptShareModule>("ChatGptShare");
