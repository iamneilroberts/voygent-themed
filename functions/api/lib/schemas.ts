// JSON Schema validation - Manual validation for Cloudflare Workers compatibility
// Note: Ajv uses eval() which is not allowed in Workers environment

export function validateIntake(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.theme || typeof data.theme !== 'string') return false;

  // Theme-specific required fields
  if (data.theme === 'heritage') {
    if (!Array.isArray(data.surnames) || data.surnames.length === 0) return false;
  } else if (data.theme === 'tvmovie') {
    if (!Array.isArray(data.titles) || data.titles.length === 0) return false;
  } else if (data.theme === 'historical') {
    if (!Array.isArray(data.events) || data.events.length === 0) return false;
  } else if (data.theme === 'culinary') {
    if (!Array.isArray(data.cuisines) || data.cuisines.length === 0) return false;
  } else if (data.theme === 'adventure') {
    if (!Array.isArray(data.activities) || data.activities.length === 0) return false;
  }

  // Common required fields - apply defaults if missing
  if (!data.party || typeof data.party !== 'object') {
    data.party = { adults: 2, children: [], accessibility: 'none' };
  }
  if (typeof data.party.adults !== 'number' || data.party.adults < 1) {
    data.party.adults = 2; // Default to 2 adults
  }
  if (!Array.isArray(data.party.children)) {
    data.party.children = [];
  }

  return true;
}

validateIntake.errors = null;

export function validateOption(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!['A', 'B', 'C', 'D'].includes(data.key)) return false;
  if (!data.title || typeof data.title !== 'string') return false;
  if (!Array.isArray(data.days) || data.days.length === 0) return false;
  return true;
}

validateOption.errors = null;

export function validateItinerary(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.title || typeof data.title !== 'string') return false;
  if (!Array.isArray(data.days) || data.days.length === 0) return false;
  if (!data.budget || !data.budget.lodging) return false;
  return true;
}

validateItinerary.errors = null;
