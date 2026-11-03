/**
 * DCLM Field Utility — Sensory Haptics Engine
 * Provides eyes-up tactile feedback for ushers and counting clerks
 */

const DCLM_HAPTICS = (function () {
  const supportsVibration = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

  function vibrate(pattern) {
    if (!supportsVibration) return false;
    try { return navigator.vibrate(pattern); }
    catch (_) { return false; }
  }

  return {
    /** Rapid click tick for incrementing counts */
    tick() {
      vibrate(18);
    },

    /** Milestone pulse (every 50 or 100 counts) */
    milestone() {
      vibrate([25, 40, 25]);
    },

    /** Success confirmation pulse */
    success() {
      vibrate([30, 60, 30]);
    },

    /** Caution or reset pulse */
    warning() {
      vibrate([60, 40, 60]);
    },

    /** Error buzz */
    error() {
      vibrate([100, 50, 100]);
    },
  };
})();
