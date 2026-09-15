import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const context = vm.createContext({
  console,
  location: { hostname: "example.test" },
  document: {
    documentElement: {},
    querySelectorAll: () => []
  },
  MutationObserver: class {
    observe() {}
  },
  requestAnimationFrame: (callback) => callback(),
  __CCF_LENS_TEST__: true
});

for (const file of [
  "WebExtension/catalog.js",
  "WebExtension/core_catalog.js",
  "WebExtension/th_catalog.js",
  "WebExtension/content.js"
]) {
  vm.runInContext(await readFile(new URL(file, root), "utf8"), context, { filename: file });
}

const api = context.__CCF_LENS_API__;
const venueSummary = (matches) => [...matches]
  .map((entry) => [entry.abbreviation, entry.rank]);

test("matches official full names", () => {
  const matches = api.findMatches("IEEE Transactions on Pattern Analysis and Machine Intelligence");
  assert.deepEqual([...new Set(matches.map((entry) => entry.rank))], ["A"]);
});

test("matches abbreviations with a year suffix", () => {
  const matches = api.findMatches("Conference on Neural Information Processing Systems (NeurIPS 2026)");
  assert.deepEqual([...new Set(matches.map((entry) => entry.rank))], ["A"]);
});

test("preserves cross-list ambiguity instead of overwriting it", () => {
  const matches = api.findMatches("Computational Visual Media");
  assert.deepEqual([...new Set(matches.map((entry) => entry.rank))].sort(), ["B", "C"]);
});

test("does not label unrelated venues", () => {
  assert.equal(api.findMatches("Imaginary Symposium on Nothing").length, 0);
});

test("matches official ICORE conference names", () => {
  const matches = api.findCoreMatches("IEEE International Conference on Computer Vision");
  assert.deepEqual(venueSummary(matches), [["ICCV", "A*"]]);
});

test("matches ICORE venues on Google Scholar", () => {
  const matches = api.findCoreScholarMatches(
    "2025 IEEE/CVF International Conference on Computer Vision (ICCV), 273-283"
  );
  assert.deepEqual(venueSummary(matches), [["ICCV", "A*"]]);
});

test("returns both ranking systems without conflating them", () => {
  const rankings = api.findRankings("ICCV 2026", true);
  assert.deepEqual(venueSummary(rankings.ccf), [["ICCV", "A"]]);
  assert.deepEqual(venueSummary(rankings.core), [["ICCV", "A*"]]);
  assert.deepEqual(venueSummary(rankings.th), [["ICCV", "A"]]);
});

test("matches TH-CPL conference names on Google Scholar", () => {
  const matches = api.findThScholarMatches(
    "2025 IEEE/CVF International Conference on Computer Vision (ICCV), 273-283"
  );
  assert.deepEqual(venueSummary(matches), [["ICCV", "A"]]);
});

test("matches TH-CPL journals on Google Scholar", () => {
  const matches = api.findThScholarMatches(
    "IEEE Transactions on Pattern Analysis and Machine Intelligence 47 (1), 1-20"
  );
  assert.deepEqual(venueSummary(matches), [["TPAMI", "A"]]);
});

test("matches TH-CPL SIGKDD through Scholar's KDD shorthand", () => {
  assert.deepEqual(venueSummary(api.findThScholarMatches("KDD'2026")), [["SIGKDD", "A"]]);
});

test("matches every official TH-CPL full name", () => {
  for (const entry of context.THCPLLensCatalog.entries) {
    const matches = api.findThMatches(entry.name);
    assert.ok(
      matches.some((match) => match.name === entry.name && match.rank === entry.rank),
      `missing ${entry.kind} ${entry.rank}: ${entry.name}`
    );
  }
});

test("does not invent an ICORE label for a journal", () => {
  assert.equal(
    api.findCoreScholarMatches(
      "IEEE Transactions on Pattern Analysis and Machine Intelligence 47 (1), 1-20"
    ).length,
    0
  );
});

test("extracts a uniquely truncated Google Scholar venue", () => {
  const matches = api.findScholarMatches(
    "G Zhao, M Pietikainen - IEEE transactions on pattern analysis …, 2007 - ieeexplore.ieee.org"
  );
  assert.deepEqual([...new Set(matches.map((entry) => entry.rank))], ["A"]);
});

test("preserves Google Scholar cross-list ambiguity for an exact venue", () => {
  const matches = api.findScholarMatches(
    "A Author - Computational Visual Media, 2024 - Springer"
  );
  assert.deepEqual([...new Set(matches.map((entry) => entry.rank))].sort(), ["B", "C"]);
});

test("does not guess an ambiguous truncated Google Scholar venue", () => {
  assert.equal(
    api.findScholarMatches("A Author - … on computer vision …, 2024 - example.org").length,
    0
  );
});

test("recognizes Google Scholar's KDD shorthand for SIGKDD", () => {
  const matches = api.findScholarMatches("KDD'2026");
  assert.deepEqual([...new Set(matches.map((entry) => entry.rank))], ["A"]);
});

const scholarProfileCases = [
  ["CVPR 2026 (Highlight)", "CVPR", "A"],
  ["ACM CIKM(Long Paper)", "CIKM", "B"],
  ["ICLR (Spotlight) 2025", "ICLR", "A"],
  ["2022 IEEE International Conference on Data Mining (ICDM), 1335-1340", "ICDM", "B"],
  ["IEEE Transactions on Neural Networks and Learning Systems 35 (12), 17398-17410", "TNNLS", "B"],
  ["Proceedings of the 30th ACM SIGKDD Conference on Knowledge Discovery and …", "SIGKDD", "A"],
  ["2025 IEEE/CVF International Conference on Computer Vision (ICCV), 273-283", "ICCV", "A"],
  ["2018 IEEE/CVF Conference on Computer Vision and Pattern Recognition, 2002-2011", "CVPR", "A"],
  ["Proceedings of the IEEE international conference on computer vision …", "ICCV", "A"],
  ["Advances in Neural Information Processing Systems 38, 164278-164339", "NeurIPS", "A"],
  ["Proceedings of the 31st ACM International Conference on Information …", "CIKM", "B"],
  ["Proceedings of the Twenty-Third International Symposium on Theory …", "MobiHoc", "B"],
  ["2023 20th Annual IEEE International Conference on Sensing, Communication …", "SECON", "B"],
  ["Asia-Pacific Workshop on Networking, 2025", "APNet", "C"]
];

for (const [venue, abbreviation, rank] of scholarProfileCases) {
  test(`matches Google Scholar profile venue: ${abbreviation}`, () => {
    const matches = api.findScholarMatches(venue);
    assert.deepEqual(
      venueSummary(matches),
      [[abbreviation, rank]]
    );
  });
}

test("does not invent a CCF label for a non-catalog journal", () => {
  assert.equal(
    api.findScholarMatches("IEEE Transactions on Industrial Electronics 69 (5), 4999-5008").length,
    0
  );
});

test("does not label arXiv entries", () => {
  assert.equal(api.findScholarMatches("arXiv preprint arXiv:2503.04550").length, 0);
});

for (const venue of [
  "2021 55th Annual Conference on Information Sciences and Systems (CISS), 1-4",
  "ACM SIGMETRICS Performance Evaluation Review 52 (1), 31-33"
]) {
  test(`does not confuse a non-listed publication with a CCF venue: ${venue}`, () => {
    assert.equal(api.findScholarMatches(venue).length, 0);
  });
}

for (const venue of [
  "EMNLP'2026 Findings",
  "EMNLP 2026 Findings",
  "2017 IEEE conference on computer vision and pattern recognition workshops …",
  "Companion Proceedings of the ACM Web Conference 2023, 648-658"
]) {
  test(`does not rank a non-full conference track: ${venue}`, () => {
    assert.equal(api.findScholarMatches(venue).length, 0);
    assert.equal(api.findCoreScholarMatches(venue).length, 0);
    assert.equal(api.findThScholarMatches(venue).length, 0);
  });
}
