"""Download Trendyol Asure 12B once, from a pinned revision, and verify it.

Run through compose, inside the same vLLM image that serves the model:

    npm run ai:download

What it does, and refuses to do:

  * the revision must be a full commit SHA; a branch name such as "main" would
    let the weights change underneath a running deployment;
  * the files land in /models/asure-12b-<sha7>, which is also the name the
    model is served under (AI_MODEL);
  * every file's SHA256 is written to manifest.json; a directory whose files
    still match it is not downloaded again, one that does not match is refused
    rather than silently served;
  * only the official Trendyol repository is used. Nothing is uploaded, and
    Hugging Face is not contacted again after this step.
"""

import hashlib
import json
import os
import re
import sys
from pathlib import Path

REPO = "Trendyol/Trendyol-LLM-Asure-12B"
ROOT = Path("/models")
# Only the model card's picture is skipped. The processor files stay even though
# image input is off in the server: vLLM reads them to load the architecture.
IGNORE = ["*.png", "*.jpg"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def manifest_of(directory: Path) -> dict:
    return {
        str(p.relative_to(directory)).replace(os.sep, "/"): sha256(p)
        for p in sorted(directory.rglob("*"))
        if p.is_file() and p.name != "manifest.json" and ".cache" not in p.parts
    }


def main() -> int:
    revision = os.environ.get("AI_MODEL_REVISION", "").strip()
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        print("AI_MODEL_REVISION must be a full 40-character commit SHA of " + REPO, file=sys.stderr)
        return 1

    name = f"asure-12b-{revision[:7]}"
    target = ROOT / name
    manifest_file = target / "manifest.json"

    if manifest_file.exists():
        expected = json.loads(manifest_file.read_text())
        if expected.get("revision") == revision and manifest_of(target) == expected.get("files"):
            print(f"{target} is complete and verified; nothing to download.")
            print(f"AI_MODEL={name}")
            return 0
        print(f"{target} does not match its manifest; remove it and run again.", file=sys.stderr)
        return 1

    # Imported here so the checks above run even where the library is missing.
    from huggingface_hub import snapshot_download

    snapshot_download(
        repo_id=REPO,
        revision=revision,
        local_dir=str(target),
        ignore_patterns=IGNORE,
        token=os.environ.get("HF_TOKEN") or None,
    )

    manifest_file.write_text(
        json.dumps({"repo": REPO, "revision": revision, "files": manifest_of(target)}, indent=2)
    )
    print(f"Downloaded and verified {REPO}@{revision} into {target}.")
    print(f"Set AI_MODEL={name} in the root .env.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
