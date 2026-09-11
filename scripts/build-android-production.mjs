import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function parseEnvFile(contents) {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((variables, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return variables;

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      variables[key] = value;
      return variables;
    }, {});
}

const productionEnvPath = '.env.production';
const localEnvPath = '.env.local';

if (!existsSync(productionEnvPath)) {
  console.error(`[build-android-production] Missing ${productionEnvPath}`);
  process.exitCode = 1;
} else {
  const originalLocalEnv = existsSync(localEnvPath)
    ? readFileSync(localEnvPath, 'utf8')
    : null;
  const productionEnv = readFileSync(productionEnvPath, 'utf8');
  const productionVars = parseEnvFile(productionEnv);
  const productionUrl = productionVars.EXPO_PUBLIC_SUPABASE_URL;

  if (!productionUrl?.startsWith('https://')) {
    console.error(
      '[build-android-production] EXPO_PUBLIC_SUPABASE_URL must be an HTTPS production URL',
    );
    process.exitCode = 1;
  } else {
    try {
      // Expo always gives .env.local higher precedence. Temporarily mirror the
      // production file so a release APK can never accidentally embed localhost.
      writeFileSync(localEnvPath, productionEnv);

      const buildEnv = {
        ...process.env,
        ...productionVars,
        NODE_ENV: 'production',
        CI: '1',
      };
      const expoCli = path.join('node_modules', 'expo', 'bin', 'cli');
      const prebuild = spawnSync(
        process.execPath,
        [expoCli, 'prebuild', '--platform', 'android', '--no-install'],
        { stdio: 'inherit', env: buildEnv },
      );

      if (prebuild.error || prebuild.status !== 0) {
        if (prebuild.error) {
          console.error('[build-android-production] Prebuild failed:', prebuild.error.message);
        }
        process.exitCode = prebuild.status ?? 1;
      } else {
        const isWindows = process.platform === 'win32';
        const gradleCommand = isWindows ? 'gradlew.bat' : './gradlew';
        const localProps = path.join('android', 'local.properties');
        if (!existsSync(localProps)) {
          const sdkPath = (process.env.ANDROID_HOME || 'C:\\Android').replace(/\\/g, '\\\\');
          writeFileSync(localProps, `sdk.dir=${sdkPath}\n`);
        }
        // Gradle does not include Expo environment variables in the bundle
        // task's up-to-date key. Remove only the generated release JS assets so
        // switching from a local build cannot reuse a localhost bundle.
        const releaseBundleDirectory = path.join('android', 'app', 'build', 'generated', 'assets', 'react', 'release');
        rmSync(releaseBundleDirectory, { recursive: true, force: true });
        const build = spawnSync(
          gradleCommand,
          [
            'app:assembleRelease',
            '-x',
            'lint',
            '-x',
            'test',
            '--configure-on-demand',
            '--build-cache',
            '-PreactNativeDevServerPort=8081',
            '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a',
            '-Pexpo.useLegacyPackaging=true',
          ],
          {
            cwd: 'android',
            stdio: 'inherit',
            shell: isWindows,
            env: buildEnv,
          },
        );

        if (build.error) {
          console.error('[build-android-production] Gradle failed:', build.error.message);
        }
        process.exitCode = build.status ?? 1;
      }
    } finally {
      if (originalLocalEnv === null) {
        if (existsSync(localEnvPath)) unlinkSync(localEnvPath);
      } else {
        writeFileSync(localEnvPath, originalLocalEnv);
      }
    }
  }
}
