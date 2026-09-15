import json
import unittest
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class ThCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads(
            (ROOT / "WebExtension/th_catalog.json").read_text(encoding="utf-8")
        )
        cls.entries = cls.catalog["entries"]

    def test_metadata_identifies_official_th_cpl_2019_document(self):
        metadata = self.catalog["metadata"]
        self.assertEqual(metadata["year"], 2019)
        self.assertEqual(metadata["source_pages"], 17)
        self.assertEqual(metadata["approved"], "2019-08-13")
        self.assertIn("tsinghua.edu.cn", metadata["source"])

    def test_catalog_has_all_406_entries(self):
        self.assertEqual(len(self.entries), 406)
        self.assertEqual(len({entry["domain"] for entry in self.entries}), 10)
        self.assertEqual(
            Counter((entry["kind"], entry["rank"]) for entry in self.entries),
            {
                ("conference", "A"): 77,
                ("conference", "B"): 148,
                ("journal", "A"): 40,
                ("journal", "B"): 141,
            },
        )

    def test_entries_point_back_to_the_official_document(self):
        for entry in self.entries:
            self.assertTrue(entry["name"])
            self.assertIn(entry["kind"], {"conference", "journal"})
            self.assertIn(entry["rank"], {"A", "B"})
            self.assertTrue(entry["url"].startswith(self.catalog["metadata"]["source"]))

    def test_well_known_examples(self):
        entries = {
            (entry["abbreviation"], entry["kind"]): entry for entry in self.entries
        }
        self.assertEqual(entries[("ICCV", "conference")]["rank"], "A")
        self.assertEqual(entries[("CVPR", "conference")]["rank"], "A")
        self.assertEqual(entries[("TPAMI", "journal")]["rank"], "A")


if __name__ == "__main__":
    unittest.main()
