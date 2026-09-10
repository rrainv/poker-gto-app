import { applyInitialPresentationTheme } from './presentation-theme.mjs';
let storage;
try { storage = window.localStorage; } catch (_) { /* Optional persistence. */ }
applyInitialPresentationTheme(document.documentElement, storage);
