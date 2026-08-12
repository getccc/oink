#!/usr/bin/env python3
"""Validate Gallery collection, static fallbacks, and Image Zoom reuse."""

from __future__ import annotations

import argparse
from html import unescape
from pathlib import Path
import re
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "exampleSite"
MAIN_SCRIPT = re.compile(r'<script src="([^"]*/js/main-[^"]+\.js)"[^>]*>')
VALID_IMAGE = "/media/content-primitives-static.svg"


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def run_hugo(hugo: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [hugo, *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def bundle_path(public: Path, page: str) -> tuple[Path | None, str]:
    source = (public / page).read_text()
    match = MAIN_SCRIPT.search(source)
    if not match:
        return None, source
    relative = unescape(match.group(1)).split("?", 1)[0].lstrip("/")
    return public / relative, source


def image_tag(source: str, alt: str) -> str:
    match = re.search(rf'<img\b[^>]*\balt="{re.escape(alt)}"[^>]*>', source)
    return match.group(0) if match else ""


def check_outputs(public: Path) -> list[str]:
    errors: list[str] = []
    bundle, html = bundle_path(public, "docs/gallery/index.html")
    disabled_bundle, disabled = bundle_path(public, "docs/gallery-disabled/index.html")
    markdown = (public / "docs/gallery/index.md").read_text()
    print_page = (public / "_print/docs/index.html").read_text()

    for marker in (
        'class="td-gallery td-gallery--columns-4"',
        'class="td-gallery__grid" aria-labelledby="td-gallery-',
        "Console screenshots and architecture views",
        "A deliberately long caption that must wrap",
        "واجهة إعدادات عربية طويلة",
        "远程图片保持静态 URL",
    ):
        require(marker in html, f"Gallery HTML fixture missing {marker}", errors)
    require(html.count('class="td-gallery__item"') == 4, "Gallery lost an item", errors)
    require(html.count('class="td-gallery__figure"') == 4, "Gallery lost a figure", errors)
    require(
        len(re.findall(r"\sdata-td-image-zoom(?:\s|>)", html)) == 4,
        "Gallery lacks explicit Zoom markers",
        errors,
    )
    require(html.count(" data-zoom-src=") == 4, "Gallery lacks canonical Zoom sources", errors)
    require(html.count('loading="lazy" decoding="async"') == 4, "Gallery loading attributes diverged", errors)
    require(html.count("data-td-image-zoom-dialog") == 1, "Gallery did not reuse one dialog", errors)
    require(bundle is not None and bundle.exists(), "Gallery has no local main bundle", errors)
    if bundle and bundle.exists():
        require("data-td-image-zoom-dialog" in bundle.read_text(), "Gallery bundle omits Image Zoom", errors)
    require('class="td-gallery td-gallery--columns-2"' in disabled, "disabled Gallery lost its grid", errors)
    require("Static Gallery overview" in disabled and "Static Gallery detail" in disabled, "disabled Gallery lost content", errors)
    require("data-td-image-zoom-dialog" not in disabled, "disabled Gallery emitted a dialog", errors)
    require(disabled_bundle is not None and disabled_bundle.exists(), "disabled Gallery has no main bundle", errors)
    if disabled_bundle and disabled_bundle.exists():
        require("data-td-image-zoom-dialog" not in disabled_bundle.read_text(), "disabled Gallery loaded Zoom", errors)
    require(bundle != disabled_bundle, "enabled and disabled Gallery reused one bundle target", errors)

    page_tag = image_tag(html, "Blue and gold local dashboard overview")
    global_tag = image_tag(html, "Green and violet global dashboard detail")
    static_tag = image_tag(html, "Tall static SVG settings overview")
    remote_tag = image_tag(html, "Remote deployment history view")
    for name, tag in (
        ("page", page_tag),
        ("global", global_tag),
        ("static", static_tag),
        ("remote", remote_tag),
    ):
        require(bool(tag), f"Gallery lacks the {name} image", errors)
    require('src="/docs/gallery/page.png"' in page_tag, "Gallery page resource URL is wrong", errors)
    require('width="64" height="40"' in page_tag, "Gallery page resource lacks dimensions", errors)
    require('src="/media/content-primitives-global.png"' in global_tag, "Gallery global resource URL is wrong", errors)
    require('width="64" height="40"' in global_tag, "Gallery global resource lacks dimensions", errors)
    require('src="/media/content-primitives-tall.svg"' in static_tag, "Gallery static URL is wrong", errors)
    require(" width=" not in static_tag and " height=" not in static_tag, "Gallery invented static dimensions", errors)
    require('src="https://example.invalid/gallery/remote.webp?view=full"' in remote_tag, "Gallery remote URL is wrong", errors)
    require(" width=" not in remote_tag and " height=" not in remote_tag, "Gallery invented remote dimensions", errors)

    order = (
        "Blue and gold local dashboard overview",
        "Green and violet global dashboard detail",
        "Tall static SVG settings overview",
        "Remote deployment history view",
    )
    require([html.index(value) for value in order] == sorted(html.index(value) for value in order), "Gallery HTML order changed", errors)

    for marker in (
        "![Blue and gold local dashboard overview](/docs/gallery/page.png)",
        "![Green and violet global dashboard detail](/media/content-primitives-global.png)",
        "![Tall static SVG settings overview](/media/content-primitives-tall.svg)",
        "![Remote deployment history view](https://example.invalid/gallery/remote.webp?view=full)",
        "_واجهة إعدادات عربية طويلة لاختبار الالتفاف والاتجاه التلقائي_",
        "_远程图片保持静态 URL，构建过程不会下载它。_",
    ):
        require(marker in markdown, f"Gallery Markdown fixture missing {marker}", errors)
    require(markdown.count("![") == 4, "Gallery Markdown lost an image", errors)
    for marker in ("<figure", "td-gallery", "data-td-image-zoom", "data-zoom-src", "<dialog"):
        require(marker not in markdown, f"Gallery Markdown contains {marker}", errors)
    require([markdown.index(value) for value in order] == sorted(markdown.index(value) for value in order), "Gallery Markdown order changed", errors)

    for marker in order:
        require(marker in print_page, f"Gallery print output missing {marker}", errors)
    require('class="td-gallery td-gallery--columns-4"' in print_page, "Gallery print output is not semantic HTML", errors)
    require("![Blue and gold local dashboard overview]" not in print_page, "Gallery print output used its Markdown fallback", errors)
    for marker in ("data-td-image-zoom", "data-zoom-src", "td-image-zoom", "<dialog"):
        require(marker not in print_page, f"Gallery print output contains {marker}", errors)
    return errors


def temp_page_build(hugo: str, body: str) -> tuple[subprocess.CompletedProcess[str], str, str]:
    with tempfile.TemporaryDirectory(prefix="oink-gallery-page-") as temp:
        temp_path = Path(temp)
        content = temp_path / "content/docs/gallery-test"
        content.mkdir(parents=True)
        (content / "index.md").write_text(
            "---\ntitle: Gallery test\noutputs: [HTML, markdown]\n---\n\n" + body
        )
        destination = temp_path / "public"
        result = run_hugo(
            hugo,
            "--source",
            str(EXAMPLE),
            "--contentDir",
            str(temp_path / "content"),
            "--destination",
            str(destination),
            "--logLevel",
            "warn",
        )
        html = ""
        markdown = ""
        if result.returncode == 0:
            html = (destination / "docs/gallery-test/index.html").read_text()
            markdown = (destination / "docs/gallery-test/index.md").read_text()
        return result, html, markdown


def check_columns_and_escaping(hugo: str) -> list[str]:
    errors: list[str] = []
    blocks = []
    for columns in range(1, 5):
        label = "<One & gallery>" if columns == 1 else f"Gallery {columns}"
        alt = "A <quoted> & image" if columns == 1 else f"Gallery image {columns}"
        caption = "<script>alert(1)</script> & caption" if columns == 1 else f"Caption {columns}"
        blocks.append(
            f'{{{{< gallery columns={columns} label="{label}" >}}}}\n'
            f'{{{{< gallery/image src="{VALID_IMAGE}" alt="{alt}" caption="{caption}" >}}}}\n'
            "{{< /gallery >}}"
        )
    result, html, markdown = temp_page_build(hugo, "\n\n".join(blocks) + "\n")
    if result.returncode != 0:
        errors.append(f"Gallery column matrix failed to build: {result.stdout}{result.stderr}")
        return errors
    for columns in range(1, 5):
        require(
            html.count(f"td-gallery--columns-{columns}") == 1,
            f"Gallery columns={columns} did not render exactly once",
            errors,
        )
    require("&lt;One &amp; gallery&gt;" in html, "Gallery label was not HTML-escaped", errors)
    require('alt="A &lt;quoted&gt; &amp; image"' in html, "Gallery alt was not HTML-escaped", errors)
    require("&lt;script&gt;alert(1)&lt;/script&gt; &amp; caption" in html, "Gallery caption was not HTML-escaped", errors)
    require("<script>alert(1)</script>" not in html, "Gallery caption became executable HTML", errors)
    require(r"\<One \& gallery\>" in markdown, "Gallery label was not Markdown-escaped", errors)
    require(r"A \<quoted\> \& image" in markdown, "Gallery alt was not Markdown-escaped", errors)
    require(r"\<script\>alert\(1\)\<\/script\> \& caption" in markdown, "Gallery caption was not Markdown-escaped", errors)
    return errors


def check_subpath(hugo: str) -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-gallery-subpath-") as temp:
        destination = Path(temp) / "public"
        result = run_hugo(
            hugo,
            "--source",
            str(EXAMPLE),
            "--destination",
            str(destination),
            "--baseURL",
            "https://example.org/manual/",
            "--logLevel",
            "warn",
        )
        if result.returncode != 0:
            errors.append(f"Gallery subpath fixture failed to build: {result.stdout}{result.stderr}")
            return errors
        page = (destination / "docs/gallery/index.html").read_text()
        for marker in (
            'src="/manual/docs/gallery/page.png"',
            'data-zoom-src="/manual/docs/gallery/page.png"',
            'src="/manual/media/content-primitives-global.png"',
            'data-zoom-src="/manual/media/content-primitives-global.png"',
            'src="/manual/media/content-primitives-tall.svg"',
            'data-zoom-src="/manual/media/content-primitives-tall.svg"',
            'src="https://example.invalid/gallery/remote.webp?view=full"',
        ):
            require(marker in page, f"Gallery subpath fixture missing {marker}", errors)
    return errors


def check_rss_output(hugo: str) -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-gallery-rss-") as temp:
        temp_path = Path(temp)
        content = temp_path / "content/docs/rss"
        layouts = temp_path / "layouts/docs"
        content.mkdir(parents=True)
        layouts.mkdir(parents=True)
        (content / "index.md").write_text(
            "---\ntitle: Gallery RSS\noutputs: [RSS]\n---\n\n"
            '{{< gallery columns=2 label="RSS views" >}}\n'
            f'{{{{< gallery/image src="{VALID_IMAGE}" alt="RSS first" caption="First caption" >}}}}\n'
            '{{< gallery/image src="https://example.invalid/second.webp" alt="RSS second" caption="Second caption" >}}\n'
            "{{< /gallery >}}\n"
        )
        (layouts / "single.rss.xml").write_text(
            '{{- .Store.Set "tdOutputFormat" "rss" -}}\n'
            "<fixture>{{ .RenderShortcodes }}</fixture>\n"
        )
        override = temp_path / "rss.yaml"
        override.write_text(
            "disableKinds: [sitemap, taxonomy, term]\n"
            "outputs:\n"
            "  home: [HTML]\n"
            "  section: [HTML]\n"
            "  page: [RSS]\n"
        )
        destination = temp_path / "public"
        result = run_hugo(
            hugo,
            "--source",
            str(EXAMPLE),
            "--contentDir",
            str(temp_path / "content"),
            "--layoutDir",
            str(temp_path / "layouts"),
            "--destination",
            str(destination),
            "--config",
            f"{EXAMPLE / 'hugo.yaml'},{override}",
            "--logLevel",
            "warn",
        )
        if result.returncode != 0:
            errors.append(f"Gallery RSS fixture failed to build: {result.stdout}{result.stderr}")
            return errors
        outputs = list(destination.rglob("*.xml"))
        if not outputs:
            errors.append("Gallery RSS fixture did not produce XML")
            return errors
        source = outputs[0].read_text()
        for marker in ("td-gallery td-gallery--columns-2", "RSS first", "First caption", "RSS second", "Second caption"):
            require(marker in source, f"Gallery RSS fixture missing {marker}", errors)
        require(source.index("RSS first") < source.index("RSS second"), "Gallery RSS order changed", errors)
        for marker in ("data-td-image-zoom", "data-zoom-src", "td-image-zoom", "<dialog", "![RSS"):
            require(marker not in source, f"Gallery RSS fixture contains {marker}", errors)
    return errors


def check_generic_rss_cache(hugo: str) -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-gallery-generic-rss-") as temp:
        site = Path(temp)
        item = site / "content/docs/item"
        item.mkdir(parents=True)
        (site / "content/docs/_index.md").write_text("---\ntitle: Docs\n---\n")
        (item / "index.md").write_text(
            "---\ntitle: Gallery cache item\ndate: 2026-08-11\noutputs: [HTML, markdown]\n---\n\n"
            "Before gallery with enough ordinary summary words to exercise the cached generic section feed output.\n\n"
            '{{< gallery columns=2 label="Cached gallery" >}}\n'
            f'{{{{< gallery/image src="{VALID_IMAGE}" alt="Cached first" caption="Cached caption" >}}}}\n'
            "{{< /gallery >}}\n\n"
            '<p><img src="/media/content-primitives-static.svg" alt="Boundary fixture" '
            'data-td-image-zoom-extra="keep" data-no-zoom-extra="keep"></p>\n'
        )
        (site / "hugo.yaml").write_text(
            "baseURL: https://example.org/\n"
            "title: Gallery RSS cache fixture\n"
            f"theme: {ROOT.name}\n"
            "disableKinds: [sitemap, taxonomy, term]\n"
            "outputs:\n"
            "  home: [HTML, RSS]\n"
            "  section: [HTML, RSS]\n"
            "  page: [HTML, markdown]\n"
            "params:\n  ui:\n    image_zoom:\n      enable: true\n"
            "markup:\n  goldmark:\n    renderer:\n      unsafe: true\n"
        )
        destination = site / "public"
        result = run_hugo(
            hugo,
            "--source",
            str(site),
            "--themesDir",
            str(ROOT.parent),
            "--destination",
            str(destination),
            "--logLevel",
            "warn",
        )
        if result.returncode != 0:
            errors.append(f"Gallery generic RSS cache fixture failed: {result.stdout}{result.stderr}")
            return errors
        source = (destination / "docs/index.xml").read_text()
        for marker in ("Before gallery with enough ordinary summary words", "Cached gallery", "Cached first", "Cached caption", "&lt;figure"):
            require(marker in source, f"Gallery generic RSS cache fixture missing {marker}", errors)
        for marker in ('data-td-image-zoom-extra=&#34;keep&#34;', 'data-no-zoom-extra=&#34;keep&#34;'):
            require(marker in source, f"Gallery static filter damaged similar attribute {marker}", errors)
        for marker in ("![Cached first]", "data-zoom-src", "data-td-image-zoom-dialog", "<dialog"):
            require(marker not in source, f"Gallery generic RSS cache fixture contains {marker}", errors)
        require(
            not re.search(r"data-td-image-zoom(?:=|\s|&gt;)", source),
            "Gallery generic RSS cache fixture contains the exact Zoom eligibility attribute",
            errors,
        )
        require(
            not re.search(r"data-no-zoom(?:=|\s|&gt;)", source),
            "Gallery generic RSS cache fixture contains the exact no-Zoom attribute",
            errors,
        )
    return errors


def zoom_site_config(enabled: bool | None) -> str:
    config = (
        "baseURL: https://example.org/\n"
        "title: Gallery Zoom fixture\n"
        f"theme: {ROOT.name}\n"
        "disableKinds: [RSS, sitemap, taxonomy, term]\n"
    )
    if enabled is not None:
        config += f"params:\n  ui:\n    image_zoom:\n      enable: {str(enabled).lower()}\n"
    return config


def check_zoom_reuse(hugo: str) -> list[str]:
    errors: list[str] = []
    cases = (
        ("default-off", None, None, False),
        ("site-on", True, None, True),
        ("page-false-wins", True, False, False),
    )
    for name, site_enabled, page_enabled, expected in cases:
        with tempfile.TemporaryDirectory(prefix=f"oink-gallery-zoom-{name}-") as temp:
            site = Path(temp)
            (site / "content/docs").mkdir(parents=True)
            front = "---\ntitle: Gallery Zoom\n"
            if page_enabled is not None:
                front += f"params:\n  ui:\n    image_zoom:\n      enable: {str(page_enabled).lower()}\n"
            front += "---\n\n"
            body = (
                '{{< gallery label="Zoom reuse" >}}\n'
                f'{{{{< gallery/image src="{VALID_IMAGE}" alt="First Zoom image" >}}}}\n'
                '{{< gallery/image src="/media/content-primitives-tall.svg" alt="Second Zoom image" >}}\n'
                "{{< /gallery >}}\n"
            )
            (site / "content/docs/index.md").write_text(front + body)
            (site / "hugo.yaml").write_text(zoom_site_config(site_enabled))
            destination = site / "public"
            result = run_hugo(
                hugo,
                "--source",
                str(site),
                "--themesDir",
                str(ROOT.parent),
                "--destination",
                str(destination),
                "--logLevel",
                "warn",
            )
            if result.returncode != 0:
                errors.append(f"Gallery Zoom case {name} failed: {result.stdout}{result.stderr}")
                continue
            bundle, page = bundle_path(destination, "docs/index.html")
            require(
                len(re.findall(r"\sdata-td-image-zoom(?:\s|>)", page)) == 2,
                f"Gallery Zoom case {name} lost markers",
                errors,
            )
            require(("data-td-image-zoom-dialog" in page) == expected, f"Gallery Zoom case {name} dialog state is wrong", errors)
            require(bundle is not None and bundle.exists(), f"Gallery Zoom case {name} lacks a bundle", errors)
            if bundle and bundle.exists():
                require(
                    ("data-td-image-zoom-dialog" in bundle.read_text()) == expected,
                    f"Gallery Zoom case {name} bundle state is wrong",
                    errors,
                )
            if expected:
                require(page.count("data-td-image-zoom-dialog") == 1, "Gallery emitted duplicate dialogs", errors)
    return errors


INVALID_CASES = (
    ("parent-positional", f'{{{{< gallery 2 >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "accepts named parameters only"),
    ("parent-unknown", f'{{{{< gallery gap=2 >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "unsupported parameter"),
    ("columns-string", f'{{{{< gallery columns="2" >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "columns must be an integer"),
    ("columns-float", f'{{{{< gallery columns=2.0 >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "columns must be an integer"),
    ("columns-low", f'{{{{< gallery columns=0 >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "columns must be from 1 through 4"),
    ("columns-high", f'{{{{< gallery columns=5 >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "columns must be from 1 through 4"),
    ("label-type", f'{{{{< gallery label=true >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "label must be a string"),
    ("label-empty", f'{{{{< gallery label=" " >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}{{{{< /gallery >}}}}', "label must not be empty"),
    ("no-child", "{{< gallery >}}{{< /gallery >}}", "requires at least one gallery/image child"),
    ("raw-content", "{{< gallery >}}not an image{{< /gallery >}}", "accepts gallery/image children only"),
    ("child-outside", f'{{{{< gallery/image src="{VALID_IMAGE}" alt="x" >}}}}', "must be enclosed directly by gallery"),
    ("child-positional", f'{{{{< gallery >}}}}{{{{< gallery/image "{VALID_IMAGE}" "x" >}}}}{{{{< /gallery >}}}}', "accepts named parameters only"),
    ("child-unknown", f'{{{{< gallery >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" class="wide" >}}}}{{{{< /gallery >}}}}', "unsupported parameter"),
    ("missing-src", '{{< gallery >}}{{< gallery/image alt="x" >}}{{< /gallery >}}', "requires parameter src"),
    ("src-type", '{{< gallery >}}{{< gallery/image src=true alt="x" >}}{{< /gallery >}}', "src must be a string"),
    ("src-empty", '{{< gallery >}}{{< gallery/image src=" " alt="x" >}}{{< /gallery >}}', "src must not be empty"),
    ("src-fragment-only", '{{< gallery >}}{{< gallery/image src="#preview" alt="x" >}}{{< /gallery >}}', "requires an image path"),
    ("src-query-only", '{{< gallery >}}{{< gallery/image src="?view=preview" alt="x" >}}{{< /gallery >}}', "requires an image path"),
    ("missing-alt", f'{{{{< gallery >}}}}{{{{< gallery/image src="{VALID_IMAGE}" >}}}}{{{{< /gallery >}}}}', "requires parameter alt"),
    ("alt-type", f'{{{{< gallery >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt=true >}}}}{{{{< /gallery >}}}}', "alt must be a string"),
    ("alt-empty", f'{{{{< gallery >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt=" " >}}}}{{{{< /gallery >}}}}', "requires meaningful alt text"),
    ("caption-type", f'{{{{< gallery >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" caption=true >}}}}{{{{< /gallery >}}}}', "caption must be a string"),
    ("caption-empty", f'{{{{< gallery >}}}}{{{{< gallery/image src="{VALID_IMAGE}" alt="x" caption=" " >}}}}{{{{< /gallery >}}}}', "caption must not be empty"),
    ("unsafe-src", '{{< gallery >}}{{< gallery/image src="javascript:alert(1)" alt="x" >}}{{< /gallery >}}', "unsupported src scheme"),
    ("protocol-relative", '{{< gallery >}}{{< gallery/image src="//example.org/x.png" alt="x" >}}{{< /gallery >}}', "protocol-relative URL"),
    ("non-image", '{{< gallery >}}{{< gallery/image src="js/base.js" alt="x" >}}{{< /gallery >}}', "resolved to a non-image"),
)


def check_invalid_cases(hugo: str) -> list[str]:
    errors: list[str] = []
    for name, body, expected in INVALID_CASES:
        with tempfile.TemporaryDirectory(prefix=f"oink-gallery-invalid-{name}-") as temp:
            temp_path = Path(temp)
            content = temp_path / "content/docs/invalid"
            content.mkdir(parents=True)
            (content / "index.md").write_text(f"---\ntitle: Invalid Gallery {name}\n---\n\n{body}\n")
            result = run_hugo(
                hugo,
                "--source",
                str(EXAMPLE),
                "--contentDir",
                str(temp_path / "content"),
                "--destination",
                str(temp_path / "public"),
                "--logLevel",
                "warn",
            )
            output = result.stdout + result.stderr
            require(result.returncode != 0, f"invalid Gallery case {name} unexpectedly built", errors)
            require(expected in output, f"invalid Gallery case {name} did not report {expected!r}: {output.strip()}", errors)
            require("content/docs/invalid/index.md:" in output, f"invalid Gallery case {name} omitted its position", errors)
    return errors


def check_template_contracts() -> list[str]:
    errors: list[str] = []
    parent = (ROOT / "layouts/_shortcodes/gallery.html").read_text()
    child = (ROOT / "layouts/_shortcodes/gallery/image.html").read_text()
    styles = (ROOT / "assets/scss/td/shortcodes/content-primitives.scss").read_text()
    static_output = (ROOT / "layouts/_partials/content/static-image-output.html").read_text()
    scripts = (ROOT / "layouts/_partials/scripts.html").read_text()
    ci = (ROOT / ".github/workflows/ci.yml").read_text()

    require('partial "content/image-resolve.html"' in child, "Gallery child bypasses the shared resolver", errors)
    require("resources.GetRemote" not in parent + child, "Gallery fetches remote images", errors)
    require('.Parent.Scratch.SetInMap "galleryEntries"' in child, "Gallery child does not register ordered data", errors)
    require('printf "%08d" .Ordinal' in child, "Gallery child key is not ordinal-based", errors)
    require('.Scratch.Get "galleryEntries"' in parent, "Gallery parent does not own rendering", errors)
    require('partial "content/image-zoom-config.html"' in parent, "Gallery does not reuse Zoom configuration", errors)
    require('.Page.Store.Set "hasImageZoom" true' in parent, "Gallery does not request the shared Zoom runtime", errors)
    require('eq $outputFormat "markdown"' in parent, "Gallery lacks Markdown output", errors)
    require('eq $outputFormat "html"' in parent, "Gallery does not isolate interactive HTML", errors)
    require("data-td-image-zoom" in parent and "data-zoom-src" in parent, "Gallery lacks explicit Zoom eligibility", errors)
    require('loading="lazy" decoding="async"' in parent, "Gallery lacks stable loading attributes", errors)
    require("js/gallery" not in scripts and not (ROOT / "assets/js/gallery.js").exists(), "Gallery added a second runtime", errors)
    require("data-td-image-zoom" in static_output, "static output filter does not remove Gallery eligibility", errors)
    require("(\\s|/?>)" in static_output and '"$1"' in static_output, "static output filter lacks exact attribute boundaries", errors)
    for marker in (".td-gallery__grid", "repeat(4", "overflow-wrap", "forced-colors", "@media print", "break-inside"):
        require(marker in styles, f"Gallery styles lack {marker}", errors)
    require("python3 scripts/check-gallery.py" in ci, "CI does not run Gallery checks", errors)
    contract = (ROOT / "docs/content-primitives.md").read_text()
    require("### 3.7 Gallery and Gallery Image" in contract, "Gallery contract is undocumented", errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", type=Path, default=EXAMPLE / "public")
    parser.add_argument("--hugo", default="hugo")
    args = parser.parse_args()

    errors = (
        check_outputs(args.public)
        + check_columns_and_escaping(args.hugo)
        + check_subpath(args.hugo)
        + check_rss_output(args.hugo)
        + check_generic_rss_cache(args.hugo)
        + check_zoom_reuse(args.hugo)
        + check_invalid_cases(args.hugo)
        + check_template_contracts()
    )
    if errors:
        print("Gallery checks failed:")
        for error in errors:
            print(f"  {error}")
        return 1
    print("Gallery checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
