const {
  IOSConfig,
  withDangerousMod,
  withPodfile,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const POSE_PLUGIN_PKG = 'react-native-mediapipe-pose-plugin';
const HAND_MODEL = 'hand_landmarker.task';
const POSE_MODEL = 'pose_landmarker_full.task';

function resolveModelPath(projectRoot, fileName) {
  const candidates = [
    path.join(projectRoot, 'assets', 'mediapipe', fileName),
    path.join(projectRoot, 'assets', fileName),
    path.join(projectRoot, fileName),
    path.join(projectRoot, 'node_modules', 'expo-vision-camera-v4-mediapipe', HAND_MODEL),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function patchBridgingHeader(contents) {
  const imports = [
    '#import <VisionCamera/FrameProcessorPlugin.h>',
    '#import <VisionCamera/FrameProcessorPluginRegistry.h>',
    '#import <VisionCamera/Frame.h>',
    '#import <VisionCamera/VisionCameraProxyHolder.h>',
  ];
  let next = contents;
  for (const line of imports) {
    if (!next.includes(line)) {
      next = `${next.trimEnd()}\n${line}\n`;
    }
  }
  return next;
}

function patchPoseLandmarkerM(contents, targetName) {
  return contents.replace(
    /#import\s+"[^"]+-Swift\.h"/,
    `#import "${targetName}-Swift.h"`,
  );
}

function mediapipeDedupeSnippet() {
  return `
    duplicate_libs = %w[GTMSessionFetcher GoogleToolboxForMac]
    support_dir = File.join(installer.sandbox.root, 'Target Support Files', 'Pods-YogAI')
    Dir.glob(File.join(support_dir, '*.xcconfig')).each do |xcconfig_path|
      contents = File.read(xcconfig_path)
      duplicate_libs.each do |lib|
        contents = contents.gsub(/-l"#{lib}"\\s*/, '')
        contents = contents.gsub(/"\\$\\{PODS_CONFIGURATION_BUILD_DIR\\}\\/#{lib}"\\s*/, '')
      end
      File.write(xcconfig_path, contents)
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        deployment = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        next if deployment.nil?
        if Gem::Version.new(deployment) < Gem::Version.new('15.5')
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.5'
        end
      end
    end
`;
}

function ensurePodfile(contents) {
  let next = contents;
  if (!next.includes("pod 'MediaPipeTasksVision'")) {
    next = next.replace(
      /use_react_native!\(/,
      "  pod 'MediaPipeTasksVision', '~> 0.10.14'\n\n  use_react_native!(",
    );
  }
  if (!next.includes('strip_mediapipe_duplicate_google_libs')) {
    next = next.sub(
      /def ccache_enabled\?\(podfile_properties\)/,
      `def strip_mediapipe_duplicate_google_libs(installer)${mediapipeDedupeSnippet()}end\n\ndef ccache_enabled?(podfile_properties)`,
    );
  }
  if (!next.includes('strip_mediapipe_duplicate_google_libs(installer)')) {
    next = next.replace(
      /react_native_post_install\(\s*\n\s*installer,/,
      `strip_mediapipe_duplicate_google_libs(installer)\n\n    react_native_post_install(\n      installer,`,
    );
    next = next.replace(
      /:ccache_enabled => ccache_enabled\?\(podfile_properties\),\s*\n\s*\)/,
      `:ccache_enabled => ccache_enabled?(podfile_properties),\n    )`,
    );
  }
  if (!next.includes('MediaPipeTasksVision.xcframework/ios-arm64')) {
    const snippet = `
    xcf_vision = '\${PODS_ROOT}/MediaPipeTasksVision/frameworks/MediaPipeTasksVision.xcframework'
    xcf_common = '\${PODS_ROOT}/MediaPipeTasksCommon/frameworks/MediaPipeTasksCommon.xcframework'
  Dir.glob(File.join(installer.sandbox.root, 'Target Support Files', 'Pods-*', '*.xcconfig')).each do |xcconfig_path|
    xcconfig_contents = File.read(xcconfig_path)
    xcconfig_contents = xcconfig_contents.gsub('-l"MediaPipeTasksCommon"', '-framework "MediaPipeTasksCommon"')
    xcconfig_contents = xcconfig_contents.gsub('-l"MediaPipeTasksVision"', '-framework "MediaPipeTasksVision"')
    unless xcconfig_contents.include?('MediaPipeTasksVision.xcframework/ios-arm64')
      xcconfig_contents += "\\nFRAMEWORK_SEARCH_PATHS = $(inherited) \\"#{xcf_vision}/ios-arm64\\" \\"#{xcf_common}/ios-arm64\\""
    end
    File.write(xcconfig_path, xcconfig_contents)
  end
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |build_config|
      build_config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++20'
      build_config.build_settings['CLANG_CXX_LIBRARY'] = 'libc++'
    end
  end
  Dir.glob(File.join(installer.sandbox.root, 'Target Support Files', '**', '*.xcconfig')).each do |xcconfig_path|
    file_contents = File.read(xcconfig_path)
    patched = file_contents.gsub(/CLANG_CXX_LANGUAGE_STANDARD = (?:"?(?:gnu\\+\\+14|gnu\\+\\+17|c\\+\\+14|c\\+\\+17)"?)/, 'CLANG_CXX_LANGUAGE_STANDARD = c++20')
    File.write(xcconfig_path, patched) if patched != file_contents
  end
`;
    next = next.replace(
      /post_install do \|installer\|/,
      `post_install do |installer|${snippet}`,
    );
  }
  return next;
}

function withMediapipeIosPoseHands(config) {
  config = withPodfile(config, (mod) => {
    mod.modResults.contents = ensurePodfile(mod.modResults.contents);
    return mod;
  });

  config = withDangerousMod(config, [
    'ios',
    async (mod) => {
      const projectRoot = mod.modRequest.projectRoot;
      const iosRoot = mod.modRequest.platformProjectRoot;
      const appName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const appDir = path.join(iosRoot, appName);
      const pluginIos = path.join(projectRoot, 'node_modules', POSE_PLUGIN_PKG, 'ios');

      fs.mkdirSync(appDir, { recursive: true });

      const swiftSrc = path.join(pluginIos, 'PoseLandmarkerPlugin.swift');
      const mSrc = path.join(pluginIos, 'PoseLandmarkerPlugin.m');
      const swiftDest = path.join(appDir, 'PoseLandmarkerPlugin.swift');
      const mDest = path.join(appDir, 'PoseLandmarkerPlugin.m');

      if (fs.existsSync(swiftSrc)) {
        fs.copyFileSync(swiftSrc, swiftDest);
      }
      if (fs.existsSync(mSrc)) {
        const mContent = patchPoseLandmarkerM(
          fs.readFileSync(mSrc, 'utf8'),
          appName,
        );
        fs.writeFileSync(mDest, mContent);
      }

      const bridgingPath = path.join(appDir, `${appName}-Bridging-Header.h`);
      const bridgingContents = fs.existsSync(bridgingPath)
        ? fs.readFileSync(bridgingPath, 'utf8')
        : '';
      fs.writeFileSync(bridgingPath, patchBridgingHeader(bridgingContents));

      for (const modelFile of [HAND_MODEL, POSE_MODEL]) {
        const src = resolveModelPath(projectRoot, modelFile);
        const dest = path.join(appDir, modelFile);
        if (src && (!fs.existsSync(dest) || fs.statSync(src).mtimeMs > fs.statSync(dest).mtimeMs)) {
          fs.copyFileSync(src, dest);
        } else if (!src && !fs.existsSync(dest)) {
          console.warn(
            `[withMediapipeIosPoseHands] Missing ${modelFile}. Run: bash scripts/download-mediapipe-models.sh`,
          );
        }
      }

      return mod;
    },
  ]);

  config = withXcodeProject(config, (mod) => {
    let project = mod.modResults;
    const iosRoot = mod.modRequest.platformProjectRoot;
    const appName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);

    const files = [
      'PoseLandmarkerPlugin.swift',
      'PoseLandmarkerPlugin.m',
      HAND_MODEL,
      POSE_MODEL,
    ];

    for (const file of files) {
      const relative = `${appName}/${file}`;
      if (!fs.existsSync(path.join(iosRoot, appName, file))) continue;
      if (project.hasFile(relative)) continue;
      if (file.endsWith('.task')) {
        project = IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath: relative,
          groupName: appName,
          project,
          isBuildFile: true,
          verbose: false,
        });
      } else {
        project = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath: relative,
          groupName: appName,
          project,
          verbose: false,
        });
      }
    }

    const bridging = `${appName}/${appName}-Bridging-Header.h`;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const item = configurations[key];
      if (typeof item !== 'object' || !item.buildSettings) continue;
      item.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = bridging;
    }

    mod.modResults = project;
    return mod;
  });

  return config;
}

module.exports = withMediapipeIosPoseHands;
