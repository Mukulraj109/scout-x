/**
 * Highlighter - Visual highlighting of DOM elements during selection.
 * Manages highlight classes on page elements.
 */

const HIGHLIGHT_CLASS = '__maxun_highlight';
const LIST_HIGHLIGHT_CLASS = '__maxun_list_highlight';
const TABLE_HIGHLIGHT_CLASS = '__maxun_table_highlight';
const SELECTED_CLASS = '__maxun_selected';
const FIRST_PICK_CLASS = '__maxun_first_pick';

let highlightedElements: Element[] = [];
let selectedElements: Element[] = [];
let firstPickElement: Element | null = null;

/**
 * Mark an element as the "first pick" (persistent pink outline).
 */
export function markFirstPick(element: Element) {
  clearFirstPick();
  element.classList.add(FIRST_PICK_CLASS);
  firstPickElement = element;
}

export function clearFirstPick() {
  if (firstPickElement) {
    firstPickElement.classList.remove(FIRST_PICK_CLASS);
    firstPickElement = null;
  }
}

/**
 * Highlight a single element (hover state).
 */
export function highlightElement(element: Element) {
  clearHighlights();
  element.classList.add(HIGHLIGHT_CLASS);
  highlightedElements.push(element);
}

/**
 * Highlight all elements in a list group (yellow/list style).
 */
export function highlightListGroup(elements: Element[]) {
  clearHighlights();
  for (const el of elements) {
    el.classList.add(LIST_HIGHLIGHT_CLASS);
    highlightedElements.push(el);
  }
}

/**
 * Highlight table elements (cyan style).
 */
export function highlightTables(tables: Element[]) {
  clearHighlights();
  for (const el of tables) {
    el.classList.add(TABLE_HIGHLIGHT_CLASS);
    highlightedElements.push(el);
  }
}

/**
 * Mark elements as selected (magenta, persistent).
 */
export function markSelected(elements: Element[]) {
  clearSelected();
  for (const el of elements) {
    el.classList.add(SELECTED_CLASS);
    selectedElements.push(el);
  }
}

/**
 * Clear hover highlights only.
 */
export function clearHighlights() {
  for (const el of highlightedElements) {
    el.classList.remove(HIGHLIGHT_CLASS, LIST_HIGHLIGHT_CLASS, TABLE_HIGHLIGHT_CLASS);
  }
  highlightedElements = [];
}

/**
 * Clear selected state.
 */
export function clearSelected() {
  for (const el of selectedElements) {
    el.classList.remove(SELECTED_CLASS);
  }
  selectedElements = [];
}

/**
 * Clear everything.
 */
export function clearAll() {
  clearHighlights();
  clearSelected();
  clearFirstPick();
}
