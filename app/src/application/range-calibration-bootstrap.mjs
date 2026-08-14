let activationPromise = null;

export function activateRangeCalibrationWorkspace() {
  if (!activationPromise) {
    activationPromise = import('./range-calibration-workspace.mjs')
      .then((module) => module.mountRangeCalibrationWorkspace())
      .catch((error) => {
        activationPromise = null;
        const root = document.querySelector('#rangeCalibrationWorkspace');
        const loading = document.querySelector('#calibrationLoadingState');
        const errorState = document.querySelector('#calibrationErrorState');
        const message = document.querySelector('#calibrationErrorMessage');
        if (root) root.setAttribute('aria-busy', 'false');
        if (loading) loading.hidden = true;
        if (errorState) errorState.hidden = false;
        if (message) message.textContent = window.t?.('Your stored data was left untouched. Try reopening this workspace.')
          || 'Your stored data was left untouched. Try reopening this workspace.';
        console.error('[Riverline Range Calibration]', error);
        throw error;
      });
  }
  return activationPromise;
}

function bindActivation() {
  const button = document.querySelector('.mode-nav-item[data-mode="calibration"]');
  button?.addEventListener('click', () => {
    activateRangeCalibrationWorkspace().catch(() => {});
  });
  if (document.querySelector('.riverline-shell')?.dataset.activeMode === 'calibration') {
    activateRangeCalibrationWorkspace().catch(() => {});
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindActivation, { once: true });
else bindActivation();

