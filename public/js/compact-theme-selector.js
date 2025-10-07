/**
 * Compact Theme Selector - Dynamic Template Rendering
 * Fetches templates from API and renders featured + secondary themes
 */

import { fetchTemplates, getFeaturedTemplates, getSecondaryTemplates, getTemplateById } from './template-api.js';

let allSecondaryTemplates = [];

/**
 * Initialize compact theme selector with dynamic template loading
 */
export async function initCompactThemeSelector() {
  console.log('[Compact Theme Selector] Initializing...');

  try {
    // Fetch templates from API
    console.log('[Compact Theme Selector] Fetching templates...');
    const templates = await fetchTemplates();
    console.log('[Compact Theme Selector] Received templates:', templates.length);

    if (!templates || templates.length === 0) {
      console.error('[Compact Theme Selector] No templates available');
      showError('No templates available');
      return;
    }

    // Separate featured and secondary templates
    const featured = getFeaturedTemplates();
    const secondary = getSecondaryTemplates();

    console.log(`[Compact Theme Selector] Loaded ${featured.length} featured, ${secondary.length} secondary templates`);

    // Render both sections
    console.log('[Compact Theme Selector] Rendering featured templates...');
    renderFeaturedTemplates(featured);

    console.log('[Compact Theme Selector] Rendering secondary templates...');
    renderSecondaryTemplates(secondary);

    // Hide loading, show content
    console.log('[Compact Theme Selector] Showing UI...');
    const loadingEl = document.getElementById('themeLoading');
    const primaryEl = document.getElementById('primaryThemesContainer');
    const secondaryEl = document.getElementById('secondaryThemesContainer');

    if (loadingEl) loadingEl.style.display = 'none';
    if (primaryEl) primaryEl.style.display = 'flex';
    if (secondaryEl && secondary.length > 0) secondaryEl.style.display = 'block';

    // Set up search functionality
    setupThemeSearch();

    console.log('[Compact Theme Selector] Initialization complete!');

  } catch (error) {
    console.error('[Compact Theme Selector] Failed to load templates:', error);
    console.error('[Compact Theme Selector] Error stack:', error.stack);
    showError('Failed to load themes. Please refresh the page.');
  }
}

/**
 * Render featured/primary template buttons
 */
function renderFeaturedTemplates(templates) {
  const container = document.getElementById('primaryThemesContainer');

  // Sort by display order
  const sorted = templates.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  // Generate HTML for each button
  const html = sorted.map((t, index) => `
    <button type="button" class="theme-btn ${index === 0 ? 'active' : ''}" data-theme="${t.id}">
      <span class="icon">${t.icon}</span>
      <span class="label">${t.name}</span>
    </button>
  `).join('');

  container.innerHTML = html;

  // Set default selected theme
  if (sorted.length > 0) {
    const selectedThemeInput = document.getElementById('selectedTheme');
    if (selectedThemeInput) {
      selectedThemeInput.value = sorted[0].id;
    }
    updateThemeDisplay(sorted[0]);
  }

  // Add click handlers
  container.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => handleThemeClick(btn.dataset.theme));
  });
}

/**
 * Render secondary templates in searchable list
 */
function renderSecondaryTemplates(templates) {
  allSecondaryTemplates = templates.sort((a, b) => a.name.localeCompare(b.name));

  const countBadge = document.getElementById('secondaryThemeCount');
  if (countBadge) {
    countBadge.textContent = templates.length;
  }

  renderSecondaryList(allSecondaryTemplates);
}

/**
 * Render the secondary template list
 */
function renderSecondaryList(templates) {
  const listContainer = document.getElementById('secondaryThemesList');
  const noResults = document.getElementById('noThemesFound');

  if (templates.length === 0) {
    listContainer.style.display = 'none';
    noResults.style.display = 'block';
    return;
  }

  listContainer.style.display = 'grid';
  noResults.style.display = 'none';

  const html = templates.map(t => `
    <button
      type="button"
      class="theme-btn secondary-theme"
      data-theme="${t.id}"
      style="padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; cursor: pointer; text-align: left; transition: all 0.2s; display: flex; gap: 8px; align-items: center;"
      onmouseover="this.style.borderColor='#667eea'; this.style.background='#f8f9ff';"
      onmouseout="this.style.borderColor='#e0e0e0'; this.style.background='white';"
    >
      <span style="font-size: 1.5em;">${t.icon}</span>
      <span style="font-size: 0.95em; font-weight: 500;">${t.name}</span>
    </button>
  `).join('');

  listContainer.innerHTML = html;

  // Add click handlers
  listContainer.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleThemeClick(btn.dataset.theme);
      // Close the details panel after selection
      const details = document.querySelector('#secondaryThemesContainer details');
      if (details) details.open = false;
    });
  });
}

/**
 * Setup theme search functionality
 */
function setupThemeSearch() {
  const searchInput = document.getElementById('themeSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (!query) {
      // Show all secondary templates
      renderSecondaryList(allSecondaryTemplates);
      return;
    }

    // Filter templates by name, description, or tags
    const filtered = allSecondaryTemplates.filter(t => {
      const matchName = t.name.toLowerCase().includes(query);
      const matchDesc = t.description?.toLowerCase().includes(query);
      const matchTags = t.tags?.some(tag => tag.toLowerCase().includes(query));
      return matchName || matchDesc || matchTags;
    });

    renderSecondaryList(filtered);
  });
}

/**
 * Handle theme button click
 */
function handleThemeClick(themeId) {
  const template = getTemplateById(themeId);
  if (!template) {
    console.error('[Theme Selector] Template not found:', themeId);
    return;
  }

  console.log('[Compact Theme Selector] Theme changed to:', themeId);

  // Update active state for all buttons (primary and secondary)
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.theme === themeId) {
      btn.classList.add('active');
    }
  });

  // Update hidden input
  const selectedThemeInput = document.getElementById('selectedTheme');
  if (selectedThemeInput) {
    selectedThemeInput.value = themeId;
  }

  // Update theme display (title, subtitle, placeholder)
  updateThemeDisplay(template);

  // Trigger theme change event
  window.dispatchEvent(new CustomEvent('themeChanged', {
    detail: { themeId, themeName: template.name }
  }));
}

/**
 * Update theme title, subtitle, and placeholder
 */
function updateThemeDisplay(template) {
  const themeTitle = document.getElementById('themeTitle');
  const themeSubtitle = document.getElementById('themeSubtitle');
  const quickSearchInput = document.getElementById('quickSearch');

  if (themeTitle) {
    themeTitle.textContent = template.name;
  }

  if (themeSubtitle) {
    themeSubtitle.textContent = template.description;
  }

  if (quickSearchInput) {
    // Set theme-specific placeholder
    const placeholders = {
      heritage: 'Enter family surname (e.g., McLeod)',
      tvmovie: 'Enter show/movie name (e.g., Game of Thrones)',
      historical: 'Enter historical event (e.g., D-Day Normandy)',
      culinary: 'Enter cuisine or region (e.g., Tuscany pasta)',
      adventure: 'Enter activity (e.g., Patagonia hiking)',
      wellness: 'Enter wellness type (e.g., yoga retreat Bali)',
      architecture: 'Enter architect or style (e.g., Gaudi Barcelona)',
      music: 'Enter music genre or festival (e.g., Jazz New Orleans)',
      wildlife: 'Enter wildlife interest (e.g., safari photography Kenya)',
      sports: 'Enter sport or event (e.g., Tour de France)',
      literary: 'Enter author or book (e.g., Shakespeare England)',
      wine: 'Enter wine region (e.g., Bordeaux vineyards)',
      photography: 'Enter photography subject (e.g., landscape Iceland)'
    };

    quickSearchInput.placeholder = placeholders[template.id] ||
      `Enter details about your ${template.name.toLowerCase()} trip...`;
  }
}

/**
 * Show error message
 */
function showError(message) {
  const loading = document.getElementById('themeLoading');
  if (loading) {
    loading.innerHTML = `
      <div style="color: #e53e3e; text-align: center;">
        <p style="margin-bottom: 10px;">⚠️ ${message}</p>
        <button onclick="location.reload()" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
          Retry
        </button>
      </div>
    `;
  }
}
