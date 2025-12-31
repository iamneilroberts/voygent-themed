/**
 * Transportation Service
 * VoyGent V3 - Smart Transportation Recommendations
 *
 * Analyzes trip options and user preferences to recommend:
 * - Rental car (self-drive)
 * - Public transit (trains, buses)
 * - Driver hire (private driver)
 * - Tour buses
 * - Mixed approach
 *
 * Considers:
 * - Driving side differences (left vs right)
 * - Traveler ages and comfort
 * - Number of travelers
 * - Local transit quality
 * - Route complexity
 */
import { createCostTracker } from '../lib/cost-tracker';
import { createAIProviderManager } from '../lib/ai-providers';
// Countries that drive on the left
const LEFT_DRIVING_COUNTRIES = [
    'United Kingdom', 'UK', 'Ireland', 'Australia', 'New Zealand', 'Japan',
    'India', 'South Africa', 'Thailand', 'Malaysia', 'Singapore', 'Kenya',
    'Hong Kong', 'Cyprus', 'Malta', 'Jamaica', 'Barbados', 'Bahamas'
];
// Countries where Americans typically drive on the right (familiar)
const RIGHT_DRIVING_COUNTRIES = [
    'United States', 'US', 'USA', 'Canada', 'Mexico', 'France', 'Germany',
    'Spain', 'Italy', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland',
    'Austria', 'Poland', 'Czech Republic', 'Hungary', 'Greece', 'Turkey',
    'Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia'
];
export class TransportationService {
    env;
    db;
    logger;
    aiProvider;
    constructor(env, db, logger) {
        this.env = env;
        this.db = db;
        this.logger = logger;
        this.aiProvider = createAIProviderManager(env, logger);
    }
    /**
     * Generate smart transportation recommendations
     */
    async generateRecommendation(request) {
        const { tripId, selectedOption, destinations, preferences } = request;
        const costTracker = createCostTracker(this.db, this.logger, tripId);
        // Analyze driving side for destinations
        const drivingSideAnalysis = this.analyzeDrivingSide(destinations, preferences.home_country);
        // Build traveler profile
        const travelerProfile = this.buildTravelerProfile(preferences);
        // Generate AI recommendation
        const recommendation = await this.generateAIRecommendation(selectedOption, destinations, preferences, drivingSideAnalysis, travelerProfile, costTracker, tripId);
        return recommendation;
    }
    /**
     * Analyze driving side differences between home and destination countries
     */
    analyzeDrivingSide(destinations, homeCountry) {
        const home = homeCountry || 'US'; // Default to US
        // Check if home country drives on the left
        const homeIsLeft = LEFT_DRIVING_COUNTRIES.some(c => home.toLowerCase().includes(c.toLowerCase()));
        // Check destinations
        const destSides = destinations.map(dest => {
            const isLeft = LEFT_DRIVING_COUNTRIES.some(c => dest.toLowerCase().includes(c.toLowerCase()));
            return isLeft ? 'left' : 'right';
        });
        const hasLeft = destSides.includes('left');
        const hasRight = destSides.includes('right');
        let destinationSide;
        if (hasLeft && hasRight) {
            destinationSide = 'mixed';
        }
        else if (hasLeft) {
            destinationSide = 'left';
        }
        else {
            destinationSide = 'right';
        }
        const homeSide = homeIsLeft ? 'left' : 'right';
        const requiresSideSwitch = homeSide !== destinationSide && destinationSide !== 'mixed';
        let warning;
        if (requiresSideSwitch) {
            warning = `Driving is on the ${destinationSide} side in your destinations, which is different from ${home}. Consider whether you're comfortable with this.`;
        }
        return {
            requiresSideSwitch,
            destinationSide,
            warning,
        };
    }
    /**
     * Build traveler profile for recommendations
     */
    buildTravelerProfile(preferences) {
        const adults = preferences.travelers_adults || 2;
        const children = preferences.travelers_children || 0;
        const ages = preferences.traveler_ages || [];
        const hasChildren = children > 0 || ages.some(a => a < 18);
        const hasSeniors = ages.some(a => a >= 65);
        let ageRange = 'adults';
        if (hasChildren && hasSeniors) {
            ageRange = 'multi-generational (children to seniors)';
        }
        else if (hasChildren) {
            ageRange = 'family with children';
        }
        else if (hasSeniors) {
            ageRange = 'includes seniors (65+)';
        }
        return {
            totalTravelers: adults + children,
            hasChildren,
            hasSeniors,
            ageRange,
            drivingComfort: preferences.driving_comfort || 'prefer_familiar',
        };
    }
    /**
     * Generate AI-powered transportation recommendation
     */
    async generateAIRecommendation(option, destinations, preferences, drivingSideAnalysis, travelerProfile, costTracker, tripId) {
        const hotelCities = option.hotels.map(h => h.city);
        const tourCities = [...new Set(option.tours.map(t => t.city))];
        const prompt = `You are a transportation planning expert. Analyze this trip and recommend the best transportation approach.

TRIP OVERVIEW:
- Destinations: ${destinations.join(' → ')}
- Hotels: ${option.hotels.map(h => `${h.name} in ${h.city} (${h.nights} nights)`).join(', ')}
- Tours: ${option.tours.map(t => `${t.name} in ${t.city}`).join(', ')}

TRAVELER PROFILE:
- Number of travelers: ${travelerProfile.totalTravelers}
- Ages: ${travelerProfile.ageRange}
- Driving comfort abroad: ${travelerProfile.drivingComfort}
${preferences.transportation_preference ? `- Preference: ${preferences.transportation_preference}` : ''}

DRIVING CONSIDERATIONS:
- Driving side in destinations: ${drivingSideAnalysis.destinationSide}
- Requires switching from home country: ${drivingSideAnalysis.requiresSideSwitch ? 'Yes' : 'No'}
${drivingSideAnalysis.warning ? `- Warning: ${drivingSideAnalysis.warning}` : ''}

ANALYZE AND RECOMMEND:
1. Consider local public transit quality in each destination
2. Consider distances between destinations
3. Consider luggage handling with ${travelerProfile.totalTravelers} travelers
4. Consider flexibility needs for tours and activities
5. Consider cost-effectiveness

Respond with ONLY valid JSON:
{
  "primary_mode": "rental_car" | "public_transit" | "driver_hire" | "tour_bus" | "mixed",
  "reasoning": "2-3 sentence explanation of why this is the best choice",
  "considerations": [
    "Key consideration 1",
    "Key consideration 2",
    "Key consideration 3"
  ],
  "recommendations_by_segment": [
    {
      "from": "City A",
      "to": "City B",
      "recommended_mode": "train/car/bus/driver",
      "duration": "estimated time",
      "notes": "specific advice",
      "cost_estimate_usd": 50
    }
  ],
  "estimated_cost_usd": 500
}`;
        try {
            const aiResponse = await this.aiProvider.generate({
                prompt,
                systemPrompt: 'You are a transportation planning expert. Provide practical, safety-conscious recommendations. Respond with valid JSON only.',
                maxTokens: 1000,
                temperature: 0.5,
            }, {
                tripId,
                taskType: 'transportation_recommendation',
                costTracker,
            });
            await this.logger.logTelemetry(this.db, tripId, 'transportation_recommendation', {
                provider: aiResponse.provider,
                model: aiResponse.model,
                tokens: aiResponse.totalTokens,
                cost: aiResponse.cost,
                details: {
                    destinations: destinations.length,
                    traveler_count: travelerProfile.totalTravelers,
                    driving_side_switch: drivingSideAnalysis.requiresSideSwitch,
                },
            });
            // Parse AI response
            const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const recommendation = JSON.parse(jsonMatch[0]);
                // Add driving side warning to considerations if applicable
                if (drivingSideAnalysis.warning && !recommendation.considerations.includes(drivingSideAnalysis.warning)) {
                    recommendation.considerations.unshift(drivingSideAnalysis.warning);
                }
                this.logger.info(`Transportation recommendation: ${recommendation.primary_mode}`);
                return recommendation;
            }
        }
        catch (error) {
            this.logger.error(`Transportation recommendation failed: ${error}`);
        }
        // Fallback recommendation
        return this.generateFallbackRecommendation(destinations, travelerProfile, drivingSideAnalysis);
    }
    /**
     * Generate fallback recommendation when AI fails
     */
    generateFallbackRecommendation(destinations, travelerProfile, drivingSideAnalysis) {
        let primaryMode = 'mixed';
        let reasoning = '';
        const considerations = [];
        // Determine recommendation based on profile
        if (travelerProfile.drivingComfort === 'no_driving') {
            primaryMode = 'public_transit';
            reasoning = 'Based on your preference to avoid driving, we recommend public transit and driver services.';
        }
        else if (drivingSideAnalysis.requiresSideSwitch && travelerProfile.drivingComfort !== 'comfortable_abroad') {
            primaryMode = 'driver_hire';
            reasoning = 'Due to different driving side and your comfort preferences, a hired driver or tour services are recommended.';
        }
        else if (travelerProfile.totalTravelers >= 5) {
            primaryMode = 'driver_hire';
            reasoning = 'With a larger group, a private driver or van service is more practical than rental cars.';
        }
        else {
            primaryMode = 'mixed';
            reasoning = 'A combination of rental car for flexibility and public transit where convenient is recommended.';
        }
        if (drivingSideAnalysis.warning) {
            considerations.push(drivingSideAnalysis.warning);
        }
        if (travelerProfile.hasSeniors) {
            considerations.push('Consider comfort and accessibility for senior travelers.');
        }
        if (travelerProfile.hasChildren) {
            considerations.push('Plan for child car seats if renting a vehicle.');
        }
        // Generate basic segments
        const segments = [];
        for (let i = 0; i < destinations.length - 1; i++) {
            segments.push({
                from: destinations[i],
                to: destinations[i + 1],
                recommended_mode: primaryMode === 'mixed' ? 'varies' : primaryMode,
                duration: 'varies',
                notes: 'Check local options for best route',
            });
        }
        return {
            primary_mode: primaryMode,
            reasoning,
            considerations,
            recommendations_by_segment: segments,
            estimated_cost_usd: 0, // Cannot estimate without AI
        };
    }
}
/**
 * Create transportation service
 */
export function createTransportationService(env, db, logger) {
    return new TransportationService(env, db, logger);
}
