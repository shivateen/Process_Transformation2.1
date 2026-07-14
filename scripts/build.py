#!/usr/bin/env python3
"""
build.py — Assemble the ProcessIQ Cognitive Cockpit into a single self-contained
public/processiq.html (CSS + data + engine + UI inlined, no CDN, runs from file://).

Mirrors the FinTran/CloseIQ build pattern: edit sources in src/, run this, serve public/.

  python scripts/build.py
  python -m http.server 3000 --directory public   ->  http://localhost:3000/processiq.html
"""
import os, json, base64

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
PUB = os.path.join(ROOT, "public")

# Latin + latin-ext subsets, base64-inlined so the single-file output keeps working
# offline (a Google Fonts <link> would need the network). ~96 KB raw.
FONT_FACES = [
    ("DM Sans", "300 800", "dm-sans-latin-ext.woff2",
     "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,"
     "U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,"
     "U+2C60-2C7F,U+A720-A7FF"),
    ("DM Sans", "300 800", "dm-sans-latin.woff2",
     "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
     "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
    ("JetBrains Mono", "400 700", "jetbrains-mono-latin-ext.woff2",
     "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,"
     "U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,"
     "U+2C60-2C7F,U+A720-A7FF"),
    ("JetBrains Mono", "400 700", "jetbrains-mono-latin.woff2",
     "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,"
     "U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
]


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as f:
        return f.read()


def font_css():
    """@font-face rules with the woff2 subsets inlined as data: URIs."""
    out = []
    for family, weight, filename, unicode_range in FONT_FACES:
        with open(os.path.join(SRC, "fonts", filename), "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        out.append(
            "@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}"
            % (family, weight, b64, unicode_range)
        )
    return "\n".join(out)


def main():
    # Re-generate data first so the build is always current with the xlsx.
    import build_patterns, build_portfolio, build_roi, build_discovery, build_taxonomy, build_cfo  # noqa
    import build_command_centre, build_mining  # noqa
    build_patterns.main()
    build_portfolio.main()
    build_roi.main()
    build_discovery.main()
    build_taxonomy.main()          # depends on patterns.json above
    build_cfo.main()               # depends on patterns.json above
    build_command_centre.main()    # depends on patterns.json above
    build_mining.main()            # depends on patterns.json above

    css = read("src", "css", "app.css")
    body = read("src", "html", "cockpit_body.html")
    engine = read("src", "js", "engine.js")
    # load order matters: shell defines window.PIQ, modules self-register, then boot
    js_modules = "\n".join([
        read("src", "js", "shell.js"),
        read("src", "js", "studio.js"),
        read("src", "js", "fitment.js"),
        read("src", "js", "build.js"),
        read("src", "js", "runtime.js"),
        read("src", "js", "provocation.js"),
        read("src", "js", "cockpit.js"),
        read("src", "js", "library.js"),
        read("src", "js", "governance.js"),
        read("src", "js", "roi.js"),
        read("src", "js", "discovery.js"),
        read("src", "js", "processmap.js"),
        read("src", "js", "cfo.js"),
        # tutorial last: the engine wraps PIQ.boot, and tours.js needs PIQ.tutorial
        read("src", "js", "tutorial", "tutorial.js"),
        read("src", "js", "tutorial", "tours.js"),
    ])
    patterns = read("src", "data", "patterns.json")
    portfolio = read("src", "data", "portfolio.json")
    roi = read("src", "data", "roi.json")
    discovery = read("src", "data", "discovery.json")
    taxonomy = read("src", "data", "taxonomy.json")
    processmaps = read("src", "data", "processmaps.json")
    cfo = read("src", "data", "cfo.json")
    command_centre = read("src", "data", "command_centre.json")
    mining = read("src", "data", "mining.json")

    html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="Cache-Control" content="no-cache"/>
<title>Process Transformation Accelerator · Tiger Analytics</title>
<style>
{fonts}
</style>
<style>
{css}
</style>
</head>
<body>
{body}
<script>window.PROCESSIQ_PATTERNS = {patterns};</script>
<script>window.PROCESSIQ_PORTFOLIO = {portfolio};</script>
<script>window.PROCESSIQ_ROI = {roi};</script>
<script>window.PROCESSIQ_DISCOVERY = {discovery};</script>
<script>window.PROCESSIQ_TAXONOMY = {taxonomy};</script>
<script>window.PROCESSIQ_PROCESSMAPS = {processmaps};</script>
<script>window.PROCESSIQ_CFO = {cfo};</script>
<script>window.PROCESSIQ_CC = {command_centre};</script>
<script>window.PROCESSIQ_MINING = {mining};</script>
<script>
{engine}
</script>
<script>
{js_modules}
</script>
<script>window.PIQ.boot();</script>
</body>
</html>
""".format(fonts=font_css(), css=css, body=body, patterns=patterns, portfolio=portfolio,
           roi=roi, discovery=discovery, taxonomy=taxonomy, processmaps=processmaps, cfo=cfo,
           command_centre=command_centre, mining=mining, engine=engine, js_modules=js_modules)

    os.makedirs(PUB, exist_ok=True)
    out = os.path.join(PUB, "processiq.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    # landing page — same inlined fonts, so it too renders correctly offline
    landing = read("src", "apps", "index.html").replace("/*@FONTS@*/", font_css())
    with open(os.path.join(PUB, "index.html"), "w", encoding="utf-8") as f:
        f.write(landing)
    kb = len(html.encode("utf-8")) / 1024
    print(f"\nBuilt {os.path.relpath(out, ROOT)}  ({kb:.0f} KB, self-contained)")
    print(f"Built {os.path.relpath(os.path.join(PUB, 'index.html'), ROOT)}  (landing)")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    main()
