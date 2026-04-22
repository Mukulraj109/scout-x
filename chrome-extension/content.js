(function () {
  if (window.__MAXUN_SELECTOR_EXTENSION__) {
    return;
  }
  window.__MAXUN_SELECTOR_EXTENSION__ = true;

  const state = {
    enabled: false,
    selectingField: "title",
    hoveredElement: null,
    selectedListElement: null,
    selections: {
      listSelector: "",
      listXPath: "",
      listPreviewText: "",
      listPreviewCount: 0,
      pagination: {
        mode: "none",
        selector: "",
      },
      fields: {
        title: null,
        price: null,
        link: null,
        image: null,
      },
      previewRows: [],
    },
  };

  const overlay = createOverlay();
  const badge = createBadge();

  document.addEventListener("mousemove", handleMouseMove, true);
  document.addEventListener("click", handleClick, true);
  document.addEventListener("keydown", handleKeydown, true);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  function handleRuntimeMessage(message, sender, sendResponse) {
    if (message.type === "maxun-start-selection") {
      state.enabled = true;
      state.selectingField = message.fieldType || "title";
      badge.textContent = `Selecting: ${state.selectingField}`;
      badge.style.display = "block";
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "maxun-stop-selection") {
      disableSelectionMode();
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "maxun-clear-selection") {
      state.selectedListElement = null;
      state.selections = {
        listSelector: "",
        listXPath: "",
        listPreviewText: "",
        listPreviewCount: 0,
        pagination: {
          mode: "none",
          selector: "",
        },
        fields: {
          title: null,
          price: null,
          link: null,
          image: null,
        },
        previewRows: [],
      };
      disableSelectionMode();
      sendResponse({ ok: true });
      return;
    }

    return false;
  }

  function handleMouseMove(event) {
    if (!state.enabled) return;
    const target = getSelectableElement(event.target);
    if (!target || target === overlay || target === badge) return;
    state.hoveredElement = target;
    const rect = target.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = `${rect.left + window.scrollX}px`;
    overlay.style.top = `${rect.top + window.scrollY}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function handleClick(event) {
    if (!state.enabled) return;

    const target = getSelectableElement(event.target);
    if (!target || target === overlay || target === badge) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const selection = buildSelection(target, state.selectingField);
    if (!selection) return;

    if (!state.selectedListElement) {
      const listInfo = detectListContainer(target);
      state.selectedListElement = listInfo?.container || target.parentElement || document.body;
      state.selections.listSelector = listInfo?.selector || generateRobustSelector(state.selectedListElement);
      state.selections.listXPath = generateXPath(state.selectedListElement);
      state.selections.listPreviewText = previewText(state.selectedListElement);
      state.selections.listPreviewCount = listInfo?.count || 1;
      state.selections.pagination = detectPagination();
    }

    state.selections.fields[state.selectingField] = selection;
    state.selections.previewRows = buildPreviewRows();

    chrome.runtime.sendMessage({
      type: "save-selection",
      payload: state.selections,
    });

    badge.textContent = `Saved ${state.selectingField}`;
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      disableSelectionMode();
    }
  }

  function disableSelectionMode() {
    state.enabled = false;
    overlay.style.display = "none";
    badge.style.display = "none";
  }

  function getSelectableElement(node) {
    if (!(node instanceof Element)) return null;
    if (node.id === "__maxun_selector_overlay" || node.id === "__maxun_selector_badge") {
      return null;
    }
    return node;
  }

  function buildSelection(element, fieldName) {
    const selector = generateRelativeSelector(element, state.selectedListElement) || generateRobustSelector(element);
    const attribute = getBestAttribute(element, fieldName);
    return {
      selector,
      xpath: generateXPath(element),
      attribute,
      previewText: previewText(element),
      tagName: element.tagName.toLowerCase(),
    };
  }

  function buildPreviewRows() {
    if (!state.selections.listSelector) return [];
    const items = Array.from(document.querySelectorAll(state.selections.listSelector)).slice(0, 10);
    return items.map((item) => {
      const row = {};
      Object.entries(state.selections.fields).forEach(([fieldName, config]) => {
        if (!config?.selector) return;
        const value = extractValue(item, config.selector, config.attribute);
        row[fieldName] = cleanupValue(value);
      });
      return row;
    }).filter((row) => Object.values(row).some(Boolean));
  }

  function extractValue(root, selector, attribute) {
    const target = root.matches(selector) ? root : root.querySelector(selector);
    if (!target) return "";
    if (attribute === "href") return target.getAttribute("href") || target.href || "";
    if (attribute === "src") return target.getAttribute("src") || target.src || "";
    if (attribute && attribute.startsWith("data-")) return target.getAttribute(attribute) || "";
    return target.innerText || target.textContent || "";
  }

  function cleanupValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function previewText(element) {
    return cleanupValue(element.innerText || element.textContent || "").slice(0, 160);
  }

  function createOverlay() {
    const el = document.createElement("div");
    el.id = "__maxun_selector_overlay";
    Object.assign(el.style, {
      position: "absolute",
      pointerEvents: "none",
      zIndex: "2147483646",
      border: "2px solid #ff6b00",
      background: "rgba(255, 107, 0, 0.12)",
      display: "none",
      boxSizing: "border-box",
    });
    document.documentElement.appendChild(el);
    return el;
  }

  function createBadge() {
    const el = document.createElement("div");
    el.id = "__maxun_selector_badge";
    Object.assign(el.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      zIndex: "2147483647",
      background: "#111827",
      color: "#f9fafb",
      padding: "8px 12px",
      borderRadius: "999px",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      fontSize: "12px",
      fontWeight: "700",
      boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
      display: "none",
    });
    document.documentElement.appendChild(el);
    return el;
  }

  function detectListContainer(element) {
    const candidates = [];
    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 6) {
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
        const classMatches = current.classList.length > 0
          ? siblings.filter((child) => hasSharedStableClass(child, current)).length
          : 0;
        const score = siblings.length + classMatches * 2;
        if (siblings.length >= 2) {
          candidates.push({
            container: current,
            selector: generateRobustSelector(current),
            count: siblings.length,
            score,
          });
        }
      }
      current = current.parentElement;
      depth += 1;
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function hasSharedStableClass(a, b) {
    const stableClasses = Array.from(b.classList).filter(isStableClass);
    return stableClasses.some((className) => a.classList.contains(className));
  }

  function detectPagination() {
    const nextSelectors = [
      'a[rel="next"]',
      'button[aria-label*="next" i]',
      'a[aria-label*="next" i]',
      'button',
      'a'
    ];

    for (const selector of nextSelectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const candidate = elements.find((element) => /next|load more|show more|more results|›|»/i.test(cleanupValue(element.textContent)));
      if (candidate) {
        return {
          mode: /load more|show more|more results/i.test(cleanupValue(candidate.textContent)) ? "next-button" : "next-button",
          selector: generateRobustSelector(candidate),
        };
      }
    }

    const scrollHeight = document.body?.scrollHeight || 0;
    const viewportHeight = window.innerHeight || 0;
    if (scrollHeight > viewportHeight * 2) {
      return {
        mode: "infinite-scroll",
        selector: "",
      };
    }

    return {
      mode: "none",
      selector: "",
    };
  }

  function getBestAttribute(element, fieldName) {
    if (fieldName === "link") {
      const anchor = element.closest("a") || element.querySelector("a");
      if (anchor) return "href";
    }
    if (fieldName === "image") {
      const image = element.tagName === "IMG" ? element : element.querySelector("img");
      if (image) return "src";
    }
    return "innerText";
  }

  function generateRelativeSelector(element, root) {
    if (!root || !root.contains(element)) return "";
    if (root === element) return generateRobustSelector(element);

    const segments = [];
    let current = element;
    while (current && current !== root && current.nodeType === Node.ELEMENT_NODE) {
      segments.unshift(buildSegment(current));
      const joined = segments.join(" > ");
      try {
        if (root.querySelectorAll(joined).length === 1) {
          return joined;
        }
      } catch (_) {}
      current = current.parentElement;
    }
    return segments.join(" > ");
  }

  function generateRobustSelector(element) {
    if (!(element instanceof Element)) return "";

    if (element.id && isStableId(element.id)) {
      return `#${cssEscape(element.id)}`;
    }

    const path = [];
    let current = element;
    let depth = 0;

    while (current && current.nodeType === Node.ELEMENT_NODE && depth < 5) {
      path.unshift(buildSegment(current));
      const selector = path.join(" > ");
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (_) {}
      current = current.parentElement;
      depth += 1;
    }

    return path.join(" > ");
  }

  function buildSegment(element) {
    const tagName = element.tagName.toLowerCase();
    const stableClasses = Array.from(element.classList).filter(isStableClass).slice(0, 2);
    if (stableClasses.length > 0) {
      return `${tagName}.${stableClasses.map(cssEscape).join(".")}`;
    }

    const siblings = element.parentElement
      ? Array.from(element.parentElement.children).filter((child) => child.tagName === element.tagName)
      : [];
    if (siblings.length > 1) {
      const index = siblings.indexOf(element) + 1;
      return `${tagName}:nth-of-type(${index})`;
    }

    return tagName;
  }

  function isStableClass(className) {
    return !!className
      && className.length < 40
      && !/\d{3,}/.test(className)
      && !/active|selected|hover|focus|open|close|show|hide/i.test(className)
      && !/[A-Fa-f0-9]{8,}/.test(className);
  }

  function isStableId(id) {
    return !!id
      && id.length < 40
      && !/\d{3,}/.test(id)
      && !/[A-Fa-f0-9]{8,}/.test(id);
  }

  function generateXPath(element) {
    if (!(element instanceof Element)) return "";
    const parts = [];
    let current = element;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const siblings = current.parentNode
        ? Array.from(current.parentNode.children).filter((child) => child.tagName === current.tagName)
        : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
      current = current.parentElement;
    }
    return `/${parts.join("/")}`;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/([ #;?%&,.+*~\':"!^$[\]()=>|/@])/g, "\\$1");
  }
})();
