/*!
 * This is a Docsy-adapted version of https://github.com/twbs/examples/blob/main/color-modes/js/color-modes.js.
 *
 * Original header:
 *
 * Color mode toggler for Bootstrap's docs (https://getbootstrap.com/)
 * Copyright 2011-2024 The Bootstrap Authors
 * Licensed under the Creative Commons Attribution 3.0 Unported License.
 */

(() => {
  'use strict'

  const themeKey = 'td-color-theme'
  const getStoredTheme = () => localStorage.getItem(themeKey)
  const setStoredTheme = theme => localStorage.setItem(themeKey, theme)

  const getPreferredTheme = () => {
    const storedTheme = getStoredTheme()
    if (storedTheme) {
      return storedTheme
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const setTheme = theme => {
    if (theme === 'auto') {
      document.documentElement.setAttribute('data-bs-theme', (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
    } else {
      document.documentElement.setAttribute('data-bs-theme', theme)
    }
  }

  const syncDirectThemeButtons = () => {
    const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark'
    document.querySelectorAll('[data-td-theme-toggle]').forEach(toggle => {
      toggle.setAttribute('aria-pressed', dark ? 'true' : 'false')
      const moon = toggle.querySelector('.td-shell-icon--moon')
      const sun = toggle.querySelector('.td-shell-icon--sun')
      if (moon) moon.toggleAttribute('hidden', dark)
      if (sun) sun.toggleAttribute('hidden', !dark)
      const icon = toggle.querySelector('i.fa-solid')
      if (icon) {
        icon.classList.toggle('fa-sun', dark)
        icon.classList.toggle('fa-moon', !dark)
      }
    })

    // The explicit auto/light/dark controls reflect the stored *preference*,
    // not the theme it currently resolves to: "auto" stays selected after the
    // system flips to dark.
    const preference = getStoredTheme() || 'auto'
    document.querySelectorAll('[data-bs-theme-value]').forEach(button => {
      const selected = button.getAttribute('data-bs-theme-value') === preference
      button.setAttribute('aria-pressed', selected ? 'true' : 'false')
      button.classList.toggle('is-active', selected)
    })
  }

  setTheme(getPreferredTheme())

  document.documentElement.removeAttribute('data-theme-init')

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const storedTheme = getStoredTheme()
    if (storedTheme !== 'light' && storedTheme !== 'dark') {
      setTheme(getPreferredTheme())
      syncDirectThemeButtons()
    }
  })

  const apply = theme => {
    if (theme === 'auto') {
      // Storing "auto" rather than clearing the key keeps the choice explicit,
      // and getPreferredTheme resolves it against the media query.
      setStoredTheme('auto')
    } else {
      setStoredTheme(theme)
    }
    setTheme(theme)
    syncDirectThemeButtons()
  }

  window.addEventListener('DOMContentLoaded', () => {
    syncDirectThemeButtons()

    document.querySelectorAll('[data-bs-theme-value]')
      .forEach(button => {
        button.addEventListener('click', () => {
          apply(button.getAttribute('data-bs-theme-value'))
        })
      })

    document.querySelectorAll('[data-td-theme-toggle]')
      .forEach(toggle => {
        toggle.addEventListener('click', () => {
          apply(document.documentElement.getAttribute('data-bs-theme') === 'dark'
            ? 'light'
            : 'dark')
        })
      })
  })
})()
