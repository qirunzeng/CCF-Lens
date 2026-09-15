# CCF Lens for Safari, Chrome, Edge, and Tampermonkey

[![CI](https://github.com/qirunzeng/CCF-Lens/actions/workflows/ci.yml/badge.svg)](https://github.com/qirunzeng/CCF-Lens/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/qirunzeng/CCF-Lens?style=social)](https://github.com/qirunzeng/CCF-Lens/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

CCF Lens is an independently implemented browser extension by [Qirun Zeng](https://github.com/qirunzeng). It labels venues on Google Scholar, ACM Digital Library, IEEE Xplore, and DBLP with both the CCF 2026 recommendation rank and the ICORE 2026 conference rank.

If CCF Lens saves you time, consider [starring the repository](https://github.com/qirunzeng/CCF-Lens) so more researchers can find it.

## Clean implementation

This repository has an independent Git history and does not contain source code, styles, images, tests, build files, or ranking tables copied from the historical CCFrank extension. The implementation uses browser and Safari extension platform APIs.

The ranking facts are extracted from the official 72-page CCF seventh-edition PDF and the official ICORE 2026 CSV export. CCF and ICORE remain the authoritative sources for their respective catalogs; the extension is not affiliated with or endorsed by either organization.

ICORE 2026 ranks conferences only. Accordingly, CCF Lens never displays a CORE badge for a journal. The visible `CORE` badge is a compact label for data from the official ICORE 2026 conference ranking.

On Google Scholar, the extension follows CCF's publication-scope rule: conference badges apply to full/regular papers. Findings, workshops, short papers, demos, technical briefs, summaries, and companion proceedings are deliberately not labeled as the ranked main conference.

## Install

### Chrome and Edge

Download the matching ZIP from [GitHub Releases](https://github.com/qirunzeng/CCF-Lens/releases). Store releases are prepared from the same Manifest V3 package.

For local testing, extract the ZIP, open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory.

### Tampermonkey

Install Tampermonkey, then use the public [CCF Lens page on Greasy Fork](https://greasyfork.org/en/scripts/595889-ccf-lens) for one-click installation and automatic updates.

The [raw userscript on GitHub](https://raw.githubusercontent.com/qirunzeng/CCF-Lens/main/dist/ccf-lens.user.js) remains available as a direct-install fallback.

### Safari

Safari currently requires a local Xcode build and signing team. See the instructions below.

## Build Safari

Requirements:

- macOS 13 or newer
- Full Xcode installation
- An Apple ID configured in Xcode for local signing

Run:

```bash
open "Safari/CCF Lens.xcodeproj"
```

The checked-in project selects Team ID `TC3755P2NZ` (Qirun Zeng Personal Team) for automatic signing. Other developers must select their own team for both targets. Run the `CCF Lens` scheme, then enable the extension in Safari Settings > Extensions.

XcodeGen is only required after editing `Safari/project.yml`:

```bash
cd Safari
xcodegen generate
```

### Synced-folder signing failure

Some file-provider-backed `Documents` folders add Finder metadata to newly created app bundles. If signing fails with `resource fork, Finder information, or similar detritus not allowed`, build with Derived Data outside the synced folder:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project "Safari/CCF Lens.xcodeproj" \
  -scheme "CCF Lens" -configuration Debug \
  -destination "platform=macOS,arch=arm64" \
  -derivedDataPath /private/tmp/ccf-lens-derived \
  DEVELOPMENT_TEAM=TC3755P2NZ CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates build
```

## Verify

```bash
python3 -m unittest discover -s tests
node --test tests/*.test.mjs
python3 tools/build_distributions.py
node --check dist/ccf-lens.user.js
```

The distribution builder produces separate Chrome and Edge store ZIPs plus a self-contained Tampermonkey userscript in `dist/`.

Store descriptions, permission justifications, and privacy declarations are maintained in [`store-listing/listing.md`](./store-listing/listing.md). See [`PRIVACY.md`](./PRIVACY.md) for the public privacy policy.

## Refresh official data

To refresh the CCF catalog, download the official PDF from the URL in `tools/extract_ccf_pdf.py`, then run:

```bash
python3 tools/extract_ccf_pdf.py path/to/official.pdf \
  --json WebExtension/catalog.json \
  --javascript WebExtension/catalog.js
```

To refresh the ICORE catalog, download the official ICORE 2026 conference export and run:

```bash
curl -L 'https://portal.core.edu.au/conf-ranks/?search=&by=all&source=ICORE2026&do=Export' \
  -o /tmp/icore-2026.csv
python3 tools/extract_core_csv.py /tmp/icore-2026.csv \
  --json WebExtension/core_catalog.json \
  --javascript WebExtension/core_catalog.js
```

## License

The original implementation and artwork in this repository are licensed under the [MIT License](./LICENSE), copyright 2026 qirunzeng.

The CCF and ICORE catalogs are external factual sources published by their respective organizations. The MIT license does not claim ownership of, or relicense, either source publication. CCF and ICORE remain the authoritative sources for ranking data.
