#!/usr/bin/env python3
"""Extract the official 2019 TH-CPL PDF into deterministic extension data."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from itertools import groupby
from pathlib import Path

import pdfplumber


SOURCE = "https://numbda.cs.tsinghua.edu.cn/~yuwj/TH-CPL.pdf"
EXPECTED_COUNTS = {
    ("conference", "A"): 77,
    ("conference", "B"): 148,
    ("journal", "A"): 40,
    ("journal", "B"): 141,
}
DOMAIN_PATTERN = re.compile(
    r"^\s*[（(]([一二三四五六七八九十]+)[）)]\s*[^\n（(]*[（(]([^\n）)]+)[）)]\s*$",
    re.MULTILINE,
)
SECTION_PATTERN = re.compile(
    r"^\s*\d+[．.]\s*([AB])\s*类\s*(会议|期刊)\s*$",
    re.MULTILINE,
)


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def cell_text(page, box) -> str:
    if box is None:
        return ""
    return clean(page.crop(box).extract_text(x_tolerance=1, y_tolerance=3))


def extract(pdf_path: Path) -> dict:
    entries: list[dict] = []
    current_domain = ""
    current_kind = ""
    current_rank = ""

    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != 17:
            raise ValueError(f"expected 17 pages, found {len(pdf.pages)}")

        for page_number, page in enumerate(pdf.pages, start=1):
            previous_bottom = 0
            for table in page.find_tables():
                preceding_text = page.crop(
                    (0, previous_bottom, page.width, table.bbox[1])
                ).extract_text(x_tolerance=1, y_tolerance=3) or ""

                domain_matches = list(DOMAIN_PATTERN.finditer(preceding_text))
                if domain_matches:
                    current_domain = clean(domain_matches[-1].group(2))

                section_matches = list(SECTION_PATTERN.finditer(preceding_text))
                if section_matches:
                    current_rank = section_matches[-1].group(1)
                    current_kind = {
                        "会议": "conference",
                        "期刊": "journal",
                    }[section_matches[-1].group(2)]

                if not all((current_domain, current_kind, current_rank)):
                    raise ValueError(f"missing table context on page {page_number}")

                current_entry = None
                for row in table.rows:
                    cells = [cell_text(page, box) for box in row.cells]
                    if "序号" in cells:
                        continue

                    sequence = next((value for value in cells[:3] if value.isdigit()), "")
                    name = cells[4] if len(cells) > 4 else ""
                    abbreviation = (
                        next((value for value in cells[6:] if value), "")
                        if len(cells) > 6
                        else ""
                    )

                    if sequence:
                        current_entry = {
                            "abbreviation": abbreviation,
                            "domain": current_domain,
                            "kind": current_kind,
                            "name": name,
                            "page": page_number,
                            "rank": current_rank,
                            "sequence": int(sequence),
                            "url": f"{SOURCE}#page={page_number}",
                        }
                        entries.append(current_entry)
                    elif name and current_entry:
                        current_entry["name"] = clean(f"{current_entry['name']} {name}")

                previous_bottom = table.bbox[3]

    counts = Counter((entry["kind"], entry["rank"]) for entry in entries)
    if counts != Counter(EXPECTED_COUNTS):
        raise ValueError(f"unexpected kind/rank counts: {dict(counts)}")
    if len({entry["domain"] for entry in entries}) != 10:
        raise ValueError("expected 10 TH-CPL research areas")

    for key, group in groupby(
        entries,
        key=lambda entry: (entry["domain"], entry["kind"], entry["rank"]),
    ):
        sequences = [entry["sequence"] for entry in group]
        if sequences != list(range(1, len(sequences) + 1)):
            raise ValueError(f"non-contiguous sequence for {key}: {sequences}")

    return {
        "metadata": {
            "name": "清华大学计算机学科群推荐学术会议和期刊列表（TH-CPL）",
            "approved": "2019-08-13",
            "source": SOURCE,
            "source_pages": 17,
            "year": 2019,
            "rank_counts": {
                f"{kind}_{rank}": count
                for (kind, rank), count in sorted(counts.items())
            },
        },
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--json", type=Path, default=Path("WebExtension/th_catalog.json"))
    parser.add_argument(
        "--javascript", type=Path, default=Path("WebExtension/th_catalog.js")
    )
    args = parser.parse_args()

    catalog = extract(args.pdf)
    args.json.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    args.javascript.write_text(
        "// Generated only from the official 2019 TH-CPL PDF.\n"
        f"globalThis.THCPLLensCatalog = {json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(catalog['entries'])} TH-CPL 2019 entries")


if __name__ == "__main__":
    main()
