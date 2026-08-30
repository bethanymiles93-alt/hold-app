const { withFinalizedMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Durable fix for one half of the 2026-08-30 launch-crash incident,
 * migrated off a one-off manual post-prebuild patch per direct
 * instruction — must survive `expo prebuild --clean` automatically, not
 * need reapplying.
 *
 * HoldShareExtension's own IPHONEOS_DEPLOYMENT_TARGET, via withFinalizedMod
 * (guaranteed to run after every other mod, per its own doc comment in
 * @expo/config-plugins — confirmed necessary by testing: withDangerousMod
 * runs too EARLY here, before expo-share-extension's own withXcodeProject
 * mod has created the target at all, found by adding debug logging and
 * seeing 0 matches even though the file existed) operating on the raw
 * project.pbxproj text on disk. expo-build-properties'
 * own ios.deploymentTarget option does NOT cover this — it explicitly
 * filters to APPLICATION-type targets only (confirmed by reading its
 * source, node_modules/expo-build-properties/build/ios.js), and
 * HoldShareExtension is an APP_EXTENSION-type target, a different one.
 * expo-share-extension's own plugin hardcodes 15.1 for this target with
 * no config option to change it (plugin/src/xcode/addToXCConfigurationList.ts).
 *
 * The other half — EXPO_USE_PRECOMPILED_MODULES — turned out not to need
 * a custom plugin at all: expo-build-properties has its own built-in
 * `ios.usePrecompiledModules` option (found by reading its source after
 * discovering it was clobbering an earlier, custom withPodfileProperties
 * write here with its own unconditional default of `true`) — set directly
 * in app.json instead. See docs/09-decision-log.md.
 */
const withHoldNativeFixes = (config) => {
  config = withFinalizedMod(config, [
    "ios",
    (config) => {
      const pbxprojPath = path.join(config.modRequest.platformProjectRoot, "Hold.xcodeproj", "project.pbxproj");
      const contents = fs.readFileSync(pbxprojPath, "utf8");
      // Quoted ("15.1") at this point in the pipeline — expo-share-extension's
      // own plugin writes it as a quoted string literal — but unquoted (15.1)
      // once CocoaPods later normalises the file during `pod install`. Match
      // both so this keeps working regardless of exactly when it runs.
      const patched = contents.replace(/IPHONEOS_DEPLOYMENT_TARGET = "?15\.1"?;/g, "IPHONEOS_DEPLOYMENT_TARGET = 16.4;");
      if (patched !== contents) {
        fs.writeFileSync(pbxprojPath, patched);
      }
      return config;
    }
  ]);

  return config;
};

module.exports = withHoldNativeFixes;
