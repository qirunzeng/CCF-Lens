# CCF Lens for Safari, Chrome, Edge, and Tampermonkey

CCF Lens is an independently implemented browser extension that labels venues on Google Scholar, ACM Digital Library, IEEE Xplore, and DBLP with the 2026 CCF recommendation rank.

## Clean implementation

This repository has an independent Git history and does not contain source code, styles, images, tests, build files, or ranking tables copied from the historical CCFrank extension. The implementation uses browser and Safari extension platform APIs.

The ranking facts are extracted directly from the official 72-page CCF seventh-edition PDF. CCF remains the authoritative source for the catalog; the extension is not affiliated with or endorsed by CCF.

On Google Scholar, the extension follows CCF's publication-scope rule: conference badges apply to full/regular papers. Findings, workshops, short papers, demos, technical briefs, summaries, and companion proceedings are deliberately not labeled as the ranked main conference.

## Install

### Chrome and Edge

Download the matching ZIP from [GitHub Releases](https://github.com/qirunzeng/CCF-Lens-Safari/releases). Store releases are prepared from the same Manifest V3 package.

For local testing, extract the ZIP, open `chrome://extensions` or `edge://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory.

### Tampermonkey

Install Tampermonkey, then open the [CCF Lens userscript](https://raw.githubusercontent.com/qirunzeng/CCF-Lens-Safari/main/dist/ccf-lens.user.js). The userscript is self-contained and checks this URL for updates.

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

Download the official PDF from the URL in `tools/extract_ccf_pdf.py`, then run:

```bash
python3 tools/extract_ccf_pdf.py path/to/official.pdf \
  --json WebExtension/catalog.json \
  --javascript WebExtension/catalog.js
```

## License

The original implementation and artwork in this repository are licensed under the [MIT License](./LICENSE), copyright 2026 qirunzeng.

The CCF catalog is an external factual source published by the China Computer Federation. The MIT license does not claim ownership of, or relicense, CCF's source publication. CCF remains the authoritative source for ranking data.
