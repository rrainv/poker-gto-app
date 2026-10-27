import {
  SYSTEM_REDUCED_MOTION_QUERY,
  createMotionPreferenceController,
  createMotionRuntime,
  installKeyboardInstantMotion,
} from './motion-preference.mjs';

function initializeMotionPreference() {
  const root = document.documentElement;
  const controller = createMotionPreferenceController({
    root,
    storage: window.localStorage,
    systemQuery: window.matchMedia?.(SYSTEM_REDUCED_MOTION_QUERY) ?? null,
    buttons: document.querySelectorAll('[data-motion-option]'),
    sourceNote: document.querySelector('#settingsMotionSource'),
    followDeviceButton: document.querySelector('#settingsMotionFollowDevice'),
  }).init();
  installKeyboardInstantMotion({ root, target: document });
  window.RiverlineMotionPreference = controller;
  window.RiverlineMotion = createMotionRuntime(root);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMotionPreference, { once: true });
} else {
  initializeMotionPreference();
}
