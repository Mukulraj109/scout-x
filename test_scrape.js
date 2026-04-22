const { chromium, firefox } = require('playwright-core');
const fs = require('fs');
const path = require('path');

async function run() {
    const fetch = require('node-fetch'); // we can also use http module if fetch is unavailable, or just native fetch in modern node

    // Maxun's node version should have native Fetch. If not, use cross-fetch
    const response = await fetch('http://localhost:3004/health');
    const data = await response.json();
    const parsedUrl = new URL(data.wsEndpoint);
    const wsEndpoint = `ws://localhost:3003${parsedUrl.pathname}`;

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

    console.log('Injecting maxun mock...');
    await page.evaluate(() => {
        window.Maxun = { version: 1 };
    });

    const scraperScript = fs.readFileSync(path.join(__dirname, 'server/src/workflow-management/scripts/scraper.js'), 'utf8');
    console.log('Injecting scraper script...');
    await page.addScriptTag({ content: scraperScript });

    console.log('Evaluating scraper...');

    const cards = await page.evaluate(() => {
        return document.querySelectorAll('li, div[class*="card"], div[class*="job"]').length;
    });
    console.log('Found potential card elements:', cards);

    const fullHTML = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('/tmp/hiringcafe.html', fullHTML);

    await browser.close();
}

run().catch(console.error);
