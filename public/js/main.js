// Main application coordinator - imports and wires up all modules

import { initThemeSelector as initOldThemeSelector } from './theme.js';
import { initThemeSelector } from './theme-selector.js';
import { initLocationDetection } from './location.js';
import { initFileUpload } from './files.js';
import { doResearchOnly } from './research.js';
import { setupCollapsibleSection, toggleDiagnostics } from './ui.js';
import { resetPreviousResults } from './trips.js';
import { loadBranding } from './branding.js';
import { showProgress, hideProgress } from './progress.js';
import { initCompactThemeSelector } from './compact-theme-selector.js';

// Initialize on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  // Load branding first (for white-label support)
  await loadBranding();

  // Initialize compact theme selector (new UI)
  initCompactThemeSelector();

  // Initialize location detection
  initLocationDetection();

  // Initialize dynamic theme selector (database-driven)
  initThemeSelector();

  // Initialize old theme form handler with change callback
  initOldThemeSelector((newTheme, oldTheme) => {
    // If changing themes and there are existing results, clear them
    if (window.currentTripId) {
      console.log(`[THEME CHANGE] Switching from ${oldTheme} to ${newTheme}, clearing results`);
      resetPreviousResults();
    }
  });

  // Listen for theme changes from dynamic selector
  window.addEventListener('themeChanged', (e) => {
    const { themeId } = e.detail;
    if (window.currentTripId) {
      console.log(`[THEME CHANGE] Switching to ${themeId}, clearing results`);
      resetPreviousResults();
    }
  });

  // Initialize file upload
  initFileUpload();

  // Generate button - works with both quick search and detailed form
  const generateBtn = document.getElementById('generateBtn');
  const quickSearchInput = document.getElementById('quickSearch');

  // Expose generateTrip globally for onclick handler (initial research)
  window.generateTrip = () => {
    const quickSearch = quickSearchInput?.value.trim() || '';
    const surnames = document.getElementById('surnames')?.value.trim() || '';

    if (!quickSearch && !surnames) {
      alert('Please enter trip details using quick search or customize section');
      if (quickSearchInput) {
        quickSearchInput.focus();
      }
      return;
    }

    // Do research first, which will then enable "Generate Trip Options" button
    doResearchOnly();
  };

  // Expose generateFullTrip for the second step (after research)
  window.generateFullTrip = async () => {
    console.log('[Generate Full Trip] Starting trip generation...');

    const formData = new FormData();
    const selectedTheme = document.getElementById('selectedTheme')?.value || 'heritage';
    formData.append('theme', selectedTheme);

    const textInput = window.buildTextInput ? buildTextInput() : '';
    formData.append('text', textInput);

    // Add any uploaded files
    const selectedFiles = window.selectedFiles || [];
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    try {
      showProgress(selectedTheme);

      const response = await fetch('/api/trips', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Trip generation failed');
      }

      const data = await response.json();
      hideProgress();

      console.log('[Generate Full Trip] Success:', data);

      // Store trip ID
      if (data.id || data.tripId) {
        window.currentTripId = data.id || data.tripId;
      }

      // Display research summary if present
      if (data.diagnostics && data.diagnostics.research && data.diagnostics.research.length > 0) {
        if (window.displayResearchSummary) {
          displayResearchSummary(data.diagnostics.research);
        }
      }

      // Display trip options
      if (window.displayTripOptions) {
        displayTripOptions(data);
      } else {
        alert('Trip generated! ID: ' + (data.id || data.tripId) + '\n\nTrip display UI coming next...');
      }

    } catch (error) {
      hideProgress();
      console.error('[Generate Full Trip] Error:', error);
      alert('Failed to generate trip: ' + error.message);
    }
  };

  // Note: Collapsible sections now use native <details>/<summary> HTML elements
});

// Expose functions globally for onclick handlers
window.toggleDiagnostics = toggleDiagnostics;

// Import and expose traveler intake functions
import { showTravelerIntake } from './traveler-intake.js';
window.showTravelerIntake = showTravelerIntake;
