// Main application coordinator - imports and wires up all modules

import { initThemeSelector } from './theme.js';
import { initLocationDetection } from './location.js';
import { initFileUpload } from './files.js';
import { doResearchOnly } from './research.js';
import { setupCollapsibleSection, toggleDiagnostics } from './ui.js';
import { resetPreviousResults } from './trips.js';

// Initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  // Initialize location detection
  initLocationDetection();

  // Initialize theme selector with change callback
  initThemeSelector((newTheme, oldTheme) => {
    // If changing themes and there are existing results, clear them
    if (window.currentTripId) {
      console.log(`[THEME CHANGE] Switching from ${oldTheme} to ${newTheme}, clearing results`);
      resetPreviousResults();
    }
  });

  // Initialize file upload
  initFileUpload();

  // Quick start button
  const quickStartBtn = document.getElementById('quickStartBtn');
  const quickStartInput = document.getElementById('quickStartInput');

  quickStartBtn?.addEventListener('click', () => {
    const input = quickStartInput.value.trim();
    if (!input) {
      alert('Please enter some details for your trip');
      quickStartInput.focus();
      return;
    }

    // Do research first, then enable full trip generation
    doResearchOnly();
  });

  // Collapsible sections
  setupCollapsibleSection('formCollapseHeader', 'quickTunerForm');
  setupCollapsibleSection('uploadCollapseHeader', 'uploadContent');
});

// Expose toggleDiagnostics globally for onclick handler
window.toggleDiagnostics = toggleDiagnostics;
