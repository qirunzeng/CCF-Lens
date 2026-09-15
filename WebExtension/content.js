(() => {
  "use strict";

  const catalog = globalThis.CCFLensCatalog?.entries ?? [];
  const nameIndex = new Map();
  const abbreviationIndex = new Map();
  const abbreviationAliases = new Map([
    ["sigkdd", ["kdd"]]
  ]);
  const scholarVenueAliases = [
    { phrase: "advances in neural information processing systems", abbreviation: "neurips", kind: "conference" },
    { phrase: "conference on computer vision and pattern recognition", abbreviation: "cvpr", kind: "conference" },
    { phrase: "international conference on computer vision", abbreviation: "iccv", kind: "conference" },
    { phrase: "acm international conference on information", abbreviation: "cikm", kind: "conference" },
    { phrase: "international symposium on theory", abbreviation: "mobihoc", kind: "conference" },
    { phrase: "annual ieee international conference on sensing communication", abbreviation: "secon", kind: "conference" }
  ];
  const scholarIgnoredUppercaseTokens = new Set([
    "acm", "cvf", "ieee", "lncs"
  ]);
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
      const key = canonicalAbbreviation(abbreviation);
      addToIndex(abbreviationIndex, key, entry);
      for (const alias of abbreviationAliases.get(key) ?? []) {
        addToIndex(abbreviationIndex, alias, entry);
      }
    }
  }

  const selectorsByHost = {
    "scholar.google.com": [".gs_ri .gs_a", ".gsc_a_t .gs_gray"],
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

  const findScholarMatches = (rawText) => {
    const parts = String(rawText ?? "").split(/\s+[-–—]\s+/u);
    const venueParts = parts.length >= 3 ? parts.slice(1, -1) : [rawText];

    for (const venuePart of venueParts) {
      const rawCandidate = String(venuePart ?? "")
        .replace(/^[\s.…·]+|[\s.…·]+$/gu, "")
        .trim();
      if (!rawCandidate) continue;

      // Parenthesized abbreviations such as "(ICDM)" and "(ICCV)" are the
      // strongest signal, and must be checked before trimming a leading year.
      const rawExact = findMatches(rawCandidate);
      if (rawExact.length) return rawExact;

      const candidate = rawCandidate
        .replace(/^(?:19|20)\d{2}\s+/u, "")
        .replace(/[,;]\s*(?:19|20)\d{2}\b.*$/u, "")
        .replace(/\s+\d+\s*(?:\([^)]*\))?\s*,\s*\d+(?:\s*[-–]\s*\d+)?\s*$/u, "")
        .replace(/,\s*\d+(?:\s*[-–]\s*\d+)?\s*$/u, "")
        .trim();

      const exact = findMatches(candidate);
      if (exact.length) return exact;

      // CCF ranks full/regular conference papers, not colocated or secondary
      // tracks. This check comes after exact matching because a few standalone
      // venues whose official names contain "Workshop" are themselves listed.
      if (/\b(?:findings?|workshops?|short\s+papers?|demos?|technical\s+briefs?|summar(?:y|ies))\b|\bcompanion\s+proceedings\b/iu.test(rawCandidate)) {
        continue;
      }

      const leadingAbbreviation = rawCandidate.match(/^([A-Z][A-Za-z0-9-]{2,})\s*['’]?\s*\d{4}\b/u)?.[1];
      if (leadingAbbreviation) {
        const leadingMatch = abbreviationIndex.get(canonicalAbbreviation(leadingAbbreviation));
        if (leadingMatch?.length) return unique(leadingMatch);
      }

      const normalized = canonicalName(candidate).replace(/^(?:of|in) the\s+/u, "");
      const conferenceContext = /\b(?:conference|symposium|proceedings|workshop|meeting)\b/iu.test(rawCandidate);
      // Scholar often wraps a real venue acronym in qualifiers such as
      // "Highlight" or "Long Paper". Match only all-uppercase
      // catalog abbreviations in conference-shaped text and explicitly reject
      // publisher/series tokens. This prevents journal titles such as ACM
      // SIGMETRICS Performance Evaluation Review from inheriting the rank of
      // the SIGMETRICS conference.
      const qualifiedAcronymContext = conferenceContext
        || Boolean(leadingAbbreviation)
        || /\b(?:long paper|spotlight|highlight)\b/iu.test(rawCandidate);
      if (qualifiedAcronymContext) {
        const abbreviationTokens = rawCandidate.match(/\b[A-Z][A-Z0-9-]{3,}\b/g) ?? [];
        for (const token of abbreviationTokens) {
          const key = canonicalAbbreviation(token);
          if (scholarIgnoredUppercaseTokens.has(key)) continue;
          const embedded = abbreviationIndex.get(key);
          if (embedded?.length) return unique(embedded);
        }
      }

      // A small, explicit alias list covers Scholar's established display
      // names without turning the matcher into unsafe general fuzzy matching.
      for (const alias of scholarVenueAliases) {
        if (!normalized.includes(alias.phrase)) continue;
        const aliased = unique((abbreviationIndex.get(alias.abbreviation) ?? [])
          .filter((entry) => entry.kind === alias.kind));
        if (aliased.length) return aliased;
      }

      const wordCount = normalized.split(" ").filter(Boolean).length;
      if (normalized.length < 20 || wordCount < 3) continue;

      const partial = unique(catalog.filter((entry) => {
        if (conferenceContext && entry.kind !== "conference") return false;
        const name = canonicalName(entry.name);
        return name.includes(normalized) || normalized.includes(name);
      }));
      const distinctNames = new Set(partial.map((entry) => canonicalName(entry.name)));
      if (distinctNames.size === 1) return partial;
    }
    return [];
  };

  if (globalThis.__CCF_LENS_TEST__) {
    globalThis.__CCF_LENS_API__ = Object.freeze({
      canonicalName,
      canonicalAbbreviation,
      findMatches,
      findScholarMatches
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
      const matches = location.hostname === "scholar.google.com"
        ? findScholarMatches(text)
        : findMatches(text);
      renderBadge(element, matches);
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
