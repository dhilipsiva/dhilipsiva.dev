#!/usr/bin/env python3
"""Generate public/llms.txt from Zola content front matter.

Run AFTER `zola build` (it writes into the build output, public/). Zola cannot
render an arbitrary templates/llms.txt, so this is a build-time generator instead.
Stdlib only (pathlib, tomllib). Deterministic; safe to re-run.
"""
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
OUT = ROOT / "public" / "llms.txt"


def base_url() -> str:
    cfg = tomllib.loads((ROOT / "config.toml").read_text(encoding="utf-8"))
    return cfg["base_url"].rstrip("/")


def front_matter(md: Path) -> dict:
    text = md.read_text(encoding="utf-8")
    if not text.startswith("+++"):
        return {}
    end = text.find("+++", 3)
    return tomllib.loads(text[3:end]) if end != -1 else {}


def pages(section: str):
    out = []
    for md in sorted((CONTENT / section).glob("*.md")):
        if md.name == "_index.md":
            continue
        fm = front_matter(md)
        if fm.get("draft"):
            continue
        out.append((md.stem, fm))
    return out


def line(base: str, section: str, stem: str, fm: dict) -> str:
    title = fm.get("title", stem)
    desc = fm.get("description")
    return f"- [{title}]({base}/{section}/{stem}/)" + (f": {desc}" if desc else "")


def main() -> int:
    base = base_url()
    L = [
        "# dhilipsiva",
        "> Self-taught software engineer (dropout). Rust · WebAssembly · LLMs · "
        "distributed systems · symbolic reasoning · Tamil · philosophy of mind. "
        '"The commit history is my transcript."',
        "",
        "## About",
        f"- [About / bio & timeline]({base}/about/): first-person bio, 2012→now timeline, skills.",
        "",
        "## Writing",
    ]
    musings = pages("musings")
    musings.sort(key=lambda kv: str(kv[1].get("date", "")), reverse=True)
    L += [line(base, "musings", s, fm) for s, fm in musings]

    L += ["", "## Projects"]
    L += [line(base, "things-i-built", s, fm) for s, fm in pages("things-i-built")]

    L += ["", "## Books"]
    L += [line(base, "books", s, fm) for s, fm in pages("books")]

    L += [
        "",
        "## Interactive (client-side WASM, no server)",
        f"- [chat — on-device AI twin (LoRA via candle→WASM)]({base}/chat/)",
        f"- [nibli — in-browser symbolic-reasoning engine with proof traces (Rust→WASM)]({base}/nibli/)",
        "",
        "## Optional",
    ]
    L += [f"- [{p}]({base}/{p}/)" for p in ("now", "uses", "talks", "contact")]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(L)} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
