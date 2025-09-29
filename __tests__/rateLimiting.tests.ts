import { jest } from '@jest/globals';

// Mock uploadPhoto function with in-memory rate limiting
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT = 10;
const WINDOW_MS = 60000; // 1 minute

const uploadPhoto = jest.fn((userId: string, photo: any) => {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // Reset window
    rateLimitStore.set(userId, { count: 1, windowStart: now });
    return Promise.resolve({ success: true, photoId: `photo_${now}` });
  }

  if (entry.count >= RATE_LIMIT) {
    return Promise.reject(new Error('Rate limit exceeded'));
  }

  entry.count++;
  return Promise.resolve({ success: true, photoId: `photo_${now}` });
});

describe('Rate Limiting Tests', () => {
  beforeEach(() => {
    rateLimitStore.clear();
    uploadPhoto.mockClear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reject upload when rate limit is exceeded (11 uploads in 1 minute)', async () => {
    const userId = 'user123';
    const mockPhoto = { data: 'base64string' };

    // Perform 10 uploads - should all succeed
    for (let i = 0; i < 10; i++) {
      const result = await uploadPhoto(userId, mockPhoto);
      expect(result.success).toBe(true);
    }

    // 11th upload should be rejected
    await expect(uploadPhoto(userId, mockPhoto)).rejects.toThrow('Rate limit exceeded');
    expect(uploadPhoto).toHaveBeenCalledTimes(11);
  });

  it('should allow uploads after rate limit window expires', async () => {
    jest.useFakeTimers();
    const userId = 'user456';
    const mockPhoto = { data: 'base64string' };

    // Perform 5 uploads
    for (let i = 0; i < 5; i++) {
      const result = await uploadPhoto(userId, mockPhoto);
      expect(result.success).toBe(true);
    }

    expect(uploadPhoto).toHaveBeenCalledTimes(5);

    // Advance time by more than 1 minute (61 seconds)
    jest.advanceTimersByTime(61000);

    // Perform 5 more uploads - should all succeed
    for (let i = 0; i < 5; i++) {
      const result = await uploadPhoto(userId, mockPhoto);
      expect(result.success).toBe(true);
    }

    expect(uploadPhoto).toHaveBeenCalledTimes(10);
  });

  it('should track rate limits separately per user', async () => {
    const user1 = 'user1';
    const user2 = 'user2';
    const mockPhoto = { data: 'base64string' };

    // User 1: 10 uploads
    for (let i = 0; i < 10; i++) {
      const result = await uploadPhoto(user1, mockPhoto);
      expect(result.success).toBe(true);
    }

    // User 1: 11th upload should fail
    await expect(uploadPhoto(user1, mockPhoto)).rejects.toThrow('Rate limit exceeded');

    // User 2: should still be able to upload
    const result = await uploadPhoto(user2, mockPhoto);
    expect(result.success).toBe(true);
  });
});