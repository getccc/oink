# Changelog

All notable changes to OINK are documented here. The project follows
[Semantic Versioning](https://semver.org/) for published tags.

## [0.2.0] - 2026-08-10

### Breaking changes

- **Rename `default_featured_image` to `default_featured`.** There is no
  compatibility alias. Update site parameters, page front matter, and section
  cascades. The implicit theme placeholder was also removed: entries without a
  page image or explicit default now render as text-only cards.
- **Require explicit Algolia credentials.** Sites that enable
  `params.search.algolia` must provide `appId`, `apiKey`, and `indexName`. OINK
  no longer falls back to Docsy's public example index and the build fails with
  a configuration error when any value is missing.
- **Remove legacy `base.js` navbar and Bootstrap widget hooks.** The obsolete
  `.js-navbar-scroll`, navbar-overflow, tooltip, and popover initializers are no
  longer run by the theme. Consumer layouts that still use those Docsy-era
  hooks must initialize the behavior in project JavaScript.
- **Change the English TOC label from `Content` to `On this page`.** The i18n
  key is unchanged, but sites with text snapshots or label-dependent tests may
  need to update their expected copy.

### Added

- Responsive landing-page media, linked component boards, and wordmark support
  across the landing navigation, docs shell, mobile subnav, and footer.
- The Markdown-first `steps` shortcode and polished, theme-aware Asciinema
  terminal frames.
- Theme-aware giscus styling and expanded documentation for hero and featured
  image configuration.
- Configurable shell content types and docs/blog section paths through
  `params.ui.shell_types`, `params.ui.docs_section`, and
  `params.ui.blog_section`.
- Complete 89-key i18n schemas for every bundled locale, including a generic
  `zh` catalog; untranslated OINK-only labels use explicit English fallbacks.
- Font Awesome Regular face support alongside the existing Solid and Brands
  faces.
- Theme CI for the minimum and current supported Hugo versions, translation-key
  parity checks, and contribution templates.

### Changed

- Refined blog imagery and summaries, section indexes, taxonomy rail groups, RSS
  navigation, page actions, link styling, and version-menu alignment.
- Trusted ECharts callback blocks no longer emit redundant warnings.
- Taxonomy “All” links now derive a common content section when possible and
  otherwise fall back to the taxonomy index instead of hard-coding `/blog/`.
- Public source comments for the OINK shell now describe behavior in English;
  shortcode templates include concise purpose and parameter headers.
- README quick-start configuration now distinguishes theme-provided features
  from site-enabled output formats and search/theme policy.
- The remaining landing-header, mobile-menu, and language-menu behavior in
  `base.js` now uses the native DOM directly.
- Document the Google search dark-mode stylesheet as an explicit consumer
  opt-in.

### Removed

- Removed unreachable legacy navbar/Bootstrap widget code from `base.js` and
  unused Font Awesome v4 compatibility fonts.

### Fixed

- Added the ARIA presentation role required by tabpane list wrappers, removing
  `aria-required-children`, `aria-required-parent`, and `listitem` violations.
- Preserve OINK light and dark brand tokens when the stock Bootstrap RTL
  stylesheet is loaded after the main theme stylesheet.
- Guard color-theme storage access and always clear prepaint animation locks
  when browsers or sandbox policy deny `localStorage`.
- Replaced decorative nested `main` and `aside` elements on the landing page
  with neutral containers.
- Replaced the print view's inline `onclick` handler with the shared,
  CSP-compatible print action.
- Guard sidebar active-path lookup for consumer sites that do not provide the
  optional navigation data map.

## [0.1.0] - 2026-08-10

- First reviewed OINK release after the Docsy fork, requiring Hugo Extended
  0.160.1 or newer.
- Added class-based light/dark syntax highlighting, unified page actions,
  responsive shell rails, improved footer/hero/blog layouts, and accessibility
  repairs.

[0.2.0]: https://github.com/pgsty/oink/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/pgsty/oink/releases/tag/v0.1.0
