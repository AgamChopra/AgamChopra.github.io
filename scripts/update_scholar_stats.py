#!/usr/bin/env python3
"""Fetch citation metrics from a public Google Scholar profile.

The public site reads scholar-stats.json instead of scraping Scholar from the
browser. This avoids client-side CORS failures on GitHub Pages.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SCHOLAR_ID = "s0Pqt1IAAAAJ"
DEFAULT_OUTPUT = Path("scholar-stats.json")
PROFILE_URL = f"https://scholar.google.com/citations?user={SCHOLAR_ID}&hl=en"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0 Safari/537.36"
)


def fetch_profile_html(url: str) -> str:
    request = Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urlopen(request, timeout=30) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace")
    except HTTPError as exc:
        raise RuntimeError(f"Google Scholar returned HTTP {exc.code}") from exc
    except URLError as exc:
        raise RuntimeError(f"Unable to reach Google Scholar: {exc.reason}") from exc


def text_from_html(fragment: str) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", fragment)).split())


def parse_metrics(profile_html: str) -> dict[str, int]:
    table_match = re.search(
        r'<table[^>]*id="gsc_rsb_st"[^>]*>(.*?)</table>',
        profile_html,
        flags=re.IGNORECASE | re.DOTALL,
    )

    if not table_match:
        raise ValueError("Could not find the Google Scholar citation table.")

    metrics: dict[str, int] = {}
    rows = re.findall(r"<tr[^>]*>(.*?)</tr>", table_match.group(1), flags=re.IGNORECASE | re.DOTALL)

    for row in rows:
        row_text = text_from_html(row)
        values = [int(value.replace(",", "")) for value in re.findall(r"\b\d[\d,]*\b", row_text)]

        if not values:
            continue

        if row_text.startswith("Citations"):
            metrics["citations"] = values[0]
        elif row_text.startswith("h-index"):
            metrics["h_index"] = values[0]

    missing = {"citations", "h_index"} - metrics.keys()
    if missing:
        raise ValueError(f"Missing expected metric(s): {', '.join(sorted(missing))}")

    return metrics


def write_stats(output_path: Path, metrics: dict[str, int], source_url: str) -> None:
    payload = {
        "source": source_url,
        "citations": metrics["citations"],
        "h_index": metrics["h_index"],
        "updated_at": datetime.now(timezone.utc).date().isoformat(),
    }
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--profile-url", default=PROFILE_URL)
    args = parser.parse_args()

    try:
        profile_html = fetch_profile_html(args.profile_url)
        metrics = parse_metrics(profile_html)
        write_stats(args.output, metrics, args.profile_url)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(f"Wrote {args.output} from {args.profile_url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
