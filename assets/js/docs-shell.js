/**
 * docs-shell.js — documentation shell interactions (no framework).
 *
 * Modules: rootMenu (root switcher), drawer (mobile navigation), collapse
 * (desktop sidebar and hover overlay), resize, treeScroll, toc (SVG track,
 * clip-path highlight, and moving dot), and search (command dialog with a
 * CJK substring fallback for lunr).
 *
 * The theme keeps the `td-color-theme` localStorage key and
 * <html data-bs-theme>. The collapsed sidebar state is stored under
 * `td-shell-sidebar-collapsed` and restored by the prepaint script. That
 * script also suppresses first-frame animations; this file re-enables them
 * after two animation frames.
 */
(function () {
  'use strict';

  var html = document.documentElement;
  var MD = '(min-width: 768px)';

  /* ----------------------------------------------------------- focus trap */

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), ' +
    '[tabindex]:not([tabindex="-1"])';

  function focusable(container) {
    return Array.prototype.filter.call(
      container.querySelectorAll(FOCUSABLE),
      function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      },
    );
  }

  // Keep Tab inside a modal surface. Returns a handler to attach on keydown;
  // it is inert until `isActive()` reports the surface as open, so the same
  // listener can stay bound for the life of the page.
  function tabTrap(container, isActive) {
    return function (event) {
      if (event.key !== 'Tab' || !isActive()) return;
      var items = focusable(container);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
  }

  /* -------------------------------------------------------- rightCollapse */

  // Collapse the complete right rail and persist the state in localStorage.
  function initRightCollapse() {
    var buttons = document.querySelectorAll('[data-td-shell-right-toggle]');
    if (!buttons.length) return;
    function collapsed() {
      return html.getAttribute('data-td-shell-toc') === 'collapsed';
    }
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = !collapsed();
        if (next) {
          html.setAttribute('data-td-shell-toc', 'collapsed');
        } else {
          html.removeAttribute('data-td-shell-toc');
        }
        try {
          localStorage.setItem('td-shell-toc-collapsed', next ? '1' : '0');
        } catch (e) {
          /* ignore */
        }
      });
    });
  }

  /* --------------------------------------------------------- footerOffset */

  // Shorten the fixed sidebar as the footer enters the viewport.
  function initFooterOffset() {
    var footer = document.querySelector('.td-shell-footline');
    var panel = document.querySelector('.td-shell-sidebar__panel');
    if (!footer || !panel) return;
    var frame = 0;

    function update() {
      frame = 0;
      var viewportHeight = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      var offset = Math.max(
        0,
        viewportHeight - footer.getBoundingClientRect().top,
      );
      if (offset > 0) offset += 1;
      html.style.setProperty('--td-shell-footer-offset', offset + 'px');
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('scroll', schedule, {
        passive: true,
      });
      window.visualViewport.addEventListener('resize', schedule);
    }
    if ('ResizeObserver' in window)
      new ResizeObserver(schedule).observe(footer);
    update();
  }

  /* ------------------------------------------------------------ rootMenu */

  // Root switcher: a 100ms scale popover closed by Escape or an outside click.
  function initRootMenu() {
    var root = document.querySelector('.td-shell-root');
    if (!root) return;
    var btn = root.querySelector('[data-td-shell-root-toggle]');
    var pop = root.querySelector('.td-shell-root__pop');
    if (!btn || !pop) return;

    function close() {
      if (pop.hidden) return;
      pop.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      window.setTimeout(function () {
        pop.hidden = true;
      }, 100);
      document.removeEventListener('pointerdown', onOutside, true);
    }
    function open() {
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(function () {
        pop.classList.add('is-open');
      });
      document.addEventListener('pointerdown', onOutside, true);
    }
    function onOutside(e) {
      if (!root.contains(e.target)) close();
    }
    btn.addEventListener('click', function () {
      if (pop.hidden) {
        open();
      } else {
        close();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pop.hidden) close();
    });
  }

  /* --------------------------------------------------------------- drawer */

  function initDrawer() {
    var sidebar = document.getElementById('td-shell-sidebar');
    if (!sidebar) return;
    var openers = document.querySelectorAll('[data-td-shell-drawer-open]');
    var closeButton = sidebar.querySelector(
      'button[data-td-shell-drawer-close]',
    );
    var lastOpener = null;
    function open(event) {
      lastOpener = event.currentTarget;
      html.setAttribute('data-td-shell-drawer', 'open');
      openers.forEach(function (el) {
        el.setAttribute('aria-expanded', 'true');
      });
      if (closeButton)
        window.requestAnimationFrame(function () {
          closeButton.focus();
        });
    }
    function close(restoreFocus) {
      var wasOpen = html.hasAttribute('data-td-shell-drawer');
      html.removeAttribute('data-td-shell-drawer');
      openers.forEach(function (el) {
        el.setAttribute('aria-expanded', 'false');
      });
      if (wasOpen && restoreFocus !== false && lastOpener) lastOpener.focus();
    }
    openers.forEach(function (el) {
      el.addEventListener('click', open);
    });
    document
      .querySelectorAll('[data-td-shell-drawer-close]')
      .forEach(function (el) {
        el.addEventListener('click', function () {
          close(true);
        });
      });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && html.hasAttribute('data-td-shell-drawer'))
        close(true);
    });
    // The drawer is modal; keep keyboard focus out of the obscured document.
    document.addEventListener(
      'keydown',
      tabTrap(sidebar, function () {
        return html.hasAttribute('data-td-shell-drawer');
      }),
      true,
    );
    // Clear drawer state across the md breakpoint to avoid a stale scroll lock.
    window.matchMedia(MD).addEventListener('change', function (mq) {
      if (mq.matches) close(false);
    });
  }

  /* ------------------------------------------------------------- collapse */

  function initCollapse() {
    var aside = document.getElementById('td-shell-sidebar');
    if (!aside) return;
    var panel = aside.querySelector('.td-shell-sidebar__panel');
    if (!panel) return;
    var mdQuery = window.matchMedia(MD);
    var lockUntil = 0;
    var closeTimer = 0;

    function collapsed() {
      return html.getAttribute('data-td-shell-sidebar') === 'collapsed';
    }
    function setCollapsed(value) {
      window.clearTimeout(closeTimer);
      aside.classList.remove('td-shell-sidebar--overlay');
      if (value) {
        html.setAttribute('data-td-shell-sidebar', 'collapsed');
      } else {
        html.removeAttribute('data-td-shell-sidebar');
      }
      try {
        localStorage.setItem('td-shell-sidebar-collapsed', value ? '1' : '0');
      } catch (e) {
        /* ignore */
      }
      // Suppress hover-open briefly after an explicit state change.
      lockUntil = performance.now() + 150;
    }

    document
      .querySelectorAll('[data-td-shell-sidebar-toggle]')
      .forEach(function (btn) {
        btn.addEventListener('click', function () {
          setCollapsed(!collapsed());
        });
      });

    // The collapsed panel leaves a 16px transparent hover target.
    panel.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch' || !mdQuery.matches) return;
      if (!collapsed() || performance.now() < lockUntil) return;
      window.clearTimeout(closeTimer);
      aside.classList.add('td-shell-sidebar--overlay');
    });
    panel.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch' || !collapsed()) return;
      // Near a viewport edge, allow extra time for the pointer to return.
      var nearEdge =
        Math.min(e.clientX, document.body.clientWidth - e.clientX) <= 100;
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(
        function () {
          aside.classList.remove('td-shell-sidebar--overlay');
          lockUntil = performance.now() + 150;
        },
        nearEdge ? 500 : 0,
      );
    });

    mdQuery.addEventListener('change', function (mq) {
      if (!mq.matches) aside.classList.remove('td-shell-sidebar--overlay');
    });
  }

  /* --------------------------------------------------------------- resize */

  // Resize the shared sidebar column/panel through --td-shell-sidebar-w and
  // persist it in localStorage. Double-click resets it; min/max come from the
  // site parameters or section cascade on .td-shell-layout.
  function initResize() {
    var aside = document.getElementById('td-shell-sidebar');
    if (!aside) return;
    var handle = aside.querySelector('[data-td-shell-resizer]');
    var panel = aside.querySelector('.td-shell-sidebar__panel');
    var layout = document.querySelector('.td-shell-layout');
    if (!handle || !panel || !layout) return;
    var mdQuery = window.matchMedia(MD);

    function bounds() {
      var cs = getComputedStyle(layout);
      return {
        min: parseFloat(cs.getPropertyValue('--td-shell-sidebar-min')) || 220,
        max: parseFloat(cs.getPropertyValue('--td-shell-sidebar-max')) || 480,
      };
    }

    handle.addEventListener('pointerdown', function (e) {
      if (!mdQuery.matches || e.button !== 0) return;
      e.preventDefault();
      var b = bounds();
      var rect = panel.getBoundingClientRect();
      var rtl = getComputedStyle(panel).direction === 'rtl';
      html.setAttribute('data-td-shell-resizing', '');
      handle.setPointerCapture(e.pointerId);

      function onMove(ev) {
        var raw = rtl ? rect.right - ev.clientX : ev.clientX - rect.left;
        var w = Math.round(Math.min(b.max, Math.max(b.min, raw)));
        html.style.setProperty('--td-shell-sidebar-w', w + 'px');
      }
      function onUp() {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        html.removeAttribute('data-td-shell-resizing');
        var w = parseFloat(
          getComputedStyle(html).getPropertyValue('--td-shell-sidebar-w'),
        );
        if (w > 0) {
          try {
            localStorage.setItem('td-shell-sidebar-w', String(Math.round(w)));
          } catch (err) {
            /* ignore */
          }
        }
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });

    // Double-click resets to the breakpoint default (268px or 286px).
    handle.addEventListener('dblclick', function () {
      html.style.removeProperty('--td-shell-sidebar-w');
      try {
        localStorage.removeItem('td-shell-sidebar-w');
      } catch (err) {
        /* ignore */
      }
    });
  }

  /* ---------------------------------------------------------- treeToggles */

  function initTreeToggles() {
    document
      .querySelectorAll('[data-td-shell-tree-toggle]')
      .forEach(function (button) {
        var target = document.getElementById(
          button.getAttribute('aria-controls'),
        );
        if (!target) return;

        function setExpanded(expanded) {
          button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          target.classList.toggle('is-open', expanded);
          var label = expanded
            ? button.dataset.labelCollapse
            : button.dataset.labelExpand;
          if (label) button.setAttribute('aria-label', label);
        }

        button.addEventListener('click', function () {
          setExpanded(button.getAttribute('aria-expanded') !== 'true');
        });
      });
  }

  /* ------------------------------------------------------------ treeScroll */

  function initTreeScroll() {
    var viewport = document.querySelector('[data-td-shell-sidebar-scroll]');
    if (!viewport) return;
    var key = 'td-shell-sidebar-scroll:' + (html.lang || 'en');

    try {
      var saved = sessionStorage.getItem(key);
      if (saved !== null) viewport.scrollTop = parseInt(saved, 10) || 0;
    } catch (e) {
      /* ignore */
    }

    // Center the active row when a deep link or restored offset placed it outside the viewport.
    var active = viewport.querySelector('.td-shell-tree__row.td-shell-active');
    if (active) {
      var rowRect = active.getBoundingClientRect();
      var boxRect = viewport.getBoundingClientRect();
      if (rowRect.top < boxRect.top || rowRect.bottom > boxRect.bottom) {
        active.scrollIntoView({ block: 'center' });
      }
    }

    var timer = 0;
    function save() {
      try {
        sessionStorage.setItem(key, String(viewport.scrollTop));
      } catch (e) {
        /* ignore */
      }
    }
    viewport.addEventListener(
      'scroll',
      function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(save, 100);
      },
      { passive: true },
    );
    window.addEventListener('pagehide', save);
  }

  /* -------------------------------------------------------- asideRelocate */

  /*
   * Below xl the TOC rail is hidden, which used to take the table of contents,
   * the page actions and the taxonomy clouds with it. Rather than render a
   * second copy — duplicate ids would break the scrollspy and the disclosure
   * wiring — the single block is moved into a slot in the sidebar drawer and
   * moved back on the way up.
   *
   * The groups follow the context: expanded in the rail, where there is room
   * for them, collapsed in the drawer, where the navigation tree comes first.
   * A group can opt out of the wide expansion when its default is collapsed.
   */
  function initAsideRelocate() {
    var aside = document.querySelector('[data-td-shell-aside]');
    var slot = document.querySelector('[data-td-shell-aside-slot]');
    if (!aside || !slot) return;
    var home = aside.parentElement;
    var wide = window.matchMedia('(min-width: 1200px)');

    function setGroups(expanded) {
      aside
        .querySelectorAll(
          '[data-td-shell-tree-toggle]:not([data-td-shell-aside-keep-open])',
        )
        .forEach(function (button) {
          var target = document.getElementById(
            button.getAttribute('aria-controls'),
          );
          if (!target) return;
          var shouldExpand =
            expanded &&
            !button.hasAttribute('data-td-shell-aside-default-collapsed');
          button.setAttribute(
            'aria-expanded',
            shouldExpand ? 'true' : 'false',
          );
          target.classList.toggle('is-open', shouldExpand);
          var label = shouldExpand
            ? button.dataset.labelCollapse
            : button.dataset.labelExpand;
          if (label) button.setAttribute('aria-label', label);
        });
    }

    function place(isWide) {
      var parent = isWide ? home : slot;
      if (aside.parentElement !== parent) parent.appendChild(aside);
      slot.hidden = isWide;
      setGroups(isWide);
    }

    place(wide.matches);
    wide.addEventListener('change', function (event) {
      place(event.matches);
    });
  }

  /* ------------------------------------------------------------------ toc */

  /*
   * TOC track: each item owns an SVG segment, with cubic Bezier connectors at
   * depth changes. A full-height accent path is clipped to the active range,
   * and a 4px dot moves along that path with CSS motion-path properties.
   * Indents are 20/32/44px and track x positions are 8/16/24px; the 0.5px
   * offset keeps a 1px stroke aligned to device pixels.
   */
  function initToc() {
    var body = document.getElementById('td-shell-toc-body');
    if (!body) return;
    var tocNav = body.querySelector('#TableOfContents');
    var links = Array.prototype.slice.call(
      body.querySelectorAll('#TableOfContents a[href^="#"]'),
    );
    if (!tocNav || !links.length) return;

    var SVG_NS = 'http://www.w3.org/2000/svg';

    // Depth is the number of ancestor <ul> elements plus one (Hugo starts at h2).
    function depthOf(a) {
      var d = 0;
      var el = a.parentElement;
      while (el && el !== tocNav) {
        if (el.tagName === 'UL') d++;
        el = el.parentElement;
      }
      return d + 1;
    }
    function itemOffset(depth) {
      return depth <= 2 ? 20 : depth === 3 ? 32 : 44;
    }
    function lineOffset(depth) {
      return depth <= 2 ? 8 : depth === 3 ? 16 : 24;
    }

    var depths = links.map(depthOf);
    var positions = []; // Per-item [top, bottom], relative to body without padding.
    var overlay = null;
    var dot = null;
    var pathEl = null;
    var pathLength = 0;

    function build() {
      // Rebuild after ResizeObserver reports changed geometry.
      body.querySelectorAll('.td-shell-toc__rail').forEach(function (el) {
        el.remove();
      });
      if (overlay) overlay.remove();
      positions = [];

      var d = '';
      var upperX = 0;
      var upperBottom = 0;
      var maxW = 0;
      var maxH = 0;

      links.forEach(function (a, i) {
        var depth = depths[i];
        a.style.paddingInlineStart = itemOffset(depth) + 'px';

        var l1 = lineOffset(depth);
        var l0 = i === 0 ? l1 : lineOffset(depths[i - 1]);
        var l2 = i === links.length - 1 ? l1 : lineOffset(depths[i + 1]);

        // Per-item muted track segment.
        var rail = document.createElementNS(SVG_NS, 'svg');
        rail.setAttribute(
          'class',
          'td-shell-toc__rail' + (l1 !== l2 ? ' td-shell-toc__rail--cut' : ''),
        );
        rail.setAttribute('aria-hidden', 'true');
        rail.style.width = Math.max(l0, l1) + 9 + 'px';
        if (l0 !== l1) {
          var conn = document.createElementNS(SVG_NS, 'path');
          conn.setAttribute(
            'd',
            'M ' +
              (l0 + 0.5) +
              ' 0 C ' +
              (l0 + 0.5) +
              ' 8 ' +
              (l1 + 0.5) +
              ' 4 ' +
              (l1 + 0.5) +
              ' 12',
          );
          rail.appendChild(conn);
        }
        var seg = document.createElementNS(SVG_NS, 'line');
        seg.setAttribute('x1', String(l1 + 0.5));
        seg.setAttribute('x2', String(l1 + 0.5));
        seg.setAttribute('y1', l0 === l1 ? '6' : '12');
        seg.setAttribute('y2', '100%');
        rail.appendChild(seg);
        a.appendChild(rail);

        // Accent-path nodes relative to the body origin.
        var style = getComputedStyle(a);
        var top = a.offsetTop + parseFloat(style.paddingTop);
        var bottom =
          a.offsetTop + a.clientHeight - parseFloat(style.paddingBottom);
        var x = l1 + 0.5;
        positions.push([top, bottom]);
        if (i === 0) {
          d += 'M' + x + ' ' + top + ' L' + x + ' ' + bottom;
        } else {
          d +=
            ' C ' +
            upperX +
            ' ' +
            (top - 4) +
            ' ' +
            x +
            ' ' +
            (upperBottom + 4) +
            ' ' +
            x +
            ' ' +
            top +
            ' L' +
            x +
            ' ' +
            bottom;
        }
        upperX = x;
        upperBottom = bottom;
        maxW = Math.max(maxW, x + 8);
        maxH = Math.max(maxH, bottom);
      });

      overlay = document.createElement('div');
      overlay.className = 'td-shell-toc__active';
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + maxW + ' ' + maxH);
      svg.style.width = maxW + 'px';
      svg.style.height = maxH + 'px';
      pathEl = document.createElementNS(SVG_NS, 'path');
      pathEl.setAttribute('d', d);
      svg.appendChild(pathEl);
      overlay.appendChild(svg);
      dot = document.createElement('span');
      dot.className = 'td-shell-toc__dot';
      dot.style.offsetPath = 'path("' + d + '")';
      overlay.appendChild(dot);
      body.appendChild(overlay);
      pathLength = pathEl.getTotalLength();
    }

    // Binary-search the path distance for a y coordinate; y is monotonic.
    function distanceAtY(y) {
      var lo = 0;
      var hi = pathLength;
      for (var i = 0; i < 24; i++) {
        var mid = (lo + hi) / 2;
        if (pathEl.getPointAtLength(mid).y < y) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return (lo + hi) / 2;
    }

    var linkById = new Map();
    links.forEach(function (a) {
      linkById.set(decodeURIComponent(a.hash.slice(1)), a);
    });
    var headings = [];
    linkById.forEach(function (_a, id) {
      var el = document.getElementById(id);
      if (el) headings.push(el);
    });
    if (!headings.length) return;

    var visible = new Set();
    var lastAbove = headings[0];

    function paint() {
      var actives = Array.from(visible);
      if (!actives.length && lastAbove) actives = [lastAbove];
      links.forEach(function (a) {
        a.classList.remove('active');
      });

      var firstIdx = Infinity;
      var lastIdx = -1;
      actives.forEach(function (h) {
        var a = linkById.get(h.id);
        if (!a) return;
        a.classList.add('active');
        var idx = links.indexOf(a);
        if (idx < firstIdx) firstIdx = idx;
        if (idx > lastIdx) lastIdx = idx;
      });

      if (lastIdx < 0 || !overlay) {
        if (overlay) {
          overlay.style.setProperty('--td-shell-track-top', '0px');
          overlay.style.setProperty('--td-shell-track-bottom', '0px');
          overlay.style.setProperty('--td-shell-dot-o', '0');
        }
        return;
      }
      var trackTop = positions[firstIdx][0];
      var trackBottom = positions[lastIdx][1];
      overlay.style.setProperty('--td-shell-track-top', trackTop + 'px');
      overlay.style.setProperty('--td-shell-track-bottom', trackBottom + 'px');
      overlay.style.setProperty('--td-shell-dot-o', '1');
      overlay.style.setProperty(
        '--td-shell-dot-d',
        distanceAtY(trackTop) + 'px',
      );

      // Keep the first active entry visible in a long, scrollable TOC.
      var first = links[firstIdx];
      if (first) {
        var container = body.getBoundingClientRect();
        var link = first.getBoundingClientRect();
        if (link.top < container.top || link.bottom > container.bottom) {
          first.scrollIntoView({ block: 'nearest' });
        }
      }
    }

    build();

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            visible.add(entry.target);
          } else {
            visible.delete(entry.target);
            // Keep the preceding section active between observed headings.
            if (entry.boundingClientRect.top < 100) lastAbove = entry.target;
          }
        });
        paint();
      },
      { rootMargin: '-80px 0px -25% 0px' },
    );
    headings.forEach(function (h) {
      observer.observe(h);
    });

    if ('ResizeObserver' in window) {
      var lastWidth = 0;
      new ResizeObserver(function (entries) {
        var w = entries[0].contentRect.width;
        if (Math.abs(w - lastWidth) > 1) {
          lastWidth = w;
          build();
        }
        paint();
      }).observe(body);
    }
    paint();
  }

  /* ---------------------------------------------------------- pageContext */

  // LLM and Markdown actions in the TOC rail's action list.
  function initPageContext() {
    document
      .querySelectorAll('[data-td-page-context]')
      .forEach(function (root) {
        var status = root.querySelector('[data-td-page-context-status]');
        var openInLinks = root.querySelectorAll('[data-td-page-open-in]');
        var openInPrompt =
          root.dataset.tdPageOpenInPrompt ||
          'Read from %s so I can ask questions about it.';
        var copyButtons = root.querySelectorAll('[data-td-page-copy]');
        var cached = new Map();

        // Match Nextra's current behavior: use the browser URL at activation
        // time so the deployed host, query string, and current hash survive.
        function syncOpenInLink(link) {
          var service = link.dataset.tdPageOpenIn;
          var prompt = openInPrompt.replace('%s', window.location.href);
          var query = encodeURIComponent(prompt);
          link.href =
            service === 'chatgpt'
              ? 'https://chatgpt.com/?hints=search&prompt=' + query
              : 'https://claude.ai/new?q=' + query;
        }

        openInLinks.forEach(function (link) {
          syncOpenInLink(link);
          link.addEventListener('click', function () {
            syncOpenInLink(link);
          });
        });

        function announce(text) {
          if (!status) return;
          status.textContent = '';
          window.requestAnimationFrame(function () {
            status.textContent = text;
          });
        }

        function fallbackCopy(text) {
          return new Promise(function (resolve, reject) {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try {
              if (document.execCommand('copy')) {
                resolve();
              } else {
                reject(new Error('copy failed'));
              }
            } catch (error) {
              reject(error);
            }
            textarea.remove();
          });
        }

        function writeClipboard(text) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
          }
          return fallbackCopy(text);
        }

        function showCopied(button) {
          var label = button.querySelector('[data-td-page-copy-label]');
          button.classList.add('is-copied');
          if (label && !label.dataset.original)
            label.dataset.original = label.textContent;
          if (label)
            label.textContent = root.dataset.tCopied || label.textContent;
          announce(root.dataset.tCopied || 'Copied');
          window.setTimeout(function () {
            button.classList.remove('is-copied');
            if (label && label.dataset.original)
              label.textContent = label.dataset.original;
          }, 1400);
        }

        function fetchMarkdown(url) {
          if (cached.has(url)) return Promise.resolve(cached.get(url));
          return fetch(url)
            .then(function (response) {
              if (!response.ok) throw new Error('Markdown request failed');
              return response.text();
            })
            .then(function (text) {
              cached.set(url, text);
              return text;
            });
        }

        copyButtons.forEach(function (button) {
          var url = button.dataset.url;
          if (!url) return;
          // Warm the cache on intent rather than on load: most readers never
          // press this, and an unconditional fetch is a request per page view.
          ['pointerenter', 'focus'].forEach(function (event) {
            button.addEventListener(
              event,
              function () {
                fetchMarkdown(url).catch(function () {
                  /* retry on activation */
                });
              },
              { once: true },
            );
          });
          button.addEventListener('click', function () {
            fetchMarkdown(url)
              .then(writeClipboard)
              .then(function () {
                showCopied(button);
              })
              .catch(function () {
                announce(root.dataset.tCopyError || 'Copy failed');
              });
          });
        });
      });
  }

  /* --------------------------------------------------------------- search */

  function initSearch() {
    var root = document.getElementById('td-shell-search');
    if (!root) return;
    var input = root.querySelector('.td-shell-search__input');
    var list = root.querySelector('.td-shell-search__list');
    var panel = root.querySelector('.td-shell-search__panel');
    var status = root.querySelector('[data-td-shell-search-status]');
    if (!input || !list || !panel || !status) return;

    var CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;
    var index = null;
    var docs = null;
    var docByRef = new Map();
    var loading = false;
    var results = [];
    var selected = 0;
    var hideTimer = 0;
    var maxResults = parseInt(root.dataset.maxResults, 10);
    if (!Number.isFinite(maxResults) || maxResults < 1) maxResults = 10;
    var openers = document.querySelectorAll('[data-td-shell-search-open]');
    var lastOpener = null;

    function isOpen() {
      return root.classList.contains('is-open');
    }

    function open(event) {
      lastOpener =
        event && event.currentTarget
          ? event.currentTarget
          : document.activeElement;
      window.clearTimeout(hideTimer);
      root.hidden = false;
      html.setAttribute('data-td-shell-lock', '');
      openers.forEach(function (el) {
        el.setAttribute('aria-expanded', 'true');
      });
      input.setAttribute('aria-expanded', 'true');
      window.requestAnimationFrame(function () {
        root.classList.add('is-open');
      });
      input.focus();
      input.select();
      ensureIndex();
    }
    function close() {
      root.classList.remove('is-open');
      html.removeAttribute('data-td-shell-lock');
      openers.forEach(function (el) {
        el.setAttribute('aria-expanded', 'false');
      });
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      if (lastOpener && root.contains(document.activeElement))
        lastOpener.focus();
      hideTimer = window.setTimeout(function () {
        root.hidden = true;
      }, 240);
    }

    function announce(text) {
      status.textContent = '';
      window.requestAnimationFrame(function () {
        status.textContent = text;
      });
    }

    function message(text) {
      list.textContent = '';
      input.removeAttribute('aria-activedescendant');
      var el = document.createElement('div');
      el.className = 'td-shell-search__empty';
      el.textContent = text;
      list.appendChild(el);
      announce(text);
    }

    function ensureIndex() {
      if (index || loading) return;
      loading = true;
      list.setAttribute('aria-busy', 'true');
      if (!docs) message(root.dataset.tLoading || '…');
      fetch(root.dataset.indexSrc)
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          docs = data;
          data.forEach(function (d) {
            docByRef.set(d.ref, d);
          });
          index = lunr(function () {
            this.ref('ref');
            this.field('title', { boost: 5 });
            this.field('categories', { boost: 3 });
            this.field('tags', { boost: 3 });
            this.field('headings', { boost: 3 });
            this.field('description', { boost: 2 });
            this.field('body');
            data.forEach(function (d) {
              this.add(d);
            }, this);
          });
          loading = false;
          list.removeAttribute('aria-busy');
          render(input.value);
        })
        .catch(function () {
          loading = false;
          list.removeAttribute('aria-busy');
          message(root.dataset.tEmpty || 'No results');
        });
    }

    // lunr cannot tokenize CJK reliably, so scan the indexed text for substrings.
    function queryCjk(q) {
      var hits = [];
      var needle = q.toLowerCase();
      docs.forEach(function (d) {
        var titleAt = (d.title || '').toLowerCase().indexOf(needle);
        var headingAt = (d.headings || '').toLowerCase().indexOf(needle);
        var descAt = (d.description || '').toLowerCase().indexOf(needle);
        var bodyAt = (d.body || '').toLowerCase().indexOf(needle);
        var score =
          (titleAt >= 0 ? 100 : 0) +
          (headingAt >= 0 ? 50 : 0) +
          (descAt >= 0 ? 30 : 0) +
          (bodyAt >= 0 ? 10 : 0);
        if (!score) return;
        var excerpt = d.excerpt || '';
        if (bodyAt >= 0) {
          var start = Math.max(0, bodyAt - 24);
          excerpt =
            (start > 0 ? '…' : '') + d.body.slice(start, bodyAt + 56) + '…';
        } else if (descAt >= 0) {
          excerpt = d.description;
        }
        hits.push({ doc: d, score: score, excerpt: excerpt });
      });
      hits.sort(function (a, b) {
        return b.score - a.score;
      });
      return hits.slice(0, maxResults);
    }

    // Latin queries retain exact, wildcard, and edit-distance matching.
    function queryLatin(q) {
      var found = index.query(function (builder) {
        lunr.tokenizer(q.toLowerCase()).forEach(function (token) {
          var term = token.toString();
          builder.term(term, { boost: 100 });
          builder.term(term, {
            wildcard:
              lunr.Query.wildcard.LEADING | lunr.Query.wildcard.TRAILING,
            boost: 10,
          });
          builder.term(term, { editDistance: 2 });
        });
      });
      return found
        .slice(0, maxResults)
        .map(function (r) {
          var doc = docByRef.get(r.ref);
          return doc
            ? { doc: doc, excerpt: doc.excerpt || doc.description || '' }
            : null;
        })
        .filter(Boolean);
    }

    function highlight(text, q) {
      var fragment = document.createDocumentFragment();
      var at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
      if (at < 0) {
        fragment.appendChild(document.createTextNode(text));
        return fragment;
      }
      fragment.appendChild(document.createTextNode(text.slice(0, at)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(at, at + q.length);
      fragment.appendChild(mark);
      fragment.appendChild(document.createTextNode(text.slice(at + q.length)));
      return fragment;
    }

    function select(i) {
      var options = Array.prototype.slice.call(
        list.querySelectorAll('[role="option"]'),
      );
      if (!options.length) {
        input.removeAttribute('aria-activedescendant');
        return;
      }
      selected = Math.max(0, Math.min(i, options.length - 1));
      options.forEach(function (row, n) {
        row.setAttribute('aria-selected', n === selected ? 'true' : 'false');
      });
      var row = options[selected];
      input.setAttribute('aria-activedescendant', row.id);
      row.scrollIntoView({ block: 'nearest' });
    }

    function render(q) {
      q = (q || '').trim();
      if (!docs || !index) return;
      list.textContent = '';
      results = [];
      selected = 0;
      input.removeAttribute('aria-activedescendant');
      if (!q) {
        status.textContent = '';
        return;
      }

      try {
        results = CJK.test(q) ? queryCjk(q) : queryLatin(q);
      } catch (e) {
        results = [];
      }
      if (!results.length) {
        message(root.dataset.tEmpty || 'No results');
        return;
      }
      results.forEach(function (r, i) {
        var row = document.createElement('a');
        row.className = 'td-shell-search__item';
        row.id = 'td-shell-search-option-' + i;
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', 'false');
        row.setAttribute('tabindex', '-1');
        row.href = r.doc.ref;

        var title = document.createElement('div');
        title.className = 'td-shell-search__item-title';
        title.appendChild(highlight(r.doc.title || r.doc.ref, q));
        row.appendChild(title);

        var ref = document.createElement('div');
        ref.className = 'td-shell-search__item-ref';
        ref.textContent = r.doc.ref;
        row.appendChild(ref);

        if (r.excerpt) {
          var excerpt = document.createElement('div');
          excerpt.className = 'td-shell-search__item-excerpt';
          excerpt.appendChild(highlight(r.excerpt, q));
          row.appendChild(excerpt);
        }

        row.addEventListener('pointermove', function () {
          if (selected !== i) select(i);
        });
        list.appendChild(row);
      });
      select(0);
      announce(
        (root.dataset.tResults || '{count} results').replace(
          '{count}',
          String(results.length),
        ),
      );
    }

    var debounce = 0;
    input.addEventListener('input', function () {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(function () {
        render(input.value);
      }, 80);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (results.length) select(Math.min(selected + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (results.length) select(Math.max(selected - 1, 0));
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (results.length) select(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (results.length) select(results.length - 1);
      } else if (e.key === 'Enter') {
        var row = list.querySelectorAll('[role="option"]')[selected];
        if (row && row.href) window.location.href = row.href;
      }
    });

    document.addEventListener('keydown', tabTrap(panel, isOpen), true);

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen()) {
          close();
        } else {
          open();
        }
      } else if (e.key === 'Escape' && isOpen()) {
        close();
      }
    });
    openers.forEach(function (el) {
      el.addEventListener('click', open);
    });
    root
      .querySelectorAll('[data-td-shell-search-close]')
      .forEach(function (el) {
        el.addEventListener('click', close);
      });

    // Show Ctrl instead of the Command badge on non-Apple platforms.
    var apple = /Mac|iPhone|iPad|iPod/.test(
      navigator.platform || navigator.userAgent,
    );
    if (!apple) {
      document
        .querySelectorAll('[data-td-shell-meta-key]')
        .forEach(function (el) {
          el.textContent = 'Ctrl';
        });
    }
  }

  /* ----------------------------------------------------------------- boot */

  initRootMenu();
  initRightCollapse();
  initFooterOffset();
  initDrawer();
  initCollapse();
  initResize();
  initTreeToggles();
  initTreeScroll();
  // Before initToc: the table of contents measures geometry, so it should be
  // built where it will actually live.
  initAsideRelocate();
  initToc();
  initPageContext();
  initSearch();

  // Restore transitions after the first painted frame.
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      html.removeAttribute('data-td-shell-no-anim');
    });
  });
})();
