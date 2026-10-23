import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "web-splash/dist");
// git이 추적하는 원본. prebuild 때 plugins/withSplashWebAsset.js가 Android·iOS 프로젝트에 넣는다.
const target = resolve(root, "assets/web/splash");
// 이미 만들어진 로컬 android/에도 바로 반영해 prebuild 없이 빌드할 수 있게 한다.
const androidTarget = resolve(root, "android/app/src/main/assets/splash");

if (!existsSync(source)) {
  throw new Error("web-splash/dist가 없습니다. 먼저 web-splash를 빌드하세요.");
}

mkdirSync(dirname(target), { recursive: true });
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const htmlPath = resolve(source, "index.html");
const html = readFileSync(htmlPath, "utf8");
const scriptPath = html.match(/<script[^>]+src="\.\/(.*?)"[^>]*><\/script>/)?.[1];
const stylePath = html.match(/<link[^>]+href="\.\/(.*?)"[^>]*>/)?.[1];

if (!scriptPath || !stylePath) {
  throw new Error("빌드된 스플래시의 JavaScript 또는 CSS 경로를 찾지 못했습니다.");
}

const embedPng = (filename) => {
  const image = readFileSync(resolve(source, filename)).toString("base64");
  return `data:image/png;base64,${image}`;
};

const script = readFileSync(resolve(source, scriptPath), "utf8")
  .replaceAll("./field24-scene-v3.png", embedPng("field24-scene-v3.png"));
const scriptDataUrl = `data:text/javascript;base64,${Buffer.from(script).toString("base64")}`;
const style = readFileSync(resolve(source, stylePath), "utf8").replaceAll(
  "../field-barlow-bold.woff2",
  `data:font/woff2;base64,${readFileSync(resolve(source, "field-barlow-bold.woff2")).toString("base64")}`,
);
const standaloneHtml = html
  .replace(/<script[^>]+src="\.\/.*?"[^>]*><\/script>/, "")
  .replace(/<link[^>]+href="\.\/.*?"[^>]*>/, `<style>${style}</style>`)
  .replace(
    "</body>",
    `<script type="module" src="${scriptDataUrl}"></script></body>`,
  );

writeFileSync(resolve(target, "index.html"), standaloneHtml);
console.log(`Splash assets synced to ${target}`);

if (existsSync(resolve(root, "android"))) {
  mkdirSync(androidTarget, { recursive: true });
  writeFileSync(resolve(androidTarget, "index.html"), standaloneHtml);
  console.log(`Splash assets synced to ${androidTarget}`);
}
