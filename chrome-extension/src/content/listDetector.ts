/**
 * List Detector - Detects repeating DOM element groups.
 * Finds list-like structures by analyzing sibling patterns and structural fingerprints.
 */

export interface DetectedListGroup {
  container: Element;
  items: Element[];
  selector: string;
  count: number;
  score: number;
  previewText: string;
}

/**
 * Walk up from a target element to find the best repeating list container.
 * Checks ancestors for siblings with matching tag/class patterns.
 */
export function detectListAtElement(target: Element): DetectedListGroup | null {
  const candidates: DetectedListGroup[] = [];
  let current = target;
  let depth = 0;

  while (current.parentElement && depth < 8) {
    const parent = current.parentElement;
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === current.tagName
    );

    if (siblings.length >= 2) {
      // Score by sibling count + shared stable classes
      const stableClassCount = countSharedStableClasses(current, siblings);
      const score = siblings.length * 10 + stableClassCount * 5;

      // Generate a selector for this group
      const selector = generateListSelector(current, parent, siblings);

      candidates.push({
        container: current,
        items: siblings,
        selector,
        count: siblings.length,
        score,
        previewText: truncate(current.textContent || '', 120),
      });
    }

    current = parent;
    depth++;
  }

  if (candidates.length === 0) return null;

  // Return the candidate with highest score
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

/**
 * Find all potential list groups on the page.
 * Scans the DOM for repeating sibling structures.
 */
export function discoverLists(doc: Document, maxGroups: number = 10): DetectedListGroup[] {
  const groups: DetectedListGroup[] = [];
  const visited = new WeakSet<Element>();

  // Walk through elements looking for parents with 3+ same-tag children
  const allElements = doc.querySelectorAll('*');
  const parentMap = new Map<Element, Map<string, Element[]>>();

  // Cap scan for performance (higher limit since we pre-scroll virtualized lists)
  const limit = Math.min(allElements.length, 10000);

  for (let i = 0; i < limit; i++) {
    const el = allElements[i] as HTMLElement;

    // Skip invisible, scripts, styles, and our own overlays
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'META' ||
        el.tagName === 'LINK' || el.tagName === 'SVG' || el.tagName === 'NOSCRIPT') continue;
    if (el.id?.startsWith('__maxun_')) continue;
    if (!el.offsetWidth && !el.offsetHeight) continue;

    const parent = el.parentElement;
    if (!parent || visited.has(parent)) continue;

    if (!parentMap.has(parent)) {
      parentMap.set(parent, new Map());
    }

    const tagGroups = parentMap.get(parent)!;
    const tag = el.tagName;

    if (!tagGroups.has(tag)) {
      tagGroups.set(tag, []);
    }
    tagGroups.get(tag)!.push(el);
  }

  // Find groups with 3+ siblings
  for (const [parent, tagGroups] of parentMap) {
    visited.add(parent);

    for (const [tag, siblings] of tagGroups) {
      if (siblings.length < 3) continue;

      // Skip nav/header/footer containers
      if (isNavigationContainer(parent)) continue;

      const stableClassCount = countSharedStableClasses(siblings[0], siblings);
      const score = siblings.length * 10 + stableClassCount * 5;

      // Check bounding box similarity for bonus
      const boxScore = checkBoundingBoxSimilarity(siblings);
      const totalScore = score + boxScore;

      const selector = generateListSelector(siblings[0], parent, siblings);

      groups.push({
        container: siblings[0],
        items: siblings,
        selector,
        count: siblings.length,
        score: totalScore,
        previewText: truncate(siblings[0].textContent || '', 120),
      });
    }
  }

  // Sort by score and return top groups
  groups.sort((a, b) => b.score - a.score);
  return groups.slice(0, maxGroups);
}

/**
 * Find the list group that contains the given point (mouse position).
 */
export function findListGroupAtPoint(
  x: number, y: number, groups: DetectedListGroup[]
): DetectedListGroup | null {
  const elementAtPoint = document.elementFromPoint(x, y);
  if (!elementAtPoint) return null;

  for (const group of groups) {
    for (const item of group.items) {
      if (item === elementAtPoint || item.contains(elementAtPoint)) {
        return group;
      }
    }
  }

  return null;
}

// ── Helpers ──

function generateListSelector(item: Element, parent: Element, siblings: Element[]): string {
  // Try class-based selector first
  const stableClasses = getStableClasses(item);
  if (stableClasses.length > 0) {
    const classSelector = `${item.tagName.toLowerCase()}.${stableClasses.slice(0, 2).map(cssEscape).join('.')}`;
    try {
      const matches = document.querySelectorAll(classSelector);
      if (matches.length === siblings.length) return classSelector;
    } catch { /* fall through */ }
  }

  // Try parent + child tag
  const parentSelector = getUniqueParentSelector(parent);
  if (parentSelector) {
    const childSelector = `${parentSelector} > ${item.tagName.toLowerCase()}`;
    try {
      const matches = document.querySelectorAll(childSelector);
      if (matches.length >= siblings.length) return childSelector;
    } catch { /* fall through */ }
  }

  // Fallback: nth-of-type based
  return `${item.tagName.toLowerCase()}`;
}

function getUniqueParentSelector(parent: Element): string | null {
  if (parent.id && isStableId(parent.id)) return `#${cssEscape(parent.id)}`;

  const stableClasses = getStableClasses(parent);
  if (stableClasses.length > 0) {
    const selector = `${parent.tagName.toLowerCase()}.${stableClasses[0]}`;
    try {
      if (document.querySelectorAll(selector).length === 1) return selector;
    } catch { /* fall through */ }
  }

  return null;
}

function countSharedStableClasses(reference: Element, siblings: Element[]): number {
  const refClasses = getStableClasses(reference);
  if (refClasses.length === 0) return 0;

  let count = 0;
  for (const sibling of siblings) {
    if (sibling === reference) continue;
    if (refClasses.some((cls) => sibling.classList.contains(cls))) count++;
  }
  return count;
}

function getStableClasses(element: Element): string[] {
  return Array.from(element.classList).filter(isStableClass);
}

function isStableClass(className: string): boolean {
  return !!className &&
    className.length < 40 &&
    !/\d{3,}/.test(className) &&
    !/active|selected|hover|focus|open|close|show|hide/i.test(className) &&
    !/[A-Fa-f0-9]{8,}/.test(className);
}

function isStableId(id: string): boolean {
  return !!id && id.length < 40 && !/\d{3,}/.test(id) && !/[A-Fa-f0-9]{8,}/.test(id);
}

function isNavigationContainer(element: Element): boolean {
  const tag = element.tagName;
  if (tag === 'NAV' || tag === 'HEADER' || tag === 'FOOTER') return true;

  const role = element.getAttribute('role');
  if (role === 'navigation' || role === 'banner' || role === 'contentinfo') return true;

  return false;
}

function checkBoundingBoxSimilarity(elements: Element[]): number {
  if (elements.length < 2) return 0;

  const rects = elements.slice(0, 5).map((el) => el.getBoundingClientRect());
  const avgWidth = rects.reduce((s, r) => s + r.width, 0) / rects.length;
  const avgHeight = rects.reduce((s, r) => s + r.height, 0) / rects.length;

  if (avgWidth === 0 || avgHeight === 0) return 0;

  const allSimilar = rects.every(
    (r) =>
      Math.abs(r.width - avgWidth) / avgWidth < 0.2 &&
      Math.abs(r.height - avgHeight) / avgHeight < 0.3
  );

  return allSimilar ? 8 : 0;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, '\\$1');
}

function truncate(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > maxLength ? clean.slice(0, maxLength) + '...' : clean;
}
