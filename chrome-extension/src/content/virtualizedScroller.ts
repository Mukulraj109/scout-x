/**
 * Virtualized Scroller - Handles React-virtualized / lazy-loaded lists.
 * Scrolls through the page to force all items to render in the DOM before detection.
 */

/**
 * Find scrollable containers on the page (candidates for virtualized lists).
 */
function findScrollableContainers(): Element[] {
  const containers: Element[] = [];
  const all = document.querySelectorAll<HTMLElement>('*');

  for (const el of Array.from(all)) {
    // Skip tiny elements
    if (el.offsetHeight < 200) continue;

    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') &&
                         el.scrollHeight > el.clientHeight + 10;

    if (isScrollable) containers.push(el);
  }

  return containers;
}

/**
 * Pre-scroll the page (and any scrollable containers) to force virtualized
 * lists to render all items. Returns to the original scroll position when done.
 */
export async function loadAllVirtualizedItems(
  onProgress?: (info: { phase: string; itemsFound: number }) => void
): Promise<void> {
  // Save current scroll positions
  const originalWindowScroll = { x: window.scrollX, y: window.scrollY };

  const containers = findScrollableContainers();
  const originalContainerScrolls = containers.map((c) => ({
    el: c,
    top: (c as HTMLElement).scrollTop,
  }));

  onProgress?.({ phase: 'Loading all items...', itemsFound: 0 });

  try {
    // 1. Scroll the window itself
    await scrollThroughWindow(onProgress);

    // 2. Scroll each scrollable container
    for (const container of containers) {
      await scrollThroughContainer(container as HTMLElement);
    }

    // 3. Final pause for late-loaded content
    await delay(400);
  } finally {
    // Restore scroll positions
    for (const { el, top } of originalContainerScrolls) {
      (el as HTMLElement).scrollTop = top;
    }
    window.scrollTo(originalWindowScroll.x, originalWindowScroll.y);
  }

  onProgress?.({ phase: 'Done', itemsFound: document.querySelectorAll('*').length });
}

/**
 * Scroll through the window top to bottom in chunks, waiting for DOM to stabilize at each step.
 */
async function scrollThroughWindow(
  onProgress?: (info: { phase: string; itemsFound: number }) => void
): Promise<void> {
  const viewportHeight = window.innerHeight;
  let lastScrollHeight = 0;
  let stableCount = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 40;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Scroll down by one viewport
    const targetY = Math.min(
      window.scrollY + viewportHeight * 0.9,
      document.documentElement.scrollHeight
    );
    window.scrollTo(0, targetY);

    // Wait for DOM to settle
    await delay(200);

    // Check if we've reached the bottom
    const atBottom = window.scrollY + viewportHeight >= document.documentElement.scrollHeight - 50;
    const currentHeight = document.documentElement.scrollHeight;

    // If height hasn't changed for 3 iterations and we're at the bottom, stop
    if (currentHeight === lastScrollHeight) {
      stableCount++;
      if (stableCount >= 3 && atBottom) break;
    } else {
      stableCount = 0;
    }
    lastScrollHeight = currentHeight;

    if (onProgress) {
      onProgress({
        phase: `Scrolling... (${Math.round((window.scrollY / currentHeight) * 100)}%)`,
        itemsFound: document.querySelectorAll('*').length,
      });
    }

    if (atBottom && currentHeight === lastScrollHeight) break;
  }
}

/**
 * Scroll through a specific container element top to bottom.
 */
async function scrollThroughContainer(container: HTMLElement): Promise<void> {
  const viewportHeight = container.clientHeight;
  let lastScrollHeight = 0;
  let stableCount = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 40;

  container.scrollTop = 0;
  await delay(100);

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    container.scrollTop = Math.min(
      container.scrollTop + viewportHeight * 0.9,
      container.scrollHeight
    );

    await delay(200);

    const atBottom = container.scrollTop + viewportHeight >= container.scrollHeight - 50;
    const currentHeight = container.scrollHeight;

    if (currentHeight === lastScrollHeight) {
      stableCount++;
      if (stableCount >= 3 && atBottom) break;
    } else {
      stableCount = 0;
    }
    lastScrollHeight = currentHeight;

    if (atBottom && currentHeight === lastScrollHeight) break;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
