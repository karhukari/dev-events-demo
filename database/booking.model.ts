'use server';

import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
  Types,
} from 'mongoose';
import { Event } from './event.model';

type BookingDocument = HydratedDocument<BookingFields>;

type BookingModel = Model<BookingFields>;

export type BookingFields = {
  eventId: Types.ObjectId;
  email: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const BookingSchema = new Schema<BookingFields>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
  },
  { timestamps: true }
);

// Prevent duplicate bookings for the same event/email pair.
BookingSchema.index({ eventId: 1, email: 1 }, { unique: true });

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidObjectId = (value: Types.ObjectId): boolean =>
  Types.ObjectId.isValid(value);

/**
 * Ensure email format is valid and the referenced event exists
 * before persisting the booking.
 */
BookingSchema.pre<BookingDocument>(
  'save',
  { document: true, query: false },
  async function validateBooking(this: BookingDocument) {
    if (
      typeof this.email !== 'string' ||
      this.email.trim().length === 0
    ) {
      throw new Error(
        'email is required and must be a non-empty string.'
      );
    }
    if (!isValidEmail(this.email)) {
      throw new Error('Invalid email format.');
    }

    if (!isValidObjectId(this.eventId)) {
      throw new Error('eventId must be a valid ObjectId.');
    }

    if (this.isNew || this.isModified('eventId')) {
      const eventExists = await Event.exists({ _id: this.eventId });
      if (!eventExists) {
        throw new Error('Referenced event does not exist.');
      }
    }
  }
);

export const Booking: BookingModel =
  models.Booking ||
  model<BookingFields, BookingModel>('Booking', BookingSchema);
