const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'com.stingray.dave',
    appCopyright: 'Copyright © 2025 StingRay Software',
    appVersion: process.env.BUILD_VERSION || '2.0.0',
    buildVersion: process.env.BUILD_NUMBER || '1',
    name: 'DAVE',
    executableName: 'dave',
    icon: path.join(__dirname, '../../resources/static/img/icon'),
    appCategoryType: 'public.app-category.education',
    osxSign: {
      identity: process.env.APPLE_IDENTITY,
      hardenedRuntime: true,
      'gatekeeper-assess': false,
      entitlements: path.join(__dirname, 'build/entitlements.mac.plist'),
      'entitlements-inherit': path.join(__dirname, 'build/entitlements.mac.plist'),
    },
    osxNotarize: process.env.APPLE_ID ? {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    } : undefined,
    // Include all necessary files
    extraResource: [
      path.join(__dirname, '../../resources'),
      path.join(__dirname, '../../python'),
    ],
    ignore: [
      /^\/src/,
      /^\/test/,
      /\.gitignore$/,
      /\.git$/,
      /\.github$/,
      /\.vscode$/,
      /node_modules\/\.bin/,
      /__pycache__/,
      /\.pyc$/,
      /\.pyo$/,
      /\.pytest_cache/,
      /\.coverage/,
      /\.eggs/,
      /\.tox/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'DAVE',
        authors: 'StingRay Software',
        exe: 'dave.exe',
        description: 'DAVE Data Analysis Tool',
        iconUrl: 'https://raw.githubusercontent.com/StingraySoftware/dave/master/src/main/resources/static/img/icon.ico',
        setupIcon: path.join(__dirname, '../../resources/static/img/icon.ico'),
        loadingGif: path.join(__dirname, '../../resources/static/img/loading.gif'),
        noMsi: true,
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
      config: {
        // ZIP maker config
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'dave',
          productName: 'DAVE',
          genericName: 'Data Analysis Tool',
          description: 'DAVE Data Analysis Tool',
          productDescription: 'Desktop GUI for astronomical X-ray data analysis',
          categories: ['Science', 'Astronomy', 'DataVisualization'],
          section: 'science',
          priority: 'optional',
          maintainer: 'StingRay Software',
          homepage: 'https://github.com/StingraySoftware/dave',
          icon: path.join(__dirname, '../../resources/static/img/icon/512x512.png'),
          bin: 'dave',
          mimeType: ['application/x-dave-project'],
          depends: [],
          recommends: [],
          suggests: [],
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'dave',
          productName: 'DAVE',
          genericName: 'Data Analysis Tool',
          description: 'DAVE Data Analysis Tool',
          productDescription: 'Desktop GUI for astronomical X-ray data analysis',
          categories: ['Science', 'Astronomy', 'DataVisualization'],
          license: 'Apache-2.0',
          homepage: 'https://github.com/StingraySoftware/dave',
          icon: path.join(__dirname, '../../resources/static/img/icon/512x512.png'),
          bin: 'dave',
          mimeType: ['application/x-dave-project'],
          requires: [],
          compressionLevel: 9,
        },
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'DAVE',
        title: 'DAVE Data Analysis',
        icon: path.join(__dirname, '../../resources/static/img/icon.icns'),
        format: 'ULFO',
        additionalDMGOptions: {
          window: {
            size: {
              width: 600,
              height: 400,
            },
            position: {
              x: 200,
              y: 200,
            },
          },
        },
        contents: [
          {
            x: 140,
            y: 220,
            type: 'file',
            path: path.join(__dirname, `out/DAVE-darwin-${process.arch}/DAVE.app`),
          },
          {
            x: 460,
            y: 220,
            type: 'link',
            path: '/Applications',
          },
        ],
      },
    },
    {
      name: '@electron-forge/maker-flatpak',
      config: {
        options: {
          id: 'com.stingray.dave',
          productName: 'DAVE',
          genericName: 'Data Analysis Tool',
          description: 'DAVE Data Analysis',
          categories: ['Science', 'Astronomy'],
          icon: path.join(__dirname, '../../resources/static/img/icon/512x512.png'),
          runtime: 'org.freedesktop.Platform',
          runtimeVersion: '22.08',
          sdk: 'org.freedesktop.Sdk',
          base: 'org.electronjs.Electron2.BaseApp',
          baseVersion: '22.08',
          branch: 'stable',
          finishArgs: [
            '--socket=x11',
            '--socket=wayland',
            '--device=dri',
            '--share=network',
            '--filesystem=home',
          ],
        },
      },
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'StingraySoftware',
          name: 'dave',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-fuses',
      config: {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
      },
    },
  ],
};