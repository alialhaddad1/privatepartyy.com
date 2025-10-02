import { jest } from '@jest/globals';

// Mock Supabase client
const mockSupabaseFrom = jest.fn();
const mockSupabaseSelect = jest.fn();
const mockSupabaseEq = jest.fn();
const mockSupabaseInsert = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

// Mock user types
interface User {
  id: string;
  email: string;
  isSubscribed: boolean;
}

interface Post {
  id: string;
  eventId: string;
  content: string;
  author: string;
  photoUrl: string;
}

// Mock posts
const mockPosts: Post[] = [
  { id: '1', eventId: 'event1', content: 'Post 1', author: 'Alice', photoUrl: 'photo1.jpg' },
  { id: '2', eventId: 'event1', content: 'Post 2', author: 'Bob', photoUrl: 'photo2.jpg' },
  { id: '3', eventId: 'event1', content: 'Post 3', author: 'Charlie', photoUrl: 'photo3.jpg' },
];

// Mock console.warn to track warnings
const originalConsoleWarn = console.warn;
const warnMessages: string[] = [];

console.warn = jest.fn((...args: any[]) => {
  warnMessages.push(args.join(' '));
  originalConsoleWarn(...args);
});

// Feed render function
interface FeedRender {
  posts: Post[];
  canLike: boolean;
  canComment: boolean;
  canDM: boolean;
}

const renderFeed = (user: User, eventId: string): FeedRender => {
  const posts = mockPosts.filter(post => post.eventId === eventId);
  
  return {
    posts,
    canLike: user.isSubscribed,
    canComment: user.isSubscribed,
    canDM: user.isSubscribed,
  };
};

// Interaction functions
const likePost = (user: User, postId: string): { success: boolean; message?: string } => {
  if (!user.isSubscribed) {
    console.warn('Subscribe to unlock likes');
    return { success: false, message: 'Subscribe to unlock' };
  }
  return { success: true };
};

const commentOnPost = (user: User, postId: string, comment: string): { success: boolean; message?: string } => {
  if (!user.isSubscribed) {
    console.warn('Subscribe to unlock comments');
    return { success: false, message: 'Subscribe to unlock' };
  }
  return { success: true };
};

const sendDM = (user: User, recipientId: string, message: string): { success: boolean; message?: string } => {
  if (!user.isSubscribed) {
    console.warn('Subscribe to unlock DMs');
    return { success: false, message: 'Subscribe to unlock' };
  }
  return { success: true };
};

describe('Subscription Wall Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    warnMessages.length = 0;
  });

  afterAll(() => {
    console.warn = originalConsoleWarn;
  });

  describe('Free User Tests', () => {
    const freeUser: User = {
      id: 'user1',
      email: 'free@example.com',
      isSubscribed: false,
    };

    it('should show posts to free user but disable likes/comments/DMs', () => {
      const feed = renderFeed(freeUser, 'event1');

      expect(feed.posts).toHaveLength(3);
      expect(feed.posts[0].content).toBe('Post 1');
      expect(feed.posts[1].content).toBe('Post 2');
      expect(feed.posts[2].content).toBe('Post 3');
      
      expect(feed.canLike).toBe(false);
      expect(feed.canComment).toBe(false);
      expect(feed.canDM).toBe(false);
    });

    it('should log "Subscribe to unlock" warning when free user tries to like', () => {
      const result = likePost(freeUser, '1');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscribe to unlock');
      expect(warnMessages.some(msg => msg.includes('Subscribe to unlock likes'))).toBe(true);
    });

    it('should log "Subscribe to unlock" warning when free user tries to comment', () => {
      const result = commentOnPost(freeUser, '1', 'Nice post!');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscribe to unlock');
      expect(warnMessages.some(msg => msg.includes('Subscribe to unlock comments'))).toBe(true);
    });

    it('should log "Subscribe to unlock" warning when free user tries to send DM', () => {
      const result = sendDM(freeUser, 'user2', 'Hello!');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Subscribe to unlock');
      expect(warnMessages.some(msg => msg.includes('Subscribe to unlock DMs'))).toBe(true);
    });

    it('should block all unauthorized interactions and log warnings', () => {
      likePost(freeUser, '1');
      commentOnPost(freeUser, '2', 'Comment');
      sendDM(freeUser, 'user3', 'Message');

      expect(warnMessages).toHaveLength(3);
      expect(warnMessages[0]).toContain('Subscribe to unlock likes');
      expect(warnMessages[1]).toContain('Subscribe to unlock comments');
      expect(warnMessages[2]).toContain('Subscribe to unlock DMs');
    });
  });

  describe('Subscribed User Tests', () => {
    const subscribedUser: User = {
      id: 'user2',
      email: 'subscribed@example.com',
      isSubscribed: true,
    };

    it('should show posts to subscribed user and enable likes/comments/DMs', () => {
      const feed = renderFeed(subscribedUser, 'event1');

      expect(feed.posts).toHaveLength(3);
      expect(feed.posts[0].content).toBe('Post 1');
      expect(feed.posts[1].content).toBe('Post 2');
      expect(feed.posts[2].content).toBe('Post 3');
      
      expect(feed.canLike).toBe(true);
      expect(feed.canComment).toBe(true);
      expect(feed.canDM).toBe(true);
    });

    it('should allow subscribed user to like posts', () => {
      const result = likePost(subscribedUser, '1');

      expect(result.success).toBe(true);
      expect(warnMessages).toHaveLength(0);
    });

    it('should allow subscribed user to comment on posts', () => {
      const result = commentOnPost(subscribedUser, '1', 'Great post!');

      expect(result.success).toBe(true);
      expect(warnMessages).toHaveLength(0);
    });

    it('should allow subscribed user to send DMs', () => {
      const result = sendDM(subscribedUser, 'user3', 'Hello there!');

      expect(result.success).toBe(true);
      expect(warnMessages).toHaveLength(0);
    });

    it('should allow all interactions without warnings', () => {
      const likeResult = likePost(subscribedUser, '1');
      const commentResult = commentOnPost(subscribedUser, '2', 'Comment');
      const dmResult = sendDM(subscribedUser, 'user3', 'Message');

      expect(likeResult.success).toBe(true);
      expect(commentResult.success).toBe(true);
      expect(dmResult.success).toBe(true);
      expect(warnMessages).toHaveLength(0);
    });
  });

  describe('Subscription Status Comparison', () => {
    const freeUser: User = {
      id: 'user_free',
      email: 'free@example.com',
      isSubscribed: false,
    };

    const subscribedUser: User = {
      id: 'user_subscribed',
      email: 'subscribed@example.com',
      isSubscribed: true,
    };

    it('should show same posts to both free and subscribed users', () => {
      const freeFeed = renderFeed(freeUser, 'event1');
      const subscribedFeed = renderFeed(subscribedUser, 'event1');

      expect(freeFeed.posts).toHaveLength(3);
      expect(subscribedFeed.posts).toHaveLength(3);
      expect(freeFeed.posts).toEqual(subscribedFeed.posts);
    });

    it('should have different interaction permissions for free vs subscribed', () => {
      const freeFeed = renderFeed(freeUser, 'event1');
      const subscribedFeed = renderFeed(subscribedUser, 'event1');

      expect(freeFeed.canLike).toBe(false);
      expect(freeFeed.canComment).toBe(false);
      expect(freeFeed.canDM).toBe(false);

      expect(subscribedFeed.canLike).toBe(true);
      expect(subscribedFeed.canComment).toBe(true);
      expect(subscribedFeed.canDM).toBe(true);
    });
  });
});