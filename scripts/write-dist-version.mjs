import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { writeDistVersion } = require('./lib/writeDistVersionLib.js');

const targetPath = writeDistVersion();
if (targetPath) {
    console.log(`[write-dist-version] Emitted ${targetPath}`);
}
