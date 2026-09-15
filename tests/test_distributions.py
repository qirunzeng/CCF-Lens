import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_distributions", ROOT / "tools/build_distributions.py"
)
BUILD_DISTRIBUTIONS = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BUILD_DISTRIBUTIONS)


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.output = Path(self.temporary_directory.name)
        self.artifacts = BUILD_DISTRIBUTIONS.build(self.output)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_builds_separate_chrome_and_edge_packages(self):
        archives = [path for path in self.artifacts if path.suffix == ".zip"]
        self.assertEqual(
            {path.name for path in archives},
            {"venuerank-lens-chrome-1.2.0.zip", "venuerank-lens-edge-1.2.0.zip"},
        )
        for archive_path in archives:
            with zipfile.ZipFile(archive_path) as archive:
                self.assertIn("manifest.json", archive.namelist())
                self.assertIn("WebExtension/popup.html", archive.namelist())
                self.assertIn("WebExtension/core_catalog.js", archive.namelist())
                self.assertIn("WebExtension/th_catalog.js", archive.namelist())
                package = json.loads(archive.read("manifest.json"))
                self.assertEqual(package["manifest_version"], 3)
                self.assertEqual(package["name"], "VenueRank Lens")
                self.assertEqual(
                    package["action"]["default_popup"], "WebExtension/popup.html"
                )

    def test_userscript_is_self_contained_and_updateable(self):
        userscript = (self.output / "ccf-lens.user.js").read_text(encoding="utf-8")
        self.assertIn("// ==UserScript==", userscript)
        self.assertIn("// @version      1.2.0", userscript)
        self.assertIn("// @updateURL    https://raw.githubusercontent.com/", userscript)
        self.assertNotIn("// @require", userscript)
        self.assertIn("GM_registerMenuCommand", userscript)
        self.assertIn("Qirun Zeng", userscript)
        self.assertIn("// @name         VenueRank Lens", userscript)
        self.assertIn("globalThis.CCFLensCatalog", userscript)
        self.assertIn("globalThis.CORELensCatalog", userscript)
        self.assertIn("globalThis.THCPLLensCatalog", userscript)
        self.assertIn("const findScholarMatches", userscript)
        self.assertIn("ccf-lens-badge", userscript)


if __name__ == "__main__":
    unittest.main()
