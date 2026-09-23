#!/usr/bin/env python3
"""Run the integrated commit's browser suite with private reports.

The assembled preview must already be running. Requires uv and Playwright's
Chromium (or --browser-executable). The checkout supplies versioned tests only.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess

from rights_book import PREFIX, ROOT, compare_artifact


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--book-checkout", type=Path, required=True)
    parser.add_argument("--url", default="http://127.0.0.1:8790")
    parser.add_argument("--browser-executable")
    parser.add_argument("--nix-browser-libraries", action="store_true")
    parser.add_argument("--skip-reasoning", action="store_true",
                        help="Run UI acceptance without repeating all 78 engine records")
    args = parser.parse_args()
    revision = json.loads((ROOT / ".tools/rights-book/edge/artifact.json").read_text())["book_revision"]
    if len(revision) != 40 or any(c not in "0123456789abcdef" for c in revision):
        raise SystemExit("Set a full RIGHTS_BOOK_ARTIFACT_REVISION or build from upstream before acceptance")
    private = ROOT / ".tools/rights-book/acceptance/ui"
    for name in ["browser.py", "contrast.js", "expectations.json"]:
        contents = subprocess.check_output([
            "git", "-C", str(args.book_checkout), "show", f"{revision}:ui/tests/{name}",
        ])
        if name == "browser.py":
            # The host adds the first keyboard stop before the unchanged book
            # root. Keep the same skip-to-main assertion, using that anchor.
            before = b"expect(page.locator('.skip-link')).to_be_focused()"
            after = b"expect(page.locator('.site-skip-link')).to_be_focused()"
            if contents.count(before) != 1:
                raise SystemExit("Review the upstream keyboard check before adapting the host skip link")
            contents = contents.replace(before, after, 1)
        target = private / "tests" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(contents)
    artifact = ROOT / "public" / PREFIX.strip("/")
    source = ROOT / "static" / PREFIX.strip("/")
    compare_artifact(source, artifact)
    # The suite reads local route exports as well as fetching the preview origin.
    dist = private / "dist" / PREFIX.strip("/")
    if dist.exists():
        shutil.rmtree(dist)
    shutil.copytree(artifact, dist)
    (private / "generated").mkdir(exist_ok=True)
    shutil.copy2(artifact / "cases.json", private / "generated/cases.json")
    env = dict(os.environ, UV_CACHE_DIR=str(ROOT / ".tools/uv-cache"))
    browser_args = ["--url", args.url]
    if args.browser_executable:
        browser_args += ["--browser-executable", args.browser_executable]
    if args.nix_browser_libraries:
        env["LD_LIBRARY_PATH"] = ":".join(
            str(path / "lib") for path in Path("/nix/store").iterdir()
            if path.is_dir() and any(name in path.name for name in ["-nss-", "-nspr-", "-alsa-lib-"])
        )
    upstream_args = browser_args + (["--skip-reasoning"] if args.skip_reasoning else [])
    subprocess.run(["uv", "run", "--script", str(private / "tests/browser.py"), *upstream_args],
                   env=env, check=True, cwd=ROOT)
    subprocess.run(["uv", "run", "--script", str(ROOT / "tests/rights_book_browser.py"), *browser_args],
                   env=env, check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
