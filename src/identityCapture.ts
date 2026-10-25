import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { expandGuide, guideToPhotoCrop, type Frame } from "./cameraCrop";
import { extractIdentityFromOcr, findIdentityRegion, findNameLineFrame, nameFromLineCrop, voteName } from "./idDate";
import { formatTimestamp, koreanNowParts } from "./dateTime";
import type { IdDocument } from "./patientWorkspace";

type Identity = { document: IdDocument; gender: string | null };

export async function captureIdentityDocument(
  photoUri: string,
  viewport: { width: number; height: number },
  guide: Frame,
  commit: (identity: Identity) => Promise<void>,
  cleanup: (uris: string[]) => Promise<void>,
): Promise<Identity> {
  const pendingFiles = new Set([photoUri]);
  try {
    if (!FileSystem.documentDirectory) throw new Error("저장소를 사용할 수 없습니다.");
    // CameraView는 세로 화면을 채우기 위해 센서 사진의 좌우를 잘라 보여 줍니다.
    // 화면의 카드 가이드와 같은 중앙 영역만 먼저 잘라 OCR에 전달하면 글자가 훨씬 크게 들어옵니다.
    const capturedSource = await ImageManipulator.ImageManipulator.manipulate(
      photoUri,
    ).renderAsync();
    const crop = guideToPhotoCrop(capturedSource, viewport, expandGuide(guide, viewport));
    const preparedContext = ImageManipulator.ImageManipulator.manipulate(photoUri);
    preparedContext.crop(crop);
    if (crop.width < 1800)
      preparedContext.resize({ width: 1800, height: null });
    const preparedRef = await preparedContext.renderAsync();
    const preparedImage = await preparedRef.saveAsync({
      compress: 1,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const imageUri = preparedImage.uri;
    pendingFiles.add(imageUri);
    const documentsDirectory = `${FileSystem.documentDirectory}identity-documents/`;
    await FileSystem.makeDirectoryAsync(documentsDirectory, {
      intermediates: true,
    });
    const savedUri = `${documentsDirectory}id-${Date.now()}.jpg`;
    pendingFiles.add(savedUri);
    await FileSystem.copyAsync({ from: imageUri, to: savedUri });
    const { recognizeText } =
      await import("@infinitered/react-native-mlkit-text-recognition");
    const result = await recognizeText(savedUri);
    let identity = extractIdentityFromOcr(result);
    const fullName = identity.name;
    let focusedName: string | null = null;
    const region = findIdentityRegion(result);
    if (region) {
      const source =
        await ImageManipulator.ImageManipulator.manipulate(
          savedUri,
        ).renderAsync();
      const originX = Math.max(0, Math.floor(region.left));
      const originY = Math.max(0, Math.floor(region.top));
      const width = Math.max(
        1,
        Math.min(
          source.width - originX,
          Math.ceil(region.right - region.left),
        ),
      );
      const height = Math.max(
        1,
        Math.min(
          source.height - originY,
          Math.ceil(region.bottom - region.top),
        ),
      );
      const context = ImageManipulator.ImageManipulator.manipulate(savedUri);
      context.crop({ originX, originY, width, height });
      if (width < 1500) context.resize({ width: 1500, height: null });
      const croppedRef = await context.renderAsync();
      const croppedImage = await croppedRef.saveAsync({
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      pendingFiles.add(croppedImage.uri);
      const focusedResult = await recognizeText(croppedImage.uri);
      const focusedIdentity = extractIdentityFromOcr(focusedResult);
      focusedName = focusedIdentity.name;
      identity = {
        name: focusedIdentity.name ?? identity.name,
        birthDate: focusedIdentity.birthDate ?? identity.birthDate,
        gender: focusedIdentity.gender ?? identity.gender,
      };
    }
    // Small licence print is often misread glyph by glyph: re-read only the name line, enlarged,
    // then take the majority of the three independent reads (enlarged line first on ties).
    const nameFrame = findNameLineFrame(result);
    if (nameFrame) {
      const source = await ImageManipulator.ImageManipulator.manipulate(savedUri).renderAsync();
      const lineHeight = Math.max(1, nameFrame.bottom - nameFrame.top);
      const originX = Math.max(0, Math.floor(nameFrame.left - lineHeight * 1.2));
      const originY = Math.max(0, Math.floor(nameFrame.top - lineHeight * 0.6));
      const width = Math.max(1, Math.min(source.width - originX, Math.ceil(nameFrame.right - nameFrame.left + lineHeight * 2.4)));
      const height = Math.max(1, Math.min(source.height - originY, Math.ceil(lineHeight * 2.2)));
      // Two enlargements: ML Kit drops different syllables at different scales.
      const lineReads: (string | null)[] = [];
      for (const target of [400, 240]) {
        const context = ImageManipulator.ImageManipulator.manipulate(savedUri);
        context.crop({ originX, originY, width, height });
        if (height < target) context.resize({ width: null, height: target });
        const lineRef = await context.renderAsync();
        const lineImage = await lineRef.saveAsync({ compress: 1, format: ImageManipulator.SaveFormat.JPEG });
        pendingFiles.add(lineImage.uri);
        lineReads.push(nameFromLineCrop(await recognizeText(lineImage.uri)));
      }
      const voted = voteName([...lineReads, focusedName, fullName]);
      identity = { ...identity, name: voted ?? identity.name };
    }
    const now = koreanNowParts();
    const value = { document: { uri: savedUri, name: identity.name, birthDate: identity.birthDate, capturedAt: formatTimestamp(now.date, now.time) }, gender: identity.gender };
    await commit(value);
    pendingFiles.delete(savedUri);
    return value;
  } finally {
    await cleanup([...pendingFiles]);
  }
}
