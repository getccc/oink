# Oink

Oink is a local-first Hugo theme for engineering documentation. It ships its
styles, fonts, search, diagrams, API documentation runtimes, and content
components with the theme, so consumer sites do not need Node.js, or a CDN.

This repository contains only the distributable theme. Documentation,
examples, tests, and deployment configuration live in [`pgsty/oink.pgsty.com`](https://github.com/pgsty/oink.pgsty.com).

## Hugo module

Install Hugo, Go, and Git, then initialize your site and add Oink:

```sh
hugo mod init github.com/example/docs
hugo mod get github.com/pgsty/oink
```

Import the theme in `hugo.yaml`:

```yaml
module:
  imports:
    - path: github.com/pgsty/oink
```

Build or preview the site:

```sh
hugo server
```

## Composable landing page

The landing page is assembled from the `sections` array in Hugo data. A
single-language site can use `data/home.yaml` (or `.yml`); a multilingual site
can use `data/home/en.yaml`, `data/home/zh.yaml`, and matching language files:

```yaml
sections:
  - hero
  - capabilities
  - type: logo_wall
    key: ecosystem
  - gallery
  - testimonials
  - contributors
  - faq
  - cta

hero:
  eyebrow: Local-first documentation
  title: Build **clearer** docs.
  desc: Start with the [OINK guide](docs/oink/) and customize from there.

ecosystem:
  title: Used with the tools you already know
  desc: Every title and description accepts Markdown, including links.
  items:
    - name: Hugo
      desc: Static site generator
      icon: fa-solid fa-bolt
      url: https://gohugo.io/
```

String entries use a same-named top-level data block. Object entries can select
another block with `key`, override the anchor with `id`, or be removed with
`enabled: false`. Section data also accepts `enabled: false`. The available
types are `hero`, `metrics`, `capabilities`, `principles`, `cards`,
`logo_wall`, `gallery`, `testimonials`, `contributors`, `faq`, `markdown`, and
`cta`. Missing optional URLs render as non-link content. For a site-specific
Section, set `partial` on an object entry; OINK passes that partial the same
`page`, `home`, `data`, `entry`, `type`, `id`, and `index` context as built-ins:

```yaml
sections:
  - type: launch
    key: launch_notes
    partial: home/sections/launch.html
```

See the [complete landing configuration](exampleSite/data/home/en.yaml) for
every section type and field shape. Existing sites without `sections` keep the
legacy Hero → Metrics → Capabilities → Principles → CTA order.

## Git submodule

Oink can also be installed as a conventional Hugo theme:

```sh
git submodule add https://github.com/pgsty/oink.git themes/oink
```

```yaml
theme: oink
```

Oink requires Hugo 0.160.1 or newer. See
[oink.pgsty.com](https://oink.pgsty.com) for documentation and examples.


## License and upstream

Oink is derived from [Docsy](https://github.com/google/docsy) and is licensed
under the Apache License 2.0. See [NOTICE](NOTICE) for upstream attribution and
[VENDOR.json](VENDOR.json) for bundled third-party components.

The theme is inspired by [Fumadocs](https://www.fumadocs.dev/)
