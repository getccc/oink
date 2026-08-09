# Phase 2 plan

Working document for the second round of remediation on the Oink theme.
Phase 1 (commits `8d4b2c5`, `83e58f2`, on top of tag `v0.0.1`) closed the
high-confidence defects. What follows is everything that was deliberately
deferred, with the measurement that motivates it, a proposed approach, and a
definition of done.

Every number below was measured against a real build, not estimated. The
baselines are recorded so the same numbers can be re-taken after a change.

---

## 0. Ground rules

### 0.1 What counts as dead code

Phase 1 removed files by computing reachability from the theme's own entry
points (`assets/scss/td/_main.scss`, the top-level layouts). That criterion is
wrong, and running `oink.pgsty.com` against the branch caught it: three
consecutive build failures for files that had no reference *inside* the theme
but were reached from a consuming site.

A file is only dead if it is unreachable from **all** of:

1. `assets/scss/td/_main.scss` — the theme's own style bundle.
2. The top-level layouts in `layouts/`.
3. **A project's `assets/scss/_styles_project.scss`.** This is the documented
   override hook, imported last by `_main.scss`. Anything under
   `assets/scss/td/**` is importable from it — `td/color-adjustments-dark`,
   `td/code-dark`, `td/extra`, `td/extra/bs-defaults`, `td/gcs-search-dark`
   are all imported by oink.pgsty.com today.
4. **A project's own layouts and render hooks.** `oink.pgsty.com` has
   `layouts/_markup/render-heading.html` whose entire body is
   `{{ partial "td/render-heading.html" . }}`.
5. **The published documentation.** `taxonomy_terms_cloud.html` and
   `taxonomy_terms_clouds.html` are documented as partials a project may call.

Before deleting anything under `assets/scss/td/**` or `layouts/_partials/**`,
grep `~/pgsty/oink.pgsty.com/{assets,layouts,config,content}` for the stem, and
build that site. Removing a file that survives all five checks is still a
breaking change for third parties; it belongs in a release note.

### 0.2 Correction to the phase-1 review

An earlier claim that "non-home pages have no footer" was wrong.
`_partials/footer.html` calls `shell/footer-line.html` unconditionally, so the
copyright row is present everywhere. The real defect was the opposite — the
home page had *two* `<footer>` elements — and it is fixed in `83e58f2`.

---

## 1. Verification harness

Two sites are used. Neither lives in this repo.

**Synthetic** — exercises docs/blog/taxonomy/community, multilingual, RTL, and
every output format. Fast, and the only way to test cases the real site does
not have.

**Real** — `~/pgsty/oink.pgsty.com`, built against the working tree:

```sh
cd ~/pgsty/oink.pgsty.com
make dev            # go workspace -> ../oink, serves on :1313
```

The checks that caught everything in phase 1, and that any phase-2 change
should be re-run against:

| Check | Tool | Phase-1 exit state |
|---|---|---|
| Build clean, no template errors | `hugo --logLevel warn` | clean |
| Console errors / failed requests | Playwright `pageerror` + `console` | zero across 10 pages x {1440, 375} |
| Horizontal overflow | `documentElement.scrollWidth - clientWidth` | zero |
| Accessibility | axe-core, `resultTypes: ['violations']` | zero violations |
| Focus containment | 26 x Tab + Shift+Tab from a modal | trapped in drawer and search |
| Highlight mode | count `.chroma` vs `pre[style]` | 11 / 0 on a real docs page |

Consider committing this harness (see item E5) so it stops being rebuilt from
scratch each session.

---

## 2. Workstreams

Items are labelled `A1`…`E6` so they can be referenced from issues and commits.

---

### A. Payload

The theme's selling point is local-first with no Node.js. That makes the bytes
it ships entirely its own responsibility.

Current per-page cost on a docs page (minified, production build):

| Asset | Bytes | Loading |
|---|---:|---|
| `main.min.css` | 451,202 | render-blocking `<link>` |
| `main-*.min.js` | ~109,900 | `<script>` at body end |
| `jquery.min.js` | 87,533 | **render-blocking `<script>` in `<head>`** |
| `lunr.min.js` | 29,510 | `<script defer>` in `<head>`, every page |

#### A1. Remove jQuery — highest value, well understood

**Evidence.** Five files reference it: `base.js` (19), `offline-search.js` (16),
`plantuml.js` (5), `search.js` (4), `markmap.js` (3). Of `base.js`, only three
functions are live — `initHeaderScroll`, `initMobileMenu`, `initLanguageMenus` —
and all three are already written in plain DOM, merely wrapped in `$(function(){})`.
Everything else targets markup the theme no longer emits. Verified absent from
`layouts/`: `.td-navbar`, `.navbar-nav`, `#main_navbar`, `.td-navbar-container`,
`.scroll-left`, `.scroll-right`, `.js-navbar-scroll`, and — for the tooltip and
popover initialisers — `data-bs-toggle="tooltip"` and `.popover-dismiss`.

**Approach.**
1. Rewrite `base.js`: drop the dead navbar code and the tooltip/popover
   initialisers, replace the jQuery ready wrappers with `DOMContentLoaded`.
2. Delete `offline-search.js` and `search.js` once the shell search covers the
   pages that still use them (depends on **B1**).
3. Port `markmap.js` and `plantuml.js` off jQuery — roughly ten lines each,
   both are `$(sel).parent().replaceWith(...)`.
4. Drop the jQuery `<script>` from `head.html`.

**Risk.** Low, but `base.js` is loaded on every page: an error there is
site-wide. Bootstrap's jQuery bridge (`defineJQueryPlugin`) becomes inert,
which is fine because nothing calls it.

**Done when.** No `assets/js/**` references jQuery, `head.html` has no jQuery
tag, and both sites pass the harness. Expect ~87 KB off the critical path.

#### A2. Font Awesome — 77.5 KB, 17.2% of the stylesheet

**Evidence.** 2,545 rules mentioning `.fa-` in the built CSS.

**Constraint.** Projects put arbitrary icon classes in front matter
(`icon: fa-solid fa-bolt`) and in `ui.page_context_menu.links`, so a blind
subset breaks consumer content.

**Approach.** Split Font Awesome out of `main.scss` into its own stylesheet so
it stops blocking the theme's own styles, then offer an opt-in allowlist
(`params.fontawesome.icons`) for projects that know their icon set. Ship the
full set by default.

**Risk.** Medium — icon rendering is very visible. Needs a page that exercises
sidebar icons, quick links, reading time, page-meta links, and taxonomy.

#### A3. Fonts — 1.73 MB in `static/webfonts`, ~1.36 MB of it unused

**Evidence.**

- `static/webfonts/open-sans/` is 652 KB across 20 `woff2` files. The built CSS
  contains six `@font-face` blocks and **none of them is Open Sans**: the
  imports are gated on `$td-enable-google-fonts`, which defaults to `false`.
  Removing both `open-sans` imports from `_main.scss` changed the output by
  zero bytes. Because they sit in `static/`, they are copied verbatim into
  every consumer's `public/`.
- Font Awesome ships `.ttf` **and** `.woff2` for every face — 708 KB of `.ttf`
  that no browser released since ~2016 will request.

**Approach.** Move the Open Sans files to `assets/` and publish them only when
`$td-enable-google-fonts` is on. Delete the `.ttf` faces, or move them behind
the same kind of opt-in.

**Risk.** Low. Verify the `@font-face` `src` lists still resolve and that
`hugo --gc` reports no missing resources.

#### A4. Bootstrap JavaScript

**Evidence.** The bundle is loaded whole. Three components are actually used:
`Tab` (`static/js/tabpane-persist.js`), `Tooltip` (`click-to-copy.js`),
`Dropdown` (`navbar-version-selector.html`), plus `ScrollSpy` when the optional
patch is enabled. The carousel is the theme's own code in
`content-components.js`, not Bootstrap's.

**Approach.** Replace `bootstrap.bundle.js` with per-component builds, or
vendor the three needed modules. Keep `scrollspy-patch.js` working — it
monkey-patches `bootstrap.ScrollSpy.prototype`.

#### A5. Load lunr on demand

29.5 KB deferred on every page for a feature that only runs after the search
dialog opens. Move the `<script>` out of `head.html` and have
`docs-shell.js#initSearch#ensureIndex` inject it before building the index.

#### A6. Stop prefetching page Markdown

`docs-shell.js#initPageContext` issues a `fetch()` for the current page's `.md`
during page load, for a copy button most readers never press. Move it to first
hover or first click, keeping the existing in-memory cache.

---

### B. Architecture

#### B1. Converge the two page shells

**Evidence.** `shell/chrome-enabled.html` gates on
`type ∈ {docs, blog, swagger}` or `kind ∈ {taxonomy, term}`. Everything else
falls back to the Docsy-era path. The two tracks duplicate: sidebar tree, TOC,
search UI (`offline-search.js` overlay vs the ⌘K dialog), page-action menu, and
footer. A project that gives a section a custom `type` silently gets a
different interface.

**Approach.** Invert the default — the shell for everything, with an opt-out
(`params.ui.shell_disable`, or a `body_class`). Then delete the legacy track,
subject to §0.1.

**Risk.** High; this is the largest change on the list. Do it alone, in its own
PR, after A1 (which removes one of the duplicated pieces).

**Blocked on.** B2.

#### B2. Decide the top-bar story — needs a product decision

`layouts/baseof.html` (home, community, search, 404) renders the landing header.
`docs/`, `blog/`, `swagger/` render no top bar at all on desktop, by design
(`--td-shell-nav-h: 0px`, "fumadocs v16 完全体"). Navigating from `/` to
`/docs/` makes the header disappear.

Options: (a) accept it and smooth the transition; (b) give non-shell pages the
shell too; (c) give shell pages a slim top bar at `≥md`. **This choice
determines the shape of B1 — please pick one before that work starts.**

#### B3. Unify the page-action UI — **done**

Two implementations of the same thing used to render on every docs page: the
right-rail `page-meta-links.html` and a `page-context-menu.html` dropdown
beside the title, each building GitHub URLs independently — the `querify` bug
fixed in phase 1 existed in only one of them.

Resolved by folding everything into `page-meta-links.html` (eight actions, one
icon each) and deleting `page-context-menu.html`. `initPageContext` shrank to
the copy and print handlers. Note the two consequences: `post_view_this`
("View page source", styling hook `.td-page-meta__view`) is no longer rendered
although `oink.pgsty.com` still documents it, and the actions inherit the
rail's `xl` breakpoint — see **C1**.

---

### C. Layout and interaction

#### C1. No table of contents below 1200px — **done**

Resolved by relocation rather than duplication: the rail's contents live in a
single `[data-td-shell-aside]` block that `docs-shell.js#initAsideRelocate`
moves into a slot in the sidebar drawer below `xl`, and back above it. Ids stay
unique, so the scrollspy and the disclosure wiring keep working; the table of
contents rebuilds through its existing `ResizeObserver`. The page actions and
the taxonomies became labelled disclosures — expanded in the rail, collapsed in
the drawer, matching the taxonomy clouds that were already built that way.

Original analysis follows.

#### C1 (original) — no table of contents below 1200px

**Evidence.** `assets/scss/td/shell/_toc.scss:7-18` sets
`.td-shell-toc { display: none }` and only restores it at `xl`. Below that the
page loses the TOC, the page-meta links, **and** the taxonomy cloud, with no
fallback. That band covers tablets, small laptops, and every split-screen
window, plus all phones.

**Raised priority.** The page actions (copy/view Markdown, edit, child page,
issues, print) now live only in this rail — the duplicate dropdown beside the
page title was removed. Until this item lands, those actions are unreachable
below `xl`. *(Resolved, see above.)*

**Approach.** A collapsible "On this page" disclosure under the page title at
`< xl`, or a bottom-sheet triggered from the mobile subnav. The TOC data and
the scrollspy already exist in `docs-shell.js#initToc`; only the container
changes. Decide separately where the page-meta links and tag cloud go.

**Risk.** Medium — new UI, needs design. `initToc` builds SVG rails against
measured geometry, so it must be rebuilt (not just re-parented) when the
container changes; it already has a `ResizeObserver` path for this.

#### C2. Content tables

**Evidence.** `_content.scss:45` applies `@extend .td-table` to every
`.td-content table`; `_table.scss:1-4` then applies `@extend .table`,
`.table-striped`, `.table-responsive` and `display: block`. Consequences
measured on a two-column table: the table does not fill its container
(726 px container, cells shrink-to-fit), and Bootstrap paints row striping with
`box-shadow: inset 0 0 0 9999px`, which ends where the cells end and reads as a
ragged grey block rather than a row band.

**Approach.** Use Hugo's `_markup/render-table.html` hook to wrap tables in a
scroll container and let the table itself be `width: 100%` again. This also
removes the `display: block` hack that `.table-responsive` was compensating
for. Note the same `table code` over-reach that phase 1 worked around in
`_chroma.scss` — fix it at the source while here.

#### C3. Theme toggle cannot return to "auto"

`dark-mode.js:107` flips light↔dark and always writes `localStorage`. The only
control that could write `auto` was `theme-toggler.html`, which is unreachable.
Once a reader clicks the toggle they never follow the system again.

**Approach.** Three-state cycle (light → dark → auto) with the icon reflecting
state, or a small popover with three choices. Needs an `auto` icon and one new
i18n string.

---

### D. Correctness and portability

#### D1. `hugo.Data.docs_nav` coupling

`shell/docs-sidebar-tree.html:14` reads
`index hugo.Data.docs_nav.active_path_by_url $currentURL` directly.
`shell/sidebar.html:40` only guards on `sections` existing, so a project that
supplies `sections` without `active_path_by_url` fails the build. The feature
is undocumented in the README.

**Approach.** Guard both keys, degrade to the generic tree when either is
missing, and document the file's schema — or generate the navigation in the
theme and drop the external dependency.

#### D2. Site-specific content in the theme

- `assets/scss/_styles_project.scss` ships `.oink-shell-demo`,
  `.oink-component-board`, `.oink-board__core`, `.taxo-fruits`,
  `.taxo-text-tags` — demo and project-specific selectors.
- `shell/taxonomy-filter.html:6` hardcodes `relLangURL "blog/"` for its "All"
  link.

Move the first to the project site; make the second derive its root from the
current section.

#### D3. Offline search does not scale

`params.offlineSearchIndex` defaults to `content`, which embeds every page's
`.Plain` into a single JSON downloaded on first ⌘K. The CJK path
(`docs-shell.js#queryCjk`) then scans every document with four `indexOf` calls
per keystroke.

**Approach.** Consider defaulting to `summary`; shard the index by section; and
replace the CJK linear scan with a prebuilt bigram or prefix index. Measure on
a site with a few hundred pages before choosing.

#### D4. `zh` gets no translations

The theme ships `i18n/zh-cn.yaml` and `i18n/zh-tw.yaml` but no `i18n/zh.yaml`.
A project using the common `languages.zh` key falls back to English for every
string — confirmed by building with `zh` and again with `zh-cn`. Add a `zh.yaml`
aliasing Simplified Chinese.

#### D5. Comment language

`layouts/_partials/shell/**` and `assets/js/docs-shell.js` are commented in
Chinese; everything inherited from upstream is in English. Pick one for the
committed source.

---

### E. Testing and packaging

#### E1. exampleSite covers only the landing page

`exampleSite/content/` had three empty directories (`docs`, `blog`, `swagger`),
removed in phase 1. Nothing in the example exercises the sidebar, TOC, search,
breadcrumbs, or taxonomy — the theme's core.

**Approach.** Add a minimal smoke-test tree: one docs section two levels deep,
two blog posts with tags, and a page carrying a code block, a table, and a
task list. Keep it small; the README is explicit that real documentation lives
in `oink.pgsty.com`.

#### E2. Enable the shipped output formats in the example

The theme ships templates for `print`, `LLMS`, and `markdown` but cannot add
them to `outputs` itself (documented in the README as of phase 1). Setting them
in `exampleSite/hugo.yaml` makes `index.llms.txt`, `all.md`,
`docs/*.print.html`, and `_partials/print/**` reachable in CI instead of only
in theory.

#### E3. Windows checkout of the exampleSite symlink

`exampleSite/themes/oink` is a committed symlink. Git on Windows without
`core.symlinks` materialises it as a text file and the example will not build.
The README documents the `--themesDir ../..` fallback; if Windows is a
supported development platform, this needs a real answer.

#### E4. Prune the CSS that survives with no markup

Phase 1 removed the files whose *entire* content was dead. Rules that reference
removed markup still live inside files that are otherwise current —
`.td-navbar` descendants in `_search.scss`, `_scroll.scss`, `_main-container.scss`,
`blocks/_blocks.scss`, `_variables.scss`. Sweep them with a selector-match pass
against rendered pages (5,820 of 6,505 selectors matched nothing in the phase-1
scan; most of that is unused Bootstrap, which A4/A2 address).

#### E5. Commit the verification harness

The Playwright + axe probes described in §1 were rebuilt from scratch this
session. Committing them — in this repo or in `oink.pgsty.com` — turns the
phase-1 exit state into a regression gate.

#### E6. Deprecation cleanup

`assets/scss/td/_code-dark.scss` is now an empty compatibility shim. Once
`oink.pgsty.com` drops its `@import 'td/code-dark';`, remove the shim and note
it in the release. Same for the `td/extra/*` and `td/gcs-search-dark` opt-ins,
which style Docsy-era markup the theme no longer renders — they compile, but
they emit nothing that matches.

---

## 3. Suggested rounds

**Round 2** — independent, verifiable, no design decisions required:
`A1`, `A3`, `A5`, `A6`, `C2`, `C3`, `D4`, `E1`, `E2`.

**Round 3** — needs design or build-chain work: `A2`, `A4`, `D1`, `D3`.

**Round 4** — architecture: `B2` (decision) then `B1`, then `B3`, `E4`, `E6`.

**Ongoing**: `E5` as early as possible; `D2` and `D5` whenever the files are
open for another reason.

---

## 4. Open questions

1. **B2** — which top-bar model? Blocks B1.
3. **A2** — is an icon allowlist acceptable to projects, or must the full Font
   Awesome set always ship?
4. **E3** — is Windows a supported development platform for this repo?
5. **D5** — Chinese or English for committed comments?
