import json
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class CatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / "WebExtension/catalog.json").read_text(encoding="utf-8"))
        cls.entries = cls.catalog["entries"]

    def test_official_document_shape(self):
        self.assertEqual(self.catalog["metadata"]["year"], 2026)
        self.assertEqual(self.catalog["metadata"]["source_pages"], 72)
        self.assertEqual(len(self.entries), 681)
        self.assertEqual(len({entry["domain"] for entry in self.entries}), 10)

    def test_kinds_and_ranks(self):
        kinds = Counter(entry["kind"] for entry in self.entries)
        self.assertEqual(kinds, {"journal": 295, "conference": 386})
        self.assertEqual({entry["rank"] for entry in self.entries}, {"A", "B", "C"})

    def test_required_fields(self):
        for entry in self.entries:
            self.assertTrue(entry["name"])
            self.assertTrue(entry["domain"])
            self.assertIn(entry["kind"], {"journal", "conference"})
            self.assertIn(entry["rank"], {"A", "B", "C"})
            self.assertGreaterEqual(entry["page"], 2)
            self.assertLessEqual(entry["page"], 72)


if __name__ == "__main__":
    unittest.main()
