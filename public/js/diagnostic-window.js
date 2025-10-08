/**
 * Diagnostic Window Component
 *
 * Real-time diagnostic display for trip generation.
 * Shows logs, provider calls, costs, and progress.
 *
 * Phase 11, Task T061
 */

class DiagnosticWindow {
  constructor(tripId) {
    this.tripId = tripId;
    this.isOpen = false;
    this.logsPollInterval = null;
    this.lastLogTimestamp = null;
    this.logs = [];
    this.diagnostics = null;

    this.create();
  }

  create() {
    // Create diagnostic window HTML
    const windowHtml = `
      <div id="diagnostic-window" class="diagnostic-window hidden">
        <div class="diagnostic-header">
          <h3>🔬 Trip Diagnostics</h3>
          <div class="diagnostic-actions">
            <button id="refresh-diagnostics" class="btn-icon" title="Refresh">
              ↻
            </button>
            <button id="export-diagnostics" class="btn-icon" title="Export JSON">
              ⬇
            </button>
            <button id="close-diagnostics" class="btn-icon" title="Close">
              ✕
            </button>
          </div>
        </div>

        <div class="diagnostic-tabs">
          <button class="tab-btn active" data-tab="overview">Overview</button>
          <button class="tab-btn" data-tab="logs">Logs</button>
          <button class="tab-btn" data-tab="providers">Providers</button>
          <button class="tab-btn" data-tab="timeline">Timeline</button>
        </div>

        <div class="diagnostic-content">
          <!-- Overview Tab -->
          <div class="tab-pane active" data-tab="overview">
            <div class="diagnostic-summary">
              <div class="summary-card">
                <div class="summary-label">Trip ID</div>
                <div class="summary-value" id="diag-trip-id">-</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Template</div>
                <div class="summary-value" id="diag-template">-</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Status</div>
                <div class="summary-value" id="diag-status">-</div>
              </div>
              <div class="summary-card">
                <div class="summary-label">Total Cost</div>
                <div class="summary-value" id="diag-cost">$0.00</div>
              </div>
            </div>

            <div class="diagnostic-stats">
              <h4>Provider Usage</h4>
              <div id="provider-stats"></div>
            </div>

            <div class="diagnostic-errors" id="error-summary" style="display: none;">
              <h4>⚠️ Errors</h4>
              <div id="error-list"></div>
            </div>
          </div>

          <!-- Logs Tab -->
          <div class="tab-pane" data-tab="logs">
            <div class="log-filters">
              <select id="log-level-filter">
                <option value="all">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
              <select id="log-category-filter">
                <option value="all">All Categories</option>
                <option value="request">Request</option>
                <option value="provider">Provider</option>
                <option value="amadeus">Amadeus</option>
                <option value="research">Research</option>
                <option value="handoff">Handoff</option>
              </select>
              <button id="clear-logs">Clear</button>
            </div>
            <div class="log-container" id="log-container">
              <div class="log-empty">No logs yet</div>
            </div>
          </div>

          <!-- Providers Tab -->
          <div class="tab-pane" data-tab="providers">
            <div id="provider-details">
              <div class="provider-empty">Loading provider data...</div>
            </div>
          </div>

          <!-- Timeline Tab -->
          <div class="tab-pane" data-tab="timeline">
            <div id="timeline-container">
              <div class="timeline-empty">Loading timeline...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inject into page
    if (!document.getElementById('diagnostic-window')) {
      document.body.insertAdjacentHTML('beforeend', windowHtml);
      this.attachEventListeners();
    }

    this.windowElement = document.getElementById('diagnostic-window');
  }

  attachEventListeners() {
    // Tab switching
    document.querySelectorAll('.diagnostic-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchTab(tab);
      });
    });

    // Actions
    document.getElementById('refresh-diagnostics').addEventListener('click', () => {
      this.refresh();
    });

    document.getElementById('export-diagnostics').addEventListener('click', () => {
      this.exportJSON();
    });

    document.getElementById('close-diagnostics').addEventListener('click', () => {
      this.close();
    });

    // Log filters
    document.getElementById('log-level-filter').addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('log-category-filter').addEventListener('change', () => {
      this.filterLogs();
    });

    document.getElementById('clear-logs').addEventListener('click', () => {
      this.clearLogs();
    });
  }

  async open() {
    this.isOpen = true;
    this.windowElement.classList.remove('hidden');

    await this.loadDiagnostics();
    this.startLogPolling();
  }

  close() {
    this.isOpen = false;
    this.windowElement.classList.add('hidden');
    this.stopLogPolling();
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.diagnostic-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.diagnostic-content .tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.dataset.tab === tabName);
    });

    // Load data for specific tabs
    if (tabName === 'providers') {
      this.renderProviders();
    } else if (tabName === 'timeline') {
      this.renderTimeline();
    }
  }

  async loadDiagnostics() {
    try {
      const response = await fetch(`/api/trips/${this.tripId}/diagnostics`);

      if (!response.ok) {
        throw new Error('Failed to load diagnostics');
      }

      this.diagnostics = await response.json();
      this.renderOverview();
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
      this.showError('Failed to load diagnostic data');
    }
  }

  renderOverview() {
    if (!this.diagnostics) return;

    // Basic info
    document.getElementById('diag-trip-id').textContent = this.diagnostics.tripId || this.tripId;
    document.getElementById('diag-template').textContent = this.diagnostics.template?.name || 'Unknown';
    document.getElementById('diag-status').textContent = this.diagnostics.status || 'Unknown';

    // Total cost
    const totalCost = this.diagnostics.totalCostUsd || 0;
    document.getElementById('diag-cost').textContent = `$${totalCost.toFixed(4)}`;

    // Provider stats
    this.renderProviderStats();

    // Errors
    const errors = this.diagnostics.errors || [];
    if (errors.length > 0) {
      document.getElementById('error-summary').style.display = 'block';
      const errorList = document.getElementById('error-list');
      errorList.innerHTML = errors.map(err => `
        <div class="error-item">
          <span class="error-time">${new Date(err.timestamp).toLocaleTimeString()}</span>
          <span class="error-message">${err.message}</span>
        </div>
      `).join('');
    }
  }

  renderProviderStats() {
    const providers = this.diagnostics?.providers || [];
    const container = document.getElementById('provider-stats');

    if (providers.length === 0) {
      container.innerHTML = '<div class="provider-empty">No provider calls yet</div>';
      return;
    }

    container.innerHTML = providers.map(provider => `
      <div class="provider-stat">
        <div class="provider-name">${provider.name}</div>
        <div class="provider-metrics">
          <span>Calls: ${provider.calls || 0}</span>
          <span>Tokens: ${provider.totalTokens || 0}</span>
          <span>Cost: $${(provider.totalCost || 0).toFixed(4)}</span>
        </div>
      </div>
    `).join('');
  }

  async startLogPolling() {
    // Initial load
    await this.loadLogs();

    // Poll every 2 seconds for new logs
    this.logsPollInterval = setInterval(async () => {
      await this.loadLogs();
    }, 2000);
  }

  stopLogPolling() {
    if (this.logsPollInterval) {
      clearInterval(this.logsPollInterval);
      this.logsPollInterval = null;
    }
  }

  async loadLogs() {
    try {
      const url = new URL(`/api/trips/${this.tripId}/logs`, window.location.origin);

      // Only get logs since last timestamp
      if (this.lastLogTimestamp) {
        url.searchParams.set('since', this.lastLogTimestamp);
      }

      const response = await fetch(url);

      if (!response.ok) return;

      const data = await response.json();
      const newLogs = data.logs || [];

      if (newLogs.length > 0) {
        // Prepend new logs (reverse chronological)
        this.logs = [...newLogs, ...this.logs];
        this.lastLogTimestamp = newLogs[0].timestamp;
        this.renderLogs();
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  renderLogs() {
    const container = document.getElementById('log-container');
    const filtered = this.getFilteredLogs();

    if (filtered.length === 0) {
      container.innerHTML = '<div class="log-empty">No logs match filters</div>';
      return;
    }

    container.innerHTML = filtered.map(log => `
      <div class="log-entry log-${log.level}">
        <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
        <span class="log-level">${log.level.toUpperCase()}</span>
        <span class="log-category">${log.category}</span>
        <span class="log-message">${log.message}</span>
        ${log.metadata ? `<pre class="log-metadata">${JSON.stringify(log.metadata, null, 2)}</pre>` : ''}
      </div>
    `).join('');
  }

  getFilteredLogs() {
    const levelFilter = document.getElementById('log-level-filter').value;
    const categoryFilter = document.getElementById('log-category-filter').value;

    return this.logs.filter(log => {
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false;
      return true;
    });
  }

  filterLogs() {
    this.renderLogs();
  }

  clearLogs() {
    this.logs = [];
    this.lastLogTimestamp = null;
    this.renderLogs();
  }

  renderProviders() {
    const container = document.getElementById('provider-details');
    // Placeholder - will be populated from diagnostics data
    container.innerHTML = '<div>Provider details coming soon...</div>';
  }

  renderTimeline() {
    const container = document.getElementById('timeline-container');
    // Placeholder - will be populated from log timeline
    container.innerHTML = '<div>Timeline view coming soon...</div>';
  }

  async refresh() {
    await this.loadDiagnostics();
    await this.loadLogs();
  }

  async exportJSON() {
    if (!this.diagnostics) {
      alert('No diagnostic data to export');
      return;
    }

    const exportData = {
      ...this.diagnostics,
      logs: this.logs,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${this.tripId}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showError(message) {
    // Simple error display
    console.error(message);
  }
}

// Export for use in other scripts
window.DiagnosticWindow = DiagnosticWindow;
