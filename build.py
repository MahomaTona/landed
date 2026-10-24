#!/usr/bin/env python3
"""Baut aus src/ die eigenständige index.html (eine Datei, kein Server nötig).

    python build.py            -> schreibt index.html
    python build.py --check    -> zusätzlich: prüft, dass alle Module eingebunden sind
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / "src"
VENDOR = ROOT / "vendor"

# Reihenfolge = Abhängigkeitsreihenfolge (alles teilt sich einen Scope)
JS_MODULES = [
    "util", "idb", "crypto", "mqtt", "net", "mesh", "docs", "blobs", "tricks", "scenes", "themes",
    "model", "crews", "ui", "media", "qr", "view_tricks", "view_feed", "view_games", "view_spots",
    "view_me", "backup", "app",
]
CSS_FILES = ["base", "components", "themes"]


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> None:
    html = read(SRC / "index.html")
    css = "\n".join(read(SRC / "css" / f"{n}.css") for n in CSS_FILES)
    js_parts = []
    for name in JS_MODULES:
        p = SRC / "js" / f"{name}.js"
        js_parts.append(f"/* ===== {name}.js ===== */\n{read(p)}")
    js = "\n\n".join(js_parts)

    vendor_css = read(VENDOR / "leaflet.css")
    vendor_js = "\n".join(read(VENDOR / f) for f in ("leaflet.js", "qrcode.js", "jsqr.js"))
    # </script> in Vendor-Code unschädlich machen
    vendor_js = vendor_js.replace("</script", "<\\/script")

    out = (
        html.replace("/*{{VENDOR_CSS}}*/", vendor_css)
        .replace("/*{{CSS}}*/", css)
        .replace("/*{{VENDOR_JS}}*/", vendor_js)
        .replace("/*{{JS}}*/", '"use strict";\n' + js)
    )
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    kb = len(out.encode("utf-8")) / 1024
    print(f"index.html geschrieben ({kb:.0f} KB, {out.count(chr(10))} Zeilen)")

    if "--check" in sys.argv:
        missing = [p.stem for p in (SRC / "js").glob("*.js") if p.stem not in JS_MODULES]
        if missing:
            print("WARNUNG: nicht eingebundene Module:", ", ".join(missing))
            sys.exit(1)
        if re.search(r"\{\{[A-Z_]+\}\}", out):
            print("WARNUNG: unersetzte Platzhalter")
            sys.exit(1)


if __name__ == "__main__":
    main()
