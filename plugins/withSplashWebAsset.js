const fs = require("fs");
const path = require("path");
const { IOSConfig, WarningAggregator, withDangerousMod, withXcodeProject } = require("expo/config-plugins");

// scripts/sync-web-splash.mjs가 만드는 단일 HTML 스플래시를 prebuild 때 양쪽 네이티브 프로젝트에 넣는다.
// App.tsx의 SPLASH_URI와 경로를 맞춘다.
const SOURCE = "assets/web/splash/index.html";
const IOS_FILE = "field24-splash.html";

// The splash bundles React Bits Pro code, so it is not in git. A checkout without it still builds:
// the app skips the intro when the page fails to load (App.tsx onError).
function source(config) {
  const file = path.join(config.modRequest.projectRoot, SOURCE);
  if (fs.existsSync(file)) return file;
  WarningAggregator.addWarningAndroid?.("withSplashWebAsset", `${SOURCE} 없음 - 스플래시 없이 빌드합니다 (npm run splash:build).`);
  WarningAggregator.addWarningIOS?.("withSplashWebAsset", `${SOURCE} 없음 - 스플래시 없이 빌드합니다 (npm run splash:build).`);
  return null;
}

function withSplashAndroid(config) {
  return withDangerousMod(config, [
    "android",
    async (configWithMod) => {
      const file = source(configWithMod);
      if (!file) return configWithMod;
      const target = path.join(configWithMod.modRequest.platformProjectRoot, "app/src/main/assets/splash/index.html");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, target);
      return configWithMod;
    },
  ]);
}

function withSplashIos(config) {
  return withXcodeProject(config, async (configWithProject) => {
    const file = source(configWithProject);
    if (!file) return configWithProject;
    const { projectRoot, platformProjectRoot } = configWithProject.modRequest;
    const target = path.join(IOSConfig.Paths.getSourceRoot(projectRoot), IOS_FILE);
    fs.copyFileSync(file, target);
    const project = configWithProject.modResults;
    const filepath = path.relative(platformProjectRoot, target);
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, "Resources");
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({ filepath, groupName: "Resources", project, isBuildFile: true });
    }
    return configWithProject;
  });
}

module.exports = function withSplashWebAsset(config) {
  return withSplashIos(withSplashAndroid(config));
};
