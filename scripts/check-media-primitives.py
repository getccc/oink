#!/usr/bin/env python3
"""Validate shared image resolution and imgproc compatibility."""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "exampleSite"
PAGE_IMAGE = EXAMPLE / "content/docs/media-primitives/page.png"


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


def check_outputs(public: Path) -> list[str]:
    errors: list[str] = []
    page = (public / "docs/media-primitives/index.html").read_text()
    markdown = (public / "docs/media-primitives/index.md").read_text()
    print_page = (public / "_print/docs/index.html").read_text()

    for marker in (
        'class="card rounded p-2 td-post-card td-imgproc mb-4 mt-4"',
        'data-zoom-src="/docs/media-primitives/page.png"',
        'alt="Blue and gold page-resource test pattern" width="48" height="30"',
        'data-zoom-src="/media/content-primitives-global.png"',
        'alt="Green and violet global-resource test pattern" width="32" height="20"',
        'alt="" width="24" height="24"',
        'alt="Page resource metadata alternative" width="40" height="24"',
        '<strong>page resource</strong>',
        '<code>inline code</code>',
        'OINK fixture byline',
    ):
        require(marker in page, f"HTML media fixture missing {marker}", errors)
    require(page.count("td-imgproc mb-4 mt-4") == 4, "imgproc lost a fixture", errors)
    require(page.count('loading="lazy" decoding="async"') == 4, "imgproc lacks stable loading attributes", errors)
    require("resources.GetRemote" not in page, "rendered media output leaked template code", errors)

    for marker in (
        "![Blue and gold page\\-resource test pattern](/docs/media-primitives/page_",
        "![Green and violet global\\-resource test pattern](/media/content-primitives-global_",
        "![](/docs/media-primitives/page_",
        "![Page resource metadata alternative](/docs/media-primitives/page_",
        "A **page resource** caption with `inline code`.",
        "Legacy **caption** retains resource metadata",
        "_OINK fixture byline_",
    ):
        require(marker in markdown, f"Markdown media fixture missing {marker}", errors)
    for marker in ("<figure", "<img", "td-imgproc", "data-zoom-src"):
        require(marker not in markdown, f"Markdown media output contains {marker}", errors)
    require(markdown.count("![") == 4, "Markdown media output lost image order", errors)

    for marker in (
        "Blue and gold page-resource test pattern",
        "Green and violet global-resource test pattern",
        "Page resource metadata alternative",
        "page_hu_",
        "content-primitives-global_hu_",
        "OINK fixture byline",
    ):
        require(marker in print_page, f"print media fixture missing {marker}", errors)
    return errors


RESOLVER_SHORTCODE = r'''{{- $resolved := partial "content/image-resolve.html" (dict
  "name" .Name "position" .Position "page" .Page "src" (.Get "src")
  "hasAlt" true "alt" (.Get "alt") "requireAlt" true
) -}}
<span class="media-resolve-fixture"
  data-kind="{{ $resolved.kind }}"
  data-media-type="{{ $resolved.mediaType }}"
  data-processable="{{ $resolved.processable }}"
  data-width="{{ $resolved.width }}"
  data-height="{{ $resolved.height }}"
  data-full-src="{{ $resolved.fullSrc }}"><img src="{{ $resolved.src }}" alt="{{ $resolved.alt }}"></span>
'''


def check_resolver_matrix(hugo: str) -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-media-resolver-") as temp:
        temp_path = Path(temp)
        content = temp_path / "content/docs/resolver"
        layouts = temp_path / "layouts/_shortcodes"
        content.mkdir(parents=True)
        layouts.mkdir(parents=True)
        shutil.copyfile(PAGE_IMAGE, content / "page.png")
        (layouts / "media-resolve-test.html").write_text(RESOLVER_SHORTCODE)
        (content / "index.md").write_text(
            "---\ntitle: Resolver matrix\n---\n\n"
            '{{< media-resolve-test src="page.png" alt="Page raster" >}}\n'
            '{{< media-resolve-test src="media/content-primitives-global.png" alt="Global raster" >}}\n'
            '{{< media-resolve-test src="media/content-primitives-global.svg" alt="Global SVG" >}}\n'
            '{{< media-resolve-test src="/media/content-primitives-static.svg" alt="Static SVG" >}}\n'
            '{{< media-resolve-test src="https://example.invalid/remote.png?fixture=1" alt="Remote raster" >}}\n'
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
            "--baseURL",
            "https://example.org/manual/",
            "--logLevel",
            "warn",
        )
        if result.returncode != 0:
            errors.append(f"resolver matrix failed to build: {result.stdout}{result.stderr}")
            return errors
        page = (destination / "docs/resolver/index.html").read_text()
        compact_page = " ".join(page.split())
        for marker in (
            'data-kind="page" data-media-type="image/png" data-processable="true" data-width="64" data-height="40" data-full-src="/manual/docs/resolver/page.png"',
            '<img src="/manual/docs/resolver/page.png" alt="Page raster">',
            'data-kind="global" data-media-type="image/png" data-processable="true" data-width="64" data-height="40" data-full-src="/manual/media/content-primitives-global.png"',
            'data-kind="global" data-media-type="image/svg&#43;xml" data-processable="false" data-width="0" data-height="0" data-full-src="/manual/media/content-primitives-global.svg"',
            'data-kind="static" data-media-type="image/svg&#43;xml" data-processable="false" data-width="0" data-height="0" data-full-src="/manual/media/content-primitives-static.svg"',
            '<img src="/manual/media/content-primitives-static.svg" alt="Static SVG">',
            'data-kind="remote" data-media-type="image/png" data-processable="false" data-width="0" data-height="0" data-full-src="https://example.invalid/remote.png?fixture=1"',
            '<img src="https://example.invalid/remote.png?fixture=1" alt="Remote raster">',
        ):
            require(marker in compact_page, f"resolver matrix missing {marker}", errors)
    return errors


def check_subpath(hugo: str) -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-media-subpath-") as temp:
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
            errors.append(f"media subpath fixture failed to build: {result.stdout}{result.stderr}")
            return errors
        page = (destination / "docs/media-primitives/index.html").read_text()
        for marker in (
            'src="/manual/docs/media-primitives/page_',
            'data-zoom-src="/manual/docs/media-primitives/page.png"',
            'src="/manual/media/content-primitives-global_',
            'data-zoom-src="/manual/media/content-primitives-global.png"',
        ):
            require(marker in page, f"media subpath fixture missing {marker}", errors)
    return errors


def check_rss_output(hugo: str) -> list[str]:
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-media-rss-") as temp:
        temp_path = Path(temp)
        content = temp_path / "content/docs/rss"
        layouts = temp_path / "layouts/docs"
        content.mkdir(parents=True)
        layouts.mkdir(parents=True)
        shutil.copyfile(PAGE_IMAGE, content / "page.png")
        (content / "index.md").write_text(
            "---\ntitle: RSS media\noutputs: [RSS]\n---\n\n"
            '{{< imgproc src="page.png" command="Fit" options="48x32" alt="RSS image" >}}\n'
            "Static **RSS caption**.\n"
            "{{< /imgproc >}}\n"
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
            errors.append(f"RSS media fixture failed to build: {result.stdout}{result.stderr}")
            return errors
        outputs = [path for path in destination.rglob("*.xml") if "rss" in path.parts]
        if not outputs:
            errors.append("RSS media fixture did not produce XML")
            return errors
        source = outputs[0].read_text()
        for marker in (
            'class="card rounded p-2 td-post-card td-imgproc mb-4 mt-4"',
            'alt="RSS image" width="48" height="30"',
            '<strong>RSS caption</strong>',
        ):
            require(marker in source, f"RSS media fixture missing {marker}", errors)
        require("![RSS image]" not in source, "RSS used Markdown image fallback", errors)
        for marker in ("<dialog", "td-image-zoom", "data-td-image-zoom", "data-zoom-src"):
            require(marker not in source, f"RSS media fixture contains Zoom marker {marker}", errors)
    return errors


def check_generic_rss_output(hugo: str) -> list[str]:
    """Guard HTML-first shortcode caches in Hugo's ordinary section feeds."""
    errors: list[str] = []
    with tempfile.TemporaryDirectory(prefix="oink-media-generic-rss-") as temp:
        site = Path(temp)
        content = site / "content/docs/item"
        content.mkdir(parents=True)
        shutil.copyfile(PAGE_IMAGE, content / "page.png")
        (site / "content/docs/_index.md").write_text(
            "---\ntitle: Docs\n---\n"
        )
        (content / "index.md").write_text(
            "---\ntitle: RSS item\ndate: 2026-08-11\n"
            "outputs: [HTML, markdown]\n---\n\n"
            "Before image.\n\n"
            '{{< imgproc src="page.png" command="Fit" options="48x32" alt="RSS generic image" >}}\n'
            "Generic **RSS caption**.\n"
            "{{< /imgproc >}}\n"
        )
        (site / "hugo.yaml").write_text(
            "baseURL: https://example.org/\n"
            "title: RSS cache fixture\n"
            f"theme: {ROOT.name}\n"
            "disableKinds: [sitemap, taxonomy, term]\n"
            "outputs:\n"
            "  home: [HTML, RSS]\n"
            "  section: [HTML, RSS]\n"
            "  page: [HTML, markdown]\n"
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
            errors.append(f"generic RSS media fixture failed to build: {result.stdout}{result.stderr}")
            return errors
        output = destination / "docs/index.xml"
        if not output.exists():
            errors.append("generic RSS media fixture did not produce docs/index.xml")
            return errors
        source = output.read_text()
        for marker in (
            "Before image.",
            "&lt;figure",
            "RSS generic image",
            "&lt;strong&gt;RSS caption&lt;/strong&gt;",
        ):
            require(marker in source, f"generic RSS media fixture missing {marker}", errors)
        for marker in (
            "![RSS generic image]",
            "data-zoom-src",
            "data-no-zoom",
            "data-td-image-zoom",
            "td-image-zoom",
            "<dialog",
        ):
            require(marker not in source, f"generic RSS media fixture contains {marker}", errors)
    return errors


INVALID_CASES = (
    ("empty", "{{< imgproc >}}\n", "legacy form requires exactly"),
    ("legacy-short", '{{< imgproc "page" Fit >}}\n', "legacy form requires exactly"),
    ("legacy-extra", '{{< imgproc "page" Fit "40x20" "extra" >}}\n', "legacy form requires exactly"),
    ("legacy-src-type", '{{< imgproc true Fit "40x20" >}}\n', "src must be a string"),
    ("legacy-command-type", '{{< imgproc "page" true "40x20" >}}\n', "command must be a string"),
    ("legacy-options-type", '{{< imgproc "page" Fit true >}}\n', "options must be a string"),
    ("missing-src", '{{< imgproc command="Fit" options="40x20" alt="x" >}}\n', "requires parameter src"),
    ("empty-src", '{{< imgproc src="" command="Fit" options="40x20" alt="x" >}}\n', "src must not be empty"),
    ("src-type", '{{< imgproc src=true command="Fit" options="40x20" alt="x" >}}\n', "src must be a string"),
    ("missing-command", '{{< imgproc src="page.png" options="40x20" alt="x" >}}\n', "requires parameter command"),
    ("command-type", '{{< imgproc src="page.png" command=true options="40x20" alt="x" >}}\n', "command must be a string"),
    ("command-value", '{{< imgproc src="page.png" command="Scale" options="40x20" alt="x" >}}\n', "command must be one of"),
    ("missing-options", '{{< imgproc src="page.png" command="Fit" alt="x" >}}\n', "requires parameter options"),
    ("options-type", '{{< imgproc src="page.png" command="Fit" options=true alt="x" >}}\n', "options must be a string"),
    ("options-empty", '{{< imgproc src="page.png" command="Fit" options="" alt="x" >}}\n', "options must not be empty"),
    ("options-invalid", '{{< imgproc src="page.png" command="Fit" options="nonsense" alt="x" >}}\n', "failed for src"),
    ("missing-alt", '{{< imgproc src="page.png" command="Fit" options="40x20" >}}\n', "requires meaningful alt text or decorative=true"),
    ("empty-alt", '{{< imgproc src="page.png" command="Fit" options="40x20" alt="" >}}\n', "requires meaningful alt text or decorative=true"),
    ("alt-type", '{{< imgproc src="page.png" command="Fit" options="40x20" alt=true >}}\n', "alt must be a string"),
    ("decorative-type", '{{< imgproc src="page.png" command="Fit" options="40x20" decorative="true" >}}\n', "decorative must be boolean"),
    ("decorative-alt", '{{< imgproc src="page.png" command="Fit" options="40x20" decorative=true alt="x" >}}\n', "decorative images must not define alt text"),
    ("unknown", '{{< imgproc src="page.png" command="Fit" options="40x20" alt="x" loading="eager" >}}\n', "unsupported parameter"),
    ("missing-resource", '{{< imgproc src="missing.png" command="Fit" options="40x20" alt="x" >}}\n', "cannot be processed"),
    ("static-resource", '{{< imgproc src="/media/content-primitives-static.svg" command="Fit" options="40x20" alt="x" >}}\n', "cannot be processed"),
    ("remote-resource", '{{< imgproc src="https://example.invalid/image.png" command="Fit" options="40x20" alt="x" >}}\n', "cannot be processed"),
    ("svg-resource", '{{< imgproc src="media/content-primitives-global.svg" command="Fit" options="40x20" alt="x" >}}\n', "cannot be processed"),
    ("non-image", '{{< imgproc src="js/base.js" command="Fit" options="40x20" alt="x" >}}\n', "resolved to a non-image"),
    ("unsafe-scheme", '{{< imgproc src="javascript:alert(1)" command="Fit" options="40x20" alt="x" >}}\n', "unsupported src scheme"),
    ("protocol-relative", '{{< imgproc src="//example.org/image.png" command="Fit" options="40x20" alt="x" >}}\n', "protocol-relative URL"),
    ("source-space", '{{< imgproc src="/bad path.png" command="Fit" options="40x20" alt="x" >}}\n', "whitespace or control characters"),
)


def check_invalid_cases(hugo: str) -> list[str]:
    errors: list[str] = []
    for name, body, expected in INVALID_CASES:
        with tempfile.TemporaryDirectory(prefix=f"oink-media-{name}-") as temp:
            temp_path = Path(temp)
            content = temp_path / "content/docs/invalid"
            content.mkdir(parents=True)
            shutil.copyfile(PAGE_IMAGE, content / "page.png")
            body = f"{body.rstrip()}{{{{< /imgproc >}}}}\n"
            (content / "index.md").write_text(
                f"---\ntitle: Invalid media {name}\n---\n\n{body}"
            )
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
            if result.returncode == 0:
                errors.append(f"invalid media case {name} unexpectedly built")
            else:
                if expected not in output:
                    errors.append(
                        f"invalid media case {name} did not report {expected!r}: "
                        f"{output.strip()}"
                    )
                if "content/docs/invalid/index.md:" not in output:
                    errors.append(f"invalid media case {name} did not report its position")
    return errors


def check_template_contracts() -> list[str]:
    errors: list[str] = []
    resolver = (ROOT / "layouts/_partials/content/image-resolve.html").read_text()
    processor = (ROOT / "layouts/_partials/content/image-process.html").read_text()
    imgproc = (ROOT / "layouts/_shortcodes/imgproc.html").read_text()
    require("resources.GetRemote" not in resolver + processor + imgproc, "media layer fetches remote images", errors)
    require("$page.Resources.Get" in resolver, "resolver lacks exact page resources", errors)
    require("resources.Get $lookup" in resolver, "resolver lacks global resources", errors)
    require(
        resolver.index("$page.Resources.Get") < resolver.index("resources.Get $lookup"),
        "resolver order is not page then global",
        errors,
    )
    require("reflect.IsImageResourceProcessable" in resolver, "resolver does not test processability", errors)
    require("reflect.IsImageResourceWithMeta" in resolver, "resolver does not guard dimensions", errors)
    require("try ($image.resource.Fit" in processor, "image operations are not guarded", errors)
    require(".IsNamedParams" in imgproc, "imgproc lacks named compatibility routing", errors)
    require("legacy form requires exactly" in imgproc, "imgproc lacks legacy positional validation", errors)
    require('eq $outputFormat "markdown"' in imgproc, "imgproc lacks Markdown output", errors)
    require("Page.Store.Set" not in imgproc, "imgproc sets a runtime flag", errors)
    require("data-zoom-src" in imgproc, "imgproc does not expose its canonical source", errors)
    static_output = 'partial "content/static-image-output.html"'
    rss_description = 'partial "content/rss-description.html"'
    for relative in (
        "layouts/_default/rss.xml",
        "layouts/blog/rss.xml",
    ):
        require(
            rss_description in (ROOT / relative).read_text(),
            f"{relative} does not use the shared RSS description renderer",
            errors,
        )
    require(
        static_output
        in (ROOT / "layouts/_partials/content/rss-description.html").read_text(),
        "RSS description renderer does not remove interaction-only image attributes",
        errors,
    )
    for relative in (
        "layouts/_partials/print/content.html",
        "layouts/_partials/print/render.html",
    ):
        require(
            static_output in (ROOT / relative).read_text(),
            f"{relative} does not remove interaction-only image attributes",
            errors,
        )
    require("src=\"image.png\"" in (ROOT / "docs/content-primitives.md").read_text(), "named imgproc contract is undocumented", errors)
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", type=Path, default=EXAMPLE / "public")
    parser.add_argument("--hugo", default="hugo")
    args = parser.parse_args()

    errors = (
        check_outputs(args.public)
        + check_resolver_matrix(args.hugo)
        + check_subpath(args.hugo)
        + check_rss_output(args.hugo)
        + check_generic_rss_output(args.hugo)
        + check_invalid_cases(args.hugo)
        + check_template_contracts()
    )
    if errors:
        print("Media primitive checks failed:")
        for error in errors:
            print(f"  {error}")
        return 1
    print("Media primitive checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
