(() => {
  'use strict'
  const toggle = document.querySelector('.article-menu-toggle')
  const sidebar = document.querySelector('.article-mobile-sidebar')
  const overlay = document.querySelector('.article-mobile-overlay')
  const closeButton = document.querySelector('.article-mobile-sidebar-close')
  if (!toggle || !sidebar || !overlay || !closeButton) return

  const links = sidebar.querySelectorAll('a')
  let returnFocus = null
  sidebar.setAttribute('role', 'dialog')
  sidebar.setAttribute('aria-modal', 'true')
  sidebar.setAttribute('aria-hidden', 'true')
  sidebar.setAttribute('inert', '')
  const setOpen = (open) => {
    if (open) returnFocus = document.activeElement
    sidebar.classList.toggle('open', open)
    overlay.classList.toggle('open', open)
    document.body.classList.toggle('article-menu-open', open)
    toggle.setAttribute('aria-expanded', String(open))
    sidebar.setAttribute('aria-hidden', String(!open))
    if (open) {
      sidebar.removeAttribute('inert')
      closeButton.focus({ preventScroll: true })
    } else {
      sidebar.setAttribute('inert', '')
      if (returnFocus && typeof returnFocus.focus === 'function') {
        returnFocus.focus({ preventScroll: true })
      }
    }
  }
  toggle.setAttribute('aria-expanded', 'false')
  toggle.setAttribute('aria-controls', 'article-mobile-sidebar')
  sidebar.id ||= 'article-mobile-sidebar'
  toggle.addEventListener('click', () => setOpen(true))
  closeButton.addEventListener('click', () => setOpen(false))
  overlay.addEventListener('click', () => setOpen(false))
  links.forEach((link) => link.addEventListener('click', () => setOpen(false)))
  document.addEventListener('keydown', (event) => {
    if (!sidebar.classList.contains('open')) return
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
    if (event.key !== 'Tab') return
    const candidates = Array.from(sidebar.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter((item) => item.getClientRects().length)
    if (!candidates.length) {event.preventDefault(); return}
    const first = candidates[0], last = candidates[candidates.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
})()
