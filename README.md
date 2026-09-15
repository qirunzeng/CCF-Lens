# VenueRank Lens for Safari, Chrome, Edge, and Tampermonkey

[![CI](https://github.com/qirunzeng/VenueRank-Lens/actions/workflows/ci.yml/badge.svg)](https://github.com/qirunzeng/VenueRank-Lens/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/qirunzeng/VenueRank-Lens?style=social)](https://github.com/qirunzeng/VenueRank-Lens/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

VenueRank Lens is an independently implemented browser extension by [Qirun Zeng](https://github.com/qirunzeng). It labels venues on Google Scholar, ACM Digital Library, IEEE Xplore, and DBLP with CCF 2026, ICORE 2026, and TH-CPL 2019 ranks.

If VenueRank Lens saves you time, consider [starring the repository](https://github.com/qirunzeng/VenueRank-Lens) so more researchers can find it.

## Clean implementation

This repository has an independent Git history and does not contain source code, styles, images, tests, build files, or ranking tables copied from the historical CCFrank extension. The implementation uses browser and Safari extension platform APIs.

The ranking facts are extracted from the official 72-page CCF seventh-edition PDF, the official ICORE 2026 CSV export, and the official 17-page TH-CPL document approved by the Tsinghua University Computer Science Degree Evaluation Subcommittee on August 13, 2019. The source organizations remain authoritative for their respective catalogs; the extension is not affiliated with or endorsed by them.

ICORE 2026 ranks conferences only. Accordingly, VenueRank Lens never displays a CORE badge for a journal. The visible `CORE` badge is a compact label for data from the official ICORE 2026 conference ranking.

TH-CPL ranks both conferences and journals as A or B. The visible badge deliberately says `TH-CPL`, and its tooltip includes `2019`, because no newer official TH-CPL edition was located when this release was prepared.

On Google Scholar, the extension follows CCF's publication-scope rule: conference badges apply to full/regular papers. Findings, workshops, short papers, demos, technical briefs, summaries, and companion proceedings are deliberately not labeled as the ranked main conference.

## Install

### Chrome and Edge

Download the matching ZIP from [GitHub Releases](https://github.com/qirunzeng/VenueRank-Lens/releases). Store releases are prepared from the same Manifest V3 package.

For local testing, extract the ZIP, open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory.

### Tampermonkey

Install Tampermonkey, then use the public [VenueRank Lens page on Greasy Fork](https://greasyfork.org/en/scripts/595904-venuerank-lens) for one-click installation and automatic updates.

The [raw userscript on GitHub](https://raw.githubusercontent.com/qirunzeng/VenueRank-Lens/main/dist/ccf-lens.user.js) remains available as a direct-install fallback. The legacy filename is retained so existing direct installations can continue updating.

### Safari

Safari currently requires a local Xcode build and signing team. See the instructions below.

## Build Safari

Requirements:

- macOS 13 or newer
- Full Xcode installation
- An Apple ID configured in Xcode for local signing

Run:

```bash
open "Safari/VenueRank Lens.xcodeproj"
```

The checked-in project selects Team ID `TC3755P2NZ` (Qirun Zeng Personal Team) for automatic signing. Other developers must select their own team for both targets. Run the `VenueRank Lens` scheme, then enable the extension in Safari Settings > Extensions.

XcodeGen is only required after editing `Safari/project.yml`:

```bash
cd Safari
xcodegen generate
```

### Synced-folder signing failure

Some file-provider-backed `Documents` folders add Finder metadata to newly created app bundles. If signing fails with `resource fork, Finder information, or similar detritus not allowed`, build with Derived Data outside the synced folder:

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project "Safari/VenueRank Lens.xcodeproj" \
  -scheme "VenueRank Lens" -configuration Debug \
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

To refresh the TH-CPL catalog from the official document, run:

```bash
curl -L 'https://numbda.cs.tsinghua.edu.cn/~yuwj/TH-CPL.pdf' \
  -o /tmp/TH-CPL.pdf
python3 tools/extract_th_cpl_pdf.py /tmp/TH-CPL.pdf \
  --json WebExtension/th_catalog.json \
  --javascript WebExtension/th_catalog.js
```

## License

The original implementation and artwork in this repository are licensed under the [MIT License](./LICENSE), copyright 2026 qirunzeng.

The CCF, ICORE, and TH-CPL catalogs are external factual sources published by their respective organizations. The MIT license does not claim ownership of, or relicense, any source publication. Those organizations remain the authoritative sources for ranking data.
