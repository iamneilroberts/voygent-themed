/**
 * Research Viewer Component
 *
 * Displays research summary and enforces research-viewed gate.
 * Phase 11, Task T062
 */

class ResearchViewer {
  constructor(tripId, onAcknowledge) {
    this.tripId = tripId;
    this.onAcknowledge = onAcknowledge;
    this.research = null;
  }

  async load() {
    try {
      const response = await fetch(`/api/trips/${this.tripId}/research`);

      if (!response.ok) {
        throw new Error('Failed to load research');
      }

      this.research = await response.json();
      return this.research;
    } catch (error) {
      console.error('Failed to load research:', error);
      throw error;
    }
  }

  render(container) {
    if (!this.research) {
      container.innerHTML = '<div class="loading">Loading research...</div>';
      return;
    }

    const html = `
      <div class="research-container">
        <div class="research-header">
          <h2>📚 Research Summary</h2>
          <p class="research-subtitle">
            We've conducted research based on your interests. Please review before we generate trip options.
          </p>
        </div>

        <div class="research-content">
          ${this.formatResearchSummary(this.research.researchSummary)}
        </div>

        <div class="research-actions">
          <button
            id="acknowledge-research"
            class="btn-primary"
            ${this.research.researchViewed ? 'disabled' : ''}
          >
            ${this.research.researchViewed ? '✓ Research Acknowledged' : 'I\'ve Reviewed the Research'}
          </button>
        </div>

        ${this.research.researchViewed ? `
          <div class="research-next">
            <p>✓ You can now generate trip options.</p>
          </div>
        ` : ''}
      </div>
    `;

    container.innerHTML = html;

    // Attach event listener
    const btn = document.getElementById('acknowledge-research');
    if (btn && !this.research.researchViewed) {
      btn.addEventListener('click', () => this.acknowledge());
    }
  }

  formatResearchSummary(summary) {
    if (!summary) {
      return '<p class="no-research">No research summary available.</p>';
    }

    // Format markdown-like content
    return summary
      .split('\n\n')
      .map(para => `<p>${para}</p>`)
      .join('');
  }

  async acknowledge() {
    try {
      const response = await fetch(`/api/trips/${this.tripId}/research`, {
        method: 'PATCH'
      });

      if (!response.ok) {
        throw new Error('Failed to acknowledge research');
      }

      const data = await response.json();

      if (data.success) {
        this.research.researchViewed = true;

        // Call callback if provided
        if (this.onAcknowledge) {
          this.onAcknowledge();
        }

        // Re-render
        const container = document.querySelector('.research-container').parentElement;
        this.render(container);
      }
    } catch (error) {
      console.error('Failed to acknowledge research:', error);
      alert('Failed to mark research as viewed. Please try again.');
    }
  }
}

window.ResearchViewer = ResearchViewer;
