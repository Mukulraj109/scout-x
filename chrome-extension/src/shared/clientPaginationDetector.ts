/**
 * Client-Side Pagination Auto-Detection
 * Ported from src/helpers/clientPaginationDetector.ts for Chrome extension.
 * Detects pagination type and selector for list extraction.
 */

import type { ClientSelectorGenerator } from './clientSelectorGenerator';

export type PaginationDetectionResult = {
  type: 'scrollDown' | 'scrollUp' | 'clickNext' | 'clickLoadMore' | '';
  selector: string | null;
  confidence: 'high' | 'medium' | 'low';
  debug?: any;
};

const MAX_BUTTON_TEXT_LENGTH = 50;

const nextButtonTextPatterns = [
  /^\s*next\s*$/i,
  /\bnext\s+page\b/i,
  /\bpage\s+suivante\b/i,
  /\bsiguiente\b/i,
  /\bweiter\b/i,
  /\bnächste\b/i,
  /\bvolgende\b/i,
  /\bpróximo\b/i,
  /\bavanti\b/i,
];

const nextButtonArrowPatterns = [
  /^[>\s›→»⟩]+$/,
  /^>>$/,
];

const loadMorePatterns = [
  /^\s*load\s+more\s*$/i,
  /^\s*show\s+more\s*$/i,
  /^\s*view\s+more\s*$/i,
  /^\s*see\s+more\s*$/i,
  /^\s*more\s+results\s*$/i,
  /^\s*plus\s+de\s+résultats\s*$/i,
  /^\s*más\s+resultados\s*$/i,
  /^\s*weitere\s+ergebnisse\s*$/i,
  /^\s*meer\s+laden\s*$/i,
  /^\s*carica\s+altri\s*$/i,
  /^\s*carregar\s+mais\s*$/i,
];

const paginationContainerPatterns = /paginat|page-nav|pager|page-numbers|page-list/i;

export class ClientPaginationDetector {
  autoDetectPagination(
    doc: Document,
    listSelector: string,
    selectorGenerator: ClientSelectorGenerator,
    options?: { disableScrollDetection?: boolean }
  ): PaginationDetectionResult {
    try {
      const listElements = this.evaluateSelector(listSelector, doc);
      if (listElements.length === 0) {
        return { type: '', selector: null, confidence: 'low', debug: 'No list elements found' };
      }

      const listContainer = this.getListContainer(listElements);
      const paginationWrapper = this.findPaginationContainer(listContainer);

      if (paginationWrapper) {
        const scopedResult = this.detectFromPaginationWrapper(paginationWrapper, doc, selectorGenerator);
        if (scopedResult) return scopedResult;
      }

      const nearbyResult = this.detectFromNearbyElements(listContainer, doc, selectorGenerator);
      if (nearbyResult) return nearbyResult;

      const infiniteScrollScore = options?.disableScrollDetection
        ? 0
        : this.detectInfiniteScrollIndicators(doc);

      if (infiniteScrollScore >= 8) {
        const confidence = infiniteScrollScore >= 15 ? 'high' : infiniteScrollScore >= 12 ? 'medium' : 'low';
        return { type: 'scrollDown', selector: null, confidence };
      }

      const fallbackResult = this.detectFromFullDocument(listContainer, doc, selectorGenerator);
      if (fallbackResult) return fallbackResult;

      return {
        type: '', selector: null, confidence: 'low',
        debug: { listElementsCount: listElements.length, paginationWrapperFound: !!paginationWrapper, infiniteScrollScore }
      };
    } catch (error: any) {
      return { type: '', selector: null, confidence: 'low', debug: 'Exception: ' + error.message };
    }
  }

  private getListContainer(listElements: HTMLElement[]): HTMLElement {
    if (listElements.length === 0) return listElements[0];
    const firstParent = listElements[0].parentElement;
    if (!firstParent) return listElements[0];

    const allShareParent = listElements.every(el => el.parentElement === firstParent);
    if (allShareParent) return firstParent;

    let ancestor: HTMLElement | null = firstParent;
    while (ancestor) {
      if (listElements.every(el => ancestor!.contains(el))) return ancestor;
      ancestor = ancestor.parentElement;
    }
    return firstParent;
  }

  private findPaginationContainer(listContainer: HTMLElement): HTMLElement | null {
    let scope = listContainer.parentElement;
    for (let level = 0; level < 4 && scope; level++) {
      const children = Array.from(scope.children) as HTMLElement[];
      for (const child of children) {
        if (child === listContainer || child.contains(listContainer) || listContainer.contains(child)) continue;
        if (!this.isVisible(child)) continue;

        const classAndLabel = `${child.className || ''} ${child.getAttribute('aria-label') || ''} ${child.getAttribute('role') || ''}`;
        if (paginationContainerPatterns.test(classAndLabel)) return child;
        if (child.tagName === 'NAV' && this.containsPaginationLinks(child)) return child;
        if (this.containsNumericPageLinks(child)) return child;
      }
      scope = scope.parentElement;
    }
    return null;
  }

  private containsPaginationLinks(container: HTMLElement): boolean {
    const links = container.querySelectorAll('a, button, [role="button"]');
    let numericCount = 0;
    let hasNextPrev = false;

    for (const link of Array.from(links)) {
      const text = (link.textContent || '').trim();
      if (/^\d+$/.test(text)) numericCount++;
      if (this.matchesAnyPattern(text, nextButtonTextPatterns)) hasNextPrev = true;
      if (this.matchesAnyPattern(text, loadMorePatterns)) hasNextPrev = true;
    }
    return numericCount >= 2 || hasNextPrev;
  }

  private containsNumericPageLinks(container: HTMLElement): boolean {
    const links = container.querySelectorAll('a, button, [role="button"]');
    const numbers: number[] = [];
    for (const link of Array.from(links)) {
      const text = (link.textContent || '').trim();
      if (/^\d+$/.test(text)) numbers.push(parseInt(text, 10));
    }
    if (numbers.length < 2) return false;
    numbers.sort((a, b) => a - b);
    for (let i = 0; i < numbers.length - 1; i++) {
      if (numbers[i + 1] - numbers[i] === 1) return true;
    }
    return false;
  }

  private detectFromPaginationWrapper(
    wrapper: HTMLElement,
    doc: Document,
    selectorGenerator: ClientSelectorGenerator
  ): PaginationDetectionResult | null {
    const clickables = this.getClickableElementsIn(wrapper);

    let nextButton: HTMLElement | null = null;
    let loadMoreButton: HTMLElement | null = null;

    for (const element of clickables) {
      if (!this.isVisible(element)) continue;
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') continue;

      const text = (element.textContent || '').trim();
      const ariaLabel = element.getAttribute('aria-label') || '';
      const title = element.getAttribute('title') || '';
      if (text.length > MAX_BUTTON_TEXT_LENGTH) continue;

      const combinedText = `${text} ${ariaLabel} ${title}`;

      if (this.matchesAnyPattern(combinedText, loadMorePatterns) && !loadMoreButton) {
        loadMoreButton = element;
      }

      let isNext = this.matchesAnyPattern(combinedText, nextButtonTextPatterns);
      if (!isNext && text.length <= 3) isNext = this.matchesAnyPattern(text, nextButtonArrowPatterns);
      if (!isNext && !text.trim()) isNext = this.matchesAnyPattern(ariaLabel, nextButtonTextPatterns);

      if (isNext && !nextButton) nextButton = element;
    }

    if (loadMoreButton) {
      const selector = this.generateSelectorsForElement(loadMoreButton, doc, selectorGenerator);
      return { type: 'clickLoadMore', selector, confidence: 'high' };
    }

    if (nextButton) {
      const selector = this.generateSelectorsForElement(nextButton, doc, selectorGenerator);
      return { type: 'clickNext', selector, confidence: 'high' };
    }

    if (this.containsNumericPageLinks(wrapper)) {
      const lastLink = this.findLastPageLink(wrapper);
      if (lastLink) {
        const selector = this.generateSelectorsForElement(lastLink, doc, selectorGenerator);
        return { type: 'clickNext', selector, confidence: 'medium' };
      }
    }

    return null;
  }

  private findLastPageLink(container: HTMLElement): HTMLElement | null {
    const links = Array.from(container.querySelectorAll('a, button, [role="button"]')) as HTMLElement[];
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const isActive = link.getAttribute('aria-current') === 'page' ||
        link.classList.contains('active') ||
        link.classList.contains('current') ||
        link.classList.contains('selected');
      if (isActive && i + 1 < links.length) return links[i + 1];
    }
    return null;
  }

  private detectFromNearbyElements(
    listContainer: HTMLElement,
    doc: Document,
    selectorGenerator: ClientSelectorGenerator
  ): PaginationDetectionResult | null {
    return this.scanClickables(listContainer, doc, selectorGenerator, true);
  }

  private detectFromFullDocument(
    listContainer: HTMLElement,
    doc: Document,
    selectorGenerator: ClientSelectorGenerator
  ): PaginationDetectionResult | null {
    return this.scanClickables(listContainer, doc, selectorGenerator, false);
  }

  private scanClickables(
    listContainer: HTMLElement,
    doc: Document,
    selectorGenerator: ClientSelectorGenerator,
    requireNear: boolean
  ): PaginationDetectionResult | null {
    const clickableElements = this.getClickableElements(doc);

    let nextButton: HTMLElement | null = null;
    let nextButtonScore = 0;
    let loadMoreButton: HTMLElement | null = null;
    let loadMoreScore = 0;

    for (const element of clickableElements) {
      if (!this.isVisible(element)) continue;
      if (listContainer.contains(element)) continue;
      if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true') continue;

      const text = (element.textContent || '').trim();
      const ariaLabel = element.getAttribute('aria-label') || '';
      const title = element.getAttribute('title') || '';
      if (text.length > MAX_BUTTON_TEXT_LENGTH) continue;

      const combinedText = `${text} ${ariaLabel} ${title}`;
      const nearList = this.isNearList(element, listContainer);

      if (requireNear && !nearList) continue;

      if (this.matchesAnyPattern(combinedText, loadMorePatterns)) {
        let score = 10;
        if (nearList) score += 5;
        if (element.tagName === 'BUTTON') score += 2;
        if (paginationContainerPatterns.test(element.className || '')) score += 3;
        if (score > loadMoreScore) { loadMoreScore = score; loadMoreButton = element; }
      }

      let isNext = this.matchesAnyPattern(combinedText, nextButtonTextPatterns);
      if (!isNext && text.length <= 3) isNext = this.matchesAnyPattern(text, nextButtonArrowPatterns);
      if (!isNext && !text.trim()) isNext = this.matchesAnyPattern(ariaLabel, nextButtonTextPatterns);

      if (isNext) {
        let score = 10;
        if (nearList) score += 5;
        if (element.tagName === 'BUTTON') score += 2;
        if (paginationContainerPatterns.test(element.className || '')) score += 3;
        const paginationAncestor = element.closest('[class*="paginat"], [class*="pager"], [aria-label*="paginat" i]');
        if (paginationAncestor) score += 5;
        if (score > nextButtonScore) { nextButtonScore = score; nextButton = element; }
      }
    }

    const threshold = requireNear ? 15 : 10;

    if (loadMoreButton && loadMoreScore >= threshold) {
      const selector = this.generateSelectorsForElement(loadMoreButton, doc, selectorGenerator);
      const confidence = loadMoreScore >= 18 ? 'high' : loadMoreScore >= 15 ? 'medium' : 'low';
      return { type: 'clickLoadMore', selector, confidence };
    }

    if (nextButton && nextButtonScore >= threshold) {
      const selector = this.generateSelectorsForElement(nextButton, doc, selectorGenerator);
      const confidence = nextButtonScore >= 18 ? 'high' : nextButtonScore >= 15 ? 'medium' : 'low';
      return { type: 'clickNext', selector, confidence };
    }

    return null;
  }

  // ── Utilities ──

  private evaluateSelector(selector: string, doc: Document): HTMLElement[] {
    try {
      const isXPath = selector.startsWith('//') || selector.startsWith('(//');
      if (isXPath) {
        const result = doc.evaluate(selector, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        const elements: HTMLElement[] = [];
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);
          if (node && node.nodeType === Node.ELEMENT_NODE) elements.push(node as HTMLElement);
        }
        return elements;
      }
      return Array.from(doc.querySelectorAll(selector));
    } catch {
      return [];
    }
  }

  private getClickableElements(doc: Document): HTMLElement[] {
    const clickables: HTMLElement[] = [];
    for (const sel of ['button', 'a', '[role="button"]', '[onclick]', '.btn', '.button']) {
      clickables.push(...Array.from(doc.querySelectorAll(sel)) as HTMLElement[]);
    }
    return Array.from(new Set(clickables));
  }

  private getClickableElementsIn(container: HTMLElement): HTMLElement[] {
    const clickables: HTMLElement[] = [];
    for (const sel of ['button', 'a', '[role="button"]', '[onclick]', '.btn', '.button']) {
      clickables.push(...Array.from(container.querySelectorAll(sel)) as HTMLElement[]);
    }
    if (['BUTTON', 'A'].includes(container.tagName) || container.getAttribute('role') === 'button') {
      clickables.push(container);
    }
    return Array.from(new Set(clickables));
  }

  private isVisible(element: HTMLElement): boolean {
    try {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' &&
        element.offsetWidth > 0 && element.offsetHeight > 0;
    } catch {
      return false;
    }
  }

  private matchesAnyPattern(text: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(text));
  }

  private isNearList(element: HTMLElement, listContainer: HTMLElement): boolean {
    try {
      const listRect = listContainer.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      if (elementRect.top >= listRect.bottom && elementRect.top <= listRect.bottom + 300) return true;
      if (elementRect.bottom <= listRect.top && elementRect.bottom >= listRect.top - 200) return true;

      const verticalOverlap = !(elementRect.bottom < listRect.top || elementRect.top > listRect.bottom);
      if (verticalOverlap) {
        const horizontalDistance = Math.min(
          Math.abs(elementRect.left - listRect.right),
          Math.abs(elementRect.right - listRect.left)
        );
        if (horizontalDistance < 150) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private detectInfiniteScrollIndicators(doc: Document): number {
    try {
      let score = 0;
      if (doc.documentElement.scrollHeight <= window.innerHeight) return 0;

      for (const sel of ['[data-infinite]', '[data-scroll-trigger]', '#infinite-scroll-trigger', '[class*="infinite-scroll"]']) {
        if (doc.querySelector(sel)) { score += 6; break; }
      }
      for (const sel of ['.infinite-scroll', '[data-infinite-scroll]', '[class*="infinite-scroll"]']) {
        if (doc.querySelector(sel)) { score += 6; break; }
      }
      for (const sel of ['[aria-label*="scroll to top" i]', '[title*="back to top" i]', '.back-to-top', '#back-to-top']) {
        try {
          const el = doc.querySelector(sel);
          if (el && this.isVisible(el as HTMLElement)) { score += 2; break; }
        } catch { continue; }
      }
      if (doc.documentElement.scrollHeight > window.innerHeight * 5) score += 2;
      return score;
    } catch {
      return 0;
    }
  }

  private generateSelectorsForElement(
    element: HTMLElement,
    doc: Document,
    selectorGenerator: ClientSelectorGenerator
  ): string | null {
    try {
      const primary = selectorGenerator.generateSelectorsFromElement(element, doc);
      if (!primary) return null;

      const selectorChain = [
        primary && 'iframeSelector' in primary && primary.iframeSelector?.full ? primary.iframeSelector.full : null,
        primary && 'shadowSelector' in primary && primary.shadowSelector?.full ? primary.shadowSelector.full : null,
        primary && 'testIdSelector' in primary ? primary.testIdSelector : null,
        primary && 'id' in primary ? primary.id : null,
        primary && 'hrefSelector' in primary ? primary.hrefSelector : null,
        primary && 'relSelector' in primary ? primary.relSelector : null,
        primary && 'accessibilitySelector' in primary ? primary.accessibilitySelector : null,
        primary && 'attrSelector' in primary ? primary.attrSelector : null,
        primary && 'generalSelector' in primary ? primary.generalSelector : null,
      ].filter(s => s != null && s !== '').join(',');

      return selectorChain || null;
    } catch {
      return null;
    }
  }
}

export const clientPaginationDetector = new ClientPaginationDetector();
