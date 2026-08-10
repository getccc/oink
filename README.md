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

## Output formats

The theme ships templates for three optional outputs, but Hugo does not let a
theme add entries to `outputs`, so a site has to opt in:

```yaml
outputs:
  home: [HTML, RSS, LLMS]      # /llms.txt site index for language models
  page: [HTML, markdown, print] # .md source, and a printable single page
  section: [HTML, RSS, print]   # printable "whole section" view
```

`markdown` is what backs the page menu's **Copy as Markdown** and **View
Markdown** entries; without it, those entries are omitted. `print` backs
**Print entire section** and publishes under `/_print/`. Leaving `outputs`
unset is supported — the affected controls simply do not render.

## Blog featured images

A post's list entry looks for an image in this order:

1. `images` in the post's front matter — the first entry.
2. A page resource whose name matches `**featured*`.
3. `default_featured`, read from the post (so a section `cascade` applies)
   and then from each ancestor section, nearest first, and finally from site
   params.

If none of these provides an image, the list entry renders without one.

So a section can give all of its posts one image:

```yaml
# content/blog/_index.md
---
title: Blog
default_featured: /images/blog-card.png
---
```

Any post that sets its own image still wins. Set
`default_featured: false` on a section — or in site params — to stop at
step 2 and render no image at all.

## Syntax highlighting

Code blocks are highlighted with Chroma class names so they follow the theme's
light and dark palettes. Hugo ignores `markup` settings that come from a theme,
so this is applied by `layouts/_markup/render-codeblock.html` rather than by
config. Every other highlight option — `style`, `lineNos`, `tabWidth`, and
per-fence attributes — still comes from your site config. To go back to Hugo's
inline highlight styles, set `params.highlight_classes: false`.

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
  image:
    light: images/hero-light.webp
    dark: images/hero-dark.webp
    alt: Product documentation workflow

ecosystem:
  title: Used with the tools you already know
  desc: Every title and description accepts Markdown, including links.
  items:
    - name: Hugo
      desc: Static site generator
      icon: fa-solid fa-bolt
      url: https://gohugo.io/
```

`hero.image` is optional. Use `light` and `dark` for theme-aware artwork, `src`
or a string value for one shared image, and `alt` when the image carries
meaning. Image paths resolve from the consumer site's `static/` directory.

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

## GitHub Discussions comments

OINK can add [giscus](https://giscus.app/) comments to content pages. Enable
GitHub Discussions and install the giscus app for the repository that will
store comments, then copy its repository and category IDs into `hugo.yaml`:

```yaml
params:
  comments:
    enable: true
    type: giscus
    giscus:
      repo: owner/repository
      repoId: repository-id
      category: Announcements
      categoryId: category-id
      mapping: pathname
      strict: 0
      reactionsEnabled: 1
      emitMetadata: 0
      inputPosition: top
      theme: auto
      loading: lazy
```

Set `comments: true` or `comments: false` in page front matter to override the
site-wide switch. An explicit `comments: false` also suppresses legacy Disqus
on that page. When giscus is active, OINK suppresses Disqus automatically so
only one comment system is rendered. Invalid or incomplete giscus configuration
produces a Hugo warning and skips giscus instead of failing the site build.

By default, the giscus interface follows the page language and OINK's
light/dark theme. Unsupported giscus locales fall back to English; set
`params.comments.giscus.lang` to override the locale. `theme` can be `auto`, a
built-in giscus theme, or a custom theme URL. `ariaLabel` and `errorMessage` can
override the comments region label and its load-failure message.

The external giscus script and its local initializer are loaded only on pages
where comments are active. Sites with a strict Content Security Policy must
allow `https://giscus.app` in `script-src` and `frame-src`.

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

## Building the example

`exampleSite/` carries a `themes/oink` symlink back to the repository root, so
it builds straight from a clone:

```sh
cd exampleSite && hugo server
```

If your platform did not materialize the symlink (Git on Windows without
`core.symlinks`), point Hugo at the checkout instead:

```sh
cd exampleSite && hugo server --themesDir ../..
```


## License and upstream

Oink is derived from [Docsy](https://github.com/google/docsy) and is licensed
under the Apache License 2.0. See [NOTICE](NOTICE) for upstream attribution and
[VENDOR.json](VENDOR.json) for bundled third-party components.

The theme is inspired by [Fumadocs](https://www.fumadocs.dev/)
