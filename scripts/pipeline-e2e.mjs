import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

const args = process.argv.slice(2);
const isDeployRequested = args.includes('--deploy') || args.includes('-d');
const isDryRun = args.includes('--dry-run');
const skipE2E = args.includes('--skip-e2e');

console.log('================================================================');
console.log('🚀 POSCURSOR GLOBAL END-TO-END AUTOMATION PIPELINE');
console.log('================================================================');
if (isDryRun) console.log('⚡ [DRY RUN MODE] Running validation without full deployment');

function runStep(stepName, command, cmdArgs, envExtra = {}) {
  console.log(`\n▶ Step: ${stepName}`);
  console.log(`  Executing: ${command} ${cmdArgs.join(' ')}`);
  
  if (isDryRun && stepName.includes('Deploy')) {
    console.log(`  [DRY RUN] Skipping actual execution of ${stepName}`);
    return true;
  }

  const result = spawnSync(command, cmdArgs, {
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, ...envExtra }
  });

  if (result.status !== 0) {
    console.error(`❌ FAILED: ${stepName} exited with status code ${result.status}`);
    return false;
  }
  
  console.log(`✅ PASSED: ${stepName}`);
  return true;
}

const pipelineSteps = [
  {
    name: '1. Auth Schema Pre-Flight Check',
    cmd: 'node',
    args: ['scripts/check-auth-schema.mjs']
  },
  {
    name: '2. Static Typecheck (TypeScript)',
    cmd: npxCmd,
    args: ['tsc', '--noEmit']
  },
  {
    name: '3. Jest Unit & Service Integration Suite',
    cmd: npmCmd,
    args: ['test', '--', '--ci', '--maxWorkers=2']
  }
];

if (!skipE2E) {
  pipelineSteps.push({
    name: '4. Playwright E2E Verification Suite',
    cmd: npxCmd,
    args: ['playwright', 'test']
  });
}

pipelineSteps.push({
  name: '5. Web Production Build & Export',
  cmd: npmCmd,
  args: ['run', 'export:web:production']
});

if (isDeployRequested) {
  pipelineSteps.push({
    name: '6. Cloudflare Pages Deployment',
    cmd: npmCmd,
    args: ['run', 'deploy:cloudflare']
  });
}

console.log(`Running ${pipelineSteps.length} pipeline steps...\n`);

for (const step of pipelineSteps) {
  const success = runStep(step.name, step.cmd, step.args);
  if (!success) {
    console.error('\n💥 PIPELINE FAILED! Stopping pipeline execution.');
    process.exit(1);
  }
}

console.log('\n================================================================');
console.log('🎉 PIPELINE COMPLETED SUCCESSFULLY!');
console.log('================================================================');
process.exit(0);
