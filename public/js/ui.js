// UI utilities for progress, errors, and diagnostics

export function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

export function hideError() {
  document.getElementById('error').classList.add('hidden');
}

export function showSuccess(msg) {
  const el = document.getElementById('success');
  el.textContent = msg;
  el.classList.remove('hidden');
}

export function hideSuccess() {
  document.getElementById('success').classList.add('hidden');
}

export function showProgressStep(stepNumber) {
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

export function resetProgressSteps() {
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

export function addProgressLog(message, type = 'info') {
  const progressLog = document.getElementById('progressLog');
  if (!progressLog) return;

  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : '→';

  const logEntry = document.createElement('div');
  logEntry.className = 'log-line';
  logEntry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> <span style="color: ${type === 'success' ? '#0f0' : type === 'error' ? '#f44' : type === 'warning' ? '#fa0' : '#0af'};">${icon}</span> ${message}`;

  progressLog.appendChild(logEntry);
  progressLog.scrollTop = progressLog.scrollHeight;
}

export function setupCollapsibleSection(headerId, contentId) {
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

export function collapseCustomizeSections() {
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

// Diagnostics
let diagnosticsEnabled = false;
let diagnosticsLog = [];

export function toggleDiagnostics() {
  diagnosticsEnabled = !diagnosticsEnabled;
  const diagDiv = document.getElementById('diagnostics');
  const toggleText = document.getElementById('diagToggleText');

  if (diagnosticsEnabled) {
    diagDiv.classList.remove('hidden');
    toggleText.textContent = '▼ Hide Diagnostics';
    updateDiagnosticsDisplay();
  } else {
    diagDiv.classList.add('hidden');
    toggleText.textContent = '▲ Show Diagnostics';
  }
}

export function logDiagnostic(type, data) {
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
            ${call.details ? `<div style="font-size: 0.85em; color: #999; margin-top: 6px;">${call.details}</div>` : ''}
          </div>
        `).join('')}
      `;
    } else {
      content = `
        <div class="timestamp">[${time}]</div>
        <div><strong style="color: #4af;">${entry.type}</strong></div>
        <pre style="margin-top: 5px; font-size: 0.85em;">${JSON.stringify(entry.data, null, 2)}</pre>
      `;
    }

    return `<div class="log-entry">${content}</div>`;
  }).join('');
}
