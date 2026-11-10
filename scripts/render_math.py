#!/usr/bin/env python3
"""Render the math essays: fill in their numbers and turn their TeX into MathML.

    content-src/musings/<slug>.md   the source you edit: Markdown with TeX in
                                    $...$ and $$...$$, and [[n:key]] placeholders
    content/musings/<slug>.md       what Zola builds: GENERATED, do not edit

Zola has no math support and this site ships no math JavaScript, so each
formula is converted to MathML here, before commit, and browsers draw it
natively (static/assets/math.css supplies the font). Each [[n:key]] is filled
from the essay's own numbers script, static/musings/<slug>/numbers.py --json,
so the page cannot disagree with the computation. An unknown key, a failed
check in that script, or a formula pandoc cannot convert stops the run.

Run:  python3 scripts/render_math.py            regenerate every essay
      python3 scripts/render_math.py --check    exit 1 if a generated page is stale

Needs pandoc 3 on PATH (TeX -> MathML); everything else is stdlib. The deploy
workflow does not run this: the generated page is what gets committed, and
tests/test_musing_math.py checks it against its source without pandoc.

Source rules: `[extra]` must be the last table of the front matter (the reading
time is appended to it, because Zola would count MathML tags as words). Inline
math stays on one line and does not start or end with a space.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tomllib

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "content-src" / "musings"
OUTPUT = ROOT / "content" / "musings"
WORDS_PER_MINUTE = 200  # the figure Zola uses

# Code is left alone; display math is matched before inline math.
TOKEN = re.compile(
    r"(?P<fence>^```.*?^```[^\n]*$)"
    r"|(?P<code>`[^`\n]+`)"
    r"|\$\$(?P<display>.+?)\$\$"
    r"|\$(?P<inline>[^\s$](?:[^$\n]*[^\s$])?)\$",
    re.S | re.M,
)
PLACEHOLDER = re.compile(r"\[\[n:([A-Za-z0-9_]+)\]\]")

# Characters that Markdown or Zola's shortcode parser would otherwise act on.
# MathML markup itself contains none of them, so they can only come from a
# formula's text or its TeX annotation, where an entity means the same thing.
ARMOUR = {ord(c): f"&#{ord(c)};" for c in "{}\\*_`[]|~"}


def numbers_script(slug: str) -> Path:
    return ROOT / "static" / "musings" / slug / "numbers.py"


def load_numbers(slug: str) -> dict:
    script = numbers_script(slug)
    if not script.is_file():
        return {}
    run = subprocess.run([sys.executable, str(script), "--json"], capture_output=True, text=True)
    result = json.loads(run.stdout)
    if run.returncode or not result["all_passed"]:
        failed = [c["name"] for c in result["checks"] if not c["ok"]]
        raise SystemExit(f"{script.relative_to(ROOT)}: checks failed: {failed}")
    return result["numbers"]


def fill(text: str, numbers: dict, field: str, slug: str) -> str:
    def lookup(match):
        key = match.group(1)
        if key not in numbers:
            raise SystemExit(f"{slug}: [[n:{key}]] is not a number in {numbers_script(slug).relative_to(ROOT)}")
        return numbers[key][field]

    return PLACEHOLDER.sub(lookup, text)


def pandoc_version() -> str:
    return subprocess.run(["pandoc", "--version"], capture_output=True, text=True, check=True).stdout.split()[1]


_mathml_cache: dict = {}


def mathml(tex: str, display: bool, slug: str) -> str:
    """One formula as a single line of MathML, safe to embed in Zola Markdown."""
    key = (tex, display)
    if key not in _mathml_cache:
        fence = "$$" if display else "$"
        run = subprocess.run(
            ["pandoc", "-f", "markdown", "-t", "html", "--mathml", "--wrap=none", "--fail-if-warnings"],
            input=f"{fence}{tex}{fence}\n", capture_output=True, text=True,
        )
        out = run.stdout.strip()
        if run.returncode or not (out.startswith("<p><math") and out.endswith("</math></p>")):
            raise SystemExit(f"{slug}: pandoc could not convert {tex!r}\n{run.stderr.strip()}")
        out = out[len("<p>"):-len("</p>")].replace(' xmlns="http://www.w3.org/1998/Math/MathML"', "")
        _mathml_cache[key] = out.translate(ARMOUR)
    return _mathml_cache[key]


def render(source: Path) -> str:
    slug = source.stem
    text = source.read_text(encoding="utf-8")
    if not text.startswith("+++\n") or "\n+++\n" not in text[4:]:
        raise SystemExit(f"{slug}: no +++ front matter")
    front, body = text[4:].split("\n+++\n", 1)
    table_names = re.findall(r"^\[([^\]]+)\]\s*$", front, re.M)
    if not table_names or table_names[-1] != "extra" or "reading_time" in tomllib.loads(front).get("extra", {}):
        raise SystemExit(f"{slug}: [extra] must be the last front-matter table and must not set reading_time")

    numbers = load_numbers(slug)
    pieces, prose, used, position = [], [], set(), 0
    for match in TOKEN.finditer(body):
        plain = body[position:match.start()]
        used.update(PLACEHOLDER.findall(plain))
        plain = fill(plain, numbers, "text", slug)
        pieces.append(plain)
        prose.append(plain)
        position = match.end()
        if match.group("display") is not None or match.group("inline") is not None:
            display = match.group("display") is not None
            tex = match.group("display" if display else "inline")
            used.update(PLACEHOLDER.findall(tex))
            formula = mathml(fill(tex, numbers, "tex", slug).strip(), display, slug)
            pieces.append(f'<div class="eq">{formula}</div>' if display else formula)
        else:
            pieces.append(match.group(0))
    tail = fill(body[position:], numbers, "text", slug)
    used.update(PLACEHOLDER.findall(body[position:]))
    pieces.append(tail)
    prose.append(tail)

    unused = sorted(set(numbers) - used)
    if unused:
        raise SystemExit(f"{slug}: numbers computed but never used on the page: {unused}")
    rendered = "".join(pieces)
    if "$" in TOKEN.sub(lambda m: "" if m.group("fence") or m.group("code") else m.group(0), rendered):
        raise SystemExit(f"{slug}: a stray $ survived; check the math delimiters")

    # Reading time from the prose alone, stopping at the reference list.
    words = len(re.sub(r"<[^>]+>", " ", "".join(prose).split("\n## Sources")[0]).split())
    digest = hashlib.sha256(source.read_bytes())
    if numbers_script(slug).is_file():
        digest.update(numbers_script(slug).read_bytes())
    header = (
        f"# GENERATED by scripts/render_math.py from content-src/musings/{slug}.md.\n"
        f"# Edit that file and re-run the script; do not edit this one.\n"
        f"# source-sha256: {digest.hexdigest()}\n"
        f"# pandoc: {pandoc_version()}\n"
    )
    return f"+++\n{header}{front}\nreading_time = {-(-words // WORDS_PER_MINUTE)}\n+++\n{rendered}"


def main() -> int:
    check = "--check" in sys.argv[1:]
    stale = []
    for source in sorted(SOURCES.glob("*.md")):
        target = OUTPUT / source.name
        rendered = render(source)
        if check:
            if not target.is_file() or target.read_text(encoding="utf-8") != rendered:
                stale.append(source.name)
        else:
            target.write_text(rendered, encoding="utf-8")
            print(f"wrote {target.relative_to(ROOT)} ({rendered.count('<math')} formulas)")
    if stale:
        print(f"stale, re-run scripts/render_math.py: {', '.join(stale)}")
        return 1
    if check:
        print("generated pages are in step with their sources")
    return 0


if __name__ == "__main__":
    sys.exit(main())
