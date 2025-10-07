import type { D1Database } from '@cloudflare/workers-types';
import { runMigrations } from './migrations';

/**
 * Set up test database with seed data (templates, agencies)
 */
export async function setupTestDatabase(db: D1Database) {
  // First, run all migrations to create tables
  await runMigrations(db);
  // Seed trip templates (all 5 themes)
  const templates = [
    {
      id: 'heritage',
      name: 'Family Heritage Discovery',
      description: 'Discover your family roots and ancestral heritage',
      theme: 'heritage',
      icon: '🏰',
      tags: JSON.stringify(['genealogy', 'ancestry', 'heritage']),
      researchQueryTemplate: '{surname} family heritage sites ancestral homes castles historical tours travel destinations',
      researchSynthesisPrompt: 'Analyze heritage research for {surname} family'
    },
    {
      id: 'tvmovie',
      name: 'Screen Tours',
      description: 'Visit filming locations from your favorite movies and TV shows',
      theme: 'tvmovie',
      icon: '🎬',
      tags: JSON.stringify(['filming-locations', 'movies', 'tv-shows']),
      researchQueryTemplate: '{title} filming locations movie sets TV show locations travel destinations',
      researchSynthesisPrompt: 'Analyze filming locations for {title}'
    },
    {
      id: 'historical',
      name: 'Historical Journey',
      description: 'Explore historical events, periods, and monuments',
      theme: 'historical',
      icon: '📜',
      tags: JSON.stringify(['history', 'museums', 'monuments']),
      researchQueryTemplate: '{event} historical sites museums memorials travel destinations',
      researchSynthesisPrompt: 'Analyze historical sites for {event}'
    },
    {
      id: 'culinary',
      name: 'Culinary Adventure',
      description: 'Savor authentic cuisines and culinary experiences',
      theme: 'culinary',
      icon: '🍽️',
      tags: JSON.stringify(['food', 'cooking', 'restaurants']),
      researchQueryTemplate: '{cuisine} {region} restaurants cooking classes food tours culinary experiences',
      researchSynthesisPrompt: 'Analyze culinary experiences for {cuisine} in {region}'
    },
    {
      id: 'adventure',
      name: 'Outdoor Exploration',
      description: 'Experience outdoor adventures and wilderness',
      theme: 'adventure',
      icon: '⛰️',
      tags: JSON.stringify(['hiking', 'outdoor', 'adventure']),
      researchQueryTemplate: '{destination} {activity} adventure tours outdoor activities travel destinations',
      researchSynthesisPrompt: 'Analyze adventure activities in {destination}'
    }
  ];

  for (const template of templates) {
    await db.prepare(`
      INSERT OR REPLACE INTO trip_templates
      (id, name, description, theme, icon, tags, researchQueryTemplate, researchSynthesisPrompt, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `)
      .bind(
        template.id,
        template.name,
        template.description,
        template.theme,
        template.icon,
        template.tags,
        template.researchQueryTemplate,
        template.researchSynthesisPrompt
      )
      .run();
  }

  console.log('[TEST] ✓ Test database seeded with templates');
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(db: D1Database) {
  // Delete test trips and messages (using test-user-% prefix)
  await db.prepare('DELETE FROM themed_messages WHERE trip_id IN (SELECT id FROM themed_trips WHERE user_id LIKE ?)')
    .bind('test-user-%')
    .run();

  await db.prepare('DELETE FROM themed_trips WHERE user_id LIKE ?')
    .bind('test-user-%')
    .run();

  console.log('[TEST] ✓ Test data cleaned up');
}

/**
 * Generate unique test user ID
 */
export function generateTestUserId(): string {
  return `test-user-${crypto.randomUUID()}`;
}

/**
 * Generate unique test agency ID
 */
export function generateTestAgencyId(): string {
  return `test-agency-${crypto.randomUUID()}`;
}

/**
 * Generate unique test trip ID
 */
export function generateTestTripId(): string {
  return `test-trip-${crypto.randomUUID()}`;
}
