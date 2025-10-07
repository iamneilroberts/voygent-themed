/**
 * Progress Step Definitions
 * Theme-specific progress messages and durations for trip generation
 */

/**
 * Progress steps with realistic timing based on actual API processing
 * Backend steps:
 * - Step 0-0.5: Template selection (~1s)
 * - Step 1: Intake normalization (~3-5s)
 * - Step 1.5: Research (web search) (~5-10s)
 * - Step 2: Options generation (~15-25s)
 * - Step 3: Save to database (~1s)
 *
 * Total typical time: 25-45 seconds
 */
export const PROGRESS_STEPS = {
  heritage: [
    { percent: 5, message: 'Analyzing your request...', duration: 2000 },
    { percent: 15, message: 'Understanding family heritage details...', duration: 4000 },
    { percent: 30, message: 'Researching surname origins and heritage sites...', duration: 8000 },
    { percent: 50, message: 'Finding ancestral locations and historical sites...', duration: 6000 },
    { percent: 70, message: 'Creating personalized trip options...', duration: 8000 },
    { percent: 85, message: 'Building detailed itineraries...', duration: 8000 },
    { percent: 95, message: 'Finalizing your heritage journey...', duration: 4000 }
  ],
  tvmovie: [
    { percent: 5, message: 'Analyzing your request...', duration: 2000 },
    { percent: 15, message: 'Understanding your favorite shows and movies...', duration: 4000 },
    { percent: 30, message: 'Searching for filming locations...', duration: 8000 },
    { percent: 50, message: 'Finding iconic filming sites to visit...', duration: 6000 },
    { percent: 70, message: 'Creating personalized trip options...', duration: 8000 },
    { percent: 85, message: 'Building detailed itineraries...', duration: 8000 },
    { percent: 95, message: 'Finalizing your cinematic adventure...', duration: 4000 }
  ],
  historical: [
    { percent: 5, message: 'Analyzing your request...', duration: 2000 },
    { percent: 15, message: 'Understanding historical interests...', duration: 4000 },
    { percent: 30, message: 'Researching historical events and sites...', duration: 8000 },
    { percent: 50, message: 'Finding museums, monuments, and landmarks...', duration: 6000 },
    { percent: 70, message: 'Creating personalized trip options...', duration: 8000 },
    { percent: 85, message: 'Building detailed itineraries...', duration: 8000 },
    { percent: 95, message: 'Finalizing your historical journey...', duration: 4000 }
  ],
  culinary: [
    { percent: 5, message: 'Analyzing your request...', duration: 2000 },
    { percent: 15, message: 'Understanding culinary preferences...', duration: 4000 },
    { percent: 30, message: 'Researching cuisines and food destinations...', duration: 8000 },
    { percent: 50, message: 'Finding restaurants, markets, and cooking classes...', duration: 6000 },
    { percent: 70, message: 'Creating personalized trip options...', duration: 8000 },
    { percent: 85, message: 'Building detailed itineraries...', duration: 8000 },
    { percent: 95, message: 'Finalizing your culinary adventure...', duration: 4000 }
  ],
  adventure: [
    { percent: 5, message: 'Analyzing your request...', duration: 2000 },
    { percent: 15, message: 'Understanding adventure preferences...', duration: 4000 },
    { percent: 30, message: 'Researching outdoor destinations and activities...', duration: 8000 },
    { percent: 50, message: 'Finding hiking trails, parks, and adventure sites...', duration: 6000 },
    { percent: 70, message: 'Creating personalized trip options...', duration: 8000 },
    { percent: 85, message: 'Building detailed itineraries...', duration: 8000 },
    { percent: 95, message: 'Finalizing your adventure journey...', duration: 4000 }
  ]
};
