// Dynamic Theme Selector - loads themes from database
// Shows featured themes as icon cards, with browse-all modal for others

let allThemes = [];
let selectedThemeId = 'heritage';

export async function initThemeSelector() {
  try {
    const response = await fetch('/api/templates');
    const data = await response.json();
    allThemes = data.templates || [];

    renderFeaturedThemes();
    setupBrowseAllButton();
  } catch (error) {
    console.error('Failed to load themes:', error);
    // Fallback to hardcoded themes if API fails
    renderFallbackThemes();
  }
}

function renderFeaturedThemes() {
  const container = document.getElementById('themeSelector');
  if (!container) return;

  const featured = allThemes
    .filter(t => t.isFeatured)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .slice(0, 5);

  if (featured.length === 0) {
    renderFallbackThemes();
    return;
  }

  container.innerHTML = featured.map(theme => `
    <div class="theme-card" data-theme="${theme.id}">
      <div style="font-size: 3rem; margin-bottom: 10px;">${theme.icon}</div>
      <h3 style="margin: 0 0 8px 0; color: #667eea;">${theme.name}</h3>
      <p style="font-size: 0.9rem; color: #666; margin: 0;">${theme.description}</p>
    </div>
  `).join('');

  // Add click handlers
  container.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const themeId = card.dataset.theme;
      selectTheme(themeId);
    });
  });

  // Select first theme by default
  if (featured.length > 0) {
    selectTheme(featured[0].id);
  }
}

function renderFallbackThemes() {
  const container = document.getElementById('themeSelector');
  if (!container) return;

  const fallbackThemes = [
    { id: 'heritage', icon: '🌳', name: 'Heritage & Ancestry', description: 'Explore your family roots' },
    { id: 'tvmovie', icon: '🎬', name: 'TV & Movie Locations', description: 'Visit filming locations' },
    { id: 'historical', icon: '⚔️', name: 'Historical Events', description: 'Walk through history' },
    { id: 'culinary', icon: '🍴', name: 'Culinary Tours', description: 'Explore regional cuisines' },
    { id: 'adventure', icon: '🏔️', name: 'Adventure & Outdoor', description: 'Hiking, wildlife, nature' }
  ];

  container.innerHTML = fallbackThemes.map(theme => `
    <div class="theme-card" data-theme="${theme.id}">
      <div style="font-size: 3rem; margin-bottom: 10px;">${theme.icon}</div>
      <h3 style="margin: 0 0 8px 0; color: #667eea;">${theme.name}</h3>
      <p style="font-size: 0.9rem; color: #666; margin: 0;">${theme.description}</p>
    </div>
  `).join('');

  container.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => selectTheme(card.dataset.theme));
  });

  selectTheme('heritage');
}

function selectTheme(themeId) {
  selectedThemeId = themeId;
  document.getElementById('selectedTheme').value = themeId;

  // Update visual selection
  document.querySelectorAll('.theme-card').forEach(card => {
    if (card.dataset.theme === themeId) {
      card.style.borderColor = '#667eea';
      card.style.background = '#f0f4ff';
    } else {
      card.style.borderColor = 'transparent';
      card.style.background = 'white';
    }
  });

  // Update hero section based on theme
  const theme = allThemes.find(t => t.id === themeId);
  if (theme) {
    updateHeroForTheme(theme);
  }

  // Trigger theme change event for other modules
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { themeId, theme } }));
}

function updateHeroForTheme(theme) {
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const quickStartInput = document.getElementById('quickStartInput');

  const heroText = {
    heritage: {
      title: 'Follow Your Family Roots',
      subtitle: 'Enter your surname and we\'ll create a personalized heritage trip in seconds',
      placeholder: 'Enter your surname (e.g., McElroy)'
    },
    tvmovie: {
      title: 'Step Into Your Favorite Scenes',
      subtitle: 'Tell us your favorite shows or movies and we\'ll plan your filming location adventure',
      placeholder: 'Enter TV show or movie (e.g., Game of Thrones)'
    },
    historical: {
      title: 'Walk Through History',
      subtitle: 'Share the historical events or periods you want to explore',
      placeholder: 'Enter historical event (e.g., WWII D-Day)'
    },
    culinary: {
      title: 'Taste the World',
      subtitle: 'Tell us what cuisines you want to explore and we\'ll create your food tour',
      placeholder: 'Enter cuisine type (e.g., Italian, French)'
    },
    adventure: {
      title: 'Explore the Great Outdoors',
      subtitle: 'Share your adventure goals and we\'ll plan your outdoor journey',
      placeholder: 'Enter activity or location (e.g., Patagonia hiking)'
    }
  };

  const text = heroText[theme.id] || {
    title: theme.name,
    subtitle: theme.description,
    placeholder: 'Describe your trip...'
  };

  if (heroTitle) heroTitle.textContent = text.title;
  if (heroSubtitle) heroSubtitle.textContent = text.subtitle;
  if (quickStartInput) quickStartInput.placeholder = text.placeholder;
}

function setupBrowseAllButton() {
  const themeSelectorContainer = document.querySelector('.quick-tuner:has(#themeSelector)');
  if (!themeSelectorContainer) return;

  const browseButton = document.createElement('button');
  browseButton.innerHTML = '🔍 Browse All Themes';
  browseButton.style.cssText = 'margin-top: 20px; background: white; color: #667eea; border: 2px solid #667eea; font-size: 1rem; padding: 12px 24px;';
  browseButton.onclick = showBrowseAllModal;

  themeSelectorContainer.appendChild(browseButton);
}

function showBrowseAllModal() {
  const modal = document.createElement('div');
  modal.id = 'browseAllModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  `;

  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    max-width: 900px;
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    padding: 30px;
  `;

  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; color: #667eea;">Browse All Themes</h2>
      <button onclick="document.getElementById('browseAllModal').remove()" style="background: transparent; color: #999; font-size: 2rem; padding: 0; min-width: auto; line-height: 1;">×</button>
    </div>

    <input type="text" id="themeSearch" placeholder="Search themes or tags..." style="width: 100%; padding: 12px; margin-bottom: 20px; border: 2px solid #ddd; border-radius: 6px; font-size: 1rem;">

    <div id="allThemesList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px;"></div>
  `;

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  renderAllThemes();
  setupThemeSearch();

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

function renderAllThemes(filterText = '') {
  const container = document.getElementById('allThemesList');
  if (!container) return;

  const filtered = allThemes.filter(theme => {
    if (!filterText) return true;
    const searchLower = filterText.toLowerCase();
    return theme.name.toLowerCase().includes(searchLower) ||
           theme.description.toLowerCase().includes(searchLower) ||
           (theme.tags || []).some(tag => tag.toLowerCase().includes(searchLower));
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999; padding: 40px;">No themes found matching your search.</div>';
    return;
  }

  container.innerHTML = filtered.map(theme => `
    <div class="theme-card-modal" data-theme="${theme.id}" style="cursor: pointer; padding: 20px; background: ${theme.id === selectedThemeId ? '#f0f4ff' : 'white'}; border: 3px solid ${theme.id === selectedThemeId ? '#667eea' : 'transparent'}; border-radius: 12px; transition: all 0.3s;">
      <div style="font-size: 2.5rem; margin-bottom: 10px;">${theme.icon}</div>
      <h3 style="margin: 0 0 8px 0; color: #667eea; font-size: 1.1rem;">${theme.name}</h3>
      <p style="font-size: 0.85rem; color: #666; margin: 0 0 10px 0;">${theme.description}</p>
      ${theme.tags && theme.tags.length > 0 ? `
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
          ${theme.tags.map(tag => `<span style="background: #e0e7ff; color: #667eea; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem;">${tag}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  container.querySelectorAll('.theme-card-modal').forEach(card => {
    card.addEventListener('click', () => {
      selectTheme(card.dataset.theme);
      document.getElementById('browseAllModal').remove();
    });
  });
}

function setupThemeSearch() {
  const searchInput = document.getElementById('themeSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    renderAllThemes(e.target.value);
  });
}

export function getSelectedTheme() {
  return selectedThemeId;
}
