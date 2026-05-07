#!/usr/bin/env python3
"""
Spanish Trainer server.
Serves the static frontend and provides a REST API for persisting word banks
as individual JSON files under ./wordbanks/.

Run: python server.py
Then open: http://localhost:5000
"""
import json
import os
import re

from flask import Flask, abort, jsonify, request, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORDBANKS_DIR = os.path.join(BASE_DIR, "wordbanks")
os.makedirs(WORDBANKS_DIR, exist_ok=True)

app = Flask(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def bank_path(name: str) -> str:
    """Return a safe absolute path for a word bank file, or abort(400)."""
    slug = re.sub(r"[^\w\- ]", "", name).strip().replace(" ", "_")
    if not slug:
        abort(400, description="Invalid bank name")
    resolved = os.path.realpath(os.path.join(WORDBANKS_DIR, slug + ".json"))
    safe_root = os.path.realpath(WORDBANKS_DIR) + os.sep
    if not resolved.startswith(safe_root):
        abort(400, description="Invalid bank name")
    return resolved


# ── Static files ──────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


# ── Word bank API ─────────────────────────────────────────────────────────────

@app.route("/api/wordbanks", methods=["GET"])
def list_banks():
    """Return a sorted list of saved bank names."""
    names = []
    for fname in sorted(os.listdir(WORDBANKS_DIR)):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(WORDBANKS_DIR, fname)
        try:
            with open(fpath, encoding="utf-8") as f:
                data = json.load(f)
            names.append(data.get("name", fname[:-5]))
        except (json.JSONDecodeError, OSError):
            pass
    return jsonify(names)


@app.route("/api/wordbanks/<name>", methods=["GET"])
def get_bank(name):
    """Return a single word bank's full data."""
    path = bank_path(name)
    if not os.path.exists(path):
        abort(404)
    with open(path, encoding="utf-8") as f:
        return jsonify(json.load(f))


@app.route("/api/wordbanks/<name>", methods=["POST"])
def save_bank(name):
    """Create or overwrite a word bank."""
    body = request.get_json(silent=True)
    if not body or not isinstance(body.get("words"), list):
        abort(400, description="Expected JSON body with a 'words' array")
    path = bank_path(name)
    payload = {"name": name, "words": body["words"]}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    return jsonify({"ok": True})


@app.route("/api/wordbanks/<name>", methods=["DELETE"])
def delete_bank(name):
    """Delete a word bank file."""
    path = bank_path(name)
    if not os.path.exists(path):
        abort(404)
    os.remove(path)
    return jsonify({"ok": True})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Spanish Trainer  →  http://localhost:8000")
    app.run(debug=False, port=8000)
