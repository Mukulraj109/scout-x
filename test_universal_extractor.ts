import { chromium } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';

// This script tests the Smart Job Extractor directly to verify discovery logic
async function runTest() {
    console.log('Starting Universal Job Board Discovery Test...');

    // Path to the smart extractor script
    const scriptPath = path.join(__dirname, 'server/src/workflow-management/scripts/smartJobExtractor.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        const url = 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?keyword=Software%2C+Data%2C+Cyber&location=United+States&locationId=300000000289738&locationLevel=country&mode=location&selectedPostingDatesFacet=7&sortBy=POSTING_DATES_DESC';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(10000); // Increased wait for Oracle Cloud slow load

        console.log('Executing smart discovery script...');
        const discoveredRows = await page.evaluate(scriptContent) as any[];

        console.log('Discovery Results:');
        console.log(JSON.stringify(discoveredRows, null, 2));

        if (discoveredRows && discoveredRows.length > 0) {
            console.log(`✅ SUCCESS: Discovered ${discoveredRows.length} jobs.`);
        } else {
            console.log('❌ FAILURE: No jobs discovered.');
        }
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        await browser.close();
    }
}

runTest();
