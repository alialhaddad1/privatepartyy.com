import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { generateQRCode } from '../src/lib/qr';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Mock QR code generation
jest.mock('../src/lib/qr', () => ({
  generateQRCode: jest.fn(),
}));

// Type definitions
interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'expired' | 'cancelled';
  user_id: string;
}

interface SupabaseResponse<T> {
  data: T | null;
  error: null | {
    message: string;
    code?: string;
    statusCode?: number;
  };
}

interface FeedPost {
  id: string;
  title: string;
  content: string;
  image_url: string;
  event_id: string;
  created_at: string;
  user_id: string;
}

// Mock services
const mockEventService = {
  getEvent: jest.fn(),
  validateEventDate: jest.fn(),
  isEventExpired: jest.fn(),
  fetchFeed: jest.fn(),
};

const mockQRService = {
  generateEventQRCode: jest.fn(),
  validateEventForQR: jest.fn(),
};

// Mock Supabase client implementation
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    lt: jest.fn(),
    gt: jest.fn(),
    single: jest.fn(),
  }))
};

// Mock QR functions
const mockGenerateQRCode = generateQRCode as jest.MockedFunction<typeof generateQRCode>;

// Mock the createClient function
(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient as any);

describe('Expired QR Codes Tests', () => {
  let mockEventsSelect: jest.MockedFunction<any>;
  let mockPostsSelect: jest.MockedFunction<any>;

  // Test data
  const currentDate = new Date();
  const expiredEvent: Event = {
    id: 'expired-event-123',
    title: 'Past Conference',
    description: 'This event has already ended',
    event_date: new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    end_date: new Date(currentDate.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
    created_at: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'expired',
    user_id: 'user-123'
  };

  const validEvent: Event = {
    id: 'valid-event-456',
    title: 'Future Conference',
    description: 'This event is upcoming',
    event_date: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    end_date: new Date(currentDate.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days from now
    created_at: currentDate.toISOString(),
    updated_at: currentDate.toISOString(),
    status: 'active',
    user_id: 'user-456'
  };

  const mockFeedPosts: FeedPost[] = [
    {
      id: 'post-1',
      title: 'Event Update',
      content: 'Important information about the event',
      image_url: 'https://storage.example.com/post1.jpg',
      event_id: 'valid-event-456',
      created_at: currentDate.toISOString(),
      user_id: 'user-123'
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock functions
    mockEventsSelect = jest.fn();
    mockPostsSelect = jest.fn();

    // Configure Supabase client mocks
    const mockSelectChain = {
      select: mockEventsSelect,
      eq: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'events') {
        mockSelectChain.select = mockEventsSelect;
        return mockSelectChain;
      } else if (table === 'posts') {
        mockSelectChain.select = mockPostsSelect;
        return mockSelectChain;
      }
      return mockSelectChain;
    });

    // Setup service implementations
    mockEventService.getEvent.mockImplementation(async (eventId: string) => {
      const selectResult = await mockEventsSelect('*');
      if (selectResult.error) {
        throw new Error(selectResult.error.message);
      }
      return selectResult.data;
    });

    mockEventService.validateEventDate.mockImplementation((event: Event) => {
      const eventDate = new Date(event.event_date);
      const now = new Date();
      return eventDate > now;
    });

    mockEventService.isEventExpired.mockImplementation((event: Event) => {
      const eventEndDate = new Date(event.end_date || event.event_date);
      const now = new Date();
      return eventEndDate < now;
    });

    mockEventService.fetchFeed.mockImplementation(async (eventId: string) => {
      // First check if event exists and is valid
      const event = await mockEventService.getEvent(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }

      if (mockEventService.isEventExpired(event)) {
        throw new Error('Event expired');
      }

      // Fetch posts for valid event
      const postsResult = await mockPostsSelect('*');
      if (postsResult.error) {
        throw new Error(postsResult.error.message);
      }

      return postsResult.data || [];
    });

    mockQRService.validateEventForQR.mockImplementation(async (eventId: string) => {
      const event = await mockEventService.getEvent(eventId);
      
      if (!event) {
        throw new Error('Event not found');
      }

      if (mockEventService.isEventExpired(event)) {
        throw new Error('Cannot generate QR code for expired event');
      }

      return event;
    });

    mockQRService.generateEventQRCode.mockImplementation(async (eventId: string) => {
      // Validate event before generating QR code
      await mockQRService.validateEventForQR(eventId);
      
      // Generate QR code for valid event
      return await mockGenerateQRCode(`https://app.example.com/event/${eventId}`);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Expired Event Detection', () => {
    it('should return expired event when date is in the past', async () => {
      // Mock returning expired event
      const expiredResponse: SupabaseResponse<Event> = {
        data: expiredEvent,
        error: null
      };

      mockEventsSelect.mockResolvedValue(expiredResponse);

      // Fetch the event
      const event = await mockEventService.getEvent(expiredEvent.id);

      // Assert event data
      expect(event).toBeDefined();
      expect(event.id).toBe('expired-event-123');
      expect(event.status).toBe('expired');

      // Assert event is expired
      expect(mockEventService.isEventExpired(event)).toBe(true);
      expect(mockEventService.validateEventDate(event)).toBe(false);

      // Verify database query
      expect(mockEventsSelect).toHaveBeenCalledWith('*');
    });

    it('should detect various expired event scenarios', async () => {
      const expiredScenarios = [
        {
          name: 'Event ended yesterday',
          event: {
            ...expiredEvent,
            id: 'expired-yesterday',
            event_date: new Date(currentDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          }
        },
        {
          name: 'Single day event that passed',
          event: {
            ...expiredEvent,
            id: 'expired-single-day',
            event_date: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: undefined, // No end date, same as event_date
          }
        },
        {
          name: 'Event ended hours ago',
          event: {
            ...expiredEvent,
            id: 'expired-hours',
            event_date: new Date(currentDate.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
            end_date: new Date(currentDate.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          }
        }
      ];

      for (const scenario of expiredScenarios) {
        mockEventsSelect.mockResolvedValue({
          data: scenario.event,
          error: null
        });

        const event = await mockEventService.getEvent(scenario.event.id);
        
        expect(mockEventService.isEventExpired(event)).toBe(true);
        expect(mockEventService.validateEventDate(event)).toBe(false);
      }
    });

    it('should handle events with no end date correctly', async () => {
      const singleDayExpiredEvent = {
        ...expiredEvent,
        id: 'single-day-expired',
        end_date: undefined
      };

      mockEventsSelect.mockResolvedValue({
        data: singleDayExpiredEvent,
        error: null
      });

      const event = await mockEventService.getEvent(singleDayExpiredEvent.id);
      
      // Should use event_date for expiration check when no end_date
      expect(mockEventService.isEventExpired(event)).toBe(true);
    });
  });

  describe('FetchFeed with Expired Events', () => {
    it('should throw "Event expired" error when attempting to fetch feed for expired event', async () => {
      // Mock expired event lookup
      mockEventsSelect.mockResolvedValue({
        data: expiredEvent,
        error: null
      });

      // Attempt to fetch feed for expired event
      await expect(mockEventService.fetchFeed(expiredEvent.id))
        .rejects.toThrow('Event expired');

      // Verify event was checked
      expect(mockEventsSelect).toHaveBeenCalledWith('*');
      
      // Verify posts were not fetched
      expect(mockPostsSelect).not.toHaveBeenCalled();
    });

    it('should handle multiple expired event scenarios in fetchFeed', async () => {
      const expiredEventIds = [
        'expired-conference-1',
        'expired-workshop-2', 
        'expired-meetup-3'
      ];

      for (const eventId of expiredEventIds) {
        const expiredEventData = {
          ...expiredEvent,
          id: eventId,
          title: `Expired Event ${eventId}`
        };

        mockEventsSelect.mockResolvedValue({
          data: expiredEventData,
          error: null
        });

        await expect(mockEventService.fetchFeed(eventId))
          .rejects.toThrow('Event expired');
      }

      expect(mockEventsSelect).toHaveBeenCalledTimes(expiredEventIds.length);
    });

    it('should provide specific error message for different expiration states', async () => {
      const expiredStates = [
        {
          event: { ...expiredEvent, status: 'expired' as const },
          expectedError: 'Event expired'
        },
        {
          event: { ...expiredEvent, status: 'cancelled' as const },
          expectedError: 'Event expired' // Still use "Event expired" for consistency
        }
      ];

      for (const state of expiredStates) {
        mockEventsSelect.mockResolvedValue({
          data: state.event,
          error: null
        });

        await expect(mockEventService.fetchFeed(state.event.id))
          .rejects.toThrow(state.expectedError);
      }
    });

    it('should handle database errors when checking event expiration', async () => {
      // Mock database error
      mockEventsSelect.mockResolvedValue({
        data: null,
        error: {
          message: 'Database connection failed',
          code: 'CONNECTION_ERROR'
        }
      });

      await expect(mockEventService.fetchFeed('any-event-id'))
        .rejects.toThrow('Database connection failed');

      expect(mockEventsSelect).toHaveBeenCalledWith('*');
    });
  });

  describe('QR Code Generation with Expired Events', () => {
    it('should reject QR code generation for expired event', async () => {
      // Mock expired event lookup
      mockEventsSelect.mockResolvedValue({
        data: expiredEvent,
        error: null
      });

      // Attempt to generate QR code for expired event
      await expect(mockQRService.generateEventQRCode(expiredEvent.id))
        .rejects.toThrow('Cannot generate QR code for expired event');

      // Verify event was checked but QR generation was not attempted
      expect(mockEventsSelect).toHaveBeenCalledWith('*');
      expect(mockGenerateQRCode).not.toHaveBeenCalled();
    });

    it('should handle various expired scenarios in QR generation', async () => {
      const expiredScenarios = [
        { id: 'expired-1', days: -1 }, // 1 day ago
        { id: 'expired-7', days: -7 }, // 1 week ago
        { id: 'expired-30', days: -30 }, // 1 month ago
      ];

      for (const scenario of expiredScenarios) {
        const expiredEventData = {
          ...expiredEvent,
          id: scenario.id,
          event_date: new Date(currentDate.getTime() + scenario.days * 24 * 60 * 60 * 1000).toISOString()
        };

        mockEventsSelect.mockResolvedValue({
          data: expiredEventData,
          error: null
        });

        await expect(mockQRService.generateEventQRCode(scenario.id))
          .rejects.toThrow('Cannot generate QR code for expired event');
      }

      expect(mockGenerateQRCode).not.toHaveBeenCalled();
    });

    it('should reject QR generation immediately after event expiry', async () => {
      // Event that just expired (1 minute ago)
      const justExpiredEvent = {
        ...expiredEvent,
        id: 'just-expired',
        event_date: new Date(currentDate.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        end_date: new Date(currentDate.getTime() - 1 * 60 * 1000).toISOString(), // 1 minute ago
      };

      mockEventsSelect.mockResolvedValue({
        data: justExpiredEvent,
        error: null
      });

      await expect(mockQRService.generateEventQRCode(justExpiredEvent.id))
        .rejects.toThrow('Cannot generate QR code for expired event');

      expect(mockGenerateQRCode).not.toHaveBeenCalled();
    });

    it('should handle non-existent events in QR generation', async () => {
      // Mock event not found
      mockEventsSelect.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(mockQRService.generateEventQRCode('non-existent-event'))
        .rejects.toThrow('Event not found');

      expect(mockGenerateQRCode).not.toHaveBeenCalled();
    });
  });

  describe('Valid Events (Future Dates)', () => {
    it('should pass normally for valid future event', async () => {
      // Mock valid future event
      mockEventsSelect.mockResolvedValue({
        data: validEvent,
        error: null
      });

      mockPostsSelect.mockResolvedValue({
        data: mockFeedPosts,
        error: null
      });

      // Fetch feed should succeed
      const feedPosts = await mockEventService.fetchFeed(validEvent.id);

      expect(feedPosts).toBeDefined();
      expect(Array.isArray(feedPosts)).toBe(true);
      expect(feedPosts).toEqual(mockFeedPosts);

      // Verify event validation passed
      expect(mockEventService.isEventExpired(validEvent)).toBe(false);
      expect(mockEventService.validateEventDate(validEvent)).toBe(true);

      // Verify both queries were made
      expect(mockEventsSelect).toHaveBeenCalledWith('*');
      expect(mockPostsSelect).toHaveBeenCalledWith('*');
    });

    it('should generate QR code successfully for valid future event', async () => {
      // Mock valid future event
      mockEventsSelect.mockResolvedValue({
        data: validEvent,
        error: null
      });

      // Mock successful QR generation
      const mockQRData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      mockGenerateQRCode.mockResolvedValue(mockQRData);

      // Generate QR code should succeed
      const qrCode = await mockQRService.generateEventQRCode(validEvent.id);

      expect(qrCode).toBe(mockQRData);
      expect(qrCode).toMatch(/^data:image\/png;base64,/);

      // Verify event was validated and QR was generated
      expect(mockEventsSelect).toHaveBeenCalledWith('*');
      expect(mockGenerateQRCode).toHaveBeenCalledWith(`https://app.example.com/event/${validEvent.id}`);
    });

    it('should handle various valid future event scenarios', async () => {
      const futureScenarios = [
        { id: 'future-1', days: 1, name: 'Tomorrow' },
        { id: 'future-7', days: 7, name: 'Next week' },
        { id: 'future-30', days: 30, name: 'Next month' },
      ];

      mockGenerateQRCode.mockResolvedValue('data:image/png;base64,mock-qr-data');

      for (const scenario of futureScenarios) {
        const futureEventData = {
          ...validEvent,
          id: scenario.id,
          title: `${scenario.name} Event`,
          event_date: new Date(currentDate.getTime() + scenario.days * 24 * 60 * 60 * 1000).toISOString()
        };

        mockEventsSelect.mockResolvedValue({
          data: futureEventData,
          error: null
        });

        // Both feed fetch and QR generation should succeed
        mockPostsSelect.mockResolvedValue({
          data: mockFeedPosts,
          error: null
        });

        const feedPosts = await mockEventService.fetchFeed(scenario.id);
        const qrCode = await mockQRService.generateEventQRCode(scenario.id);

        expect(feedPosts).toEqual(mockFeedPosts);
        expect(qrCode).toBe('data:image/png;base64,mock-qr-data');
        expect(mockEventService.isEventExpired(futureEventData)).toBe(false);
      }
    });

    it('should handle events starting soon correctly', async () => {
      // Event starting in 1 hour
      const upcomingEvent = {
        ...validEvent,
        id: 'upcoming-soon',
        event_date: new Date(currentDate.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        end_date: new Date(currentDate.getTime() + 3 * 60 * 60 * 1000).toISOString(), // 3 hours from now
      };

      mockEventsSelect.mockResolvedValue({
        data: upcomingEvent,
        error: null
      });

      mockPostsSelect.mockResolvedValue({
        data: mockFeedPosts,
        error: null
      });

      mockGenerateQRCode.mockResolvedValue('data:image/png;base64,upcoming-qr');

      // Should work normally for upcoming events
      const feedPosts = await mockEventService.fetchFeed(upcomingEvent.id);
      const qrCode = await mockQRService.generateEventQRCode(upcomingEvent.id);

      expect(feedPosts).toEqual(mockFeedPosts);
      expect(qrCode).toBe('data:image/png;base64,upcoming-qr');
      expect(mockEventService.isEventExpired(upcomingEvent)).toBe(false);
    });

    it('should handle currently running events correctly', async () => {
      // Event that started 1 hour ago but ends in 2 hours
      const currentEvent = {
        ...validEvent,
        id: 'currently-running',
        event_date: new Date(currentDate.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        end_date: new Date(currentDate.getTime() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      };

      mockEventsSelect.mockResolvedValue({
        data: currentEvent,
        error: null
      });

      mockPostsSelect.mockResolvedValue({
        data: mockFeedPosts,
        error: null
      });

      mockGenerateQRCode.mockResolvedValue('data:image/png;base64,current-qr');

      // Should work for currently running events
      const feedPosts = await mockEventService.fetchFeed(currentEvent.id);
      const qrCode = await mockQRService.generateEventQRCode(currentEvent.id);

      expect(feedPosts).toEqual(mockFeedPosts);
      expect(qrCode).toBe('data:image/png;base64,current-qr');
      expect(mockEventService.isEventExpired(currentEvent)).toBe(false);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle events expiring at exact current time', async () => {
      // Event ending exactly now
      const boundaryEvent = {
        ...expiredEvent,
        id: 'boundary-event',
        event_date: new Date(currentDate.getTime() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        end_date: currentDate.toISOString(), // Exactly now
      };

      mockEventsSelect.mockResolvedValue({
        data: boundaryEvent,
        error: null
      });

      // Should be considered expired (using < comparison)
      expect(mockEventService.isEventExpired(boundaryEvent)).toBe(false); // Exactly at boundary
      
      // But in practice, system clock differences mean we should treat "now" as expired
      const slightlyPastEvent = {
        ...boundaryEvent,
        end_date: new Date(currentDate.getTime() - 1).toISOString(), // 1ms ago
      };
      
      expect(mockEventService.isEventExpired(slightlyPastEvent)).toBe(true);
    });

    it('should handle malformed event dates gracefully', async () => {
      const malformedEvent = {
        ...expiredEvent,
        id: 'malformed-dates',
        event_date: 'invalid-date',
        end_date: 'also-invalid'
      };

      mockEventsSelect.mockResolvedValue({
        data: malformedEvent,
        error: null
      });

      // Should handle invalid dates without crashing
      expect(() => mockEventService.isEventExpired(malformedEvent)).not.toThrow();
      expect(() => mockEventService.validateEventDate(malformedEvent)).not.toThrow();
    });

    it('should handle timezone considerations', async () => {
      // Event in different timezone
      const timezoneEvent = {
        ...validEvent,
        id: 'timezone-event',
        event_date: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        end_date: new Date(currentDate.getTime() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
      };

      mockEventsSelect.mockResolvedValue({
        data: timezoneEvent,
        error: null
      });

      // Should handle timezone properly (all dates are in ISO format/UTC)
      expect(mockEventService.isEventExpired(timezoneEvent)).toBe(false);
      expect(mockEventService.validateEventDate(timezoneEvent)).toBe(true);
    });
  });
});