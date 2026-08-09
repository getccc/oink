/**
 * docs-shell.js — documentation shell interactions (no framework).
 *
 * 模块：rootMenu（根节点下拉）/ drawer（移动抽屉）/ collapse（桌面侧栏收起 +
 *       悬停弹出）/ resize（拖拽调宽）/
 *       treeScroll（侧栏滚动位保持）/ toc（v16 轨道 + clip-path 高亮 + 滑动圆点）/
 *       search（⌘K 弹窗，lunr + 中文子串兜底）。
 *
 * 约定：主题沿用 localStorage `td-color-theme` + <html data-bs-theme>；
 *       侧栏收起态存 localStorage `td-shell-sidebar-collapsed`，由 head-end 的
 *       预绘制脚本在首帧前恢复；首帧动画由 <html data-td-shell-no-anim> 抑制，
 *       本文件在两帧后移除该属性。
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

  // 右侧栏整栏隐藏（与左侧对称）：标题图标钮切换，右上浮动钮恢复，localStorage 持久化。
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

  // 固定侧栏在页脚进入视口时缩短同等高度，底部版本选择器始终位于页脚上方。
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

  // 根节点下拉（v16 SidebarTabsDropdown）：100ms scale 弹层，外点/Esc 关闭。
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
    // 抽屉是模态：背后的正文被遮罩挡住，Tab 不能走到那里去。
    document.addEventListener(
      'keydown',
      tabTrap(sidebar, function () {
        return html.hasAttribute('data-td-shell-drawer');
      }),
      true,
    );
    // 视口跨过 md 断点时清掉抽屉态，避免桌面端残留滚动锁。
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
      lockUntil = performance.now() + 150; // fumadocs 同款：状态切换后 150ms 抑制悬停弹出
    }

    document
      .querySelectorAll('[data-td-shell-sidebar-toggle]')
      .forEach(function (btn) {
        btn.addEventListener('click', function () {
          setCollapsed(!collapsed());
        });
      });

    // 悬停弹出：收起的面板保留 16px 隐形热区（opacity:0 不影响命中测试）。
    panel.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch' || !mdQuery.matches) return;
      if (!collapsed() || performance.now() < lockUntil) return;
      window.clearTimeout(closeTimer);
      aside.classList.add('td-shell-sidebar--overlay');
    });
    panel.addEventListener('pointerleave', function (e) {
      if (e.pointerType === 'touch' || !collapsed()) return;
      // fumadocs 同款延迟：离开点贴近视口左右边缘（≤100px）给 500ms 宽限，否则立即收回。
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

  // 侧栏拖拽调宽：写 --td-shell-sidebar-w（列与面板共用），localStorage 持久化，
  // 双击复位。min/max 由 .td-shell-layout 的 --td-shell-sidebar-min/max 钳制
  // （站点参数 + 栏目 front matter cascade）。嵌入态与悬浮弹出态共用同一面板。
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

    // 双击复位为断点默认宽（268/286）。
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

    // 活跃行不在视口内时（深链直达 / 恢复位失效）将其居中。
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
          button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
          target.classList.toggle('is-open', expanded);
          var label = expanded
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
   * TOC —— fumadocs.dev v16 同款「normal」变体：
   *   · 每个条目一段 SVG 轨道，深度变化处用三次贝塞尔曲线平滑连接；
   *   · 活跃高亮 = 一条覆盖整列的主色路径，clip-path 裁剪活跃区间（150ms 过渡）；
   *   · 一枚 4px 圆点沿同一路径滑动（CSS offset-path / offset-distance）。
   * 缩进 20/32/44px，轨道 x 8/16/24（+0.5 使 1px 描边落在整像素）。
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

    // 深度 = 祖先 <ul> 层数 + 1（Hugo TOC 从 h2 起，对应 fumadocs depth 2）。
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
    var positions = []; // 每条目 [top, bottom]（相对 body，去除 padding）
    var overlay = null;
    var dot = null;
    var pathEl = null;
    var pathLength = 0;

    function build() {
      // 清场重建（ResizeObserver 触发时布局已变）。
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

        // --- 每条目的灰色轨道段 ---
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

        // --- 主色路径的节点（相对 body 原点）---
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

    // 沿路径二分查找 y 坐标对应的路径距离（路径在 y 上单调递增）。
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

      // 长 TOC：保证首个活跃项在滚动区内可见。
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
            // 记住最近滚出视口上沿的标题：节与节之间保持上一节高亮。
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

  // "Copy as Markdown" and "Print this page" in the TOC rail's action list.
  function initPageContext() {
    document
      .querySelectorAll('[data-td-page-context]')
      .forEach(function (root) {
        var status = root.querySelector('[data-td-page-context-status]');
        var copyButtons = root.querySelectorAll('[data-td-page-copy]');
        var printButtons = root.querySelectorAll('[data-td-page-print]');
        var cached = new Map();

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
          if (label) label.textContent = root.dataset.tCopied || label.textContent;
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

        printButtons.forEach(function (button) {
          button.addEventListener('click', function () {
            window.print();
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

    // 中文等 CJK 查询：lunr 的分词对 CJK 无能为力，改用全量子串扫描。
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

    // 拉丁文查询：兼容旧实现的三连查询（精确 boost 100 / 通配 10 / 容错 editDistance 2）。
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

    // 非 Apple 平台把 ⌘ 徽章换成 Ctrl。
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

  /* ------------------------------------------------ authoredAccessibility */

  function initAuthoredAccessibility() {
    // Goldmark task-list controls are read-only status markers. Give them the
    // list item text as their accessible name without changing authored HTML.
    document
      .querySelectorAll('.td-content input[type="checkbox"][disabled]')
      .forEach(function (input) {
        if (
          input.hasAttribute('aria-label') ||
          input.hasAttribute('aria-labelledby')
        )
          return;
        var item = input.closest('li');
        var label = item ? item.textContent.replace(/\s+/g, ' ').trim() : '';
        if (label) input.setAttribute('aria-label', label);
        else input.setAttribute('aria-hidden', 'true');
      });

    // Empty Font Awesome elements are decorative; the adjacent text or parent
    // control already carries the name that assistive technology should use.
    document
      .querySelectorAll('i[class*="fa-"], span[class*="fa-"]')
      .forEach(function (icon) {
        if (
          icon.textContent.trim() ||
          icon.hasAttribute('aria-label') ||
          icon.hasAttribute('title')
        )
          return;
        icon.setAttribute('aria-hidden', 'true');
      });
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
  initAuthoredAccessibility();

  // 首帧后恢复过渡动画（head-end 预绘制脚本置位）。
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      html.removeAttribute('data-td-shell-no-anim');
    });
  });
})();
