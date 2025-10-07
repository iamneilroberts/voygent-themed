/**
 * Progress Overlay Controller
 * Shows/hides progress indicator with real-time updates from server
 */

import { PROGRESS_STEPS } from './progress-steps.js';

let currentProgressTimeout = null;
let progressPollInterval = null;
let currentTripId = null;

/**
 * Show progress overlay with real-time updates
 * @param {string} theme - Theme name (heritage, tvmovie, etc.)
 * @param {string} tripId - Trip ID to poll for progress (optional)
 */
export function showProgress(theme, tripId = null) {
  const overlay = document.getElementById('progressOverlay');
  if (!overlay) {
    console.warn('[Progress] Progress overlay element not found');
    return;
  }

  overlay.classList.remove('hidden');
  currentTripId = tripId;

  // If we have a trip ID, poll for real progress
  if (tripId) {
    console.log('[Progress] Starting real-time progress polling for trip:', tripId);
    pollProgress(tripId);
  } else {
    // Fall back to animated progress
    console.log('[Progress] Using animated progress (no trip ID)');
    showAnimatedProgress(theme);
  }
}

/**
 * Poll server for real progress updates
 * @param {string} tripId - Trip ID to poll
 */
function pollProgress(tripId) {
  // Stop any existing polling
  if (progressPollInterval) {
    clearInterval(progressPollInterval);
  }

  // Poll every 1 second
  progressPollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/trips/${tripId}/progress`);
      if (!response.ok) {
        console.warn('[Progress] Failed to fetch progress, falling back to animation');
        clearInterval(progressPollInterval);
        return;
      }

      const data = await response.json();
      updateProgressUI(data.step, data.message, data.percent);

      // If complete, stop polling
      if (data.complete) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
      }
    } catch (error) {
      console.error('[Progress] Error polling progress:', error);
    }
  }, 1000);
}

/**
 * Update progress UI with real data
 * @param {string} step - Current step (e.g., "intake", "research", "options")
 * @param {string} message - Progress message
 * @param {number} percent - Progress percentage (0-100)
 */
function updateProgressUI(step, message, percent) {
  const messageEl = document.getElementById('progressMessage');
  const fillEl = document.getElementById('progressFill');

  if (messageEl) messageEl.textContent = message;
  if (fillEl) fillEl.style.width = percent + '%';
}

/**
 * Show animated progress (fallback when no trip ID)
 * @param {string} theme - Theme name
 */
function showAnimatedProgress(theme) {
  const steps = PROGRESS_STEPS[theme] || PROGRESS_STEPS.heritage;
  let currentStep = 0;

  function advance() {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    updateProgressUI('animated', step.message, step.percent);

    currentStep++;
    if (currentStep < steps.length) {
      currentProgressTimeout = setTimeout(advance, step.duration);
    }
  }

  advance();
}

/**
 * Hide progress overlay and reset state
 */
export function hideProgress() {
  if (currentProgressTimeout) {
    clearTimeout(currentProgressTimeout);
    currentProgressTimeout = null;
  }

  if (progressPollInterval) {
    clearInterval(progressPollInterval);
    progressPollInterval = null;
  }

  const overlay = document.getElementById('progressOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  // Reset for next use
  const fillEl = document.getElementById('progressFill');
  const messageEl = document.getElementById('progressMessage');

  if (fillEl) fillEl.style.width = '0%';
  if (messageEl) messageEl.textContent = '';
  currentTripId = null;
}
