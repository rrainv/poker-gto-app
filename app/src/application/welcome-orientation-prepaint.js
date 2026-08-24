(function prepareWelcomeOrientation(root, storage) {
  'use strict';

  var storageKey = 'riverline.welcomeOrientation.v1';
  var schemaVersion = 'welcome-orientation/v1';
  var destinations = ['hand', 'analyze', 'training', 'equity', 'personal-strategy', 'home', 'guide', 'saved', 'home-game'];
  var oriented = false;
  try {
    var raw = storage && storage.getItem(storageKey);
    var value = raw ? JSON.parse(raw) : null;
    oriented = Boolean(value
      && value.schemaVersion === schemaVersion
      && value.localOwnerId === 'local'
      && (value.status === 'completed' || value.status === 'dismissed')
      && typeof value.completedAt === 'string'
      && Number.isFinite(Date.parse(value.completedAt))
      && typeof value.completionReason === 'string'
      && (value.destination === null || destinations.indexOf(value.destination) >= 0));
  } catch (_) {
    oriented = false;
  }

  root.dataset.welcomeOrientation = oriented ? 'completed' : 'unseen';
  if (!oriented) {
    document.addEventListener('DOMContentLoaded', function selectWelcomeEntry() {
      var shell = document.querySelector('.riverline-shell');
      if (!shell) return;
      shell.dataset.activeMode = 'welcome';
      shell.dataset.activeDestination = 'welcome';
      document.querySelectorAll('.mode-nav-item.active').forEach(function clearInitialNavigation(item) {
        item.classList.remove('active');
        item.setAttribute('aria-current', 'false');
      });
    }, { once: true });
  }
}(document.documentElement, window.localStorage));
