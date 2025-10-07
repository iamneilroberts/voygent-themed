/**
 * Progress Overlay Controller
 * Shows/hides progress indicator with theme-specific messages
 */

import { PROGRESS_STEPS } from './progress-steps.js';

let currentProgressTimeout = null;

/**
 * Show progress overlay with theme-specific animation
 * @param {string} theme - Theme name (heritage, tvmovie, etc.)
 */
export function showProgress(theme) {
  const overlay = document.getElementById('progressOverlay');
  if (!overlay) {
    console.warn('[Progress] Progress overlay element not found');
    return;
  }

  overlay.classList.remove('hidden');

  const steps = PROGRESS_STEPS[theme] || PROGRESS_STEPS.heritage;
  let currentStep = 0;

  function advance() {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    const messageEl = document.getElementById('progressMessage');
    const fillEl = document.getElementById('progressFill');

    if (messageEl) messageEl.textContent = step.message;
    if (fillEl) fillEl.style.width = step.percent + '%';

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

  const overlay = document.getElementById('progressOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  // Reset for next use
  const fillEl = document.getElementById('progressFill');
  const messageEl = document.getElementById('progressMessage');

  if (fillEl) fillEl.style.width = '0%';
  if (messageEl) messageEl.textContent = '';
}
