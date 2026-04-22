/**
 * Test the Universal Job Board Extractor via Camoufox
 * Connects to the Camoufox Docker container's WS proxy and
 * runs the smart extraction script against JPMC.
 */
const { firefox } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const http = require('http');

const JPMC_URL = 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?keyword=Software%2C+Data%2C+Cyber&location=United+States&locationId=300000000289738&locationLevel=country&mode=location&selectedPostingDatesFacet=7&sortBy=POSTING_DATES_DESC';

async function getCamoufoxEndpoint() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3004/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.status === 'healthy' && json.wsEndpoint) {
                        // Replace localhost with 127.0.0.1 for Docker
                        const endpoint = json.wsEndpoint.replace('localhost', '127.0.0.1');
                        resolve(endpoint);
                    } else {
                        reject(new Error('Camoufox not healthy: ' + data));
                    }
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function run() {
    console.log('=== Camoufox JPMC Extraction Test ===\n');

    // Step 1: Get Camoufox WS endpoint
    let wsEndpoint;
    try {
        wsEndpoint = await getCamoufoxEndpoint();
        console.log(`[✓] Camoufox healthy at: ${wsEndpoint}`);
    } catch (e) {
        console.error(`[✗] Cannot reach Camoufox: ${e.message}`);
        process.exit(1);
    }

    // Step 2: Connect to Camoufox via WebSocket
    let browser;
    try {
        browser = await firefox.connect(wsEndpoint, { timeout: 15000 });
        console.log('[✓] Connected to Camoufox browser');
    } catch (e) {
        console.error(`[✗] Failed to connect to Camoufox: ${e.message}`);
        process.exit(1);
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Step 3: Navigate to JPMC
        console.log(`\n[→] Navigating to JPMC...`);
        await page.goto(JPMC_URL, { waitUntil: 'networkidle', timeout: 60000 });
        console.log('[✓] Page loaded');

        // Step 4: Wait for dynamic content to render
        console.log('[→] Waiting 10s for Oracle Cloud to render job cards...');
        await page.waitForTimeout(10000);

        // Step 5: Take a screenshot for debugging
        await page.screenshot({ path: 'jpmc_camoufox_screenshot.png', fullPage: false });
        console.log('[✓] Screenshot saved: jpmc_camoufox_screenshot.png');

        // Step 6: Check raw HTML for job indicators
        const pageText = await page.evaluate(() => document.body.innerText);
        const jobKeywords = ['job', 'position', 'apply', 'software', 'data', 'cyber'];
        const foundKeywords = jobKeywords.filter(kw => pageText.toLowerCase().includes(kw));
        console.log(`[i] Page text contains keywords: ${foundKeywords.join(', ') || 'NONE'}`);
        console.log(`[i] Page text length: ${pageText.length} chars`);

        // Step 7: Run Smart Extraction
        console.log('\n[→] Running Smart Job Extractor...');
        const scriptPath = path.join(__dirname, 'server/src/workflow-management/scripts/smartJobExtractor.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf-8');
        const discoveredRows = await page.evaluate(scriptContent);

        if (Array.isArray(discoveredRows) && discoveredRows.length > 0) {
            console.log(`\n✅ SUCCESS: Discovered ${discoveredRows.length} jobs!\n`);
            console.log('--- First 5 results ---');
            discoveredRows.slice(0, 5).forEach((row, i) => {
                console.log(`\nJob #${i + 1}:`);
                console.log(`  Title:    ${row.title || '(empty)'}`);
                console.log(`  Company:  ${row.company || '(empty)'}`);
                console.log(`  Location: ${row.location || '(empty)'}`);
                console.log(`  Salary:   ${row.salary || '(empty)'}`);
                console.log(`  Date:     ${row.date || '(empty)'}`);
                console.log(`  Link:     ${row.link || '(empty)'}`);
            });
            if (discoveredRows.length > 5) {
                console.log(`\n... and ${discoveredRows.length - 5} more.`);
            }
        } else {
            console.log('\n❌ FAILURE: No jobs discovered.');
            console.log('[i] Dumping first 500 chars of page text for debugging:');
            console.log(pageText.slice(0, 500));
        }
    } catch (e) {
        console.error(`[✗] Error during extraction: ${e.message}`);
    } finally {
        await context.close().catch(() => { });
        console.log('\n[✓] Done.');
    }
}

run();
