# Floodzie UI/UX Issues & Recommendations

## Accessibility Issues

### Critical

1. **Global `transition: all 0.2s` on `*`** — Transitions ALL properties on ALL elements including layout properties. This is a performance hazard and can cause janky scrolling and layout shifts.
   - **Fix:** Remove the global rule and apply transitions only to specific properties on specific elements (e.g., `transition-colors`, `transition-transform`).

2. **`lang="id"` hardcoded on `<html>`** — Even when English is selected via the language switcher, the `lang` attribute remains `id`. Screen readers will mispronounce English content.
   - **Fix:** Sync the `lang` attribute with the LanguageContext state.

3. **No skip-to-content link** — Users relying on keyboard navigation must tab through the entire sidebar (12+ items) before reaching main content.
   - **Fix:** Add a visually hidden skip link as the first focusable element in the layout.

4. **Weather popup lacks focus trapping** — The weather popup uses a raw `<div>` as a modal overlay without proper focus trapping or ARIA dialog role. Focus can escape behind the overlay.
   - **Fix:** Use Radix Dialog or implement focus trap with `aria-modal="true"` and `role="dialog"`.

### Moderate

5. **Missing `aria-label` on icon-only buttons** — Several header buttons (theme toggle, language switcher) lack accessible labels.
   - **Fix:** Add descriptive `aria-label` attributes to all icon-only interactive elements.

6. **Interactive `<div>` elements with `onClick`** — Some clickable elements use `<div>` or `<motion.div>` without `role="button"`, `tabIndex`, or keyboard event handlers.
   - **Fix:** Use semantic `<button>` elements or add proper ARIA roles and keyboard support.

7. **Map components lack keyboard navigation** — Leaflet maps are mouse/touch-dependent with no keyboard alternatives for key actions.
   - **Fix:** Add keyboard shortcuts for common map actions and document them.

8. **Carousel keyboard navigation unclear** — Embla carousel relies heavily on mouse/touch. Keyboard users may not be able to navigate slides.
   - **Fix:** Ensure arrow key navigation works and add `aria-roledescription="carousel"`.

### Minor

9. **404 page uses hardcoded dark background** — `bg-slate-950` ignores the user's theme preference.
   - **Fix:** Use theme-aware CSS variables instead.

10. **Footer text hardcoded in Indonesian** — Despite i18n support, the footer content is not translated.
    - **Fix:** Use translation keys from LanguageContext.

## Performance Issues

1. **Duplicate Inter font loading** — Inter is loaded both via `next/font/google` and a Google Fonts CSS `<link>` import. This doubles the font download.
   - **Fix:** Remove the CSS import and use only `next/font/google`.

2. **6-second splash screen** — Blocks access to content for 6 full seconds on every new session. This is a significant UX friction point.
   - **Fix:** Reduce to 2-3 seconds max, or make it dismissable, or remove entirely and use skeleton loading states.

3. **Global `transition: all`** — (Also listed under accessibility) Forces the browser to check and potentially animate every CSS property change on every element.
   - **Fix:** Use targeted transitions only.

## Design Consistency Issues

1. **No typographic distinction** — Inter is used for everything (body, headings, labels, display text). Consider a display font for headings or at least more weight/size variation.

2. **Inconsistent card variants** — The Card component has many CVA variants (glass, elevated, outline, gradient) but usage across pages is inconsistent.

3. **Mixed language in UI** — Some components use Indonesian labels while the i18n system is set to English, and vice versa. The `PeringatanBencanaCard` component name itself is Indonesian.

## Recommendations Summary

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Remove global `transition: all` | Low |
| P0 | Sync `lang` attribute with language | Low |
| P0 | Add skip-to-content link | Low |
| P1 | Fix weather popup focus trapping | Medium |
| P1 | Add aria-labels to icon buttons | Low |
| P1 | Remove duplicate font loading | Low |
| P1 | Reduce splash screen duration | Low |
| P2 | Fix interactive div elements | Medium |
| P2 | Add keyboard navigation to maps | High |
| P2 | Theme-aware 404 page | Low |
| P2 | Translate footer content | Low |
| P3 | Carousel keyboard support | Medium |
| P3 | Typographic hierarchy | Medium |
| P3 | Consistent card variant usage | Medium |
