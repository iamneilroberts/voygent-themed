// Research utility functions for query interpolation

/**
 * Interpolates placeholders in research query templates with actual values from intake data
 * Supports placeholders: {surname}, {title}, {event}, {cuisine}, {destination}, {activity}, {region}
 */
export function interpolateResearchQuery(template: string, intakeJson: any): string {
  if (!template || !intakeJson) {
    return template || '';
  }

  let query = template;

  // Replace surname placeholder (heritage theme)
  if (intakeJson.surnames && intakeJson.surnames.length > 0) {
    query = query.replace(/{surname}/g, intakeJson.surnames[0]);
  }

  // Replace title placeholder (tvmovie theme)
  if (intakeJson.titles && intakeJson.titles.length > 0) {
    query = query.replace(/{title}/g, intakeJson.titles[0]);
  }

  // Replace event placeholder (historical theme)
  if (intakeJson.events && intakeJson.events.length > 0) {
    query = query.replace(/{event}/g, intakeJson.events[0]);
  }

  // Replace cuisine placeholder (culinary theme)
  if (intakeJson.cuisines && intakeJson.cuisines.length > 0) {
    query = query.replace(/{cuisine}/g, intakeJson.cuisines[0]);
  }

  // Replace destination placeholder (adventure theme)
  if (intakeJson.destinations && intakeJson.destinations.length > 0) {
    query = query.replace(/{destination}/g, intakeJson.destinations[0]);
  }

  // Replace activity placeholder (adventure theme)
  if (intakeJson.activities && intakeJson.activities.length > 0) {
    query = query.replace(/{activity}/g, intakeJson.activities[0]);
  }

  // Replace region placeholder (culinary theme, optional)
  if (intakeJson.regions && intakeJson.regions.length > 0) {
    query = query.replace(/{region}/g, intakeJson.regions[0]);
  } else {
    // Remove {region} placeholder if no region provided
    query = query.replace(/{region}/g, '').replace(/\s+/g, ' ').trim();
  }

  return query;
}
