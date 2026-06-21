#!/usr/bin/env python3
"""
build-mobile.py — package src/App.jsx into a single-file mobile web app at
docs/index.html (for GitHub Pages + Add to Home Screen).

Pure standard library. No npm, no Pillow, no network. Just:  python3 build-mobile.py
"""
import re, json, urllib.parse, os

SRC = "src/App.jsx"
OUT = "docs/index.html"

# spoon home-screen icon (pre-rendered; edit only if you redraw the spoon)
ICON = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAADNElEQVR4nO3dMWoUYQCGYSN6ABtBBAsDFouNXbocwTvYebmQIk1Kg4WdjWwRSEgTBBsPYGMtzLtxdmd3NsnzlEMy2eLlLz52Jgcn51+fwJCnc38A9pc4SOIgiYMkDpI4SOIgiYMkDtKzuT/A43J89GHw+s9fvye5/6uXLwavf/n2fY27OTlI4iCJgyQOkjhI4iCJg2Tn2EjtFqX2jNOzi8Hri8Xh6M80pD7n6v3DyUESB0kcJHGQxEESB0kcJDvHf+md4MdW/+5yeTV4vfaPy+vbCf+6k4MkDpI4SOIgiYMkDpI4SHaOf4x9rqR2iIfByUESB0kcJHGQxEESB0kcpEe6c4z9fsZUe8ZUz6GUd29fD16v93ZcXt+suJuTgyQOkjhI4iCJgyQOkjhIj3Tn2La59oyy3ntOnRwkcZDEQRIHSRwkcZDEQbJzbGTbe8a8nBwkcZDEQRIHSRwkcZDEQbJz7LXjo/eD1+v5mvqex+rnU4qTgyQOkjhI4iCJgyQOkjhID3znGPte0doJxr73Yiq1Z/T+ser/xI7l5CCJgyQOkjhI4iCJgyQO0gPZOWrPKLVP1P5xenYx6v5TPc+ymz2jODlI4iCJgyQOkjhI4iCJg3TPdo6xe8bY929eXt8OXp9qtxj7/tDd7BnFyUESB0kcJHGQxEESB0kcpD3dOcbuGWPVnjHt+y22d5/dcHKQxEESB0kcJHGQxEESB2nmnWPb38+o500+f/o4eH3e70/sGycHSRwkcZDEQRIHSRwkcZB2tHPM9byJPWMTTg6SOEjiIImDJA6SOEjiIE28c8y1Z9TzJvaMTTg5SOIgiYMkDpI4SOIgiYO05s4x1/sz+udvtvNBHjUnB0kcJHGQxEESB0kcJHGQ7tg5ptozxv6/Vs+b7AMnB0kcJHGQxEESB0kcJHGQ7tg5xj5XUuwZ95GTgyQOkjhI4iCJgyQOkjhIByfnX1f+wPMtf4A/W74/63NykMRBEgdJHCRxkMRBEgdpzfdzLJdXg9cXi8P4DXvG/ePkIImDJA6SOEjiIImDJA7SnTvH8D6xWLwZ9fPcR04OkjhI4iCJgyQOkjhI4iCJgyQO0l+9SJWtvgQMigAAAABJRU5ErkJggg=="

CDN = "https://cdnjs.cloudflare.com/ajax/libs"

HEAD_CSS = """
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      html, body {
        margin: 0; padding: 0;
        overflow: hidden; position: fixed;
        width: 100%; height: 100%;
        overscroll-behavior: none;
        -webkit-user-select: none; user-select: none;
        -webkit-touch-callout: none;
        touch-action: manipulation;
        background: #AEB9C4;
      }
      #root { width: 100%; height: 100%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
      input, textarea, [contenteditable] {
        -webkit-user-select: text; user-select: text; touch-action: auto;
      }
      .boot { height:100%; display:flex; align-items:center; justify-content:center;
        font-family: ui-monospace, Menlo, monospace; color:#4F5B66; }
"""

def build():
    code = open(SRC).read()
    # React/ReactDOM are globals from the CDN; turn the module into plain script
    code = re.sub(r'import React, \{([^}]*)\} from "react";',
                  r'const {\1} = React;', code)
    code = code.replace("export default function App", "function App")
    code = re.sub(r'^export const', 'const', code, flags=re.M)
    code = code.replace('export const', 'const')
    code += '\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n'
    assert "</script>" not in code, "app code contains </script>"

    manifest = {
        "name": "spoons", "short_name": "spoons", "display": "standalone",
        "background_color": "#AEB9C4", "theme_color": "#AEB9C4",
        "orientation": "portrait", "start_url": ".",
        "icons": [{"src": ICON, "sizes": "180x180", "type": "image/png"}],
    }
    manifest_uri = "data:application/manifest+json," + urllib.parse.quote(json.dumps(manifest))

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="spoons" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#AEB9C4" />
  <link rel="apple-touch-icon" href="{ICON}" />
  <link rel="icon" type="image/png" href="{ICON}" />
  <link rel="manifest" href="{manifest_uri}" />
  <title>spoons</title>
  <style>{HEAD_CSS}</style>
</head>
<body>
  <div id="root"><div class="boot">…</div></div>
  <script src="{CDN}/react/18.3.1/umd/react.production.min.js"></script>
  <script src="{CDN}/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
  <script src="{CDN}/babel-standalone/7.23.5/babel.min.js"></script>
  <script type="text/babel" data-presets="react">
{code}
  </script>
</body>
</html>
'''
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w").write(html)
    ver = re.search(r'APP_VERSION = "([^"]+)"', code)
    print(f"built {OUT}  (v{ver.group(1) if ver else '?'}, {len(html)} bytes)")

if __name__ == "__main__":
    build()
