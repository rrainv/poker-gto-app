export function installGuideSurface(browserWindow = window) {
  const { document } = browserWindow;
  const surface = document?.querySelector?.('#infoView');
  if (!surface) return null;

  function navigate(destination) {
    const control = document.querySelector(`.mode-nav-item[data-navigation-id="${destination}"]`);
    if (!control) return false;
    control.click();
    return true;
  }

  function handleClick(event) {
    const action = event.target?.closest?.('[data-guide-destination]');
    if (!action || !surface.contains(action)) return;
    navigate(action.dataset.guideDestination);
  }

  surface.addEventListener('click', handleClick);
  return Object.freeze({
    schemaVersion: 'guide-surface/v1',
    navigate,
    destroy() { surface.removeEventListener('click', handleClick); },
  });
}

if (typeof window !== 'undefined') installGuideSurface(window);
