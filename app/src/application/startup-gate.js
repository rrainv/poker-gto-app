(function installStartupGate(root) {
  'use strict';

  // HOME-BRIDGE-RACE. A module whose graph has a top-level await (the
  // authentication and sync bootstraps, and everything importing them) is
  // evaluated asynchronously. Browsers do not hold later deferred scripts for
  // it, so logic.js could start before those bridges (RiverlineHome and the
  // rest) existed. This classic script runs just before logic.js; whenReady()
  // resolves once every module script of the page has finished evaluating, so
  // logic.js starts against a complete set of bridges.
  var LIVENESS_LIMIT_MS = 15000;
  var pending = null;

  function moduleUrls() {
    var doc = root.document;
    var nodes = doc.querySelectorAll('script[type="module"][src]');
    var urls = [];
    for (var index = 0; index < nodes.length; index += 1) {
      urls.push(new URL(nodes[index].getAttribute('src'), doc.baseURI).href);
    }
    return urls;
  }

  function settleAll() {
    // import() of a URL already in the module map returns that same instance
    // and settles when its (possibly async) evaluation does. A module that
    // fails to load rejects here; the browser already reports it, and the app
    // still starts without that bridge.
    var imports = moduleUrls().map(function importOne(url) {
      return import(url).then(function ok() { return true; }, function failed() { return false; });
    });
    return Promise.all(imports);
  }

  function whenReady() {
    if (pending) return pending;
    // Liveness guard for a module that never settles (a hung auth-config
    // fetch); not a retry. The app starts without whatever is still pending.
    var limit = new Promise(function limitReached(resolve) {
      root.setTimeout(function timedOut() {
        console.warn('[Riverline] Startup gate gave up waiting for module scripts.');
        resolve();
      }, LIVENESS_LIMIT_MS);
    });
    pending = Promise.race([settleAll(), limit]).then(function done() {});
    return pending;
  }

  Object.defineProperty(root, 'RiverlineStartup', {
    configurable: true,
    enumerable: false,
    value: Object.freeze({ whenReady: whenReady }),
    writable: false,
  });
})(typeof window !== 'undefined' ? window : globalThis);
