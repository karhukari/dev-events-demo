'use server';

import {
  Schema,
  model,
  models,
  type HydratedDocument,
  type Model,
} from 'mongoose';

export type EventFields = {
  title: string;
  slug?: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

type EventDocument = HydratedDocument<EventFields>;
type EventModel = Model<EventFields>;

const EventSchema = new Schema<EventFields>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    slug: { type: String, unique: true, maxlength: 200 },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    overview: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    venue: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    date: { type: String, required: true, trim: true, maxlength: 30 },
    time: { type: String, required: true, trim: true, maxlength: 30 },
    mode: { type: String, required: true, trim: true, maxlength: 50 },
    audience: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    agenda: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      required: true,
    },
    organizer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    tags: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      required: true,
    },
  },
  { timestamps: true }
);

// Keep slug unique for routing and lookup efficiency.
EventSchema.index({ slug: 1 }, { unique: true });

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const normalizeDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid date format.');
  }
  // Store date-only portion as ISO (YYYY-MM-DD).
  return parsed.toISOString().split('T')[0];
};

const normalizeTime = (value: string): string => {
  const trimmed = value.trim().toLowerCase();
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i;
  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)$/;

  if (twelveHour.test(trimmed)) {
    const [, h, m, meridiemRaw] = trimmed.match(twelveHour) ?? [];
    const hourNum = Number(h);
    const minutes = m;
    const meridiem = meridiemRaw?.toLowerCase();
    const normalizedHour =
      meridiem === 'pm' && hourNum !== 12
        ? hourNum + 12
        : meridiem === 'am' && hourNum === 12
        ? 0
        : hourNum;
    return `${normalizedHour.toString().padStart(2, '0')}:${minutes}`;
  }

  if (twentyFourHour.test(trimmed)) {
    const [, h, m] = trimmed.match(twentyFourHour) ?? [];
    return `${h.padStart(2, '0')}:${m}`;
  }

  throw new Error('Invalid time format. Use HH:MM or HH:MM AM/PM.');
};

/**
 * Validate required fields, normalize date/time, and generate a slug
 * when the title changes. Keeps data consistent across reloads.
 */
EventSchema.pre<EventDocument>(
  'save',
  async function handleNormalize(this: EventDocument) {
    const stringFields: Array<
      keyof Pick<
        EventFields,
        | 'title'
        | 'description'
        | 'overview'
        | 'image'
        | 'venue'
        | 'location'
        | 'date'
        | 'time'
        | 'mode'
        | 'audience'
        | 'organizer'
      >
    > = [
      'title',
      'description',
      'overview',
      'image',
      'venue',
      'location',
      'date',
      'time',
      'mode',
      'audience',
      'organizer',
    ];

    for (const field of stringFields) {
      const value = this[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(
          `${field} is required and must be a non-empty string.`
        );
      }
      this[field] = value.trim() as EventFields[typeof field];
    }

    const agenda = (this.agenda ?? [])
      .map((item) => {
        if (typeof item !== 'string') {
          throw new Error('agenda must contain strings.');
        }
        return item.trim();
      })
      .filter((item): item is string => item.length > 0);
    if (!Array.isArray(agenda) || agenda.length === 0) {
      throw new Error(
        'agenda is required and must be a non-empty array.'
      );
    }
    this.agenda = agenda;

    const tags = (this.tags ?? [])
      .map((item) => {
        if (typeof item !== 'string') {
          throw new Error('tags must contain strings.');
        }
        return item.trim();
      })
      .filter((item): item is string => item.length > 0);
    if (!Array.isArray(tags) || tags.length === 0) {
      throw new Error(
        'tags is required and must be a non-empty array.'
      );
    }
    this.tags = tags;

    this.date = normalizeDate(this.date);
    this.time = normalizeTime(this.time);

    const titleChanged =
      typeof this.isModified === 'function'
        ? this.isModified('title')
        : true;
    if (!this.slug || titleChanged) {
      this.slug = toSlug(this.title);
    }
  }
);

export const Event: EventModel =
  models.Event ||
  model<EventFields, EventModel>('Event', EventSchema);
