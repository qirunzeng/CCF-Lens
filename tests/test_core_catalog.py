import json
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class CoreCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(
            (ROOT / "WebExtension/core_catalog.json").read_text(encoding="utf-8")
        )
        cls.entries = cls.catalog["entries"]

    def test_metadata_identifies_official_icore_2026_export(self):
        metadata = self.catalog["metadata"]
        self.assertEqual(metadata["source_name"], "ICORE2026")
        self.assertEqual(metadata["year"], 2026)
        self.assertIn("portal.core.edu.au", metadata["source"])

    def test_catalog_has_all_825_ranked_conferences(self):
        self.assertEqual(len(self.entries), 825)
        self.assertEqual(
            Counter(entry["rank"] for entry in self.entries),
            {
                "A*": 62,
                "A": 108,
                "B": 249,
                "Australasian B": 6,
                "C": 381,
                "Australasian C": 19,
            },
        )

    def test_entries_are_unique_conferences_with_official_links(self):
        self.assertEqual(len({entry["id"] for entry in self.entries}), 825)
        for entry in self.entries:
            self.assertEqual(entry["kind"], "conference")
            self.assertTrue(entry["url"].startswith("https://portal.core.edu.au/conf-ranks/"))

    def test_well_known_examples(self):
        by_abbreviation = {entry["abbreviation"]: entry for entry in self.entries}
        self.assertEqual(by_abbreviation["ICCV"]["rank"], "A*")
        self.assertEqual(by_abbreviation["EMNLP"]["rank"], "A*")
        self.assertEqual(by_abbreviation["KDD"]["rank"], "A*")
        self.assertEqual(by_abbreviation["CIKM"]["rank"], "A")


if __name__ == "__main__":
    unittest.main()
