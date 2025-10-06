// Voygent Heritage Frontend
let selectedFiles = [];
let currentTripId = null;
let selectedOptionKey = null;
let selectedVariant = null;
let diagnosticsEnabled = false;
let diagnosticsLog = [];

// Geolocation and airport detection
document.getElementById('detectLocationBtn')?.addEventListener('click', detectUserLocation);

// Auto-detect location on page load (silent fallback to ATL)
window.addEventListener('DOMContentLoaded', () => {
  const airportInput = document.getElementById('airport');

  // Set default to ATL
  airportInput.value = 'ATL';

  // Try to detect user location silently (no prompts if denied)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const airport = getNearestAirport(latitude, longitude);
        airportInput.value = airport.code;
        airportInput.placeholder = `Detected: ${airport.name}`;
      },
      () => {
        // Silently fail - keep ATL default
        airportInput.placeholder = 'Default: Atlanta (ATL)';
      },
      { timeout: 5000, enableHighAccuracy: false }
    );
  }

  // Theme selector
  const themeCards = document.querySelectorAll('.theme-card');
  const selectedThemeInput = document.getElementById('selectedTheme');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const quickStartInput = document.getElementById('quickStartInput');

  const themeData = {
    heritage: {
      title: 'Follow Your Family Roots',
      subtitle: 'Enter your surname and we\'ll create a personalized heritage trip in seconds',
      placeholder: 'Enter your surname (e.g., McElroy)'
    },
    tvmovie: {
      title: 'Visit Your Favorite Film Locations',
      subtitle: 'Enter a TV show or movie and we\'ll plan your ultimate fan trip',
      placeholder: 'Enter show/movie (e.g., Game of Thrones)'
    },
    historical: {
      title: 'Walk Through History',
      subtitle: 'Enter a historical event or period you\'d like to explore',
      placeholder: 'Enter event (e.g., D-Day Normandy)'
    },
    culinary: {
      title: 'Explore World Cuisines',
      subtitle: 'Enter a cuisine or region you\'d like to discover',
      placeholder: 'Enter cuisine (e.g., Italian, Tuscany)'
    },
    adventure: {
      title: 'Plan Your Next Adventure',
      subtitle: 'Enter your dream destination or activity',
      placeholder: 'Enter location (e.g., Patagonia hiking)'
    }
  };

  // Theme-specific form field configurations
  const themeFormFields = {
    heritage: {
      field1: { label: 'Family Surnames *', placeholder: 'e.g., McLeod, Roberts', id: 'surnames' },
      field2: { label: 'Suspected Origins', placeholder: 'Unknown - AI will guess from surname', id: 'origins' }
    },
    tvmovie: {
      field1: { label: 'TV Shows / Movies *', placeholder: 'e.g., Game of Thrones, Breaking Bad', id: 'surnames' },
      field2: { label: 'Specific Locations', placeholder: 'e.g., Winterfell, Albuquerque', id: 'origins' }
    },
    historical: {
      field1: { label: 'Historical Events *', placeholder: 'e.g., D-Day, Battle of Waterloo', id: 'surnames' },
      field2: { label: 'Time Period', placeholder: 'e.g., WWII, Napoleonic Era', id: 'origins' }
    },
    culinary: {
      field1: { label: 'Cuisines *', placeholder: 'e.g., Italian, French, Japanese', id: 'surnames' },
      field2: { label: 'Regions', placeholder: 'e.g., Tuscany, Provence, Kyoto', id: 'origins' }
    },
    adventure: {
      field1: { label: 'Activities *', placeholder: 'e.g., Hiking, Safari, Kayaking', id: 'surnames' },
      field2: { label: 'Destinations', placeholder: 'e.g., Patagonia, Swiss Alps', id: 'origins' }
    }
  };

  function updateFormFieldsForTheme(theme) {
    const fields = themeFormFields[theme] || themeFormFields.heritage;

    // Update field 1
    document.getElementById('field1Label').textContent = fields.field1.label;
    document.getElementById('surnames').placeholder = fields.field1.placeholder;
    document.getElementById('surnames').value = '';

    // Update field 2
    document.getElementById('field2Label').textContent = fields.field2.label;
    document.getElementById('origins').placeholder = fields.field2.placeholder;
    document.getElementById('origins').value = '';
  }

  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const theme = card.dataset.theme;
      const previousTheme = selectedThemeInput.value;

      // If changing themes and there are existing results, clear them
      if (previousTheme !== theme && currentTripId) {
        console.log(`[THEME CHANGE] Switching from ${previousTheme} to ${theme}, clearing results`);
        resetPreviousResults();
      }

      // Remove selection from all cards
      themeCards.forEach(c => c.style.borderColor = 'transparent');

      // Mark this card as selected
      card.style.borderColor = '#667eea';

      // Update selected theme
      selectedThemeInput.value = theme;

      // Update hero section
      const data = themeData[theme];
      heroTitle.textContent = data.title;
      heroSubtitle.textContent = data.subtitle;
      quickStartInput.placeholder = data.placeholder;
      quickStartInput.value = ''; // Clear input when switching themes

      // Update form fields for this theme
      updateFormFieldsForTheme(theme);
    });
  });

  // Select heritage by default
  document.querySelector('[data-theme="heritage"]')?.click();

  // Quick start button
  const quickStartBtn = document.getElementById('quickStartBtn');

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

function setupCollapsibleSection(headerId, contentId) {
  const header = document.getElementById(headerId);
  const content = document.getElementById(contentId);

  if (!header || !content) return;

  const toggle = header.querySelector('.collapse-toggle');

  header.addEventListener('click', () => {
    const isCollapsed = content.classList.contains('collapsed');

    if (isCollapsed) {
      content.classList.remove('collapsed');
      toggle.classList.remove('collapsed');
    } else {
      content.classList.add('collapsed');
      toggle.classList.add('collapsed');
    }
  });
}

function collapseCustomizeSections() {
  const formContent = document.getElementById('quickTunerForm');
  const uploadContent = document.getElementById('uploadContent');
  const formToggle = document.querySelector('#formCollapseHeader .collapse-toggle');
  const uploadToggle = document.querySelector('#uploadCollapseHeader .collapse-toggle');

  if (formContent && !formContent.classList.contains('collapsed')) {
    formContent.classList.add('collapsed');
    formToggle?.classList.add('collapsed');
  }

  if (uploadContent && !uploadContent.classList.contains('collapsed')) {
    uploadContent.classList.add('collapsed');
    uploadToggle?.classList.add('collapsed');
  }
}

function showProgressStep(stepNumber) {
  const step = document.getElementById(`step${stepNumber}`);
  if (!step) return;

  // Mark previous step as completed
  if (stepNumber > 1) {
    const prevStep = document.getElementById(`step${stepNumber - 1}`);
    if (prevStep) {
      prevStep.classList.add('completed');
    }
  }

  // Show current step
  step.classList.remove('hidden');
}

function resetProgressSteps() {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`step${i}`);
    if (step) {
      step.classList.add('hidden');
      step.classList.remove('completed');
    }
  }

  // Reset progress log
  const progressLog = document.getElementById('progressLog');
  if (progressLog) {
    progressLog.innerHTML = '<div class="log-line">⏳ Initializing...</div>';
  }
}

function addProgressLog(message, type = 'info') {
  const progressLog = document.getElementById('progressLog');
  if (!progressLog) return;

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : '→';
  const color = type === 'success' ? '#0f0' : type === 'error' ? '#f44' : type === 'warning' ? '#fa0' : '#0f0';

  const logLine = document.createElement('div');
  logLine.className = 'log-line';
  logLine.style.color = color;
  logLine.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${icon} ${message}`;

  progressLog.appendChild(logLine);
  progressLog.scrollTop = progressLog.scrollHeight; // Auto-scroll to bottom
}

function detectUserLocation() {
  const btn = document.getElementById('detectLocationBtn');
  const status = document.getElementById('locationStatus');
  const airportInput = document.getElementById('airport');

  if (!navigator.geolocation) {
    status.textContent = 'Geolocation not supported by your browser';
    status.style.display = 'block';
    status.style.color = '#dc3545';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Detecting...';
  status.textContent = 'Requesting location permission...';
  status.style.display = 'block';
  status.style.color = '#666';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const airport = getNearestAirport(latitude, longitude);

      airportInput.value = airport.code;
      status.textContent = `Detected: ${airport.name} (${airport.code})`;
      status.style.color = '#28a745';

      btn.disabled = false;
      btn.textContent = '✓ Detected';
      setTimeout(() => {
        btn.textContent = '📍 Detect';
        status.style.display = 'none';
      }, 3000);
    },
    (error) => {
      let message = 'Unable to detect location';
      if (error.code === 1) message = 'Location permission denied';
      else if (error.code === 2) message = 'Location unavailable';
      else if (error.code === 3) message = 'Location request timed out';

      status.textContent = message;
      status.style.color = '#dc3545';
      btn.disabled = false;
      btn.textContent = '📍 Detect';

      setTimeout(() => status.style.display = 'none', 5000);
    },
    { timeout: 10000, enableHighAccuracy: false }
  );
}

function getNearestAirport(lat, lon) {
  // Major US airports with coordinates
  const airports = [
    { code: 'JFK', name: 'New York JFK', lat: 40.6413, lon: -73.7781 },
    { code: 'LAX', name: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
    { code: 'ORD', name: 'Chicago O\'Hare', lat: 41.9742, lon: -87.9073 },
    { code: 'DFW', name: 'Dallas/Fort Worth', lat: 32.8998, lon: -97.0403 },
    { code: 'ATL', name: 'Atlanta', lat: 33.6407, lon: -84.4277 },
    { code: 'DEN', name: 'Denver', lat: 39.8561, lon: -104.6737 },
    { code: 'SFO', name: 'San Francisco', lat: 37.6213, lon: -122.3790 },
    { code: 'SEA', name: 'Seattle', lat: 47.4502, lon: -122.3088 },
    { code: 'MIA', name: 'Miami', lat: 25.7959, lon: -80.2870 },
    { code: 'BOS', name: 'Boston', lat: 42.3656, lon: -71.0096 },
    { code: 'PHX', name: 'Phoenix', lat: 33.4352, lon: -112.0101 },
    { code: 'IAH', name: 'Houston', lat: 29.9902, lon: -95.3368 },
    { code: 'LAS', name: 'Las Vegas', lat: 36.0840, lon: -115.1537 },
    { code: 'MSP', name: 'Minneapolis', lat: 44.8848, lon: -93.2223 },
    { code: 'DTW', name: 'Detroit', lat: 42.2162, lon: -83.3554 },
    { code: 'PHL', name: 'Philadelphia', lat: 39.8744, lon: -75.2424 },
    { code: 'CLT', name: 'Charlotte', lat: 35.2144, lon: -80.9473 },
    { code: 'EWR', name: 'Newark', lat: 40.6895, lon: -74.1745 },
    { code: 'SLC', name: 'Salt Lake City', lat: 40.7899, lon: -111.9791 },
    { code: 'PDX', name: 'Portland', lat: 45.5898, lon: -122.5951 },
    // Major international airports
    { code: 'YYZ', name: 'Toronto', lat: 43.6777, lon: -79.6248 },
    { code: 'YVR', name: 'Vancouver', lat: 49.1967, lon: -123.1815 },
    { code: 'LHR', name: 'London Heathrow', lat: 51.4700, lon: -0.4543 },
    { code: 'CDG', name: 'Paris CDG', lat: 49.0097, lon: 2.5479 },
  ];

  // Calculate distance using Haversine formula
  function distance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  let nearest = airports[0];
  let minDist = distance(lat, lon, nearest.lat, nearest.lon);

  for (const airport of airports) {
    const dist = distance(lat, lon, airport.lat, airport.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = airport;
    }
  }

  return nearest;
}

// File upload handling
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');

uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
});

function handleFiles(files) {
  selectedFiles = [...selectedFiles, ...Array.from(files)];
  updateFileList();
}

function updateFileList() {
  fileList.innerHTML = selectedFiles
    .map((f, i) => `
      <div style="padding: 8px; background: #f0f0f0; margin: 5px 0; border-radius: 4px; display: flex; justify-content: space-between;">
        <span>📄 ${f.name} (${(f.size / 1024).toFixed(1)} KB)</span>
        <button onclick="removeFile(${i})" style="background: #dc3545; padding: 4px 12px; font-size: 0.8rem;">Remove</button>
      </div>
    `)
    .join('');
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  updateFileList();
}

// Diagnostics
function toggleDiagnostics() {
  diagnosticsEnabled = !diagnosticsEnabled;
  const diagDiv = document.getElementById('diagnostics');
  const toggleText = document.getElementById('diagToggleText');

  if (diagnosticsEnabled) {
    diagDiv.classList.remove('hidden');
    toggleText.textContent = '▼ Hide Diagnostics';
    updateDiagnosticsDisplay(); // Show existing logs
  } else {
    diagDiv.classList.add('hidden');
    toggleText.textContent = '▲ Show Diagnostics';
  }
}

function logDiagnostic(type, data) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, type, data };
  diagnosticsLog.push(entry);

  if (diagnosticsEnabled) {
    updateDiagnosticsDisplay();
  }
}

function updateDiagnosticsDisplay() {
  const logDiv = document.getElementById('diagnosticsLog');
  logDiv.innerHTML = diagnosticsLog.map(entry => {
    let content = '';
    const time = new Date(entry.timestamp).toLocaleTimeString();

    // Format AI calls specially if present
    if (entry.data.aiCalls && entry.data.aiCalls.length > 0) {
      const totalCost = entry.data.aiCalls.reduce((sum, call) => {
        return sum + parseFloat(call.cost.replace('$', ''));
      }, 0);

      content = `
        <div class="timestamp">[${time}]</div>
        <div><strong style="color: #4af;">${entry.type}</strong> - ${entry.data.endpoint}</div>
        <div style="margin-top: 8px;">
          <span class="provider">⏱ Duration: ${entry.data.duration}</span> |
          <span class="cost">💰 Total Cost: $${totalCost.toFixed(4)}</span> |
          <span class="tokens">🔢 ${entry.data.aiCalls.length} AI calls</span>
        </div>
        ${entry.data.aiCalls.map(call => `
          <div style="margin: 10px 0; padding: 8px; background: #1a1a1a; border-left: 3px solid #4a9eff;">
            <div style="font-weight: bold; color: #4af;">${call.step}</div>
            <div style="font-size: 0.9em; color: #aaa; margin-top: 4px;">
              <span class="provider">Provider: ${call.provider}</span> |
              <span class="provider">Model: ${call.model}</span>
            </div>
            ${call.tokensIn || call.tokensOut ? `
              <div style="font-size: 0.9em; margin-top: 4px;">
                <span class="tokens">Tokens: ${call.tokensIn}→${call.tokensOut}</span> |
                <span class="cost">Cost: ${call.cost}</span>
              </div>
            ` : ''}
            ${call.sources ? `
              <div style="margin-top: 6px; font-size: 0.85em;">
                <span style="color: #888;">Sources: ${call.sources.length}</span>
              </div>
            ` : ''}
            ${call.details ? `
              <details style="margin-top: 6px; cursor: pointer;">
                <summary style="color: #888; font-size: 0.85em;">View details</summary>
                <div style="margin-top: 6px; padding: 6px; background: #0a0a0a; font-size: 0.85em; max-height: 200px; overflow-y: auto;">
                  ${call.details}
                </div>
              </details>
            ` : ''}
          </div>
        `).join('')}
      `;
    } else {
      content = `
        <div class="timestamp">[${time}]</div>
        <div><strong style="color: #4af;">${entry.type}</strong></div>
        <div style="margin-top: 4px; font-size: 0.9em;">
          ${JSON.stringify(entry.data, null, 2).substring(0, 300)}
        </div>
      `;
    }

    return `<div class="log-entry">${content}</div>`;
  }).reverse().join('');
}

// Reset all previous results
function resetPreviousResults() {
  // Clear trip state
  currentTripId = null;
  selectedOptionKey = null;
  selectedVariant = null;

  // Hide all result sections
  document.getElementById('researchSummary')?.classList.add('hidden');
  document.getElementById('optionsSection')?.classList.add('hidden');
  document.getElementById('variantsSection')?.classList.add('hidden');
  document.getElementById('itinerarySection')?.classList.add('hidden');
  document.getElementById('chatSection')?.classList.add('hidden');

  // Clear content
  document.getElementById('optionsGrid').innerHTML = '';
  document.getElementById('variantsContainer').innerHTML = '';
  document.getElementById('itineraryContent').innerHTML = '';
  document.getElementById('researchContent').innerHTML = '';
  document.getElementById('researchSources').innerHTML = '';

  // Reset progress UI
  resetProgressSteps();

  console.log('[RESET] Cleared all previous trip results');
}

// Do research only (intake + web search), show results, enable Generate button
async function doResearchOnly() {
  const selectedTheme = document.getElementById('selectedTheme')?.value || 'heritage';
  const quickStartInput = document.getElementById('quickStartInput')?.value.trim() || '';
  const surnames = document.getElementById('surnames').value.trim();

  // Theme-specific validation messages
  const validationMessages = {
    heritage: 'Please enter at least one family surname',
    tvmovie: 'Please enter at least one TV show or movie',
    historical: 'Please enter at least one historical event',
    culinary: 'Please enter at least one cuisine type',
    adventure: 'Please enter at least one activity or destination'
  };

  if (!surnames && !quickStartInput) {
    showError(validationMessages[selectedTheme] || 'Please enter trip details');
    return;
  }

  // Clear previous results
  resetPreviousResults();

  const formData = new FormData();
  formData.append('theme', selectedTheme);

  const textInput = buildTextInput();
  formData.append('text', textInput);

  selectedFiles.forEach(file => {
    formData.append('files', file);
  });

  // Show loading
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('quickStartBtn').disabled = true;
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
    document.getElementById('loading').classList.add('hidden');

    // Enable the Generate Trip Options button
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = false;
    generateBtn.style.display = 'block';
    generateBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Show success message
    showSuccess('✓ Research complete! Review the findings above, then click "Generate Trip Options" to continue.');

    addProgressLog('Ready to generate trip options', 'success');

  } catch (error) {
    console.error('[Research] Error:', error);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('quickStartBtn').disabled = false;
    showError(error.message || 'Research failed');
    addProgressLog(`Error: ${error.message}`, 'error');
  }
}

// Generate trip
async function generateTrip() {
  // Get selected theme and quick start input
  const selectedTheme = document.getElementById('selectedTheme')?.value || 'heritage';
  const quickStartInput = document.getElementById('quickStartInput')?.value.trim() || '';
  const surnames = document.getElementById('surnames').value.trim();

  // Theme-specific validation messages
  const validationMessages = {
    heritage: 'Please enter at least one family surname',
    tvmovie: 'Please enter at least one TV show or movie',
    historical: 'Please enter at least one historical event',
    culinary: 'Please enter at least one cuisine type',
    adventure: 'Please enter at least one activity or destination'
  };

  // Theme-specific validation
  if (!surnames && !quickStartInput) {
    showError(validationMessages[selectedTheme] || 'Please enter trip details');
    return;
  }

  // Clear any previous results before starting new search
  resetPreviousResults();

  const formData = new FormData();

  // Add selected theme
  formData.append('theme', selectedTheme);

  // Build text input from form
  const textInput = buildTextInput();
  formData.append('text', textInput);

  // Add files
  selectedFiles.forEach(file => {
    formData.append('files', file);
  });

  // Show loading
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('generateBtn').disabled = true;
  hideError();
  hideSuccess();

  // Collapse customize sections to make research prominent
  collapseCustomizeSections();

  // Theme-aware progress messages
  const progressMessages = {
    heritage: {
      step2: 'Step 1: Analyzing your family history input...',
      step3: 'Step 2: Researching surname origins...',
      step4: 'Step 3: AI analyzing heritage connections...'
    },
    tvmovie: {
      step2: 'Step 1: Analyzing your show/movie preferences...',
      step3: 'Step 2: Researching filming locations...',
      step4: 'Step 3: AI finding best locations to visit...'
    },
    historical: {
      step2: 'Step 1: Analyzing historical event details...',
      step3: 'Step 2: Researching historical sites...',
      step4: 'Step 3: AI planning historical tour...'
    },
    culinary: {
      step2: 'Step 1: Analyzing cuisine preferences...',
      step3: 'Step 2: Researching food destinations...',
      step4: 'Step 3: AI planning culinary experience...'
    },
    adventure: {
      step2: 'Step 1: Analyzing adventure goals...',
      step3: 'Step 2: Researching destinations...',
      step4: 'Step 3: AI planning adventure itinerary...'
    }
  };

  const messages = progressMessages[selectedTheme] || progressMessages.heritage;

  // Show progress steps sequentially
  addProgressLog('Initializing trip generation...', 'info');
  showProgressStep(1);
  setTimeout(() => {
    showProgressStep(2);
    addProgressLog(messages.step2, 'info');
  }, 500);
  setTimeout(() => {
    showProgressStep(3);
    addProgressLog(messages.step3, 'info');
  }, 1500);
  setTimeout(() => {
    showProgressStep(4);
    addProgressLog(messages.step4, 'info');
  }, 3000);

  const startTime = Date.now();

  try {
    addProgressLog(`Sending request with ${textInput.length} chars, ${selectedFiles.length} files`, 'info');

    logDiagnostic('REQUEST', {
      endpoint: 'POST /api/trips',
      input: textInput.substring(0, 200) + '...',
      files: selectedFiles.map(f => f.name)
    });

    const response = await fetch('/api/trips', {
      method: 'POST',
      body: formData
    });

    addProgressLog(`Received response (${response.status})`, response.ok ? 'success' : 'error');

    const data = await response.json();
    const duration = Date.now() - startTime;

    addProgressLog(`Total processing time: ${(duration / 1000).toFixed(1)}s`, 'success');

    // Build AI calls array including research steps
    const aiCalls = [];

    // Add research steps if present
    if (data.diagnostics?.research) {
      addProgressLog(`Research: Found ${data.diagnostics.research.length} steps`, 'info');

      data.diagnostics.research.forEach(step => {
        const researchStepNames = {
          surname_research: '🔍 Heritage Research',
          filming_location_research: '🎬 Filming Location Research',
          historical_research: '⚔️ Historical Research',
          culinary_research: '🍴 Culinary Research',
          adventure_research: '🏔️ Adventure Research'
        };

        if (researchStepNames[step.step]) {
          addProgressLog(`Web search: ${step.query}`, 'info');
          addProgressLog(`Found ${step.sources?.length || 0} sources`, 'success');

          aiCalls.push({
            step: researchStepNames[step.step],
            provider: 'Web Search',
            model: step.query,
            tokensIn: 0,
            tokensOut: 0,
            cost: '$0.0000',
            details: step.summary || step.error,
            sources: step.sources
          });
        } else if (step.step === 'ai_reasoning') {
          addProgressLog(`AI analysis: ${step.tokens || 0} tokens, $${(step.cost || 0).toFixed(4)}`, 'success');

          aiCalls.push({
            step: '🤔 AI Analysis',
            provider: 'AI',
            model: 'genealogy-expert',
            tokensIn: 0,
            tokensOut: step.tokens || 0,
            cost: `$${(step.cost || 0).toFixed(4)}`,
            details: step.analysis
          });
        }
      });
    }

    // Add standard AI calls
    if (data.diagnostics?.intake) {
      addProgressLog(`Intake: ${data.diagnostics.intake.provider} (${data.diagnostics.intake.model})`, 'info');
      addProgressLog(`Tokens: ${data.diagnostics.intake.tokensIn}→${data.diagnostics.intake.tokensOut}, Cost: $${data.diagnostics.intake.costUsd.toFixed(4)}`, 'success');

      aiCalls.push({
        step: 'Intake Normalization',
        provider: data.diagnostics.intake.provider,
        model: data.diagnostics.intake.model,
        tokensIn: data.diagnostics.intake.tokensIn,
        tokensOut: data.diagnostics.intake.tokensOut,
        cost: `$${data.diagnostics.intake.costUsd.toFixed(4)}`
      });
    }

    if (data.diagnostics?.options) {
      addProgressLog(`Options: ${data.diagnostics.options.provider} (${data.diagnostics.options.model})`, 'info');
      addProgressLog(`Generated ${data.options?.length || 0} trip options`, 'success');
      addProgressLog(`Tokens: ${data.diagnostics.options.tokensIn}→${data.diagnostics.options.tokensOut}, Cost: $${data.diagnostics.options.costUsd.toFixed(4)}`, 'success');

      aiCalls.push({
        step: 'Options Generation',
        provider: data.diagnostics.options.provider,
        model: data.diagnostics.options.model,
        tokensIn: data.diagnostics.options.tokensIn,
        tokensOut: data.diagnostics.options.tokensOut,
        cost: `$${data.diagnostics.options.costUsd.toFixed(4)}`
      });
    }

    // Log total cost
    if (data.diagnostics?.totalCost) {
      addProgressLog(`Total cost: $${data.diagnostics.totalCost.toFixed(4)}`, 'success');
    }

    logDiagnostic('RESPONSE', {
      endpoint: 'POST /api/trips',
      status: response.status,
      duration: `${duration}ms`,
      tripId: data.tripId,
      hasIntake: !!data.intake,
      optionsCount: data.options?.length || 0,
      aiCalls: aiCalls
    });

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate trip');
    }

    currentTripId = data.tripId;

    // Display research summary if available
    if (data.diagnostics?.research) {
      displayResearchSummary(data.diagnostics.research);
    }

    displayOptions(data.options);
    showSuccess(`Trip ${currentTripId} created! Select your preferred option below.`);

    // Enable chat after options are displayed
    document.getElementById('chatSection').classList.remove('hidden');
    addChatMessage('assistant', 'I\'ve created some trip options for you! Select one above, or ask me to modify them.');

  } catch (error) {
    logDiagnostic('ERROR', {
      endpoint: 'POST /api/trips',
      error: error.message
    });
    showError(error.message);
  } finally {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('generateBtn').disabled = false;
    resetProgressSteps();
  }
}

function displayResearchSummary(researchSteps) {
  if (!researchSteps || researchSteps.length === 0) {
    console.log('[Research Display] No research steps to display');
    return;
  }

  const summaryDiv = document.getElementById('researchSummary');
  const contentDiv = document.getElementById('researchContent');
  const sourcesDiv = document.getElementById('researchSources');

  console.log('[Research Display] Processing research steps:', researchSteps);

  // Find different types of research steps
  const aiReasoning = researchSteps.find(step => step.step === 'ai_reasoning');
  const webSearch = researchSteps.find(step =>
    step.step === 'surname_research' ||
    step.step === 'filming_location_research' ||
    step.step === 'historical_research' ||
    step.step === 'culinary_research' ||
    step.step === 'adventure_research'
  );

  console.log('[Research Display] AI Reasoning:', aiReasoning ? 'Found' : 'Not found');
  console.log('[Research Display] Web Search:', webSearch ? 'Found' : 'Not found');

  // Display web search summary (available for all themes)
  if (webSearch && webSearch.summary) {
    let formattedHTML = `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #667eea; margin-bottom: 10px;">🔍 Research Summary</h3>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #667eea;">
          ${webSearch.summary.split('\n\n').map(para => `<p style="margin-bottom: 10px;">${para}</p>`).join('')}
        </div>
      </div>
    `;

    // Add AI reasoning if available (currently only for heritage)
    if (aiReasoning && aiReasoning.analysis) {
      const analysis = aiReasoning.analysis;
      const sections = analysis.split(/\d+\.\s+/).filter(s => s.trim());

      if (sections.length > 1) {
        formattedHTML += `
          <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">💡 AI Analysis</h3>
            ${sections.map((section, idx) => {
              if (idx === 0 && section.length < 100) {
                return `<p style="margin-bottom: 15px;"><strong>${section.trim()}</strong></p>`;
              }
              return `
                <div style="margin-bottom: 15px; padding-left: 20px; border-left: 3px solid #667eea;">
                  <strong style="color: #667eea;">${idx === 0 ? 'Key Finding' : `Point ${idx}`}:</strong>
                  <span style="margin-left: 10px;">${section.trim()}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        formattedHTML += `
          <div style="margin-top: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">💡 AI Analysis</h3>
            <p>${analysis}</p>
          </div>
        `;
      }
    }

    contentDiv.innerHTML = formattedHTML;

    // Add web search sources if available
    if (webSearch.sources && webSearch.sources.length > 0) {
      sourcesDiv.innerHTML = `
        <p style="margin-bottom: 10px; font-weight: 600;">Sources:</p>
        <ul style="list-style: none; padding: 0;">
          ${webSearch.sources.map(url => `
            <li style="margin: 8px 0;">
              <a href="${url}" target="_blank" style="color: #667eea; text-decoration: none; display: flex; align-items: center; gap: 8px;">
                🔗 ${new URL(url).hostname}
              </a>
            </li>
          `).join('')}
        </ul>
      `;
    } else {
      sourcesDiv.innerHTML = '';
    }

    // Show the summary and scroll to it
    summaryDiv.classList.remove('hidden');
    addProgressLog('Research summary displayed', 'success');
    setTimeout(() => {
      summaryDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  } else {
    console.log('[Research Display] No summary content found');
  }
}

function buildTextInput() {
  const selectedTheme = document.getElementById('selectedTheme')?.value || 'heritage';
  const quickStartInput = document.getElementById('quickStartInput')?.value.trim() || '';
  const surnames = document.getElementById('surnames').value.trim();
  const origins = document.getElementById('origins').value.trim();
  const adults = parseInt(document.getElementById('adults').value) || 2;
  const children = document.getElementById('children').value.trim();
  const duration = document.getElementById('duration').value.trim();
  const month = document.getElementById('month').value;
  const luxury = document.getElementById('luxury').value;
  const activity = document.getElementById('activity').value;
  const travelPace = document.getElementById('travel_pace').value;
  const airport = document.getElementById('airport').value.trim();
  const transportPref = document.getElementById('transport_pref').value;
  const hotelType = document.getElementById('hotel_type').value;
  const notes = document.getElementById('notes').value.trim();

  let text = '';

  // Start with quick start input if provided
  if (quickStartInput) {
    text += `${quickStartInput}\n\n`;
  }

  // Add heritage-specific fields if surnames provided
  if (surnames) {
    text += `Family surnames: ${surnames}\n`;
  }
  if (origins) text += `Suspected origins: ${origins}\n`;

  // Party information
  text += `Party: ${adults} adult(s)`;
  if (children) text += `, children ages: ${children}`;
  text += `\n`;

  // Trip details
  if (duration) text += `Duration: ${duration} days\n`;
  if (month) text += `Target month: ${month}\n`;
  if (airport) text += `Departure airport: ${airport}\n`;
  text += `Transport preference: ${transportPref}\n`;
  text += `Travel pace: ${travelPace}\n`;
  text += `Hotel type: ${hotelType}\n`;
  text += `Luxury level: ${luxury}\n`;
  text += `Activity level: ${activity}\n`;
  if (notes) text += `\nAdditional notes:\n${notes}\n`;

  return text;
}

function displayOptions(options) {
  const optionsArray = options.options || options;
  const grid = document.getElementById('optionsGrid');

  grid.innerHTML = optionsArray.map(opt => `
    <div class="option-card" data-key="${opt.key}" onclick="selectOption('${opt.key}')">
      <h3>Option ${opt.key}: ${opt.title}</h3>
      <p class="why">${opt.whyOverall}</p>
      <div class="days">
        ${opt.days.length} days: ${opt.days.slice(0, 3).map(d => d.city).join(' → ')}${opt.days.length > 3 ? '...' : ''}
      </div>
      ${opt.splurges && opt.splurges.length ? `<p style="margin-top: 10px; font-size: 0.85rem; color: #667eea;">💎 ${opt.splurges.join(', ')}</p>` : ''}
    </div>
  `).join('');

  document.getElementById('optionsSection').classList.remove('hidden');
}

function selectOption(key) {
  selectedOptionKey = key;

  // Update UI
  document.querySelectorAll('.option-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.key === key);
  });

  document.getElementById('confirmBtn').classList.remove('hidden');
}

// Display hotels for each city (T034/T039)
let selectedHotels = [];

function displayHotels(hotelsPerCity) {
  const container = document.getElementById('hotelsContainer') || createHotelsContainer();

  container.innerHTML = `
    <h2 style="margin-bottom: 20px;">Select Hotels for Each City</h2>
    ${hotelsPerCity.map(cityHotels => renderCityHotels(cityHotels)).join('')}
    <button onclick="confirmHotelSelection()" style="margin-top: 20px; background: #667eea; color: white; padding: 15px 30px; border: none; border-radius: 8px; font-size: 1rem; cursor: pointer;">
      Confirm Hotel Selection
    </button>
  `;

  container.classList.remove('hidden');
  container.scrollIntoView({ behavior: 'smooth' });
}

function createHotelsContainer() {
  const container = document.createElement('div');
  container.id = 'hotelsContainer';
  container.style.cssText = 'margin: 30px 0; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);';

  const variantsSection = document.getElementById('variantsSection');
  variantsSection.parentNode.insertBefore(container, variantsSection);

  return container;
}

function renderCityHotels(cityHotels) {
  const { city, hotels, error } = cityHotels;

  if (error || !hotels || hotels.length === 0) {
    return `
      <div style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
        <h3>${city}</h3>
        <p style="color: #888;">${error || 'No hotels available - travel professional will provide options'}</p>
      </div>
    `;
  }

  return `
    <div style="margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
      <h3 style="margin-bottom: 15px;">${city}</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
        ${hotels.map(hotel => renderHotelCard(city, hotel)).join('')}
      </div>
    </div>
  `;
}

function renderHotelCard(city, hotel) {
  const stars = '⭐'.repeat(hotel.star_rating || 3);
  const price = hotel.nightly_price_low && hotel.nightly_price_high
    ? `$${hotel.nightly_price_low}-$${hotel.nightly_price_high}/night`
    : 'Price upon request';

  return `
    <div class="hotel-card" data-city="${city}" data-hotel-id="${hotel.hotel_id}"
         onclick="selectHotel('${city}', '${hotel.hotel_id}')"
         style="padding: 15px; background: white; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; transition: all 0.2s;">
      <h4 style="margin: 0 0 10px 0; font-size: 1rem;">${hotel.name}</h4>
      <div style="font-size: 0.9rem; color: #667eea; margin-bottom: 5px;">${stars}</div>
      <div style="font-size: 0.9rem; font-weight: 600; color: #28a745;">${price}</div>
      <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">${hotel.budget_tier || 'comfort'}</div>
      ${hotel.provider ? `<div style="font-size: 0.75rem; color: #aaa; margin-top: 5px;">via ${hotel.provider}</div>` : ''}
    </div>
  `;
}

function selectHotel(city, hotelId) {
  // Remove previous selection for this city
  selectedHotels = selectedHotels.filter(h => h.city !== city);

  // Add new selection
  selectedHotels.push({ city, hotel_id: hotelId });

  // Update UI
  document.querySelectorAll(`.hotel-card[data-city="${city}"]`).forEach(card => {
    if (card.dataset.hotelId === hotelId) {
      card.style.border = '3px solid #667eea';
      card.style.background = '#f0f4ff';
    } else {
      card.style.border = '2px solid #e0e0e0';
      card.style.background = 'white';
    }
  });
}

async function confirmHotelSelection() {
  if (!currentTripId || selectedHotels.length === 0) {
    showError('Please select at least one hotel');
    return;
  }

  try {
    // Send hotel selection to backend (T036)
    const response = await fetch(`/api/trips/${currentTripId}/select`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedHotels })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error);

    addChatMessage('assistant', `Great! I've saved your hotel selections. ${selectedHotels.length} hotel(s) confirmed.`);

    // Hide hotel selection UI
    document.getElementById('hotelsContainer').classList.add('hidden');
  } catch (error) {
    showError(`Failed to save hotel selection: ${error.message}`);
  }
}

async function confirmSelection() {
  if (!selectedOptionKey || !currentTripId) {
    showError('Please select an option first');
    return;
  }

  document.getElementById('loading').classList.remove('hidden');
  hideError();

  try {
    // Step 1: Select the option
    logDiagnostic('REQUEST', {
      endpoint: `PATCH /api/trips/${currentTripId}/select`,
      optionKey: selectedOptionKey
    });

    const selectResponse = await fetch(`/api/trips/${currentTripId}/select`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionKey: selectedOptionKey })
    });

    const selectData = await selectResponse.json();

    logDiagnostic('RESPONSE', {
      endpoint: `/api/trips/${currentTripId}/select`,
      status: selectResponse.status
    });

    if (!selectResponse.ok) throw new Error(selectData.error);

    // Display hotels if available (T034/T039)
    if (selectData.itinerary && selectData.itinerary.hotels && selectData.itinerary.hotels.length > 0) {
      displayHotels(selectData.itinerary.hotels);
    }

    // Step 2: Generate A/B variants
    logDiagnostic('REQUEST', {
      endpoint: `/api/trips/${currentTripId}/ab`,
      preferences: {
        luxury: document.getElementById('luxury').value,
        activity: document.getElementById('activity').value
      }
    });

    const abResponse = await fetch(`/api/trips/${currentTripId}/ab`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transport: {
          rail: true,
          car_ok: true,
          driver_guide_ok: document.getElementById('transport_pref').value === 'driver'
        },
        luxury: document.getElementById('luxury').value,
        activity: document.getElementById('activity').value,
        accessibility: 'none'
      })
    });

    const abData = await abResponse.json();

    logDiagnostic('RESPONSE', {
      endpoint: `/api/trips/${currentTripId}/ab`,
      status: abResponse.status,
      hasVariantA: !!abData.variantA,
      hasVariantB: !!abData.variantB
    });

    if (!abResponse.ok) throw new Error(abData.error);

    displayVariants(abData.variantA, abData.variantB);
    showSuccess('Detailed itineraries ready! Choose your preferred trip style below.');

  } catch (error) {
    logDiagnostic('ERROR', {
      operation: 'confirmSelection',
      error: error.message
    });
    showError(error.message);
  } finally {
    document.getElementById('loading').classList.add('hidden');
    resetProgressSteps();
  }
}

function displayVariants(variantA, variantB) {
  const container = document.getElementById('variantsContainer');

  container.innerHTML = `
    ${renderVariant('A', 'Option 1: Guided Experience', variantA)}
    ${renderVariant('B', 'Option 2: Independent Adventure', variantB)}
  `;

  document.getElementById('variantsSection').classList.remove('hidden');
  document.getElementById('variantsSection').scrollIntoView({ behavior: 'smooth' });
}

function renderVariant(key, title, variant) {
  // Format flight pricing (T040/T041)
  let flightPricingHTML = '';
  if (variant.flights) {
    const flights = variant.flights;
    flightPricingHTML = `
      <div style="background: #e8f4f8; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #0066cc;">✈️ Flight Estimates</h4>
        <div style="font-size: 0.95rem;">
          <div style="margin: 5px 0;">
            <strong>Route:</strong> ${flights.route || 'N/A'}
          </div>
          <div style="margin: 5px 0;">
            <strong>Price Range:</strong>
            <span style="color: #28a745; font-weight: 600;">
              $${flights.price_low?.toFixed(0) || 0} - $${flights.price_high?.toFixed(0) || 0}
            </span>
            per person
          </div>
          <div style="margin: 5px 0;">
            <strong>Carrier:</strong> ${flights.carrier || 'Various'}
          </div>
          <div style="margin-top: 10px; font-size: 0.85rem; color: #666; font-style: italic;">
            ${flights.disclaimer || 'Prices are estimates only'}
          </div>
        </div>
      </div>
    `;
  }

  // Format total estimate with disclaimer (T040)
  let totalEstimateHTML = '';
  if (variant.total_estimate || variant.estimated_budget) {
    const estimate = variant.total_estimate || variant.estimated_budget;
    totalEstimateHTML = `
      <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
        <h4 style="margin: 0 0 10px 0; color: #856404;">💰 Estimated Total Cost</h4>
        <div style="font-size: 1.2rem; font-weight: 700; color: #28a745; margin-bottom: 10px;">
          $${estimate.toLocaleString()} per person
        </div>
        <div style="font-size: 0.85rem; color: #856404;">
          ⚠️ <strong>Important:</strong> This is a preliminary estimate only.
          Final pricing will be provided by your travel professional and may include
          a 10-15% commission on top of the displayed range. Actual costs may vary
          based on availability, season, and specific preferences.
        </div>
      </div>
    `;
  }

  // Format cities/highlights
  let contentHTML = '';
  if (variant.cities && variant.cities.length > 0) {
    contentHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0;">📍 Cities: ${variant.cities.join(', ')}</h4>
      </div>
    `;
  }

  if (variant.highlights && variant.highlights.length > 0) {
    contentHTML += `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        <h4 style="margin: 0 0 10px 0;">✨ Highlights</h4>
        <ul style="margin: 0; padding-left: 20px;">
          ${variant.highlights.map(h => `<li style="margin: 5px 0;">${h}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Fallback: if variant has days array (old schema)
  if (variant.days && variant.days.length > 0) {
    contentHTML = `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">
        ${variant.days.map(day => `
          <div style="border-left: 3px solid #667eea; padding-left: 15px; margin-bottom: 15px;">
            <strong>Day ${day.d}: ${day.city}</strong>
            <p style="margin: 5px 0;">☀️ AM: ${day.am}</p>
            <p style="margin: 5px 0;">🌤️ PM: ${day.pm}</p>
            ${day.eve ? `<p style="margin: 5px 0;">🌙 EVE: ${day.eve}</p>` : ''}
            ${day.rail ? `<p style="font-size: 0.85rem; color: #888;">🚆 ${day.rail}</p>` : ''}
            ${day.drive ? `<p style="font-size: 0.85rem; color: #888;">🚗 ${day.drive}</p>` : ''}
            <p style="font-style: italic; color: #555; margin-top: 5px;">${day.why}</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
    <div class="variant-card" data-variant="${key}">
      <h3>Variant ${key}: ${title}</h3>
      <p style="color: #666; margin-bottom: 20px;">${variant.overview || variant.title || ''}</p>
      <p style="font-style: italic; color: #888; margin-bottom: 15px;">${variant.style || ''}</p>

      ${flightPricingHTML}
      ${totalEstimateHTML}
      ${contentHTML}

      <p style="margin-top: 15px; font-weight: 600;">Budget: ${variant.budget?.lodging || 'Comfort'}</p>
      ${variant.budget?.notes ? `<p style="font-size: 0.9rem; color: #666;">${variant.budget.notes}</p>` : ''}
      <button onclick="selectVariant('${key}')">Select This Itinerary</button>
    </div>
  `;
}

function selectVariant(key) {
  selectedVariant = key;
  addChatMessage('user', `I'd like to go with ${key === 'A' ? 'the first option' : 'the second option'}`);
  addChatMessage('assistant', `Great choice! Your itinerary is selected. You can ask me to make adjustments, add specific sites, or get more details about any day.`);

  // Highlight selected variant
  document.querySelectorAll('.variant-card').forEach(card => {
    if (card.dataset.variant === key) {
      card.style.border = '3px solid #667eea';
    } else {
      card.style.border = '';
    }
  });
}

// Chat functionality
function addChatMessage(role, content) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${role}`;
  messageDiv.textContent = content;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();

  if (!message) return;

  addChatMessage('user', message);
  input.value = '';

  // Simple keyword responses for now (can be enhanced with LLM later)
  if (message.toLowerCase().includes('hotel') || message.toLowerCase().includes('accommodation')) {
    addChatMessage('assistant', 'The hotels shown above are from Amadeus real-time data. You can select your preferred hotels in the trip view. Would you like recommendations for a specific price range?');
  } else if (message.toLowerCase().includes('flight') || message.toLowerCase().includes('airfare')) {
    addChatMessage('assistant', 'Flight prices are shown in your trip itineraries and come from Amadeus live data. Prices shown are estimates and may vary. What departure city are you flying from?');
  } else if (message.toLowerCase().includes('change') || message.toLowerCase().includes('modify') || message.toLowerCase().includes('edit')) {
    addChatMessage('assistant', 'To modify your trip, use the trip creation form above to generate new options with different parameters. You can adjust dates, party size, luxury level, and more.');
  } else if (message.toLowerCase().includes('cost') || message.toLowerCase().includes('price') || message.toLowerCase().includes('budget')) {
    addChatMessage('assistant', 'Total trip costs are shown in the trip style options, including flights and hotels. Remember: prices shown are estimates from live provider data (subject to change). Final booking prices may differ.');
  } else if (message.toLowerCase().includes('book') || message.toLowerCase().includes('reserve')) {
    addChatMessage('assistant', 'VoyGent is currently in planning mode - we help you design your heritage trip but don\'t handle bookings directly. Use the flight/hotel details to book through your preferred travel site or agent.');
  } else if (message.toLowerCase().includes('help')) {
    addChatMessage('assistant', 'I can help with: viewing trip options, selecting hotels, understanding costs, and answering questions about your heritage destinations. What would you like to know?');
  } else {
    addChatMessage('assistant', 'I can help with trip planning questions! Try asking about: hotels, flights, costs, destinations, or trip modifications. What would you like to know?');
  }
}

// Allow Enter key to send chat
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }
});

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError() {
  document.getElementById('error').classList.add('hidden');
}

function showSuccess(msg) {
  const el = document.getElementById('success');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideSuccess() {
  document.getElementById('success').classList.add('hidden');
}
