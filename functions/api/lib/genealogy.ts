/**
 * Genealogy Parser Library
 * Feature: 001-web-search-integration
 *
 * Parses genealogy URLs (FamilySearch, WikiTree) and extracts ancestry context.
 * For MVP: Supports FamilySearch + WikiTree only.
 */

export interface GenealogyContext {
  surnames: string[];
  origins: string[];
  migration_window: string | null;
  key_sites: string[];
  sources: AncestrySource[];
  web_search_summary: string | null;
}

export interface AncestrySource {
  kind: 'url' | 'pdf' | 'image' | 'text';
  value: string;
  raw_content?: string;
  parsed_data?: any;
  ocr_summary?: string;
  web_search_context?: string;
}

/**
 * Parse FamilySearch URL to extract person ID and fetch profile
 * URL format: https://www.familysearch.org/tree/person/details/[ID]
 */
export async function parseFamilySearchURL(url: string): Promise<Partial<GenealogyContext>> {
  try {
    // Extract person ID from URL
    const match = url.match(/familysearch\.org\/tree\/person\/(?:details\/)?([A-Z0-9-]+)/i);
    if (!match) {
      throw new Error('Invalid FamilySearch URL format');
    }

    const personId = match[1];

    // FamilySearch public API endpoint (no auth required for public profiles)
    const apiUrl = `https://api.familysearch.org/platform/tree/persons/${personId}`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`FamilySearch API failed: ${response.status}`);
    }

    const data = await response.json();

    // Extract data from response
    const person = data.persons?.[0];
    if (!person) {
      throw new Error('No person data found');
    }

    // Extract names
    const names = person.names || [];
    const surnames = names
      .flatMap((n: any) => n.nameForms || [])
      .flatMap((nf: any) => nf.parts || [])
      .filter((p: any) => p.type === 'http://gedcomx.org/Surname')
      .map((p: any) => p.value)
      .filter((v: string) => v);

    // Extract birth/death places for origins
    const facts = person.facts || [];
    const birthFact = facts.find((f: any) => f.type === 'http://gedcomx.org/Birth');
    const deathFact = facts.find((f: any) => f.type === 'http://gedcomx.org/Death');

    const origins: string[] = [];
    if (birthFact?.place?.original) {
      origins.push(birthFact.place.original);
    }
    if (deathFact?.place?.original && deathFact.place.original !== birthFact?.place?.original) {
      origins.push(deathFact.place.original);
    }

    // Extract dates for migration window
    const birthDate = birthFact?.date?.original;
    const deathDate = deathFact?.date?.original;
    const migration_window = birthDate && deathDate ? `${birthDate}-${deathDate}` : null;

    return {
      surnames: [...new Set(surnames)],
      origins: [...new Set(origins)],
      migration_window,
      key_sites: origins, // Use birth/death places as initial key sites
      sources: [{
        kind: 'url',
        value: url,
        parsed_data: { personId, surnames, origins, dates: { birth: birthDate, death: deathDate } },
      }],
    };
  } catch (error) {
    console.error('FamilySearch parsing failed:', error);
    throw new Error(`FamilySearch URL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse WikiTree URL to extract profile ID and fetch profile
 * URL format: https://www.wikitree.com/wiki/[PROFILE_ID]
 */
export async function parseWikiTreeURL(url: string): Promise<Partial<GenealogyContext>> {
  try {
    // Extract profile ID from URL
    const match = url.match(/wikitree\.com\/wiki\/([A-Za-z0-9_-]+)/i);
    if (!match) {
      throw new Error('Invalid WikiTree URL format');
    }

    const profileId = match[1];

    // WikiTree public API (no auth required for public profiles)
    const apiUrl = `https://api.wikitree.com/api.php?action=getProfile&key=${profileId}&fields=Name,BirthLocation,DeathLocation,BirthDate,DeathDate`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`WikiTree API failed: ${response.status}`);
    }

    const data = await response.json();

    const profile = data[0]?.profile;
    if (!profile) {
      throw new Error('No profile data found');
    }

    // Extract surname from Name (format: "LastName-####")
    const surname = profile.Name?.split('-')[0] || '';

    // Extract locations
    const origins: string[] = [];
    if (profile.BirthLocation) {
      origins.push(profile.BirthLocation);
    }
    if (profile.DeathLocation && profile.DeathLocation !== profile.BirthLocation) {
      origins.push(profile.DeathLocation);
    }

    // Extract dates for migration window
    const birthYear = profile.BirthDate?.match(/\d{4}/)?.[0];
    const deathYear = profile.DeathDate?.match(/\d{4}/)?.[0];
    const migration_window = birthYear && deathYear ? `${birthYear}-${deathYear}` : null;

    return {
      surnames: surname ? [surname] : [],
      origins: [...new Set(origins)],
      migration_window,
      key_sites: origins,
      sources: [{
        kind: 'url',
        value: url,
        parsed_data: { profileId, surname, origins, dates: { birth: profile.BirthDate, death: profile.DeathDate } },
      }],
    };
  } catch (error) {
    console.error('WikiTree parsing failed:', error);
    throw new Error(`WikiTree URL parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse genealogy URL (auto-detect provider)
 */
export async function parseGenealogyURL(url: string): Promise<Partial<GenealogyContext>> {
  if (url.includes('familysearch.org')) {
    return parseFamilySearchURL(url);
  } else if (url.includes('wikitree.com')) {
    return parseWikiTreeURL(url);
  } else if (url.includes('ancestry.com') || url.includes('myheritage.com')) {
    // Not supported in MVP
    throw new Error('Manual entry required - Ancestry and MyHeritage URLs not supported in MVP');
  } else {
    throw new Error('Unsupported genealogy website - please use FamilySearch or WikiTree');
  }
}

/**
 * Extract genealogy context from OCR text or uploaded content
 * Uses simple pattern matching for surnames, places, dates
 */
export function extractGenealogyContext(text: string, ocrSummary?: string): Partial<GenealogyContext> {
  const surnames: string[] = [];
  const origins: string[] = [];
  let migration_window: string | null = null;

  // Pattern: "Surname:" or "Family name:" followed by capitalized words
  const surnameMatches = text.match(/(?:surname|family name|last name):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi);
  if (surnameMatches) {
    surnameMatches.forEach(match => {
      const name = match.split(':')[1]?.trim();
      if (name && !surnames.includes(name)) {
        surnames.push(name);
      }
    });
  }

  // Pattern: "Born in" or "Origin:" followed by place name
  const originMatches = text.match(/(?:born in|origin|from|emigrated from):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z][a-z]+)*)/gi);
  if (originMatches) {
    originMatches.forEach(match => {
      const place = match.split(':')[1]?.trim() || match.replace(/(?:born in|origin|from|emigrated from)\s+/i, '').trim();
      if (place && !origins.includes(place)) {
        origins.push(place);
      }
    });
  }

  // Pattern: Year ranges like "1880-1920" or "1880 to 1920"
  const dateRangeMatch = text.match(/(\d{4})\s*[-to]+\s*(\d{4})/i);
  if (dateRangeMatch) {
    migration_window = `${dateRangeMatch[1]}-${dateRangeMatch[2]}`;
  }

  return {
    surnames,
    origins,
    migration_window,
    key_sites: origins,
    sources: [{
      kind: 'text',
      value: 'Uploaded document',
      raw_content: text.slice(0, 500), // First 500 chars
      ocr_summary,
    }],
  };
}

/**
 * Merge multiple genealogy contexts
 */
export function mergeGenealogyContexts(contexts: Partial<GenealogyContext>[]): GenealogyContext {
  const merged: GenealogyContext = {
    surnames: [],
    origins: [],
    migration_window: null,
    key_sites: [],
    sources: [],
    web_search_summary: null,
  };

  contexts.forEach(ctx => {
    if (ctx.surnames) {
      merged.surnames.push(...ctx.surnames);
    }
    if (ctx.origins) {
      merged.origins.push(...ctx.origins);
    }
    if (ctx.migration_window && !merged.migration_window) {
      merged.migration_window = ctx.migration_window;
    }
    if (ctx.key_sites) {
      merged.key_sites.push(...ctx.key_sites);
    }
    if (ctx.sources) {
      merged.sources.push(...ctx.sources);
    }
  });

  // Deduplicate
  merged.surnames = [...new Set(merged.surnames)];
  merged.origins = [...new Set(merged.origins)];
  merged.key_sites = [...new Set(merged.key_sites)];

  return merged;
}
