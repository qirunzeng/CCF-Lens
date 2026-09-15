#!/usr/bin/env python3
"""Build deterministic Chrome, Edge, and Tampermonkey distributions."""

from __future__ import annotations

import argparse
import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FIXED_ZIP_TIME = (2026, 1, 1, 0, 0, 0)
CHROMIUM_FILES = (
    Path("manifest.json"),
    Path("LICENSE"),
    Path("WebExtension/catalog.js"),
    Path("WebExtension/core_catalog.js"),
    Path("WebExtension/th_catalog.js"),
    Path("WebExtension/content.js"),
    Path("WebExtension/content.css"),
    Path("WebExtension/popup.html"),
    Path("WebExtension/popup.css"),
    Path("WebExtension/icons/icon-16.png"),
    Path("WebExtension/icons/icon-32.png"),
    Path("WebExtension/icons/icon-48.png"),
    Path("WebExtension/icons/icon-128.png"),
)


def manifest() -> dict:
    return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def write_chromium_zip(destination: Path) -> None:
    with zipfile.ZipFile(
        destination,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for relative_path in CHROMIUM_FILES:
            info = zipfile.ZipInfo(relative_path.as_posix(), FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, (ROOT / relative_path).read_bytes())


def userscript_text() -> str:
    package = manifest()
    version = package["version"]
    matches = package["content_scripts"][0]["matches"]
    metadata = [
        "// ==UserScript==",
        "// @name         VenueRank Lens",
        # Keep the original namespace permanently: userscript managers use the
        # name/namespace pair as the installed script's stable identity.
        "// @namespace    https://github.com/qirunzeng/CCF-Lens",
        f"// @version      {version}",
        "// @description  Show CCF 2026, ICORE 2026, and TH-CPL 2019 venue ranks on supported publication sites.",
        "// @author       Qirun Zeng",
        "// @license      MIT",
    ]
    metadata.extend(f"// @match        {pattern}" for pattern in matches)
    metadata.extend(
        [
            "// @homepageURL  https://github.com/qirunzeng/VenueRank-Lens",
            "// @supportURL   https://github.com/qirunzeng/VenueRank-Lens/issues",
            "// @downloadURL  https://raw.githubusercontent.com/qirunzeng/VenueRank-Lens/main/dist/ccf-lens.user.js",
            "// @updateURL    https://raw.githubusercontent.com/qirunzeng/VenueRank-Lens/main/dist/ccf-lens.user.js",
            "// @run-at       document-idle",
            "// @noframes",
            "// @grant        GM_registerMenuCommand",
            "// ==/UserScript==",
            "",
        ]
    )

    css = (ROOT / "WebExtension/content.css").read_text(encoding="utf-8")
    style_loader = "\n".join(
        [
            "(() => {",
            "  const style = document.createElement(\"style\");",
            f"  style.textContent = {json.dumps(css, ensure_ascii=False)};",
            "  (document.head || document.documentElement).append(style);",
            "})();",
            "",
        ]
    )
    project_menu = "\n".join(
        [
            "GM_registerMenuCommand(\"★ VenueRank Lens by Qirun Zeng — GitHub\", () => {",
            "  window.open(\"https://github.com/qirunzeng/VenueRank-Lens\", \"_blank\", \"noopener,noreferrer\");",
            "});",
            "",
        ]
    )
    catalog = (ROOT / "WebExtension/catalog.js").read_text(encoding="utf-8")
    core_catalog = (ROOT / "WebExtension/core_catalog.js").read_text(encoding="utf-8")
    th_catalog = (ROOT / "WebExtension/th_catalog.js").read_text(encoding="utf-8")
    content = (ROOT / "WebExtension/content.js").read_text(encoding="utf-8")
    return (
        "\n".join(metadata)
        + style_loader
        + project_menu
        + catalog
        + "\n"
        + core_catalog
        + "\n"
        + th_catalog
        + "\n"
        + content
    )


def build(output_directory: Path) -> list[Path]:
    output_directory.mkdir(parents=True, exist_ok=True)
    version = manifest()["version"]
    outputs = [
        output_directory / f"venuerank-lens-chrome-{version}.zip",
        output_directory / f"venuerank-lens-edge-{version}.zip",
    ]
    for destination in outputs:
        write_chromium_zip(destination)

    userscript = output_directory / "ccf-lens.user.js"
    userscript.write_text(userscript_text(), encoding="utf-8")
    outputs.append(userscript)
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    for output in build(args.output.resolve()):
        print(output)


if __name__ == "__main__":
    main()
