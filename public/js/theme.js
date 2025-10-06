// Theme selection and form field management

export const THEME_DATA = {
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

export const THEME_FORM_FIELDS = {
  heritage: {
    field1: { label: 'Family Surnames *', placeholder: 'e.g., McLeod, Roberts' },
    field2: { label: 'Suspected Origins', placeholder: 'Unknown - AI will guess from surname' }
  },
  tvmovie: {
    field1: { label: 'TV Shows / Movies *', placeholder: 'e.g., Game of Thrones, Breaking Bad' },
    field2: { label: 'Specific Locations', placeholder: 'e.g., Winterfell, Albuquerque' }
  },
  historical: {
    field1: { label: 'Historical Events *', placeholder: 'e.g., D-Day, Battle of Waterloo' },
    field2: { label: 'Time Period', placeholder: 'e.g., WWII, Napoleonic Era' }
  },
  culinary: {
    field1: { label: 'Cuisines *', placeholder: 'e.g., Italian, French, Japanese' },
    field2: { label: 'Regions', placeholder: 'e.g., Tuscany, Provence, Kyoto' }
  },
  adventure: {
    field1: { label: 'Activities *', placeholder: 'e.g., Hiking, Safari, Kayaking' },
    field2: { label: 'Destinations', placeholder: 'e.g., Patagonia, Swiss Alps' }
  }
};

export const VALIDATION_MESSAGES = {
  heritage: 'Please enter at least one family surname',
  tvmovie: 'Please enter at least one TV show or movie',
  historical: 'Please enter at least one historical event',
  culinary: 'Please enter at least one cuisine type',
  adventure: 'Please enter at least one activity or destination'
};

export function updateFormFieldsForTheme(theme) {
  const fields = THEME_FORM_FIELDS[theme] || THEME_FORM_FIELDS.heritage;

  // Update field 1
  document.getElementById('field1Label').textContent = fields.field1.label;
  document.getElementById('surnames').placeholder = fields.field1.placeholder;
  document.getElementById('surnames').value = '';

  // Update field 2
  document.getElementById('field2Label').textContent = fields.field2.label;
  document.getElementById('origins').placeholder = fields.field2.placeholder;
  document.getElementById('origins').value = '';
}

export function getSelectedTheme() {
  return document.getElementById('selectedTheme')?.value || 'heritage';
}

export function initThemeSelector(onThemeChange) {
  const themeCards = document.querySelectorAll('.theme-card');
  const selectedThemeInput = document.getElementById('selectedTheme');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const quickStartInput = document.getElementById('quickStartInput');

  themeCards.forEach(card => {
    card.addEventListener('click', () => {
      const theme = card.dataset.theme;
      const previousTheme = selectedThemeInput.value;

      // Remove selection from all cards
      themeCards.forEach(c => c.style.borderColor = 'transparent');

      // Mark this card as selected
      card.style.borderColor = '#667eea';

      // Update selected theme
      selectedThemeInput.value = theme;

      // Update hero section
      const data = THEME_DATA[theme];
      heroTitle.textContent = data.title;
      heroSubtitle.textContent = data.subtitle;
      quickStartInput.placeholder = data.placeholder;
      quickStartInput.value = ''; // Clear input when switching themes

      // Update form fields for this theme
      updateFormFieldsForTheme(theme);

      // Notify callback
      if (onThemeChange && previousTheme !== theme) {
        onThemeChange(theme, previousTheme);
      }
    });
  });

  // Select heritage by default
  document.querySelector('[data-theme="heritage"]')?.click();
}
