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

for (const file of ["WebExtension/catalog.js", "WebExtension/content.js"]) {
  vm.runInContext(await readFile(new URL(file, root), "utf8"), context, { filename: file });
}

const api = context.__CCF_LENS_API__;

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
