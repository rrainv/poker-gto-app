// Native summary handles Enter/Space. Escape closes the innermost open detail
// and returns focus without submitting forms or changing application inputs.
export function bindDisclosureDismissal(details, { signal } = {}) {
  details.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !details.open) return;
    const nearest = event.target?.closest?.('details[open]');
    const target = nearest && details.contains(nearest) ? nearest : details;
    event.preventDefault();
    event.stopPropagation();
    target.open = false;
    target.querySelector('summary')?.focus();
  }, { signal });
}
