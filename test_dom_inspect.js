/**
 * DOM Inspector: Find what selectors contain job data on JPMC
 * Connect via Camoufox, then inspect the DOM structure.
 */
const { firefox } = require('playwright-core');
const http = require('http');

const JPMC_URL = 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs?keyword=Software%2C+Data%2C+Cyber&location=United+States&locationId=300000000289738&locationLevel=country&mode=location&selectedPostingDatesFacet=7&sortBy=POSTING_DATES_DESC';

async function getCamoufoxEndpoint() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3004/health', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                resolve(json.wsEndpoint.replace('localhost', '127.0.0.1'));
            });
        }).on('error', reject);
    });
}

async function run() {
    const wsEndpoint = await getCamoufoxEndpoint();
    console.log(`Connecting to Camoufox: ${wsEndpoint}`);
    const browser = await firefox.connect(wsEndpoint, { timeout: 15000 });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(JPMC_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    // Targeted inspection: look at the actual DOM structure
    const info = await page.evaluate(() => {
        // 1. Get all anchor tags with "job" in href
        const jobLinks = Array.from(document.querySelectorAll('a')).filter(a => /job/i.test(a.href));

        // 2. For each job link, walk up to find the "card" container
        const cards = new Set();
        const cardInfo = [];

        for (const link of jobLinks.slice(0, 5)) {
            let el = link;
            const path = [];
            while (el && el !== document.body) {
                path.push({
                    tag: el.tagName,
                    id: el.id || '',
                    classes: Array.from(el.classList).join(' '),
                    childCount: el.parentElement ? el.parentElement.children.length : 0
                });
                el = el.parentElement;
            }
            cardInfo.push({
                linkHref: link.href,
                linkText: (link.innerText || '').trim().slice(0, 80),
                ancestorPath: path.slice(0, 6)
            });
        }

        // 3. Try some common Oracle Cloud selectors
        const oracleSelectors = {
            'article': document.querySelectorAll('article').length,
            '[class*="job"]': document.querySelectorAll('[class*="job"]').length,
            '[class*="Job"]': document.querySelectorAll('[class*="Job"]').length,
            '[class*="card"]': document.querySelectorAll('[class*="card"]').length,
            '[class*="Card"]': document.querySelectorAll('[class*="Card"]').length,
            '[class*="posting"]': document.querySelectorAll('[class*="posting"]').length,
            '[class*="Posting"]': document.querySelectorAll('[class*="Posting"]').length,
            '[class*="result"]': document.querySelectorAll('[class*="result"]').length,
            '[class*="Result"]': document.querySelectorAll('[class*="Result"]').length,
            '[class*="list-item"]': document.querySelectorAll('[class*="list-item"]').length,
            '[role="listitem"]': document.querySelectorAll('[role="listitem"]').length,
            '[role="article"]': document.querySelectorAll('[role="article"]').length,
            'li': document.querySelectorAll('li').length,
            'a[href*="job"]': document.querySelectorAll('a[href*="job"]').length,
            'a[href*="jobs"]': document.querySelectorAll('a[href*="jobs"]').length,
        };

        return {
            jobLinksCount: jobLinks.length,
            cardInfo,
            selectorCounts: oracleSelectors,
            bodyChildCount: document.body.children.length,
            totalElements: document.querySelectorAll('*').length
        };
    });

    console.log('\n=== DOM Inspector Results ===\n');
    console.log(`Total elements on page: ${info.totalElements}`);
    console.log(`Job-related links found: ${info.jobLinksCount}`);
    console.log('\nSelector counts:');
    Object.entries(info.selectorCounts).forEach(([sel, count]) => {
        if (count > 0) console.log(`  ${sel}: ${count}`);
    });

    console.log('\nFirst 5 job link ancestor paths:');
    info.cardInfo.forEach((card, i) => {
        console.log(`\n--- Link #${i + 1}: "${card.linkText}" ---`);
        console.log(`  href: ${card.linkHref}`);
        card.ancestorPath.forEach((a, depth) => {
            console.log(`  ${'  '.repeat(depth)}${a.tag}${a.id ? '#' + a.id : ''}.${a.classes} (siblings: ${a.childCount})`);
        });
    });

    await context.close();
    console.log('\nDone.');
}

run().catch(console.error);
