// Handoff Document Validation Service
// Validates handoff JSON structures per data-model.md

import {
  HandoffDocument,
  ChatMessage,
  UserPreferences,
  FlightOption,
  HotelOption,
  DailyPlan
} from '../handoff-documents';

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export class HandoffValidator {
  /**
   * Validate chat history structure
   */
  static validateChatHistory(history: ChatMessage[]): ValidationResult {
    const errors: FieldError[] = [];

    if (!Array.isArray(history)) {
      errors.push({ field: 'chatHistory', message: 'Must be an array' });
      return { valid: false, errors };
    }

    if (history.length > 100) {
      errors.push({ field: 'chatHistory', message: 'Cannot exceed 100 messages' });
    }

    history.forEach((msg, index) => {
      if (!msg.role || !['user', 'assistant'].includes(msg.role)) {
        errors.push({ field: `chatHistory[${index}].role`, message: 'Must be "user" or "assistant"' });
      }
      if (!msg.content || typeof msg.content !== 'string') {
        errors.push({ field: `chatHistory[${index}].content`, message: 'Content is required and must be a string' });
      } else if (msg.content.length > 10000) {
        errors.push({ field: `chatHistory[${index}].content`, message: 'Message exceeds 10,000 characters' });
      }
      if (!msg.timestamp) {
        errors.push({ field: `chatHistory[${index}].timestamp`, message: 'Timestamp is required' });
      }
    });

    // Validate chronological order
    for (let i = 1; i < history.length; i++) {
      const prev = new Date(history[i - 1].timestamp);
      const curr = new Date(history[i].timestamp);
      if (curr < prev) {
        errors.push({ field: 'chatHistory', message: 'Messages must be in chronological order' });
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate user preferences structure
   */
  static validateUserPreferences(prefs: UserPreferences): ValidationResult {
    const errors: FieldError[] = [];

    if (!prefs) {
      errors.push({ field: 'userPreferences', message: 'User preferences are required' });
      return { valid: false, errors };
    }

    // Required fields
    if (!prefs.luxuryLevel || typeof prefs.luxuryLevel !== 'string') {
      errors.push({ field: 'userPreferences.luxuryLevel', message: 'Luxury level is required' });
    }
    if (!prefs.activityLevel || typeof prefs.activityLevel !== 'string') {
      errors.push({ field: 'userPreferences.activityLevel', message: 'Activity level is required' });
    }
    if (!prefs.transport || typeof prefs.transport !== 'string') {
      errors.push({ field: 'userPreferences.transport', message: 'Transport preference is required' });
    }
    if (!prefs.days || typeof prefs.days !== 'number' || prefs.days < 1) {
      errors.push({ field: 'userPreferences.days', message: 'Days must be a number >= 1' });
    }
    if (!prefs.adults || typeof prefs.adults !== 'number' || prefs.adults < 1) {
      errors.push({ field: 'userPreferences.adults', message: 'Adults must be a number >= 1' });
    }

    // Optional fields validation
    if (prefs.children !== undefined && (typeof prefs.children !== 'number' || prefs.children < 0)) {
      errors.push({ field: 'userPreferences.children', message: 'Children must be a number >= 0' });
    }
    if (prefs.budgetUsd !== undefined && (typeof prefs.budgetUsd !== 'number' || prefs.budgetUsd < 0)) {
      errors.push({ field: 'userPreferences.budgetUsd', message: 'Budget must be a number >= 0' });
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate flight options array
   */
  static validateFlightOptions(options: FlightOption[]): ValidationResult {
    const errors: FieldError[] = [];

    if (!Array.isArray(options)) {
      errors.push({ field: 'allFlightOptions', message: 'Must be an array' });
      return { valid: false, errors };
    }

    options.forEach((flight, index) => {
      if (!flight.id) {
        errors.push({ field: `allFlightOptions[${index}].id`, message: 'Flight ID is required' });
      }
      if (!flight.carrier) {
        errors.push({ field: `allFlightOptions[${index}].carrier`, message: 'Carrier is required' });
      }
      if (!flight.from || !flight.from.airportCode) {
        errors.push({ field: `allFlightOptions[${index}].from`, message: 'From airport is required' });
      }
      if (!flight.to || !flight.to.airportCode) {
        errors.push({ field: `allFlightOptions[${index}].to`, message: 'To airport is required' });
      }
      if (typeof flight.basePriceUsd !== 'number' || flight.basePriceUsd < 0) {
        errors.push({ field: `allFlightOptions[${index}].basePriceUsd`, message: 'Valid base price is required' });
      }
      if (typeof flight.estimatedPriceUsd !== 'number' || flight.estimatedPriceUsd < 0) {
        errors.push({ field: `allFlightOptions[${index}].estimatedPriceUsd`, message: 'Valid estimated price is required' });
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate hotel options array
   */
  static validateHotelOptions(options: HotelOption[]): ValidationResult {
    const errors: FieldError[] = [];

    if (!Array.isArray(options)) {
      errors.push({ field: 'allHotelOptions', message: 'Must be an array' });
      return { valid: false, errors };
    }

    options.forEach((hotel, index) => {
      if (!hotel.id) {
        errors.push({ field: `allHotelOptions[${index}].id`, message: 'Hotel ID is required' });
      }
      if (!hotel.name) {
        errors.push({ field: `allHotelOptions[${index}].name`, message: 'Hotel name is required' });
      }
      if (typeof hotel.starRating !== 'number' || hotel.starRating < 1 || hotel.starRating > 5) {
        errors.push({ field: `allHotelOptions[${index}].starRating`, message: 'Star rating must be 1-5' });
      }
      if (typeof hotel.basePricePerNightUsd !== 'number' || hotel.basePricePerNightUsd < 0) {
        errors.push({ field: `allHotelOptions[${index}].basePricePerNightUsd`, message: 'Valid base price is required' });
      }
      if (typeof hotel.estimatedPricePerNightUsd !== 'number' || hotel.estimatedPricePerNightUsd < 0) {
        errors.push({ field: `allHotelOptions[${index}].estimatedPricePerNightUsd`, message: 'Valid estimated price is required' });
      }
    });

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate daily itinerary array
   */
  static validateDailyItinerary(itinerary: DailyPlan[]): ValidationResult {
    const errors: FieldError[] = [];

    if (!Array.isArray(itinerary)) {
      errors.push({ field: 'dailyItinerary', message: 'Must be an array' });
      return { valid: false, errors };
    }

    if (itinerary.length === 0) {
      errors.push({ field: 'dailyItinerary', message: 'Must contain at least one day' });
      return { valid: false, errors };
    }

    itinerary.forEach((day, index) => {
      if (typeof day.day !== 'number' || day.day < 1) {
        errors.push({ field: `dailyItinerary[${index}].day`, message: 'Day must be a number >= 1' });
      }
      if (!day.date || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
        errors.push({ field: `dailyItinerary[${index}].date`, message: 'Date must be in YYYY-MM-DD format' });
      }
      if (!day.location) {
        errors.push({ field: `dailyItinerary[${index}].location`, message: 'Location is required' });
      }
      if (!Array.isArray(day.activities)) {
        errors.push({ field: `dailyItinerary[${index}].activities`, message: 'Activities must be an array' });
      } else {
        day.activities.forEach((activity, actIndex) => {
          if (!activity.time || !/^\d{2}:\d{2}$/.test(activity.time)) {
            errors.push({ field: `dailyItinerary[${index}].activities[${actIndex}].time`, message: 'Time must be in HH:MM format' });
          }
          if (!activity.activity) {
            errors.push({ field: `dailyItinerary[${index}].activities[${actIndex}].activity`, message: 'Activity description is required' });
          }
          if (!activity.type || !['paid_tour', 'free', 'meal', 'transport'].includes(activity.type)) {
            errors.push({ field: `dailyItinerary[${index}].activities[${actIndex}].type`, message: 'Type must be paid_tour, free, meal, or transport' });
          }
          if (typeof activity.costUsd !== 'number' || activity.costUsd < 0) {
            errors.push({ field: `dailyItinerary[${index}].activities[${actIndex}].costUsd`, message: 'Cost must be a number >= 0' });
          }
        });
      }
      if (!day.whyWeSuggest) {
        errors.push({ field: `dailyItinerary[${index}].whyWeSuggest`, message: '"Why we suggest" is required' });
      }
      if (typeof day.dailyTotalUsd !== 'number' || day.dailyTotalUsd < 0) {
        errors.push({ field: `dailyItinerary[${index}].dailyTotalUsd`, message: 'Daily total must be a number >= 0' });
      }
    });

    // Validate sequential day numbers
    for (let i = 0; i < itinerary.length; i++) {
      if (itinerary[i].day !== i + 1) {
        errors.push({ field: 'dailyItinerary', message: 'Day numbers must be sequential starting from 1' });
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Calculate expiry date (created_at + 30 days)
   */
  static calculateExpiry(createdAt: Date): Date {
    const expiry = new Date(createdAt);
    expiry.setDate(expiry.getDate() + 30);
    return expiry;
  }

  /**
   * Validate complete handoff document
   */
  static validateHandoffDocument(handoff: Partial<HandoffDocument>): ValidationResult {
    const errors: FieldError[] = [];

    // Validate chat history
    if (handoff.chatHistory) {
      const result = this.validateChatHistory(handoff.chatHistory);
      errors.push(...result.errors);
    } else {
      errors.push({ field: 'chatHistory', message: 'Chat history is required' });
    }

    // Validate user preferences
    if (handoff.userPreferences) {
      const result = this.validateUserPreferences(handoff.userPreferences);
      errors.push(...result.errors);
    } else {
      errors.push({ field: 'userPreferences', message: 'User preferences are required' });
    }

    // Validate flight options
    if (handoff.allFlightOptions) {
      const result = this.validateFlightOptions(handoff.allFlightOptions);
      errors.push(...result.errors);
    } else {
      errors.push({ field: 'allFlightOptions', message: 'Flight options are required' });
    }

    // Validate hotel options
    if (handoff.allHotelOptions) {
      const result = this.validateHotelOptions(handoff.allHotelOptions);
      errors.push(...result.errors);
    } else {
      errors.push({ field: 'allHotelOptions', message: 'Hotel options are required' });
    }

    // Validate daily itinerary
    if (handoff.dailyItinerary) {
      const result = this.validateDailyItinerary(handoff.dailyItinerary);
      errors.push(...result.errors);
    } else {
      errors.push({ field: 'dailyItinerary', message: 'Daily itinerary is required' });
    }

    // Validate business logic
    if (handoff.totalEstimateUsd !== undefined && handoff.totalEstimateUsd <= 0) {
      errors.push({ field: 'totalEstimateUsd', message: 'Total estimate must be > 0' });
    }

    if (handoff.agentQuoteUsd !== undefined && handoff.totalEstimateUsd !== undefined) {
      if (handoff.agentQuoteUsd < handoff.totalEstimateUsd) {
        errors.push({ field: 'agentQuoteUsd', message: 'Agent quote must be >= total estimate' });
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
