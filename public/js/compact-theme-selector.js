/**
 * Compact Theme Selector
 * Handles theme button clicks and updates quick search placeholder
 */

const THEME_DATA = {
  heritage: {
    title: 'Heritage & Ancestry Trip',
    subtitle: 'Explore your family roots and ancestral heritage',
    placeholder: 'Enter family surname (e.g., McLeod)'
  },
  tvmovie: {
    title: 'TV & Movie Locations Trip',
    subtitle: 'Visit iconic filming locations from your favorite shows',
    placeholder: 'Enter show/movie name (e.g., Game of Thrones)'
  },
  historical: {
    title: 'Historical Events Trip',
    subtitle: 'Walk through history at significant sites',
    placeholder: 'Enter historical event (e.g., D-Day Normandy)'
  },
  culinary: {
    title: 'Culinary Tour',
    subtitle: 'Explore regional cuisines and food culture',
    placeholder: 'Enter cuisine or region (e.g., Tuscany pasta)'
  },
  adventure: {
    title: 'Adventure & Outdoor Trip',
    subtitle: 'Experience nature, hiking, and wildlife',
    placeholder: 'Enter activity (e.g., Patagonia hiking)'
  }
};

/**
 * Initialize compact theme selector
 */
export function initCompactThemeSelector() {
  const themeButtons = document.querySelectorAll('.theme-btn');
  const selectedThemeInput = document.getElementById('selectedTheme');
  const quickSearchInput = document.getElementById('quickSearch');
  const themeTitle = document.getElementById('themeTitle');
  const themeSubtitle = document.getElementById('themeSubtitle');

  themeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;

      // Update active state
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update hidden input
      if (selectedThemeInput) {
        selectedThemeInput.value = theme;
      }

      // Update quick search placeholder and title
      const themeData = THEME_DATA[theme];
      if (themeData) {
        if (quickSearchInput) {
          quickSearchInput.placeholder = themeData.placeholder;
        }
        if (themeTitle) {
          themeTitle.textContent = themeData.title;
        }
        if (themeSubtitle) {
          themeSubtitle.textContent = themeData.subtitle;
        }
      }

      // Trigger theme change event for other modules
      window.dispatchEvent(new CustomEvent('themeChanged', {
        detail: { themeId: theme, themeName: themeData?.title }
      }));

      console.log('[Compact Theme Selector] Theme changed to:', theme);
    });
  });

  console.log('[Compact Theme Selector] Initialized with', themeButtons.length, 'themes');
}
