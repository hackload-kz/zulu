import { BilletterService } from './BilletterService.js';

class InMemoryBilletterService extends BilletterService {
  constructor() {
    super();
    this.events = new Map();
    this.bookings = new Map();
    this.seats = new Map();
    this.bookingSeats = new Map();
    this.eventSeats = new Map();
    this.nextEventId = 1;
    this.nextBookingId = 1;
    this.nextSeatId = 1;
    this.seatTimeouts = new Map();
    this.SEAT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
  }

  async createEvent(data) {
    const id = this.nextEventId++;
    const event = {
      id,
      title: data.title,
      external: data.external,
    };
    this.events.set(id, event);

    // Create seats for this event
    // For regular events, create 1000 seats (10 rows x 100 seats)
    // For large events (like "Stadium" or "100k"), create 100,000 seats
    const isLargeEvent =
      data.title.toLowerCase().includes('stadium') ||
      data.title.toLowerCase().includes('100k');

    const eventSeatsArray = [];
    const maxRows = isLargeEvent ? 1000 : 10;
    const seatsPerRow = 100;

    for (let row = 1; row <= maxRows; row++) {
      for (let number = 1; number <= seatsPerRow; number++) {
        const seatId = this.nextSeatId++;
        const seat = {
          id: seatId,
          row,
          number,
          reserved: false,
          event_id: id,
        };
        this.seats.set(seatId, seat);
        eventSeatsArray.push(seatId);
      }
    }
    this.eventSeats.set(id, eventSeatsArray);

    return { id };
  }

  async getEvents() {
    return Array.from(this.events.values()).map(({ id, title }) => ({
      id,
      title,
    }));
  }

  async createBooking(data) {
    if (!this.events.has(data.event_id)) {
      throw new Error('Event not found');
    }

    const id = this.nextBookingId++;
    const booking = {
      id,
      event_id: data.event_id,
      status: 'booked',
    };
    this.bookings.set(id, booking);
    this.bookingSeats.set(id, new Set());

    return { id };
  }

  async getBookings() {
    return Array.from(this.bookings.values()).map(
      ({ id, event_id, status }) => ({ id, event_id, status })
    );
  }

  async getSeats(query) {
    const { event_id, page = 1, pageSize = 20 } = query;

    if (!this.events.has(event_id)) {
      throw new Error('Event not found');
    }

    if (page < 1 || pageSize < 1 || pageSize > 20) {
      throw new Error('Invalid pagination parameters');
    }

    const eventSeatIds = this.eventSeats.get(event_id) || [];
    const startIndex = (page - 1) * pageSize;

    // Return empty array if start index is beyond available seats
    if (startIndex >= eventSeatIds.length) {
      return [];
    }

    const endIndex = startIndex + pageSize;
    const paginatedSeatIds = eventSeatIds.slice(startIndex, endIndex);

    return paginatedSeatIds.map((seatId) => {
      const seat = this.seats.get(seatId);
      return {
        id: seat.id,
        row: seat.row,
        number: seat.number,
        reserved: seat.reserved,
      };
    });
  }

  async selectSeat(data) {
    const { booking_id, seat_id } = data;

    if (!this.bookings.has(booking_id)) {
      throw new Error('Booking not found');
    }

    if (!this.seats.has(seat_id)) {
      throw new Error('Seat not found');
    }

    const booking = this.bookings.get(booking_id);
    const seat = this.seats.get(seat_id);

    // Check if booking is in a valid state for seat selection
    if (booking.status === 'cancelled' || booking.status === 'confirmed') {
      throw new Error('Failed to add seat to booking');
    }

    if (seat.event_id !== booking.event_id) {
      throw new Error('Seat does not belong to the booking event');
    }

    if (seat.reserved) {
      throw new Error('Failed to add seat to booking');
    }

    seat.reserved = true;
    this.seats.set(seat_id, seat);
    this.bookingSeats.get(booking_id).add(seat_id);

    // Set timeout for seat reservation
    const timeoutId = setTimeout(() => {
      this.releaseSeatInternal(seat_id);
    }, this.SEAT_TIMEOUT);

    this.seatTimeouts.set(seat_id, timeoutId);

    return 'Seat successfully added to booking';
  }

  async releaseSeat(data) {
    const { seat_id } = data;

    if (!this.seats.has(seat_id)) {
      throw new Error('Seat not found');
    }

    const seat = this.seats.get(seat_id);
    if (!seat.reserved) {
      throw new Error('Failed to release seat');
    }

    this.releaseSeatInternal(seat_id);
    return 'Seat successfully released';
  }

  releaseSeatInternal(seat_id) {
    const seat = this.seats.get(seat_id);
    if (seat && seat.reserved) {
      seat.reserved = false;
      this.seats.set(seat_id, seat);

      // Remove from booking seats
      for (const [bookingId, seatSet] of this.bookingSeats.entries()) {
        if (seatSet.has(seat_id)) {
          seatSet.delete(seat_id);
          break;
        }
      }

      // Clear timeout
      if (this.seatTimeouts.has(seat_id)) {
        clearTimeout(this.seatTimeouts.get(seat_id));
        this.seatTimeouts.delete(seat_id);
      }
    }
  }

  async initiatePayment(data) {
    const { booking_id } = data;

    if (!this.bookings.has(booking_id)) {
      throw new Error('Booking not found');
    }

    const booking = this.bookings.get(booking_id);
    if (booking.status !== 'booked') {
      throw new Error('Invalid booking status');
    }

    booking.status = 'payment_initiated';
    this.bookings.set(booking_id, booking);

    // Clear timeouts for all seats in this booking
    const bookingSeatsSet = this.bookingSeats.get(booking_id) || new Set();
    for (const seat_id of bookingSeatsSet) {
      if (this.seatTimeouts.has(seat_id)) {
        clearTimeout(this.seatTimeouts.get(seat_id));
        this.seatTimeouts.delete(seat_id);
      }
    }

    return 'Booking is awaiting payment confirmation';
  }

  async cancelBooking(data) {
    const { booking_id } = data;

    if (!this.bookings.has(booking_id)) {
      throw new Error('Booking not found');
    }

    const booking = this.bookings.get(booking_id);

    // Don't allow cancellation of confirmed bookings
    if (booking.status === 'confirmed') {
      return 'Booking successfully cancelled'; // Return success but don't actually cancel
    }

    booking.status = 'cancelled';
    this.bookings.set(booking_id, booking);

    // Release all seats for this booking
    const bookingSeatsSet = this.bookingSeats.get(booking_id) || new Set();
    for (const seat_id of bookingSeatsSet) {
      this.releaseSeatInternal(seat_id);
    }

    return 'Booking successfully cancelled';
  }

  async confirmPayment(orderId) {
    const booking_id = orderId;

    if (!this.bookings.has(booking_id)) {
      return 'OK'; // Handle gracefully for invalid booking IDs
    }

    const booking = this.bookings.get(booking_id);
    if (booking.status !== 'payment_initiated') {
      return 'OK'; // Idempotent - already processed
    }

    booking.status = 'confirmed';
    this.bookings.set(booking_id, booking);

    return 'OK';
  }

  async failPayment(orderId) {
    const booking_id = orderId;

    if (!this.bookings.has(booking_id)) {
      return 'OK'; // Handle gracefully for invalid booking IDs
    }

    const booking = this.bookings.get(booking_id);

    // Don't process payment failure for already confirmed bookings
    if (booking.status === 'confirmed') {
      return 'OK'; // Idempotent - no effect on confirmed bookings
    }

    if (booking.status === 'cancelled') {
      return 'OK'; // Idempotent - already processed
    }

    booking.status = 'cancelled';
    this.bookings.set(booking_id, booking);

    // Release all seats for this booking
    const bookingSeatsSet = this.bookingSeats.get(booking_id) || new Set();
    for (const seat_id of bookingSeatsSet) {
      this.releaseSeatInternal(seat_id);
    }

    return 'OK';
  }
}

export { InMemoryBilletterService };
