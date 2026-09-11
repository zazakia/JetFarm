const fs = require('fs');
const path = require('path');

const backupDir = process.argv[2];
if (!backupDir) {
    console.error("Please provide backup directory path");
    process.exit(1);
}

function mergeFiles(filePaths, outputFile) {
    console.log(`Merging into ${outputFile}...`);
    let allData = [];
    for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
            try {
                let content = fs.readFileSync(filePath, 'utf8');
                // The MCP tool results are wrapped in a result object usually, 
                // but these output.txt files seem to contain the raw JSON result from the tool.
                // Let's parse them safely.
                let data = JSON.parse(content);
                if (data.result) {
                    // Extract data from <untrusted-data> tags if present
                    const match = data.result.match(/<untrusted-data-[^>]+>\n([\s\S]*)\n<\/untrusted-data-[^>]+>/);
                    if (match) {
                        data = JSON.parse(match[1]);
                    }
                }
                if (Array.isArray(data)) {
                    allData = allData.concat(data);
                } else if (data.tables && Array.isArray(data.tables)) {
                     // Handle table list if accidentally passed
                }
            } catch (e) {
                console.error(`Error parsing ${filePath}: ${e.message}`);
            }
        }
    }
    fs.writeFileSync(path.join(backupDir, outputFile), JSON.stringify(allData, null, 2));
    console.log(`Done. Total rows: ${allData.length}`);
}

// Merging app_payments
mergeFiles([
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/140/output.txt',
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/141/output.txt',
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/142/output.txt'
], 'app_payments.json');

// Merging app_payment_schedules
mergeFiles([
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/145/output.txt',
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/146/output.txt',
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/147/output.txt',
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/148/output.txt',
    'C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/149/output.txt'
], 'app_payment_schedules.json');

// For app_loans and app_borrowers, we just need to strip the untrusted-data tags if they are there
function processSingleFile(filePath, outputFile) {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        try {
            let data = JSON.parse(content);
            if (data.result) {
                const match = data.result.match(/<untrusted-data-[^>]+>\n([\s\S]*)\n<\/untrusted-data-[^>]+>/);
                if (match) {
                    data = JSON.parse(match[1]);
                }
            }
            fs.writeFileSync(path.join(backupDir, outputFile), JSON.stringify(data, null, 2));
            console.log(`Processed ${outputFile}`);
        } catch (e) {
            console.error(`Error processing single file ${filePath}: ${e.message}`);
        }
    }
}

processSingleFile('C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/105/output.txt', 'app_loans.json');
processSingleFile('C:/Users/HI/.gemini/antigravity/brain/dab38d06-af67-40ba-bff3-b59281dc15e6/.system_generated/steps/120/output.txt', 'app_borrowers.json');
