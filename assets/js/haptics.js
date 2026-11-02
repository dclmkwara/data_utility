/**
 * DCLM Field Utility — Sensory Haptics Engine
 * Provides eyes-up tactile feedback for ushers and counting clerks
 */

const DCLM_HAPTICS = (function () {
  const supportsVibration = typeof navigator !== "undefined" && "vibrate" in navigator;

  return {
    /** Rapid click tick for incrementing counts */
    tick() {
      if (supportsVibration) {
        navigator.vibrate(12);
      }
    },

    /** Milestone pulse (every 50 or 100 counts) */
    milestone() {
      if (supportsVibration) {
        navigator.vibrate([25, 40, 25]);
      }
    },

    /** Success confirmation pulse */
    success() {
      if (supportsVibration) {
        navigator.vibrate([30, 60, 30]);
      }
    },

    /** Caution or reset pulse */
    warning() {
      if (supportsVibration) {
        navigator.vibrate([60, 40, 60]);
      }
    },

    /** Error buzz */
    error() {
      if (supportsVibration) {
        navigator.vibrate([100, 50, 100]);
      }
    },
  };
})();
