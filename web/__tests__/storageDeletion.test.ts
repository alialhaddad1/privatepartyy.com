import { jest } from '@jest/globals';

// Mock Supabase storage and database
const mockStorageRemove = jest.fn();
const mockStorageFrom = jest.fn(() => ({
  remove: mockStorageRemove,
}));

const mockDbDelete = jest.fn();
const mockDbEq = jest.fn();
const mockDbLt = jest.fn();
const mockDbSelect = jest.fn();
const mockDbFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: mockStorageFrom,
    },
    from: mockDbFrom,
  })),
}));

// Mock posts database
interface Post {
  id: string;
  eventId: string;
  content: string;
  photoUrl: string;
  created_at: string;
}

let mockPostsDb: Post[] = [];

// Mock console.log to track cleanup logs
const originalConsoleLog = console.log;
const logMessages: string[] = [];

console.log = jest.fn((...args: any[]) => {
  logMessages.push(args.join(' '));
  originalConsoleLog(...args);
});

// Cleanup function
const cleanupExpiredPosts = async (expiryHours: number = 12) => {
  const expiryTime = new Date();
  expiryTime.setHours(expiryTime.getHours() - expiryHours);
  
  // Find expired posts
  const expiredPosts = mockPostsDb.filter(
    post => new Date(post.created_at) < expiryTime
  );
  
  if (expiredPosts.length === 0) {
    console.log('No expired posts found');
    return { deletedCount: 0, deletedPosts: [] };
  }
  
  // Extract photo URLs for storage deletion
  const photoUrls = expiredPosts.map(post => post.photoUrl);
  
  // Delete from storage
  const storageResult = await mockStorageRemove(photoUrls);
  
  // Delete from database
  const postIds = expiredPosts.map(post => post.id);
  mockPostsDb = mockPostsDb.filter(post => !postIds.includes(post.id));
  
  // Log deletion
  expiredPosts.forEach(post => {
    console.log(`Deleted post: ${post.id} (created: ${post.created_at})`);
  });
  
  console.log(`Cleanup complete: ${expiredPosts.length} posts deleted`);
  
  return {
    deletedCount: expiredPosts.length,
    deletedPosts: expiredPosts,
    storageResult,
  };
};

describe('Storage Deletion Tests - Photo Expiry and Cleanup', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockStorageRemove.mockResolvedValue({ data: null, error: null });
    mockPostsDb = [];
    logMessages.length = 0;
    
    // Setup mock implementations
    mockDbFrom.mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          delete: jest.fn().mockReturnThis(),
          select: mockDbSelect.mockReturnThis(),
          eq: mockDbEq.mockReturnThis(),
          lt: mockDbLt.mockImplementation(() => ({
            data: mockPostsDb,
            error: null,
          })),
        };
      }
      return {};
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  it('should delete posts and files older than 12 hours', async () => {
    // Insert 3 posts older than 12 hours
    const oldTime = new Date();
    oldTime.setHours(oldTime.getHours() - 13);
    
    mockPostsDb = [
      {
        id: 'post1',
        eventId: 'event1',
        content: 'Old post 1',
        photoUrl: 'photos/old1.jpg',
        created_at: oldTime.toISOString(),
      },
      {
        id: 'post2',
        eventId: 'event1',
        content: 'Old post 2',
        photoUrl: 'photos/old2.jpg',
        created_at: new Date(oldTime.getTime() - 3600000).toISOString(),
      },
      {
        id: 'post3',
        eventId: 'event1',
        content: 'Old post 3',
        photoUrl: 'photos/old3.jpg',
        created_at: new Date(oldTime.getTime() - 7200000).toISOString(),
      },
    ];
    
    const result = await cleanupExpiredPosts(12);
    
    expect(result.deletedCount).toBe(3);
    expect(result.deletedPosts).toHaveLength(3);
    expect(mockStorageRemove).toHaveBeenCalledWith([
      'photos/old1.jpg',
      'photos/old2.jpg',
      'photos/old3.jpg',
    ]);
    expect(mockPostsDb).toHaveLength(0);
    
    // Verify logs
    expect(logMessages.some(msg => msg.includes('Deleted post: post1'))).toBe(true);
    expect(logMessages.some(msg => msg.includes('Deleted post: post2'))).toBe(true);
    expect(logMessages.some(msg => msg.includes('Deleted post: post3'))).toBe(true);
    expect(logMessages.some(msg => msg.includes('Cleanup complete: 3 posts deleted'))).toBe(true);
  });

  it('should not delete posts within the last 2 hours', async () => {
    // Insert 2 recent posts
    const recentTime = new Date();
    recentTime.setHours(recentTime.getHours() - 1);
    
    mockPostsDb = [
      {
        id: 'post4',
        eventId: 'event1',
        content: 'Recent post 1',
        photoUrl: 'photos/recent1.jpg',
        created_at: recentTime.toISOString(),
      },
      {
        id: 'post5',
        eventId: 'event1',
        content: 'Recent post 2',
        photoUrl: 'photos/recent2.jpg',
        created_at: new Date().toISOString(),
      },
    ];
    
    const result = await cleanupExpiredPosts(12);
    
    expect(result.deletedCount).toBe(0);
    expect(result.deletedPosts).toHaveLength(0);
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockPostsDb).toHaveLength(2);
    
    // Verify log
    expect(logMessages.some(msg => msg.includes('No expired posts found'))).toBe(true);
  });

  it('should delete only expired posts and keep recent ones', async () => {
    const oldTime = new Date();
    oldTime.setHours(oldTime.getHours() - 15);
    
    const recentTime = new Date();
    recentTime.setMinutes(recentTime.getMinutes() - 30);
    
    mockPostsDb = [
      {
        id: 'post6',
        eventId: 'event1',
        content: 'Old post',
        photoUrl: 'photos/old6.jpg',
        created_at: oldTime.toISOString(),
      },
      {
        id: 'post7',
        eventId: 'event1',
        content: 'Recent post',
        photoUrl: 'photos/recent7.jpg',
        created_at: recentTime.toISOString(),
      },
      {
        id: 'post8',
        eventId: 'event1',
        content: 'Another old post',
        photoUrl: 'photos/old8.jpg',
        created_at: new Date(oldTime.getTime() - 3600000).toISOString(),
      },
    ];
    
    const result = await cleanupExpiredPosts(12);
    
    expect(result.deletedCount).toBe(2);
    expect(mockStorageRemove).toHaveBeenCalledWith([
      'photos/old6.jpg',
      'photos/old8.jpg',
    ]);
    expect(mockPostsDb).toHaveLength(1);
    expect(mockPostsDb[0].id).toBe('post7');
  });

  it('should log which posts were deleted with timestamps', async () => {
    const oldTime = new Date();
    oldTime.setHours(oldTime.getHours() - 20);
    
    mockPostsDb = [
      {
        id: 'post9',
        eventId: 'event1',
        content: 'Expired post',
        photoUrl: 'photos/old9.jpg',
        created_at: oldTime.toISOString(),
      },
    ];
    
    await cleanupExpiredPosts(12);
    
    const deletionLog = logMessages.find(msg => 
      msg.includes('Deleted post: post9') && msg.includes(oldTime.toISOString())
    );
    
    expect(deletionLog).toBeDefined();
    expect(logMessages.some(msg => msg.includes('Cleanup complete: 1 posts deleted'))).toBe(true);
  });

  it('should handle empty database gracefully', async () => {
    mockPostsDb = [];
    
    const result = await cleanupExpiredPosts(12);
    
    expect(result.deletedCount).toBe(0);
    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(logMessages.some(msg => msg.includes('No expired posts found'))).toBe(true);
  });
});