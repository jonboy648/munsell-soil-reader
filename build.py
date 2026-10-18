"""PROTOTYPE build: inline the library, logic and page script into one double-clickable HTML file.

Run: python build.py  ->  writes munsell-prototype.html
"""
from pathlib import Path

HERE = Path(__file__).parent


def main() -> None:
    bundle = (HERE / "vendor" / "munsell.bundle.js").read_text(encoding="utf-8")
    logic = (HERE / "logic.js").read_text(encoding="utf-8")
    page_js = (HERE / "page.js").read_text(encoding="utf-8")
    for name, text in [("bundle", bundle), ("logic", logic), ("page", page_js)]:
        assert "</script" not in text.lower(), f"{name} contains </script>"
    notice = (
        "/* munsell.js 1.1.7, MPL-2.0, (c) Hugo Sansaqua. Unmodified npm package bundled with esbuild.\n"
        "   Source: https://github.com/privet-kitty/munsell.js  License: vendor/munsell.js-LICENSE.txt */\n"
    )
    html = (HERE / "page.html").read_text(encoding="utf-8")
    html = html.replace("<!--MUNSELL_BUNDLE-->", f"<script>\n{notice}{bundle}\n</script>")
    html = html.replace("<!--LOGIC-->", f"<script>\n{logic}\n</script>")
    html = html.replace("<!--PAGE_SCRIPT-->", page_js)
    out = HERE / "munsell-prototype.html"
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")

    # The real tool: one page, munsell.js loaded from jsDelivr instead of inlined.
    app_js = (HERE / "app.js").read_text(encoding="utf-8")
    assert "</script" not in app_js.lower(), "app.js contains </script>"
    app = (HERE / "app.html").read_text(encoding="utf-8")
    app = app.replace("<!--LOGIC-->", f"<script>\n{logic}\n</script>")
    app = app.replace("<!--APP_SCRIPT-->", app_js)

    # Artifact version: the publish step adds the document skeleton.
    artifact = HERE / "dist" / "munsell-soil-reader.html"
    artifact.parent.mkdir(exist_ok=True)
    artifact.write_text(app, encoding="utf-8")
    print(f"wrote {artifact} ({artifact.stat().st_size // 1024} KB)")

    # Website version (soil.joncackler.com): same page in a full document.
    head, body = app.split('<div class="wrap">', 1)
    site_html = (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        "<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}"
        "body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n"
        f"{head}</head>\n<body>\n<div class=\"wrap\">{body}</body>\n</html>\n"
    )
    site = HERE / "site" / "index.html"
    site.parent.mkdir(exist_ok=True)
    site.write_text(site_html, encoding="utf-8")
    print(f"wrote {site} ({site.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
