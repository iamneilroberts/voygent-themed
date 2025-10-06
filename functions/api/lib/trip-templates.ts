// Trip Template System for VoyGent
// Supports multiple trip themes: heritage, tv/movies, historical, culinary, etc.
// All templates are stored in the D1 database.

export interface TripTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  intakePrompt: string;      // Custom intake normalizer prompt
  optionsPrompt: string;      // Custom options generator prompt
  requiredFields: string[];   // Fields that MUST be extracted
  optionalFields: string[];   // Fields that are nice to have
  exampleInputs: string[];    // Example user inputs for this theme
}

// Default template ID for fallback
const DEFAULT_TEMPLATE_ID = 'heritage';

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  intake_prompt: string;
  options_prompt: string;
  required_fields: string;
  optional_fields: string;
  example_inputs: string;
  is_active: number;
}

function parseJsonArray(value: string | null, fallback: string[] = []): string[] {
  if (!value) return [...fallback];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [...fallback];
  } catch {
    return [...fallback];
  }
}

function rowToTemplate(row: TemplateRow): TripTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    intakePrompt: row.intake_prompt,
    optionsPrompt: row.options_prompt,
    requiredFields: parseJsonArray(row.required_fields),
    optionalFields: parseJsonArray(row.optional_fields),
    exampleInputs: parseJsonArray(row.example_inputs)
  };
}

function normalizeTemplate(template: TripTemplate): TripTemplate {
  return {
    id: template.id.trim(),
    name: template.name.trim(),
    description: template.description.trim(),
    icon: template.icon.trim(),
    intakePrompt: template.intakePrompt.trim(),
    optionsPrompt: template.optionsPrompt.trim(),
    requiredFields: (template.requiredFields || []).map(f => f.trim()).filter(Boolean),
    optionalFields: (template.optionalFields || []).map(f => f.trim()).filter(Boolean),
    exampleInputs: (template.exampleInputs || []).map(f => f.trim()).filter(Boolean)
  };
}

function detectTemplateId(input: string, explicitTheme?: string): string {
  if (explicitTheme) return explicitTheme;

  const lowerInput = input.toLowerCase();

  if (lowerInput.match(/game of thrones|harry potter|lord of the rings|star wars|filming location|movie|tv show|series/i)) {
    return 'tvmovie';
  }

  if (lowerInput.match(/wwii|world war|battle|historical|revolution|ancient|empire|medieval/i)) {
    return 'historical';
  }

  if (lowerInput.match(/food|cuisine|cooking class|wine tour|michelin|restaurant|culinary|market/i)) {
    return 'culinary';
  }

  if (lowerInput.match(/hiking|safari|adventure|climbing|kayaking|wildlife|camping|national park/i)) {
    return 'adventure';
  }

  if (lowerInput.match(/surname|ancestry|family|genealogy|heritage|roots|immigrant/i)) {
    return 'heritage';
  }

  return DEFAULT_TEMPLATE_ID;
}

export async function listTemplates(db: D1Database, includeInactive: boolean = false): Promise<TripTemplate[]> {
  const query = includeInactive
    ? `SELECT * FROM trip_templates ORDER BY name`
    : `SELECT * FROM trip_templates WHERE is_active = 1 ORDER BY name`;

  const result = await db.prepare(query).all();
  const rows = (result.results || []) as TemplateRow[];

  return rows.map(rowToTemplate);
}

export async function getTemplate(id: string, db: D1Database, includeInactive: boolean = true): Promise<TripTemplate | null> {
  const query = includeInactive
    ? `SELECT * FROM trip_templates WHERE id = ?`
    : `SELECT * FROM trip_templates WHERE id = ? AND is_active = 1`;

  const row = await db.prepare(query).bind(id).first<TemplateRow>();

  if (row) {
    return rowToTemplate(row);
  }

  return null;
}

export async function selectTemplate(input: string, explicitTheme: string | undefined, db: D1Database): Promise<TripTemplate> {
  const templateId = detectTemplateId(input, explicitTheme);
  const template = await getTemplate(templateId, db, true);

  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  return template;
}

export async function upsertTemplate(db: D1Database, template: TripTemplate): Promise<TripTemplate> {
  const normalized = normalizeTemplate(template);

  if (!normalized.id || !normalized.name || !normalized.intakePrompt || !normalized.optionsPrompt) {
    throw new Error('Missing required template fields');
  }

  await db.prepare(
    `INSERT INTO trip_templates
      (id, name, description, icon, intake_prompt, options_prompt, required_fields, optional_fields, example_inputs, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      intake_prompt = excluded.intake_prompt,
      options_prompt = excluded.options_prompt,
      required_fields = excluded.required_fields,
      optional_fields = excluded.optional_fields,
      example_inputs = excluded.example_inputs,
      is_active = 1,
      updated_at = unixepoch()`
  ).bind(
    normalized.id,
    normalized.name,
    normalized.description,
    normalized.icon,
    normalized.intakePrompt,
    normalized.optionsPrompt,
    JSON.stringify(normalized.requiredFields),
    JSON.stringify(normalized.optionalFields),
    JSON.stringify(normalized.exampleInputs)
  ).run();

  const saved = await getTemplate(normalized.id, db, true);
  if (!saved) {
    throw new Error('Failed to persist template');
  }

  return saved;
}

export async function deactivateTemplate(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    `UPDATE trip_templates SET is_active = 0, updated_at = unixepoch() WHERE id = ?`
  ).bind(id).run();
}

export async function deleteTemplate(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM trip_templates WHERE id = ?`).bind(id).run();
}
