/**
 * Phase Gate Middleware
 * VoyGent V3 - Two-Phase Workflow Enforcement
 *
 * Enforces Constitution principle II: Two-Phase Conversational Workflow
 * Blocks Phase 2 (booking API calls) until destinations_confirmed = true
 */

import { DatabaseClient, ThemedTrip } from './db';
import { Logger } from './logger';

export interface PhaseGateResult {
  allowed: boolean;
  trip?: ThemedTrip;
  error?: {
    code: string;
    message: string;
    requiresConfirmation: boolean;
  };
}

/**
 * Phase Gate Middleware
 */
export class PhaseGate {
  constructor(
    private db: DatabaseClient,
    private logger: Logger
  ) {}

  /**
   * Check if Phase 2 operations are allowed
   *
   * @param tripId - Trip ID to check
   * @returns PhaseGateResult with allowed flag and error details if blocked
   */
  async checkPhase2Access(tripId: string): Promise<PhaseGateResult> {
    const trip = await this.db.getTrip(tripId);

    if (!trip) {
      return {
        allowed: false,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found',
          requiresConfirmation: false,
        },
      };
    }

    // Check if destinations are confirmed (phase gate)
    if (!trip.destinations_confirmed) {
      this.logger.warn(`Phase 2 blocked for trip ${tripId}: destinations not confirmed`);

      return {
        allowed: false,
        trip,
        error: {
          code: 'DESTINATIONS_NOT_CONFIRMED',
          message: 'Destinations must be confirmed before trip building',
          requiresConfirmation: true,
        },
      };
    }

    // Phase 2 allowed
    this.logger.debug(`Phase 2 allowed for trip ${tripId}: destinations confirmed`);
    return {
      allowed: true,
      trip,
    };
  }

  /**
   * Check if trip is in valid state for destination confirmation
   *
   * @param tripId - Trip ID to check
   * @returns PhaseGateResult with allowed flag
   */
  async checkConfirmationEligibility(tripId: string): Promise<PhaseGateResult> {
    const trip = await this.db.getTrip(tripId);

    if (!trip) {
      return {
        allowed: false,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found',
          requiresConfirmation: false,
        },
      };
    }

    // Check if destinations are already confirmed
    if (trip.destinations_confirmed) {
      return {
        allowed: false,
        trip,
        error: {
          code: 'ALREADY_CONFIRMED',
          message: 'Destinations already confirmed',
          requiresConfirmation: false,
        },
      };
    }

    // Check if research destinations exist
    if (!trip.research_destinations) {
      return {
        allowed: false,
        trip,
        error: {
          code: 'NO_RESEARCH_DESTINATIONS',
          message: 'No destinations to confirm. Complete research phase first.',
          requiresConfirmation: false,
        },
      };
    }

    return {
      allowed: true,
      trip,
    };
  }

  /**
   * Check if trip is in valid state for option selection
   *
   * @param tripId - Trip ID to check
   * @returns PhaseGateResult with allowed flag
   */
  async checkOptionSelectionEligibility(tripId: string): Promise<PhaseGateResult> {
    const trip = await this.db.getTrip(tripId);

    if (!trip) {
      return {
        allowed: false,
        error: {
          code: 'TRIP_NOT_FOUND',
          message: 'Trip not found',
          requiresConfirmation: false,
        },
      };
    }

    // Check if destinations are confirmed (Phase 2 gate)
    if (!trip.destinations_confirmed) {
      return {
        allowed: false,
        trip,
        error: {
          code: 'DESTINATIONS_NOT_CONFIRMED',
          message: 'Destinations must be confirmed before selecting options',
          requiresConfirmation: true,
        },
      };
    }

    // Check if options are ready
    if (!trip.options_json) {
      return {
        allowed: false,
        trip,
        error: {
          code: 'OPTIONS_NOT_READY',
          message: 'Trip options not yet generated. Please wait for trip building to complete.',
          requiresConfirmation: false,
        },
      };
    }

    // Allow re-selection until handoff is complete
    // Users can change their mind before finalizing with a travel agent

    return {
      allowed: true,
      trip,
    };
  }

  /**
   * Get current phase for a trip
   *
   * @param trip - ThemedTrip object
   * @returns Phase identifier: 'phase1' or 'phase2'
   */
  getCurrentPhase(trip: ThemedTrip): 'phase1' | 'phase2' {
    return trip.destinations_confirmed ? 'phase2' : 'phase1';
  }

  /**
   * Validate phase transition
   *
   * @param trip - ThemedTrip object
   * @param targetPhase - Target phase to transition to
   * @returns True if transition is valid
   */
  canTransitionTo(trip: ThemedTrip, targetPhase: 'phase1' | 'phase2'): boolean {
    const currentPhase = this.getCurrentPhase(trip);

    // Phase 1 -> Phase 1: always allowed
    if (targetPhase === 'phase1') {
      return true;
    }

    // Phase 1 -> Phase 2: requires confirmation
    if (currentPhase === 'phase1' && targetPhase === 'phase2') {
      return trip.destinations_confirmed === 1;
    }

    // Phase 2 -> Phase 2: always allowed
    return true;
  }
}

/**
 * Create phase gate instance
 */
export function createPhaseGate(db: DatabaseClient, logger: Logger): PhaseGate {
  return new PhaseGate(db, logger);
}

/**
 * Helper: Check if endpoint requires Phase 2 access
 *
 * @param pathname - Request pathname (e.g., '/api/trips/:id/select')
 * @returns True if endpoint requires Phase 2
 */
export function isPhase2Endpoint(pathname: string): boolean {
  const phase2Endpoints = [
    '/select',       // POST /api/trips/:id/select
    '/handoff',      // POST /api/trips/:id/handoff
  ];

  return phase2Endpoints.some((endpoint) => pathname.includes(endpoint));
}

/**
 * Helper: Check if endpoint is destination confirmation
 *
 * @param pathname - Request pathname
 * @returns True if endpoint is /confirm-destinations
 */
export function isConfirmDestinationsEndpoint(pathname: string): boolean {
  return pathname.includes('/confirm-destinations');
}
