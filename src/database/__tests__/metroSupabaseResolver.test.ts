import fs from 'fs';
import path from 'path';

describe('Metro Supabase bundle compatibility', () => {
  it('routes the native Supabase client to its Hermes-compatible CommonJS build', () => {
    const metroConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../metro.config.js'),
      'utf8',
    );

    expect(metroConfig).toContain("moduleName === '@supabase/supabase-js'");
    expect(metroConfig).toContain("platform !== 'web'");
    expect(metroConfig).toContain("'@supabase/supabase-js/dist/index.cjs'");
  });

  it('keeps the legacy Watermelon adapter aligned with the native build', () => {
    const appConfig = fs.readFileSync(
      path.resolve(__dirname, '../../../app.json'),
      'utf8',
    );
    const databaseConfig = fs.readFileSync(
      path.resolve(__dirname, '../index.ts'),
      'utf8',
    );

    expect(appConfig).toContain('"disableJsi": true');
    expect(databaseConfig).toContain('jsi: false');
  });

  it('provides a production Android build that cannot embed the local Supabase URL', () => {
    const packageJson = fs.readFileSync(
      path.resolve(__dirname, '../../../package.json'),
      'utf8',
    );
    const buildScriptPath = path.resolve(
      __dirname,
      '../../../scripts/build-android-production.mjs',
    );

    expect(packageJson).toContain(
      '"android:production": "node scripts/build-android-production.mjs"',
    );
    expect(fs.existsSync(buildScriptPath)).toBe(true);

    const buildScript = fs.readFileSync(buildScriptPath, 'utf8');
    expect(buildScript).toContain("NODE_ENV: 'production'");
    expect(buildScript).toContain('writeFileSync(localEnvPath, productionEnv)');
    expect(buildScript).toContain('writeFileSync(localEnvPath, originalLocalEnv)');
    expect(buildScript).toContain("path.join('android', 'app', 'build', 'generated', 'assets', 'react', 'release')");
    expect(buildScript).toContain('rmSync(releaseBundleDirectory, { recursive: true, force: true })');
  });
});
