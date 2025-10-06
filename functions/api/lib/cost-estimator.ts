/**
 * Cost Estimator Logic
 * Feature: 001-web-search-integration
 *
 * Calculates per-person trip cost with 10-15% commission headroom on top of range.
 * Formula: total_per_person = [subtotal_low, Math.ceil(subtotal_high * (1 + commission_pct/100))]
 */

export interface HotelCostInput {
  city: string;
  nights: number;
  nightly_low: number;
  nightly_high: number;
}

export interface TourCostInput {
  name: string;
  price_low: number;
  price_high: number;
}

export interface TransportCostInput {
  type: 'train' | 'car_rental' | 'driver' | 'taxi' | 'bus';
  route?: string;
  days?: number;
  price_low: number;
  price_high: number;
}

export interface CostEstimateInput {
  trip_id: string;
  airfare: {
    price_low: number;
    price_high: number;
  };
  hotels: HotelCostInput[];
  tours?: TourCostInput[];
  transport?: TransportCostInput[];
  commission_pct?: number; // 10-15, default 15
}

export interface CostEstimate {
  trip_id: string;
  airfare: [number, number];
  hotels: [number, number];
  tours: [number, number];
  transport: [number, number];
  subtotal: [number, number];
  total_per_person: [number, number];
  commission_included: boolean;
  commission_pct: number;
  currency: string;
  disclaimer: string;
  estimate_date: string;
}

/**
 * Calculate cost estimate with commission headroom
 */
export function calculateCostEstimate(input: CostEstimateInput): CostEstimate {
  const {
    trip_id,
    airfare,
    hotels,
    tours = [],
    transport = [],
    commission_pct = 15,
  } = input;

  // Validate commission percentage
  if (commission_pct < 10 || commission_pct > 15) {
    throw new Error('Commission percentage must be between 10 and 15');
  }

  // Calculate component ranges
  const airfareRange: [number, number] = [airfare.price_low, airfare.price_high];

  // Hotels: sum nightly_low * nights, sum nightly_high * nights
  const hotelsLow = hotels.reduce((sum, h) => sum + (h.nightly_low * h.nights), 0);
  const hotelsHigh = hotels.reduce((sum, h) => sum + (h.nightly_high * h.nights), 0);
  const hotelsRange: [number, number] = [hotelsLow, hotelsHigh];

  // Tours: sum price_low, sum price_high
  const toursLow = tours.reduce((sum, t) => sum + t.price_low, 0);
  const toursHigh = tours.reduce((sum, t) => sum + t.price_high, 0);
  const toursRange: [number, number] = [toursLow, toursHigh];

  // Transport: sum price_low, sum price_high
  const transportLow = transport.reduce((sum, t) => sum + t.price_low, 0);
  const transportHigh = transport.reduce((sum, t) => sum + t.price_high, 0);
  const transportRange: [number, number] = [transportLow, transportHigh];

  // Subtotal
  const subtotalLow = airfareRange[0] + hotelsRange[0] + toursRange[0] + transportRange[0];
  const subtotalHigh = airfareRange[1] + hotelsRange[1] + toursRange[1] + transportRange[1];
  const subtotalRange: [number, number] = [subtotalLow, subtotalHigh];

  // Apply commission to top only
  const totalLow = subtotalLow; // No commission on low end
  const totalHigh = Math.ceil(subtotalHigh * (1 + commission_pct / 100));
  const totalRange: [number, number] = [totalLow, totalHigh];

  return {
    trip_id,
    airfare: airfareRange,
    hotels: hotelsRange,
    tours: toursRange,
    transport: transportRange,
    subtotal: subtotalRange,
    total_per_person: totalRange,
    commission_included: true,
    commission_pct,
    currency: 'USD',
    disclaimer: 'final quote by travel professional',
    estimate_date: new Date().toISOString(),
  };
}
