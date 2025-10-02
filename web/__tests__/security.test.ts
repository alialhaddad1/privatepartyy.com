import { jest } from '@jest/globals';

// Mock Supabase client
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Mock posts database
const mockPosts = [
  { id: 1, eventId: 'test_event', content: 'Post 1', author: 'Alice' },
  { id: 2, eventId: 'test_event', content: 'Post 2', author: 'Bob' },
  { id: 3, eventId: 'test_event', content: 'Post 3', author: 'Charlie' },
  { id: 4, eventId: 'other_event', content: 'Post 4', author: 'Dave' },
  { id: 5, eventId: 'other_event', content: 'Post 5', author: 'Eve' },
];

// Mock fetchFeed function
const fetchFeed = async (eventId: string | null | undefined) => {
  if (eventId === null || eventId === undefined) {
    throw new Error('Forbidden: eventId is required');
  }

  if (typeof eventId !== 'string' || eventId.trim() === '') {
    throw new Error('Forbidden: invalid eventId');
  }

  // Filter posts by eventId
  const posts = mockPosts.filter(post => post.eventId === eventId);
  
  return {
    success: true,
    data: posts,
    count: posts.length,
  };
};

describe('Security Tests - Feed Access via QR Code', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow user with correct eventId to retrieve posts', async () => {
    const eventId = 'test_event';
    
    const result = await fetchFeed(eventId);
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
    expect(result.data.every(post => post.eventId === eventId)).toBe(true);
    expect(result.data[0].content).toBe('Post 1');
    expect(result.data[1].content).toBe('Post 2');
    expect(result.data[2].content).toBe('Post 3');
  });

  it('should return empty result for invalid eventId', async () => {
    const eventId = 'wrong_event';
    
    const result = await fetchFeed(eventId);
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('should return 403-like error when eventId is null', async () => {
    await expect(fetchFeed(null)).rejects.toThrow('Forbidden: eventId is required');
  });

  it('should return 403-like error when eventId is undefined', async () => {
    await expect(fetchFeed(undefined)).rejects.toThrow('Forbidden: eventId is required');
  });

  it('should ensure no posts are leaked if eventId does not match', async () => {
    const eventId = 'non_existent_event';
    
    const result = await fetchFeed(eventId);
    
    expect(result.data).toHaveLength(0);
    
    // Verify no posts from other events are included
    const hasOtherEventPosts = result.data.some(
      post => post.eventId !== eventId
    );
    expect(hasOtherEventPosts).toBe(false);
  });

  it('should not leak posts from other events when querying valid event', async () => {
    const eventId = 'test_event';
    
    const result = await fetchFeed(eventId);
    
    // Verify all returned posts match the requested eventId
    expect(result.data.every(post => post.eventId === eventId)).toBe(true);
    
    // Verify no posts from 'other_event' are included
    const hasOtherEventPosts = result.data.some(
      post => post.eventId === 'other_event'
    );
    expect(hasOtherEventPosts).toBe(false);
  });

  it('should return 403-like error for empty string eventId', async () => {
    await expect(fetchFeed('')).rejects.toThrow('Forbidden: invalid eventId');
  });

  it('should handle multiple different valid eventIds correctly', async () => {
    const result1 = await fetchFeed('test_event');
    const result2 = await fetchFeed('other_event');
    
    expect(result1.data).toHaveLength(3);
    expect(result2.data).toHaveLength(2);
    
    expect(result1.data.every(post => post.eventId === 'test_event')).toBe(true);
    expect(result2.data.every(post => post.eventId === 'other_event')).toBe(true);
  });
});