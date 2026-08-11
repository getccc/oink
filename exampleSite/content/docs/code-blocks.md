---
title: Enhanced code blocks
description: Regression fixtures for the shared Chroma shell and code groups.
outputs: [HTML, markdown]
weight: 20
---

## Titled, numbered, and highlighted

```yaml {filename="config/very-long-example-name-for-responsive-layout.yml" copy="all" lineNos="table" lineNoStart=3 hl_lines="4 6"}
params:
  offlineSearch: true
  ui:
    sidebar_menu_foldable: true
    sidebar_menu_compact: true
```

## Escaped generic attributes

```text {#generic-code .code-fixture data-note="a \"quoted\" & value"}
safe attributes
```

## Wrapped and collapsed

```text {id="wrapped-example" wrap=true collapse=4 label="Wrapped configuration example"}
alpha = one
beta = two
gamma = this-is-a-deliberately-long-unbroken-value-that-tests-responsive-wrapping-without-changing-the-source
delta = four
epsilon = five
zeta = six
eta = seven
```

## Console commands

```console
$ printf 'hello\n'
hello
$ printf 'world\n'
world
$ printf '%s\n' \
>   first \
>   second
first
second
```

## Package managers

{{< code-group id="install-client" sync="package-manager" persist=true label="Choose a package manager" copy="all" >}}
  {{< code-tab title="npm" value="npm" lang="bash" >}}
npm install @example/client
  {{< /code-tab >}}

  {{< code-tab title="pnpm" value="pnpm" lang="bash" selected=true >}}
pnpm add @example/client
  {{< /code-tab >}}

  {{< code-tab title="yarn" value="yarn" lang="bash" >}}
yarn add @example/client
  {{< /code-tab >}}
{{< /code-group >}}

## Synchronized peer

{{< code-group id="install-tool" sync="package-manager" persist=true >}}
  {{< code-tab title="npm" value="npm" lang="bash" >}}
npm install --global @example/tool
  {{< /code-tab >}}
  {{< code-tab title="pnpm" value="pnpm" lang="bash" >}}
pnpm add --global @example/tool
  {{< /code-tab >}}
{{< /code-group >}}

## Plain-text tab titles

{{< code-group id="plain-titles" persist=false copy=false >}}
  {{< code-tab title="A **literal** [label]" value="literal" lang="text" >}}
punctuation stays literal
  {{< /code-tab >}}
{{< /code-group >}}

## Legacy tabpane

{{< tabpane persist="lang" >}}
  {{< tab header="YAML" lang="yaml" selected=true >}}
message: legacy-compatible
  {{< /tab >}}
  {{< tab header="JSON" lang="json" >}}
{"message":"legacy-compatible"}
  {{< /tab >}}
{{< /tabpane >}}
