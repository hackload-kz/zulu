// TypeScript type definitions for Billetter API

export interface Event {
  id: number;
  title: string;
  external: boolean;
}

export interface Booking {
  id: number;
  event_id: number;
  status:
    | 'booked'
    | 'seats_selected'
    | 'payment_initiated'
    | 'confirmed'
    | 'cancelled';
}

export interface Seat {
  id: number;
  row: number;
  number: number;
  reserved: boolean;
}

export interface CreateEventRequest {
  title: string;
  external: boolean;
}

export interface CreateBookingRequest {
  event_id: number;
}

export interface SelectSeatRequest {
  booking_id: number;
  seat_id: number;
}

export interface ReleaseSeatRequest {
  seat_id: number;
}

export interface InitiatePaymentRequest {
  booking_id: number;
}

export interface CancelBookingRequest {
  booking_id: number;
}

export interface SeatsQuery {
  event_id: number;
  page?: number;
  pageSize?: number;
}

export interface PaymentCallbackQuery {
  orderId: number;
}

// EventProvider types
export interface Order {
  id: string;
  status: 'STARTED' | 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED';
  started_at: number;
  updated_at: number;
  places_count: number;
}

export interface Place {
  id: string;
  row: number;
  seat: number;
  is_free: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface EventProviderConfig {
  baseURL: string;
}

// Service interfaces
export abstract class BilletterService {
  abstract createEvent(data: CreateEventRequest): Promise<{ id: number }>;
  abstract getEvents(): Promise<Event[]>;
  abstract createBooking(data: CreateBookingRequest): Promise<{ id: number }>;
  abstract getBookings(): Promise<Booking[]>;
  abstract getSeats(query: SeatsQuery): Promise<Seat[]>;
  abstract selectSeat(data: SelectSeatRequest): Promise<string>;
  abstract releaseSeat(data: ReleaseSeatRequest): Promise<string>;
  abstract initiatePayment(data: InitiatePaymentRequest): Promise<string>;
  abstract cancelBooking(data: CancelBookingRequest): Promise<string>;
  abstract confirmPayment(orderId: number): Promise<string>;
  abstract failPayment(orderId: number): Promise<string>;
}
