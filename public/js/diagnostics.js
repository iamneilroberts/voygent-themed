// Diagnostics module
export let diagnosticsEnabled = false;
export let diagnosticsLog = [];

export function toggleDiagnostics() {
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

export function logDiagnostic(type, data) {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, type, data };
  diagnosticsLog.push(entry);

  if (diagnosticsEnabled) {
    updateDiagnosticsDisplay();
  }
}

export function updateDiagnosticsDisplay() {
  const logDiv = document.getElementById('diagnosticsLog');
  logDiv.innerHTML = diagnosticsLog.map(entry => `
    <div class="log-entry">
      <div class="timestamp">${entry.timestamp}</div>
      <div><strong>${entry.type}</strong></div>
      <pre>${JSON.stringify(entry.data, null, 2)}</pre>
    </div>
  `).reverse().join('');
}

// Make toggleDiagnostics available globally for onclick
window.toggleDiagnostics = toggleDiagnostics;
