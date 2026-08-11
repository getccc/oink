#!/usr/bin/env python3
"""Validate Enhanced Code Block output and strict author-contract failures."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import re
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "exampleSite"


def require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def bundle_source(page: str, public: Path) -> str:
    match = re.search(r'<script src="(?P<src>/js/main-[^"]+\.js)"', page)
    if not match:
        return ""
    return (public / match.group("src").lstrip("/")).read_text()


def check_outputs(public: Path) -> list[str]:
    errors: list[str] = []
    code_html = (public / "docs/code-blocks/index.html").read_text()
    code_markdown = (public / "docs/code-blocks/index.md").read_text()
    typography_html = (public / "docs/typography/index.html").read_text()
    home_html = (public / "index.html").read_text()
    print_html = (public / "_print/docs/index.html").read_text()

    for marker in (
        'class="td-code td-code--titled"',
        'data-collapse-lines="4"',
        'data-copy-mode="command"',
        'class="td-code td-code--untitled code-fixture"',
        'data-note="a &#34;quoted&#34; &amp; value"',
        'id="install-client-pnpm"',
        'data-sync="package-manager"',
        'data-td-tp-persist="yaml"',
    ):
        require(marker in code_html, f"HTML fixture missing {marker}", errors)

    require("**npm**" in code_markdown, "Markdown lost npm title", errors)
    require(
        r"**A \*\*literal\*\* \[label\]**" in code_markdown,
        "Markdown did not preserve a plain-text Code Group title",
        errors,
    )
    require("pnpm add @example/client" in code_markdown, "Markdown lost pnpm code", errors)
    require("data-td-code" not in code_markdown, "Markdown contains code runtime HTML", errors)
    require("nav-tabs" not in code_markdown, "Markdown contains tab UI HTML", errors)

    code_bundle = bundle_source(code_html, public)
    typography_bundle = bundle_source(typography_html, public)
    home_bundle = bundle_source(home_html, public)
    print_bundle = bundle_source(print_html, public)
    require("td-code-group:v1" in code_bundle, "Code Group runtime was not bundled", errors)
    require("data-td-code-copy" in code_bundle, "Copy runtime was not bundled", errors)
    require("data-td-code-copy" in typography_bundle, "ordinary code lacks Copy runtime", errors)
    require("td-code-group:v1" not in typography_bundle, "ordinary code loaded tab runtime", errors)
    for name, source in (("home", home_bundle), ("print", print_bundle)):
        require("data-td-code-copy" not in source, f"{name} loaded Copy runtime", errors)
        require("td-code-group:v1" not in source, f"{name} loaded tab runtime", errors)

    require("td-code-group__print-title" in print_html, "print lost group titles", errors)
    require("npm install @example/client" in print_html, "print lost grouped code", errors)
    return errors


def check_template_contracts() -> list[str]:
    errors: list[str] = []
    html_bases = (
        "layouts/baseof.html",
        "layouts/baseof.taxonomy.html",
        "layouts/baseof.term.html",
        "layouts/blog/baseof.html",
        "layouts/docs/baseof.html",
        "layouts/swagger/baseof.html",
    )
    for relative in html_bases:
        source = (ROOT / relative).read_text()
        require(
            '.Store.Set "tdOutputFormat" "html"' in source,
            f"{relative} does not reset the HTML output context",
            errors,
        )
        main = source.find('block "main"')
        scripts = source.find('partial "scripts.html"')
        require(
            main >= 0 and scripts > main,
            f"{relative} loads scripts before content sets Page Store flags",
            errors,
        )
    return errors


INVALID_CASES = (
    (
        "filename-title",
        '```yaml {filename="a.yml" title="A"}\na: 1\n```\n',
        "filename and title are mutually exclusive",
        {},
    ),
    (
        "command-language",
        '```bash {copy="command"}\necho no\n```\n',
        "copy=command requires language console or shell-session",
        {},
    ),
    (
        "wrap-table",
        '```text {wrap=true lineNos="table"}\none\ntwo\n```\n',
        "wrap=true is incompatible",
        {},
    ),
    (
        "collapse-zero",
        '```text {collapse=0}\none\n```\n',
        "collapse must be a positive integer",
        {},
    ),
    (
        "duplicate-code-ids",
        '```text {id="same-code"}\none\n```\n\n'
        '```text {id="same-code"}\ntwo\n```\n',
        "duplicate id",
        {},
    ),
    (
        "invalid-code-id",
        '```text {id="bad id"}\none\n```\n',
        "id must not contain ASCII whitespace or control characters",
        {},
    ),
    (
        "code-group-root-collision",
        '```text {id="same-component"}\none\n```\n\n'
        """{{< code-group id="same-component" >}}
{{< code-tab title="One" value="one" >}}two{{< /code-tab >}}
{{< /code-group >}}
""",
        "duplicate id",
        {},
    ),
    (
        "generated-viewport-collision",
        '```text {id="component-one-code-viewport"}\none\n```\n\n'
        """{{< code-group id="component" >}}
{{< code-tab title="One" value="one" >}}two{{< /code-tab >}}
{{< /code-group >}}
""",
        "duplicate id",
        {},
    ),
    (
        "generated-line-anchor-collision",
        '```text {id="anchored" lineNos="inline" anchorLineNos=true}\none\n```\n\n'
        '```text {id="anchored-1"}\ntwo\n```\n',
        "duplicate id",
        {},
    ),
    (
        "filename-aria-label",
        '```text {filename="a.txt" aria-label="conflict"}\none\n```\n',
        "label/filename and aria-label are mutually exclusive",
        {},
    ),
    (
        "reserved-data",
        '```text {data-line-count="999"}\none\n```\n',
        'attribute "data-line-count" is reserved',
        {},
    ),
    (
        "duplicate-values",
        """{{< code-group id="duplicate" >}}
{{< code-tab title="One" value="same" >}}one{{< /code-tab >}}
{{< code-tab title="Two" value="same" >}}two{{< /code-tab >}}
{{< /code-group >}}
""",
        "duplicate code-tab value",
        {},
    ),
    (
        "duplicate-groups",
        """{{< code-group id="same-group" >}}
{{< code-tab title="One" value="one" >}}one{{< /code-tab >}}
{{< /code-group >}}

{{< code-group id="same-group" >}}
{{< code-tab title="Two" value="two" >}}two{{< /code-tab >}}
{{< /code-group >}}
""",
        "duplicate group id",
        {},
    ),
    (
        "multiple-selected",
        """{{< code-group id="selected" >}}
{{< code-tab title="One" value="one" selected=true >}}one{{< /code-tab >}}
{{< code-tab title="Two" value="two" selected=true >}}two{{< /code-tab >}}
{{< /code-group >}}
""",
        "only one code-tab may set selected=true",
        {},
    ),
    (
        "invalid-group-id",
        """{{< code-group id="Bad ID" >}}
{{< code-tab title="One" value="one" >}}one{{< /code-tab >}}
{{< /code-group >}}
""",
        "id must match",
        {},
    ),
    (
        "prism-group",
        """{{< code-group id="prism" >}}
{{< code-tab title="One" value="one" >}}one{{< /code-tab >}}
{{< /code-group >}}
""",
        "requires Hugo/Chroma",
        {"HUGO_PARAMS_PRISM_SYNTAX_HIGHLIGHTING": "true"},
    ),
)


def check_invalid_cases(hugo: str) -> list[str]:
    errors: list[str] = []
    for name, body, expected, extra_env in INVALID_CASES:
        with tempfile.TemporaryDirectory(prefix=f"oink-code-{name}-") as temp:
            temp_path = Path(temp)
            content = temp_path / "content/docs"
            content.mkdir(parents=True)
            (content / "invalid.md").write_text(
                f"---\ntitle: Invalid {name}\n---\n\n{body}"
            )
            destination = temp_path / "public"
            command = [
                hugo,
                "--source",
                str(EXAMPLE),
                "--contentDir",
                str(temp_path / "content"),
                "--destination",
                str(destination),
                "--logLevel",
                "warn",
            ]
            if extra_env:
                override = temp_path / "override.yaml"
                override.write_text("params:\n  prism_syntax_highlighting: true\n")
                command.extend(
                    ["--config", f"{EXAMPLE / 'hugo.yaml'},{override}"]
                )
            result = subprocess.run(
                command,
                cwd=ROOT,
                env={**os.environ, **extra_env},
                capture_output=True,
                text=True,
                check=False,
            )
            output = result.stdout + result.stderr
            if result.returncode == 0:
                errors.append(f"invalid case {name} unexpectedly built")
            elif expected not in output:
                errors.append(
                    f"invalid case {name} did not report {expected!r}: {output.strip()}"
                )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", type=Path, default=EXAMPLE / "public")
    parser.add_argument("--hugo", default="hugo")
    args = parser.parse_args()

    errors = (
        check_outputs(args.public)
        + check_template_contracts()
        + check_invalid_cases(args.hugo)
    )
    if errors:
        print("Enhanced code-block checks failed:")
        for error in errors:
            print(f"  {error}")
        return 1
    print("Enhanced code-block checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
