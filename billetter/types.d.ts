// TypeScript type definitions for Billetter API

interface Event {
  id: number;
  title: string;
  external: boolean;
}

interface Booking {
  id: number;
  event_id: number;
  status:
    | 'booked'
    | 'seats_selected'
    | 'payment_initiated'
    | 'confirmed'
    | 'cancelled';
}

interface Seat {
  id: number;
  row: number;
  number: number;
  status: 'FREE' | 'RESERVED' | 'SOLD';
  price: string;
}

interface CreateEventRequest {
  title: string;
  external: boolean;
}

interface CreateBookingRequest {
  event_id: number;
}

interface SelectSeatRequest {
  booking_id: number;
  seat_id: number;
}

interface ReleaseSeatRequest {
  seat_id: number;
}

interface InitiatePaymentRequest {
  booking_id: number;
}

interface CancelBookingRequest {
  booking_id: number;
}

interface SeatsQuery {
  event_id: number;
  page?: number;
  pageSize?: number;
}

interface EventsQuery {
  query?: string;
  date?: string;
  page?: number;
  pageSize?: number;
}

interface PaymentCallbackQuery {
  orderId: number;
}

// EventProvider types
interface Order {
  id: string;
  status: 'STARTED' | 'SUBMITTED' | 'CONFIRMED' | 'CANCELLED';
  started_at: number;
  updated_at: number;
  places_count: number;
}

interface Place {
  id: string;
  row: number;
  seat: number;
  is_free: boolean;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface EventProviderConfig {
  baseURL: string;
}

// Service interfaces
interface BilletterService {
  createEvent(data: CreateEventRequest): Promise<{ id: number }>;
  getEvents(query?: EventsQuery): Promise<Event[]>;
  createBooking(data: CreateBookingRequest): Promise<{ id: number }>;
  getBookings(): Promise<Booking[]>;
  getSeats(query: SeatsQuery): Promise<Seat[]>;
  selectSeat(data: SelectSeatRequest): Promise<string>;
  releaseSeat(data: ReleaseSeatRequest): Promise<string>;
  initiatePayment(data: InitiatePaymentRequest): Promise<string>;
  cancelBooking(data: CancelBookingRequest): Promise<string>;
  confirmPayment(orderId: number): Promise<string>;
  failPayment(orderId: number): Promise<string>;
}
