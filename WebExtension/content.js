(() => {
  "use strict";

  const ccfCatalog = globalThis.CCFLensCatalog?.entries ?? [];
  const coreCatalog = globalThis.CORELensCatalog?.entries ?? [];
  const thCatalog = globalThis.THCPLLensCatalog?.entries ?? [];
  const nameIndex = new Map();
  const abbreviationIndex = new Map();
  const coreNameIndex = new Map();
  const coreAbbreviationIndex = new Map();
  const thNameIndex = new Map();
  const thAbbreviationIndex = new Map();
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
    .replace(/\btrans\b/g, "transactions")
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

  const indexCatalog = (catalog, names, abbreviations, includeAliases = false) => {
    for (const entry of catalog) {
      addToIndex(names, canonicalName(entry.name), entry);
      const nameWithoutHistory = entry.name
        .replace(/\s*\((?:was|previously|formerly|merged|amalgamation|changed|duplicate)\b.*$/iu, "")
        .trim();
      if (nameWithoutHistory !== entry.name) {
        addToIndex(names, canonicalName(nameWithoutHistory), entry);
      }

      const primaryAbbreviation = entry.abbreviation.replace(/[（(].*$/u, "").trim();
      const candidates = [primaryAbbreviation];
      const previousName = entry.abbreviation.match(/(?:原|formerly)\s*([^）)]+)/i)?.[1];
      if (previousName) candidates.push(previousName);
      for (const abbreviation of candidates) {
        const key = canonicalAbbreviation(abbreviation);
        addToIndex(abbreviations, key, entry);
        if (!includeAliases) continue;
        for (const alias of abbreviationAliases.get(key) ?? []) {
          addToIndex(abbreviations, alias, entry);
        }
      }
    }
  };

  indexCatalog(ccfCatalog, nameIndex, abbreviationIndex, true);
  indexCatalog(coreCatalog, coreNameIndex, coreAbbreviationIndex);
  indexCatalog(thCatalog, thNameIndex, thAbbreviationIndex, true);

  const selectorsByHost = {
    "scholar.google.com": [".gs_ri .gs_a", ".gsc_a_t .gs_gray"],
    "ieeexplore.ieee.org": [".description > a[href*='/xpl/']"],
    "dblp.org": ["cite a span[itemprop='isPartOf'] > span[itemprop='name']"],
    "dblp.uni-trier.de": ["cite a span[itemprop='isPartOf'] > span[itemprop='name']"],
    "dl.acm.org": [".issue-item__detail .epub-section__title", ".source > span:nth-child(2)"]
  };

  const unique = (entries) => [...new Map(entries.map((entry) => [
    `${entry.id ?? ""}|${entry.rank}|${entry.kind}|${entry.domain ?? ""}|${entry.name}`,
    entry
  ])).values()];

  const findMatchesIn = (rawText, names, abbreviations) => {
    const text = canonicalName(rawText);
    const exact = names.get(text);
    if (exact?.length) return unique(exact);

    const parenthetical = [...rawText.matchAll(/\(([^()]+)\)/g)].at(-1)?.[1] ?? "";
    const candidates = [parenthetical, rawText]
      .map(canonicalAbbreviation)
      .filter(Boolean);
    for (const candidate of candidates) {
      const match = abbreviations.get(candidate.replace(/\d+$/g, ""));
      if (match?.length) return unique(match);
    }
    return [];
  };

  const findMatches = (rawText) => findMatchesIn(rawText, nameIndex, abbreviationIndex);
  const findCoreMatches = (rawText) => findMatchesIn(rawText, coreNameIndex, coreAbbreviationIndex);
  const findThMatches = (rawText) => findMatchesIn(rawText, thNameIndex, thAbbreviationIndex);

  const findScholarMatchesIn = (rawText, catalog, names, abbreviations) => {
    const parts = String(rawText ?? "").split(/\s+[-–—]\s+/u);
    const venueParts = parts.length >= 3 ? parts.slice(1, -1) : [rawText];

    for (const venuePart of venueParts) {
      const rawCandidate = String(venuePart ?? "")
        .replace(/^[\s.…·]+|[\s.…·]+$/gu, "")
        .trim();
      if (!rawCandidate) continue;

      // Parenthesized abbreviations such as "(ICDM)" and "(ICCV)" are the
      // strongest signal, and must be checked before trimming a leading year.
      const rawExact = findMatchesIn(rawCandidate, names, abbreviations);
      if (rawExact.length) return rawExact;

      const candidate = rawCandidate
        .replace(/^(?:19|20)\d{2}\s+/u, "")
        .replace(/[,;]\s*(?:19|20)\d{2}\b.*$/u, "")
        .replace(/\s+\d+\s*(?:\([^)]*\))?\s*,\s*\d+(?:\s*[-–]\s*\d+)?\s*$/u, "")
        .replace(/,\s*\d+(?:\s*[-–]\s*\d+)?\s*$/u, "")
        .trim();

      const exact = findMatchesIn(candidate, names, abbreviations);
      if (exact.length) return exact;

      // CCF ranks full/regular conference papers, not colocated or secondary
      // tracks. This check comes after exact matching because a few standalone
      // venues whose official names contain "Workshop" are themselves listed.
      if (/\b(?:findings?|workshops?|short\s+papers?|demos?|technical\s+briefs?|summar(?:y|ies))\b|\bcompanion\s+proceedings\b/iu.test(rawCandidate)) {
        continue;
      }

      const leadingAbbreviation = rawCandidate.match(/^([A-Z][A-Za-z0-9-]{2,})\s*['’]?\s*\d{4}\b/u)?.[1];
      if (leadingAbbreviation) {
        const leadingMatch = abbreviations.get(canonicalAbbreviation(leadingAbbreviation));
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
          const embedded = abbreviations.get(key);
          if (embedded?.length) return unique(embedded);
        }
      }

      // A small, explicit alias list covers Scholar's established display
      // names without turning the matcher into unsafe general fuzzy matching.
      for (const alias of scholarVenueAliases) {
        if (!normalized.includes(alias.phrase)) continue;
        const aliased = unique((abbreviations.get(alias.abbreviation) ?? [])
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

  const findScholarMatches = (rawText) => findScholarMatchesIn(
    rawText, ccfCatalog, nameIndex, abbreviationIndex
  );
  const findCoreScholarMatches = (rawText) => findScholarMatchesIn(
    rawText, coreCatalog, coreNameIndex, coreAbbreviationIndex
  );
  const findThScholarMatches = (rawText) => findScholarMatchesIn(
    rawText, thCatalog, thNameIndex, thAbbreviationIndex
  );

  const findRankings = (rawText, scholar = false) => ({
    ccf: scholar ? findScholarMatches(rawText) : findMatches(rawText),
    core: scholar ? findCoreScholarMatches(rawText) : findCoreMatches(rawText),
    th: scholar ? findThScholarMatches(rawText) : findThMatches(rawText)
  });

  if (globalThis.__CCF_LENS_TEST__) {
    globalThis.__CCF_LENS_API__ = Object.freeze({
      canonicalName,
      canonicalAbbreviation,
      findMatches,
      findScholarMatches,
      findCoreMatches,
      findCoreScholarMatches,
      findThMatches,
      findThScholarMatches,
      findRankings
    });
  }

  const rankOrder = new Map([
    ["A*", 0], ["A", 1], ["B", 2], ["Australasian B", 3],
    ["C", 4], ["Australasian C", 5]
  ]);
  const coreRankLabel = (rank) => rank
    .replace("Australasian B", "B (AU)")
    .replace("Australasian C", "C (AU)");
  const coreRankClass = (rank) => rank
    .replace("A*", "a-star")
    .replace("Australasian ", "au-")
    .toLowerCase();

  const renderBadges = (venueElement, rankings) => {
    venueElement.parentElement?.querySelectorAll(":scope > .ccf-lens-badge").forEach((badge) => badge.remove());
    let insertionPoint = venueElement;

    const groups = [
      {
        source: "ccf",
        label: "CCF",
        matches: rankings.ccf,
        rankLabel: (rank) => rank,
        rankClass: (rank) => rank.toLowerCase(),
        title: (entry) => `${entry.name} · ${entry.domain} · CCF ${entry.rank}`
      },
      {
        source: "core",
        label: "CORE",
        matches: rankings.core,
        rankLabel: coreRankLabel,
        rankClass: coreRankClass,
        title: (entry) => `${entry.name} · ICORE 2026 · ${entry.rank}`
      },
      {
        source: "th",
        label: "TH-CPL",
        matches: rankings.th,
        rankLabel: (rank) => rank,
        rankClass: (rank) => rank.toLowerCase(),
        title: (entry) => `${entry.name} · ${entry.domain} · TH-CPL 2019 ${entry.rank}`
      }
    ];

    for (const group of groups) {
      if (!group.matches.length) continue;
      const ranks = [...new Set(group.matches.map((entry) => entry.rank))]
        .sort((left, right) => (rankOrder.get(left) ?? 99) - (rankOrder.get(right) ?? 99));
      const badge = document.createElement("span");
      badge.className = [
        "ccf-lens-badge",
        `ccf-lens-source-${group.source}`,
        `ccf-lens-${group.source}-rank-${group.rankClass(ranks[0])}`
      ].join(" ");
      badge.textContent = `${group.label} ${ranks.map(group.rankLabel).join("/")}`;
      badge.setAttribute("role", "note");
      badge.title = group.matches.map(group.title).join("\n");
      insertionPoint.after(badge);
      insertionPoint = badge;
    }
  };

  const scan = () => {
    const selectors = selectorsByHost[location.hostname] ?? [];
    for (const element of document.querySelectorAll(selectors.join(","))) {
      const text = element.textContent?.trim() ?? "";
      if (!text || observedText.get(element) === text) continue;
      observedText.set(element, text);
      const rankings = findRankings(text, location.hostname === "scholar.google.com");
      renderBadges(element, rankings);
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
