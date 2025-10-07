// Research-only flow (intake + web search)

import { getSelectedTheme, VALIDATION_MESSAGES } from './theme.js';
import { selectedFiles } from './files.js';
import { showError, hideError, showSuccess, hideSuccess, addProgressLog, showProgressStep, collapseCustomizeSections } from './ui.js';
import { buildTextInput, displayResearchSummary } from './trips.js';
import { showProgress, hideProgress } from './progress.js';

export async function doResearchOnly() {
  const selectedTheme = getSelectedTheme();
  const quickSearchInput = document.getElementById('quickSearch')?.value.trim() || '';
  const surnames = document.getElementById('surnames').value.trim();

  if (!surnames && !quickSearchInput) {
    showError(VALIDATION_MESSAGES[selectedTheme] || 'Please enter trip details');
    return;
  }

  // Clear previous results
  window.resetPreviousResults();

  const formData = new FormData();
  formData.append('theme', selectedTheme);

  const textInput = buildTextInput();
  formData.append('text', textInput);

  selectedFiles.forEach(file => {
    formData.append('files', file);
  });

  // Show new progress overlay
  showProgress(selectedTheme);

  // Show loading (old style for backwards compatibility)
  document.getElementById('loading')?.classList.remove('hidden');
  const quickStartBtn = document.getElementById('quickStartBtn');
  if (quickStartBtn) quickStartBtn.disabled = true;
  hideError();
  hideSuccess();

  collapseCustomizeSections();

  // Theme-aware progress messages
  const progressMessages = {
    heritage: {
      step2: 'Analyzing your family history...',
      step3: 'Researching surname origins...'
    },
    tvmovie: {
      step2: 'Analyzing show/movie preferences...',
      step3: 'Researching filming locations...'
    },
    historical: {
      step2: 'Analyzing historical events...',
      step3: 'Researching historical sites...'
    },
    culinary: {
      step2: 'Analyzing cuisine preferences...',
      step3: 'Researching food destinations...'
    },
    adventure: {
      step2: 'Analyzing adventure goals...',
      step3: 'Researching destinations...'
    }
  };

  const messages = progressMessages[selectedTheme] || progressMessages.heritage;

  addProgressLog('Starting research...', 'info');
  showProgressStep(1);
  setTimeout(() => {
    showProgressStep(2);
    addProgressLog(messages.step2, 'info');
  }, 300);
  setTimeout(() => {
    showProgressStep(3);
    addProgressLog(messages.step3, 'info');
  }, 800);

  const startTime = Date.now();

  try {
    addProgressLog(`Sending research request...`, 'info');

    const response = await fetch('/api/research', {
      method: 'POST',
      body: formData
    });

    addProgressLog(`Received response (${response.status})`, response.ok ? 'success' : 'error');

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Research failed');
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    addProgressLog(`Research completed in ${(duration / 1000).toFixed(1)}s`, 'success');

    // Store trip ID if available
    if (data.id) {
      window.currentTripId = data.id;
      console.log('[Research] Trip ID stored:', data.id);
    }

    // Display research results
    if (data.research && data.research.length > 0) {
      const researchStep = data.research.find(step =>
        step.step === 'surname_research' ||
        step.step === 'filming_location_research' ||
        step.step === 'historical_research' ||
        step.step === 'culinary_research' ||
        step.step === 'adventure_research'
      );

      if (researchStep && researchStep.summary) {
        addProgressLog('Displaying research findings...', 'success');
        displayResearchSummary(data.research);
      }
    }

    // Hide loading spinner
    document.getElementById('loading')?.classList.add('hidden');

    // Hide progress overlay
    hideProgress();

    // Show the Generate Trip Options button
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.style.display = 'block';
      generateBtn.textContent = '✨ Generate Trip Options';
      generateBtn.onclick = () => window.generateFullTrip();
      generateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Show success message
    showSuccess('✓ Research complete! Review the findings above, then click "Generate Trip Options" to see itineraries and costs.');

    addProgressLog('Ready to generate full trip', 'success');

  } catch (error) {
    console.error('[Research] Error:', error);
    document.getElementById('loading')?.classList.add('hidden');
    const quickStartBtn = document.getElementById('quickStartBtn');
    if (quickStartBtn) quickStartBtn.disabled = false;

    // Hide progress overlay on error
    hideProgress();

    showError(error.message || 'Research failed');
    addProgressLog(`Error: ${error.message}`, 'error');
  }
}
