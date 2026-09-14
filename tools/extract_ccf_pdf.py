#!/usr/bin/env python3
"""Extract the official 2026 CCF catalog PDF into deterministic web-extension data."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pdfplumber

OFFICIAL_URL = (
    "https://www.ccf.org.cn/ccf/contentcore/resource/download?"
    "ID=112CF3BF7E1140ACEB271ADAED12A67ADFABB8FF099E40C2759502A85C8A281F"
)


def compact(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def cell_text(page, box, *, is_url: bool = False) -> str:
    if box is None:
        return ""
    value = page.crop(box).extract_text(x_tolerance=1, y_tolerance=3) or ""
    return re.sub(r"\s+", "", value) if is_url else compact(value)


def extract(pdf_path: Path) -> dict:
    entries: list[dict] = []
    current_domain = ""
    current_kind = ""
    current_rank = ""

    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != 72:
            raise ValueError(f"Expected 72 pages, found {len(pdf.pages)}")

        for page_number, page in enumerate(pdf.pages, start=1):
            page_text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""

            has_section_header = False
            if "中国计算机学会推荐国际学术期刊" in page_text:
                current_kind = "journal"
                has_section_header = True
            elif "中国计算机学会推荐国际学术会议" in page_text:
                current_kind = "conference"
                has_section_header = True

            if has_section_header:
                domain_match = re.search(r"[（(]([^（）()]*)[）)]", page_text)
                if not domain_match:
                    raise ValueError(f"Missing domain header on page {page_number}")
                current_domain = compact(domain_match.group(1))

            rank_match = re.search(r"[一二三]、\s*([ABC])\s*类", page_text)
            if rank_match:
                current_rank = rank_match.group(1)

            for table in page.find_tables():
                if not table.rows:
                    continue
                header = [cell_text(page, box) for box in table.rows[0].cells]
                if len(header) != 5:
                    continue
                first_row_is_data = header[0].isdigit()
                if not first_row_is_data:
                    if header[0] != "序号":
                        continue
                    if "期刊简称" in header:
                        current_kind = "journal"
                    elif "会议简称" in header:
                        current_kind = "conference"
                    else:
                        continue
                elif not current_kind:
                    raise ValueError(f"Continuation table without a kind on page {page_number}")

                if not all((current_domain, current_kind, current_rank)):
                    raise ValueError(f"Missing context on page {page_number}")

                rows = table.rows if first_row_is_data else table.rows[1:]
                for row in rows:
                    cells = row.cells
                    if len(cells) != 5:
                        continue
                    sequence = cell_text(page, cells[0])
                    if not sequence.isdigit():
                        continue
                    abbreviation = cell_text(page, cells[1])
                    full_name = cell_text(page, cells[2])
                    publisher = cell_text(page, cells[3])
                    url = cell_text(page, cells[4], is_url=True)
                    if not full_name:
                        raise ValueError(f"Missing name on page {page_number}, row {sequence}")
                    entries.append(
                        {
                            "abbreviation": abbreviation,
                            "name": full_name,
                            "rank": current_rank,
                            "kind": current_kind,
                            "domain": current_domain,
                            "publisher": publisher,
                            "url": url,
                            "page": page_number,
                        }
                    )

    if len(entries) != 681:
        raise ValueError(f"Expected 681 entries, extracted {len(entries)}")

    return {
        "metadata": {
            "title": "中国计算机学会推荐国际学术会议和期刊目录",
            "edition": 7,
            "year": 2026,
            "source": OFFICIAL_URL,
            "source_pages": 72,
        },
        "entries": entries,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--json", type=Path, required=True)
    parser.add_argument("--javascript", type=Path, required=True)
    args = parser.parse_args()

    catalog = extract(args.pdf)
    encoded = json.dumps(catalog, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.javascript.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(encoded, encoding="utf-8")
    args.javascript.write_text(
        "// Generated only from the official CCF seventh-edition PDF.\n"
        f"globalThis.CCFLensCatalog = {json.dumps(catalog, ensure_ascii=False, separators=(',', ':'))};\n",
        encoding="utf-8",
    )
    print(f"Extracted {len(catalog['entries'])} entries")


if __name__ == "__main__":
    main()
