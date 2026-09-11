import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/utils/logoBase64.ts');
let content = fs.readFileSync(filePath, 'utf8');

if (content.includes('export const logoBase64')) {
    content = content.replace('export const logoBase64', 'export let logoBase64');
    content += '\nexport function setLogoBase64(newLogo: string) {\n    logoBase64 = newLogo;\n}\n';
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully patched logoBase64.ts to make logoBase64 mutable.');
} else if (content.includes('export let logoBase64')) {
    console.log('logoBase64.ts is already patched.');
} else {
    console.error('Error: Could not find export const logoBase64 in logoBase64.ts');
    process.exit(1);
}
