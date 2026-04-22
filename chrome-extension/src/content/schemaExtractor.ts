/**
 * Schema.org JSON-LD JobPosting Extractor
 *
 * Parses <script type="application/ld+json"> tags from the page to extract
 * structured job data using the Schema.org JobPosting standard.
 *
 * Supported by: LinkedIn, Indeed, Glassdoor, ZipRecruiter, Amazon.jobs,
 * Google Jobs, Greenhouse, Lever, Workday, Ashby, and most company career pages.
 *
 * Reference: https://schema.org/JobPosting
 */

export interface SchemaJobPosting {
  '@type': 'JobPosting';
  title: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string;
  hiringOrganization?: {
    '@type'?: string;
    name?: string;
    sameAs?: string;
    logo?: string;
  };
  jobLocation?: {
    '@type'?: string;
    address?: {
      '@type'?: string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
  baseSalary?: {
    '@type'?: string;
    currency?: string;
    value?: {
      '@type'?: string;
      minValue?: number;
      maxValue?: number;
      value?: number;
      unitText?: string;
    };
  };
  qualifications?: string;
  responsibilities?: string;
  skills?: string;
  jobBenefits?: string;
  experienceRequirements?: string;
  educationRequirements?: string;
  industry?: string;
  occupationalCategory?: string;
  jobLocationType?: string;
  directApply?: boolean;
  incentiveCompensation?: string;
  [key: string]: unknown;
}

export interface ExtractedSchemaField {
  schemaField: string;
  rawValue: string;
}

// Map schema field names → semantic type labels
const SCHEMA_FIELD_MAP: Record<string, { label: string; parse: (job: SchemaJobPosting) => string }> = {
  title: {
    label: 'title',
    parse: (job) => job.title || '',
  },
  company: {
    label: 'company',
    parse: (job) => {
      const org = job.hiringOrganization;
      if (!org) return '';
      return org.name || '';
    },
  },
  companyUrl: {
    label: 'companyUrl',
    parse: (job) => {
      const org = job.hiringOrganization;
      if (!org) return '';
      return org.sameAs || '';
    },
  },
  location: {
    label: 'location',
    parse: (job) => {
      const addr = job.jobLocation?.address;
      if (!addr) return '';
      const parts: string[] = [];
      if (addr.addressLocality) parts.push(addr.addressLocality);
      if (addr.addressRegion) parts.push(addr.addressRegion);
      if (addr.addressCountry) parts.push(addr.addressCountry);
      if (addr.streetAddress) parts.unshift(addr.streetAddress);
      return parts.join(', ');
    },
  },
  salary: {
    label: 'salary',
    parse: (job) => {
      const sal = job.baseSalary;
      if (!sal || !sal.value) return '';
      const { currency, value } = sal;
      if (!value) return '';

      const fmt = (n: number) => {
        if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
        return n.toString();
      };

      let amount = '';
      if (value.minValue !== undefined && value.maxValue !== undefined) {
        amount = `${fmt(value.minValue)}-${fmt(value.maxValue)}`;
      } else if (value.minValue !== undefined) {
        amount = `${fmt(value.minValue)}+`;
      } else if (value.maxValue !== undefined) {
        amount = `up to ${fmt(value.maxValue)}`;
      } else if (value.value !== undefined) {
        amount = fmt(value.value);
      }

      const unit = value.unitText || 'YEAR';
      const currencySymbol = getCurrencySymbol(currency || 'USD');
      return `${currencySymbol}${amount} / ${unit.toLowerCase()}`;
    },
  },
  currency: {
    label: 'currency',
    parse: (job) => job.baseSalary?.currency || '',
  },
  employmentType: {
    label: 'employmentType',
    parse: (job) => normalizeEmploymentType(job.employmentType || ''),
  },
  description: {
    label: 'description',
    parse: (job) => stripHtmlTags(job.description || ''),
  },
  qualifications: {
    label: 'qualifications',
    parse: (job) => stripHtmlTags(job.qualifications || ''),
  },
  responsibilities: {
    label: 'responsibilities',
    parse: (job) => stripHtmlTags(job.responsibilities || ''),
  },
  skills: {
    label: 'skills',
    parse: (job) => stripHtmlTags(job.skills || ''),
  },
  benefits: {
    label: 'benefits',
    parse: (job) => stripHtmlTags(job.jobBenefits || ''),
  },
  experience: {
    label: 'experience',
    parse: (job) => stripHtmlTags(job.experienceRequirements || ''),
  },
  education: {
    label: 'education',
    parse: (job) => stripHtmlTags(job.educationRequirements || ''),
  },
  industry: {
    label: 'industry',
    parse: (job) => job.industry || '',
  },
  remote: {
    label: 'remote',
    parse: (job) => {
      if (job.jobLocationType === 'TELECOMMUTE' || job.jobLocationType === 'REMOTE') return 'Remote';
      const loc = job.jobLocation?.address;
      if (!loc) return '';
      if (/remote|telecommute|work from home/i.test(JSON.stringify(loc))) return 'Remote';
      return '';
    },
  },
};

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹',
    JPY: '¥', CAD: 'CA$', AUD: 'A$', CHF: 'CHF',
    CNY: '¥', BRL: 'R$', MXN: 'MX$', KRW: '₩',
    SGD: 'S$', HKD: 'HK$', SEK: 'kr', NOK: 'kr',
    DKK: 'kr', PLN: 'zł', CZK: 'Kč', ZAR: 'R',
  };
  return symbols[currency.toUpperCase()] || `${currency.toUpperCase()} `;
}

function normalizeEmploymentType(type: string): string {
  const map: Record<string, string> = {
    'FULL_TIME': 'Full-time',
    'PART_TIME': 'Part-time',
    'CONTRACTOR': 'Contract',
    'TEMPORARY': 'Temporary',
    'INTERN': 'Internship',
    'INTERNSHIP': 'Internship',
    'VOLUNTEER': 'Volunteer',
    'PER_DIEM': 'Per diem',
    'OTHER': 'Other',
  };
  const normalized = type.replace(/_/g, ' ').replace(/-/g, ' ');
  return map[normalized] || map[type] || type;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find all JSON-LD JobPosting entries in the document.
 * Handles: single JobPosting, arrays of JobPostings, nested @graph structures.
 */
export function findJobPostings(doc: Document): SchemaJobPosting[] {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  const results: SchemaJobPosting[] = [];

  for (const script of Array.from(scripts)) {
    try {
      const text = script.textContent || '';
      const data = JSON.parse(text);

      // Case 1: Direct JobPosting object
      if (data['@type'] === 'JobPosting') {
        results.push(data as SchemaJobPosting);
        continue;
      }

      // Case 2: Array of items
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item['@type'] === 'JobPosting') {
            results.push(item as SchemaJobPosting);
          }
        }
        continue;
      }

      // Case 3: @graph structure (common on LinkedIn, Indeed, etc.)
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          if (item['@type'] === 'JobPosting') {
            results.push(item as SchemaJobPosting);
          }
        }
        continue;
      }

      // Case 4: List of JobPostings directly in the object
      if (data['@type'] === 'ItemList' || data['@type'] === 'ListItem') {
        const items = data.itemListElement || data.element || data.items || [];
        for (const item of items) {
          if (item['@type'] === 'JobPosting') {
            results.push(item as SchemaJobPosting);
          } else if (item.item?.['@type'] === 'JobPosting') {
            results.push(item.item as SchemaJobPosting);
          }
        }
      }
    } catch {
      // Malformed JSON — skip
    }
  }

  return results;
}

/**
 * Extract all available schema fields from the document.
 * Returns field values keyed by schema field name.
 */
export function extractSchemaFields(doc: Document): Record<string, string> {
  const postings = findJobPostings(doc);
  if (postings.length === 0) return {};

  const results: Record<string, string[]> = {};

  for (const fieldName of Object.keys(SCHEMA_FIELD_MAP)) {
    const { parse } = SCHEMA_FIELD_MAP[fieldName];
    const values = postings
      .map((job) => parse(job))
      .filter((v) => v && v.trim().length > 0);

    if (values.length > 0) {
      results[fieldName] = [...new Set(values)]; // deduplicate
    }
  }

  // Convert arrays to comma-joined strings for single-value fields
  const output: Record<string, string> = {};
  for (const [field, values] of Object.entries(results)) {
    output[field] = values.join(', ');
  }

  return output;
}

/**
 * Extract schema fields from a specific JobPosting by index.
 * Useful when the page has multiple job postings in JSON-LD.
 */
export function extractSchemaFieldsAtIndex(doc: Document, index: number): Record<string, string> {
  const postings = findJobPostings(doc);
  if (index < 0 || index >= postings.length) return {};

  const job = postings[index];
  const output: Record<string, string> = {};

  for (const [fieldName, { parse }] of Object.entries(SCHEMA_FIELD_MAP)) {
    const value = parse(job);
    if (value && value.trim().length > 0) {
      output[fieldName] = value;
    }
  }

  return output;
}

/**
 * Check if the document has JobPosting schema data.
 */
export function hasJobPostingSchema(doc: Document): boolean {
  return findJobPostings(doc).length > 0;
}

/**
 * Get the number of JobPosting entries found in the document.
 */
export function getJobPostingCount(doc: Document): number {
  return findJobPostings(doc).length;
}
