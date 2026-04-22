(function () {
    /**
     * Universal Job Board Extractor v4
     * Extracts structured job data from any job board page.
     * Fields: jobTitle, companyName, location, jobUrl, jobDescription, salary, datePosted, jobCategory
     */

    const LOCATION_RE = /\b[A-Z][a-z]+,\s*[A-Z]{2}\b|\bRemote\b|\bHybrid\b|\bOn-site\b|\bUnited States\b|\bUnited Kingdom\b|\b[A-Z][a-z]+,\s*[A-Z][a-z]+,?\s*United\s*States\b/i;
    const MONEY_RE = /[\$\£\€\¥]\s?\d[\d,.]*/;
    const DATE_RE = /\d+\s+(days?|weeks?|months?|hours?)\s+ago/i;
    const CATEGORY_RE = /\b(engineer|technology|design|data|science|finance|marketing|operations|cyber|security|infrastructure|software|banking|commercial|product|management)\b/i;

    /** Link hrefs that are never individual job postings */
    const EXCLUDE_PATH_RE = /\/(login|sign-?in|sign-?up|register|account|profile|settings|privacy|terms|cookie|help|faq|contact|blog|news|cart|checkout)(\/|$|\?)/i;
    const JOBISH_PATH_RE = /job|career|position|posting|requisition|vacancy|opening|role|apply|listing|\/j\/|\/r\/|req=/i;
    const JOB_TITLE_RE = /\b(engineer|developer|analyst|manager|designer|scientist|specialist|coordinator|director|associate|intern|lead|architect|vice\s*president|consultant|representative|technician|accountant|supervisor|executive|officer|nurse|therapist|physician|attorney|paralegal|recruiter|hr\b|human\s*resources|sales|marketing|support|writer|editor|researcher)\b/i;
    const NOISE_LINK_TEXT_RE = /^(see all|view all|show more|load more|next|previous|back|home|menu|search|filter|sort by|apply now|log ?in|sign ?up|subscribe|share|save|email|print)\b/i;
    const GENERIC_JOB_TITLE_RE = /^(careers?|jobs?|openings?|search results|all jobs|job search|home|navigation)$/i;

    // ── Step 0: Try to extract company name from page header/title ──
    function detectSiteCompany() {
        // Common patterns for single-company job boards
        const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
        if (ogSiteName && ogSiteName.length < 60 && !/job|career|work|hire/i.test(ogSiteName)) {
            return ogSiteName.replace(/\s*(careers?|jobs?|candidate|experience|page)\s*/gi, '').trim();
        }

        const title = document.title || '';
        // Extract from "Company - Careers" or "Jobs at Company" patterns
        const titleMatch = title.match(/^(.+?)\s*[-–|·]\s*(careers?|jobs?|openings?|hiring)/i)
            || title.match(/(careers?|jobs?|openings?|hiring)\s*[-–|·]\s*(.+?)$/i)
            || title.match(/^(.+?)\s+(careers?|candidate)/i);
        if (titleMatch) {
            const name = (titleMatch[1] || titleMatch[2] || '').replace(/\s*(careers?|jobs?|candidate|experience|page|search)\s*/gi, '').trim();
            if (name.length > 1 && name.length < 50) return name;
        }

        // Try logo alt text
        const logo = document.querySelector('[class*="logo"] img, [aria-label*="logo"] img, header img');
        if (logo?.alt && logo.alt.length < 50 && logo.alt.length > 1) {
            return logo.alt.replace(/\s*(logo|careers?)\s*/gi, '').trim();
        }

        return '';
    }

    const siteCompany = detectSiteCompany();

    function shouldExcludeAnchor(a) {
        const href = (a.href || '').trim();
        if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return true;
        let path = '';
        try {
            path = new URL(href, window.location.origin).pathname || '';
        } catch (e) {
            return true;
        }
        if (EXCLUDE_PATH_RE.test(path)) return true;
        const text = (a.innerText || '').trim();
        if (text.length > 0 && text.length < 40 && NOISE_LINK_TEXT_RE.test(text)) return true;
        return false;
    }

    function isLikelyJobPostingLink(a) {
        if (shouldExcludeAnchor(a)) return false;
        const href = a.href.toLowerCase();
        const text = (a.innerText || '').trim();
        const pathJobish = JOBISH_PATH_RE.test(href);
        const textJobish = text.length >= 5 && text.length < 220 && JOB_TITLE_RE.test(text);
        return pathJobish || textJobish;
    }

    // ── Step 1: Find job links (exclude nav, auth, and generic UI links) ──
    const allLinks = Array.from(document.querySelectorAll('a'));
    const jobLinks = allLinks.filter(isLikelyJobPostingLink);

    // ── Step 1b: Also check for clickable non-<a> elements (React SPAs) ──
    const clickableJobEls = [];
    if (jobLinks.length < 3) {
        document.querySelectorAll('[role="link"], [role="button"], [tabindex="0"], [onclick]').forEach(el => {
            const text = (el.innerText || '').trim();
            if (text.length > 5 && text.length < 220 && JOB_TITLE_RE.test(text) && !NOISE_LINK_TEXT_RE.test(text)) {
                clickableJobEls.push(el);
            }
        });
    }

    const allJobEls = [...jobLinks, ...clickableJobEls];
    if (allJobEls.length === 0) return [];

    // ── Step 2: Find the card container for each link ──
    function findCardElement(link) {
        let el = link.parentElement;
        let depth = 0;
        while (el && el !== document.body && depth < 8) {
            const parent = el.parentElement;
            if (parent) {
                const sameTagSiblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
                if (sameTagSiblings.length >= 3) return el;
            }
            el = parent;
            depth++;
        }
        return link.parentElement;
    }

    const cardElements = allJobEls.map(findCardElement);
    const uniqueCards = [];
    const seen = new Set();
    cardElements.forEach(card => {
        if (card && !seen.has(card)) {
            seen.add(card);
            uniqueCards.push(card);
        }
    });

    // ── Step 3: Extract fields from each card ──
    function extractFields(card) {
        const row = {
            jobTitle: '',
            companyName: siteCompany,
            location: '',
            jobUrl: '',
            jobDescription: '',
            salary: '',
            datePosted: '',
            jobCategory: '',
        };

        // Find the best link inside the card for jobUrl
        const links = Array.from(card.querySelectorAll('a')).filter(a =>
            a.href && !a.href.startsWith('javascript:') && !a.href.endsWith('#')
        );

        if (links.length > 0) {
            // Prefer links with job/position in the URL
            const best = links.find(a => /job|position|career|posting|requisition|opening/i.test(a.href)) || links[0];
            row.jobUrl = best.href;
            const linkText = (best.innerText || '').trim();
            if (linkText.length > 2 && linkText.length < 200) row.jobTitle = linkText;
        }

        // If no <a> link found, try to construct URL from data attributes or card click behavior
        if (!row.jobUrl) {
            const dataId = card.getAttribute('data-job-id') || card.getAttribute('data-id') || card.getAttribute('data-requisition-id');
            if (dataId) {
                row.jobUrl = window.location.origin + window.location.pathname.replace(/\/jobs.*/, '/job/' + dataId);
            } else {
                // Leave empty — rows without a real posting URL are filtered out later
                row.jobUrl = '';
            }
        }

        // Fallback title from headings
        if (!row.jobTitle || row.jobTitle.length < 3) {
            const heading = card.querySelector('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="Title"], [class*="name"], [class*="Name"]');
            if (heading) row.jobTitle = (heading.innerText || '').trim().slice(0, 200);
        }

        // Collect text from leaf elements
        const leafTexts = [];
        card.querySelectorAll('span, p, div, h1, h2, h3, h4, h5, h6, a, li, td, dd, dt, label, small, time').forEach(el => {
            const t = (el.innerText || '').trim();
            if (t.length > 1 && t.length < 200 && el.children.length === 0) {
                leafTexts.push(t);
            }
        });
        const lines = leafTexts.length > 0
            ? leafTexts
            : (card.innerText || '').split('\n').map(l => l.trim()).filter(l => l.length > 1 && l.length < 200);

        const titleLower = (row.jobTitle || '').toLowerCase();

        for (const line of lines) {
            if (line.toLowerCase() === titleLower) continue;
            if (!row.location && LOCATION_RE.test(line)) { row.location = line; continue; }
            if (!row.salary && MONEY_RE.test(line)) { row.salary = line; continue; }
            if (!row.datePosted && DATE_RE.test(line)) { row.datePosted = line; continue; }
            if (!row.jobCategory && line.length < 50 && CATEGORY_RE.test(line)) {
                row.jobCategory = line;
                continue;
            }
            // Company: only override site company if we find a distinct company name per card
            if (!row.companyName && !siteCompany && line.length > 2 && line.length < 60
                && !LOCATION_RE.test(line) && !MONEY_RE.test(line) && !CATEGORY_RE.test(line)) {
                row.companyName = line;
            }
        }

        // Try to get a short description from the card
        const descEl = card.querySelector('[class*="desc"], [class*="Desc"], [class*="summary"], [class*="Summary"], p');
        if (descEl) {
            const desc = (descEl.innerText || '').trim();
            if (desc.length > 20 && desc.length < 500 && desc !== row.jobTitle) {
                row.jobDescription = desc;
            }
        }

        // Check for time/date elements
        if (!row.datePosted) {
            const timeEl = card.querySelector('time, [datetime], [class*="date"], [class*="Date"], [class*="posted"], [class*="Posted"]');
            if (timeEl) {
                row.datePosted = timeEl.getAttribute('datetime') || (timeEl.innerText || '').trim();
            }
        }

        const scrub = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : s);
        return {
            jobTitle: scrub(row.jobTitle),
            companyName: scrub(row.companyName),
            location: scrub(row.location),
            jobUrl: scrub(row.jobUrl),
            jobDescription: scrub(row.jobDescription),
            salary: scrub(row.salary),
            datePosted: scrub(row.datePosted),
            jobCategory: scrub(row.jobCategory),
        };
    }

    function normalizeJobUrl(u) {
        try {
            const x = new URL(u, window.location.origin);
            x.hash = '';
            const drop = [];
            x.searchParams.forEach((_, k) => {
                if (/^utm_/i.test(k) || k === 'ref' || k === 'source') drop.push(k);
            });
            drop.forEach((k) => x.searchParams.delete(k));
            let s = x.href;
            if (s.endsWith('/')) s = s.slice(0, -1);
            return s;
        } catch (e) {
            return (u || '').trim();
        }
    }

    function listPageUrlSansQuery() {
        try {
            const u = new URL(window.location.href);
            u.hash = '';
            u.search = '';
            let s = u.href;
            if (s.endsWith('/')) s = s.slice(0, -1);
            return s;
        } catch (e) {
            return window.location.href;
        }
    }

    function rowLooksLikeRealJob(row) {
        if (!row.jobTitle || row.jobTitle.length < 3 || GENERIC_JOB_TITLE_RE.test(row.jobTitle.trim())) {
            return false;
        }
        const nu = normalizeJobUrl(row.jobUrl);
        if (!nu) {
            // Some SPAs use clickable rows without a resolvable URL — keep strong title matches only
            return row.jobTitle.length >= 8 && JOB_TITLE_RE.test(row.jobTitle);
        }
        const listBase = listPageUrlSansQuery();
        const nuBase = normalizeJobUrl(nu.split('?')[0]);
        const looksLikeListingOnly =
            nuBase === listBase &&
            !JOBISH_PATH_RE.test(nu) &&
            !/\/\d{4,}\b|\/[a-f0-9-]{8,}\b/i.test(nu);
        if (looksLikeListingOnly) return false;
        return true;
    }

    const rawResults = uniqueCards.map(extractFields).filter(rowLooksLikeRealJob);

    const deduped = [];
    const seenFingerprints = new Set();
    for (const r of rawResults) {
        const key = `${normalizeJobUrl(r.jobUrl)}|${(r.jobTitle || '').toLowerCase().slice(0, 100)}`;
        if (seenFingerprints.has(key)) continue;
        seenFingerprints.add(key);
        deduped.push(r);
    }

    deduped.sort((a, b) => (a.jobTitle || '').localeCompare(b.jobTitle || '', undefined, { sensitivity: 'base' }));
    return deduped;
})();
