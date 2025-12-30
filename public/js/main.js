/**
 * VoyGent V3 - Homepage
 * Theme selection and trip creation
 */

document.addEventListener('DOMContentLoaded', async () => {
  const templatesGrid = document.getElementById('templatesGrid');

  try {
    // Fetch templates from API (with full details for form building)
    const data = await apiClient.getTemplates();
    const templates = data.templates;

    if (templates.length === 0) {
      templatesGrid.innerHTML = '<div class="empty-state">No trip themes available</div>';
      return;
    }

    // Fetch full template details for each (to get required/optional fields)
    const fullTemplates = await Promise.all(
      templates.map(async (t) => {
        try {
          const full = await apiClient.getTemplate(t.id);
          return { ...t, ...full };
        } catch {
          return t;
        }
      })
    );

    // Clear loading state
    templatesGrid.innerHTML = '';

    // Create template cards
    fullTemplates.forEach((template) => {
      const card = createTemplateCard(template);
      templatesGrid.appendChild(card);
    });
  } catch (error) {
    console.error('Failed to load templates:', error);
    templatesGrid.innerHTML = '<div class="empty-state">Failed to load trip themes. Please refresh the page.</div>';
  }
});

/**
 * Create template card element
 */
function createTemplateCard(template) {
  const card = document.createElement('div');
  card.className = 'template-card';
  card.setAttribute('data-template-id', template.id);

  card.innerHTML = `
    <div class="icon">${template.icon}</div>
    <h3>${template.name}</h3>
    <p>${template.description}</p>
  `;

  // Click handler: open intake form modal
  card.addEventListener('click', () => {
    if (typeof IntakeForm !== 'undefined') {
      IntakeForm.open(template);
    } else {
      // Fallback to prompt if IntakeForm not available
      const initialMessage = prompt(
        `${template.search_placeholder}\n\nTell us about your ${template.name.toLowerCase()} interests:`,
        ''
      );

      if (initialMessage && initialMessage.trim() !== '') {
        apiClient.createTrip(template.id, initialMessage.trim())
          .then((result) => {
            window.location.href = `/chat?trip_id=${result.trip_id}`;
          })
          .catch((error) => {
            console.error('Failed to create trip:', error);
            alert('Failed to start trip planning. Please try again.');
          });
      }
    }
  });

  return card;
}
