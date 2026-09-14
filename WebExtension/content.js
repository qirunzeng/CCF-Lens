(() => {
  "use strict";

  const catalog = globalThis.CCFLensCatalog?.entries ?? [];
  const nameIndex = new Map();
  const abbreviationIndex = new Map();
  const observedText = new WeakMap();

  const canonicalName = (value) => String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(proceedings|proc\.?|volume|vol\.?|conference paper|journal article)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  const canonicalAbbreviation = (value) => canonicalName(value).replace(/[^a-z0-9]/g, "");

  const addToIndex = (index, key, entry) => {
    if (!key) return;
    const matches = index.get(key) ?? [];
    matches.push(entry);
    index.set(key, matches);
  };

  for (const entry of catalog) {
    addToIndex(nameIndex, canonicalName(entry.name), entry);
    const primaryAbbreviation = entry.abbreviation.replace(/[（(].*$/u, "").trim();
    const abbreviations = [primaryAbbreviation];
    const previousName = entry.abbreviation.match(/(?:原|formerly)\s*([^）)]+)/i)?.[1];
    if (previousName) abbreviations.push(previousName);
    for (const abbreviation of abbreviations) {
      addToIndex(abbreviationIndex, canonicalAbbreviation(abbreviation), entry);
    }
  }

  const selectorsByHost = {
    "ieeexplore.ieee.org": [".description > a[href*='/xpl/']"],
    "dblp.org": ["cite a span[itemprop='isPartOf'] > span[itemprop='name']"],
    "dblp.uni-trier.de": ["cite a span[itemprop='isPartOf'] > span[itemprop='name']"],
    "dl.acm.org": [".issue-item__detail .epub-section__title", ".source > span:nth-child(2)"]
  };

  const unique = (entries) => [...new Map(entries.map((entry) => [
    `${entry.rank}|${entry.kind}|${entry.domain}|${entry.name}`,
    entry
  ])).values()];

  const findMatches = (rawText) => {
    const text = canonicalName(rawText);
    const exact = nameIndex.get(text);
    if (exact?.length) return unique(exact);

    const parenthetical = [...rawText.matchAll(/\(([^()]+)\)/g)].at(-1)?.[1] ?? "";
    const candidates = [parenthetical, rawText]
      .map(canonicalAbbreviation)
      .filter(Boolean);
    for (const candidate of candidates) {
      const match = abbreviationIndex.get(candidate.replace(/\d+$/g, ""));
      if (match?.length) return unique(match);
    }
    return [];
  };

  if (globalThis.__CCF_LENS_TEST__) {
    globalThis.__CCF_LENS_API__ = Object.freeze({
      canonicalName,
      canonicalAbbreviation,
      findMatches
    });
  }

  const renderBadge = (venueElement, matches) => {
    venueElement.parentElement?.querySelectorAll(":scope > .ccf-lens-badge").forEach((badge) => badge.remove());
    if (!matches.length) return;

    const ranks = [...new Set(matches.map((entry) => entry.rank))].sort();
    const badge = document.createElement("span");
    badge.className = `ccf-lens-badge ccf-lens-rank-${ranks[0].toLowerCase()}`;
    badge.textContent = `CCF ${ranks.join("/")}`;
    badge.setAttribute("role", "note");
    badge.title = matches
      .map((entry) => `${entry.name} · ${entry.domain} · CCF ${entry.rank}`)
      .join("\n");
    venueElement.after(badge);
  };

  const scan = () => {
    const selectors = selectorsByHost[location.hostname] ?? [];
    for (const element of document.querySelectorAll(selectors.join(","))) {
      const text = element.textContent?.trim() ?? "";
      if (!text || observedText.get(element) === text) continue;
      observedText.set(element, text);
      renderBadge(element, findMatches(text));
    }
  };

  let scanQueued = false;
  const queueScan = () => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan();
    });
  };

  scan();
  new MutationObserver(queueScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });
})();
