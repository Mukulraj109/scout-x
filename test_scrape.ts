import { chromium, firefox } from 'playwright-core';
import fs from 'fs';
import path from 'path';

async function run() {
    const wsEndpoint = 'ws://localhost:3003';
    console.log('Connecting to', wsEndpoint);
    const browser = await firefox.connect(wsEndpoint);

    console.log('Creating context');
    const context = await browser.newContext();
    const page = await context.newPage();

    const url = 'https://hiring.cafe/?searchState=%7B%22departments%22%3A%5B%22Engineering%22%5D%7D';
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    console.log('Waiting for network idle...');
    try {
        await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch (e) {
        console.log('Network idle wait timed out, continuing');
    }

    console.log('Taking screenshot before scraping...');
    await page.screenshot({ path: '/tmp/hiringcafe_test.png' });

    // Assuming we have basic list options
    // Let's grab the scraper logic
    const scraperScript = fs.readFileSync(path.join(__dirname, 'server/src/workflow-management/scripts/scraper.js'), 'utf8');

    console.log('Injecting scraper script...');
    await page.addScriptTag({ content: scraperScript });

    console.log('Evaluating scraper...');
    const result = await page.evaluate(async () => {
        // We will try extracting text from the list
        // Provide the same args that we would normally provide!
        // We don't have the exact recording config, but we can just use universal extractor or mock it.
        const extractorItems = [
            { id: '1', type: 'text', text: 'Senior Software Engineer' }, // mock data
        ];

        try {
            // Wait for maxun to be ready if needed, or we can just run the generic list extraction logic
            if (window.Maxun) {
                // Let's pretend we are extracting a list
                return "Maxun exists";
            }
            return "No Maxun object";
        } catch (e) {
            return e.toString();
        }
    });

    console.log('Result:', result);

    // Check what elements matching typical job card look like
    const cards = await page.evaluate(() => {
        return document.querySelectorAll('li, div[class*="card"], div[class*="job"]').length;
    });
    console.log('Found potential card elements:', cards);

    const fullHTML = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('/tmp/hiringcafe.html', fullHTML);

    await browser.close();
}

run().catch(console.error);
