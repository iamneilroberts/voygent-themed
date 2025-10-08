/**
 * Template Selector Component
 *
 * Displays available trip templates and allows selection.
 * Phase 11, Task T063
 */

class TemplateSelector {
  constructor(onSelect) {
    this.onSelect = onSelect;
    this.templates = [];
    this.selectedTemplate = null;
  }

  async loadTemplates() {
    try {
      const response = await fetch('/api/admin/templates?is_active=true');

      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      this.templates = data.templates || [];
      return this.templates;
    } catch (error) {
      console.error('Failed to load templates:', error);
      throw error;
    }
  }

  render(container) {
    if (this.templates.length === 0) {
      container.innerHTML = '<div class="loading">Loading templates...</div>';
      return;
    }

    const html = `
      <div class="template-selector">
        <h3>Choose Your Trip Theme</h3>
        <div class="template-grid">
          ${this.templates.map(template => this.renderTemplateCard(template)).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach event listeners
    this.templates.forEach(template => {
      const card = document.getElementById(`template-${template.id}`);
      if (card) {
        card.addEventListener('click', () => this.selectTemplate(template));
      }
    });
  }

  renderTemplateCard(template) {
    const isSelected = this.selectedTemplate?.id === template.id;

    return `
      <div
        id="template-${template.id}"
        class="template-card ${isSelected ? 'selected' : ''}"
        role="button"
        tabindex="0"
      >
        <div class="template-icon">${template.icon || '✈️'}</div>
        <h4 class="template-name">${template.name}</h4>
        <p class="template-description">${template.description}</p>
        ${isSelected ? '<div class="template-checkmark">✓</div>' : ''}
      </div>
    `;
  }

  selectTemplate(template) {
    this.selectedTemplate = template;

    // Update UI
    document.querySelectorAll('.template-card').forEach(card => {
      card.classList.remove('selected');
    });

    const selectedCard = document.getElementById(`template-${template.id}`);
    if (selectedCard) {
      selectedCard.classList.add('selected');
    }

    // Call callback
    if (this.onSelect) {
      this.onSelect(template);
    }
  }

  getSelected() {
    return this.selectedTemplate;
  }
}

window.TemplateSelector = TemplateSelector;
