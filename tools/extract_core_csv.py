#!/usr/bin/env python3
"""Convert the official ICORE 2026 conference export into extension data."""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


SOURCE = "https://portal.core.edu.au/conf-ranks/?search=&by=all&source=ICORE2026&do=Export"
RANKS = {"A*", "A", "B", "C", "Australasian B", "Australasian C"}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract(csv_path: Path) -> dict:
    entries = []
    with csv_path.open(encoding="utf-8-sig", newline="") as source:
        for row_number, row in enumerate(csv.reader(source), start=1):
            if len(row) != 9:
                raise ValueError(f"row {row_number}: expected 9 columns, got {len(row)}")

            identifier, name, abbreviation, source_name, rank, *_rest = row
            rank = clean(rank)
            if source_name != "ICORE2026" or rank not in RANKS:
                continue

            entries.append(
                {
                    "abbreviation": clean(abbreviation),
                    "id": int(identifier),
                    "kind": "conference",
                    "name": clean(name),
                    "rank": rank,
                    "url": f"https://portal.core.edu.au/conf-ranks/{identifier}/",
                }
            )

    entries.sort(key=lambda entry: (entry["abbreviation"].casefold(), entry["name"].casefold()))
    rank_counts = Counter(entry["rank"] for entry in entries)
    if len(entries) != 825:
        raise ValueError(f"expected 825 ranked ICORE 2026 venues, got {len(entries)}")

    return {
        "metadata": {
            "name": "International CORE Conference Rankings",
            "source": SOURCE,
            "source_name": "ICORE2026",
            "year": 2026,
            "rank_counts": dict(sorted(rank_counts.items())),
        },
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv", type=Path)
    parser.add_argument("--json", type=Path, default=Path("WebExtension/core_catalog.json"))
    parser.add_argument("--javascript", type=Path, default=Path("WebExtension/core_catalog.js"))
    args = parser.parse_args()

    catalog = extract(args.csv)
    args.json.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    args.javascript.write_text(
        "// Generated only from the official ICORE 2026 CSV export.\n"
        f"globalThis.CORELensCatalog = {json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(catalog['entries'])} ranked ICORE 2026 conferences")


if __name__ == "__main__":
    main()
