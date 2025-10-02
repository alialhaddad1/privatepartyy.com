import { jest } from '@jest/globals';

// Mock Supabase storage and database
const mockStorageUpload = jest.fn();
const mockStorageFrom = jest.fn(() => ({
  upload: mockStorageUpload,
}));

const mockDbInsert = jest.fn();
const mockDbFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: {
      from: mockStorageFrom,
    },
    from: mockDbFrom,
  })),
}));

// Mock post interface
interface Post {
  id: string;
  eventId: string;
  author: string;
  content: string;
  photoUrl: string;
  created_at: string;
}

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Validation error class
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// File upload validation
const validateFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size ${file.size} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (10MB)`,
    };
  }

  return { valid: true };
};

// Upload function
const uploadPost = async (
  eventId: string,
  author: string,
  content: string,
  file: File
): Promise<Post> => {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new ValidationError(validation.error!);
  }

  const postId = `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fileName = `${eventId}/${postId}_${file.name}`;

  // Upload to storage
  const storageResult = await mockStorageUpload(fileName, file);
  if (storageResult.error) {
    throw new Error(`Storage upload failed: ${storageResult.error}`);
  }

  // Create post
  const post: Post = {
    id: postId,
    eventId,
    author,
    content,
    photoUrl: fileName,
    created_at: new Date().toISOString(),
  };

  const dbResult = await mockDbInsert(post);
  if (dbResult.error) {
    throw new Error(`Database insert failed: ${dbResult.error}`);
  }

  return post;
};

// Mock posts database
let mockPostsDb: Post[] = [];

describe('UX Collisions Tests - Anonymous User Experience', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostsDb = [];

    // Setup mock implementations
    mockStorageUpload.mockResolvedValue({
      data: { path: 'some/path' },
      error: null,
    });

    mockDbInsert.mockImplementation((post: Post) => {
      mockPostsDb.push(post);
      return Promise.resolve({ data: post, error: null });
    });

    mockDbFrom.mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          insert: mockDbInsert,
        };
      }
      return {};
    });
  });

  describe('Name Collision Tests', () => {
    it('should distinguish two users with same name "Alice" by post.id', async () => {
      const eventId = 'event_collision';
      const author = 'Alice';
      
      const file1 = new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' });

      // First Alice uploads
      const post1 = await uploadPost(eventId, author, 'First post', file1);
      
      // Second Alice uploads
      const post2 = await uploadPost(eventId, author, 'Second post', file2);

      // Verify both posts exist
      expect(mockPostsDb).toHaveLength(2);
      
      // Verify both have same author name
      expect(post1.author).toBe('Alice');
      expect(post2.author).toBe('Alice');
      
      // Verify they have different post IDs
      expect(post1.id).not.toBe(post2.id);
      expect(post1.id).toBeTruthy();
      expect(post2.id).toBeTruthy();
      
      // Verify posts can be distinguished by ID
      const alice1Posts = mockPostsDb.filter(p => p.id === post1.id);
      const alice2Posts = mockPostsDb.filter(p => p.id === post2.id);
      
      expect(alice1Posts).toHaveLength(1);
      expect(alice2Posts).toHaveLength(1);
      expect(alice1Posts[0].content).toBe('First post');
      expect(alice2Posts[0].content).toBe('Second post');
    });

    it('should handle multiple users with same name gracefully', async () => {
      const eventId = 'event_multiple_collision';
      const author = 'Alice';
      
      const posts = [];
      
      // Simulate 5 different "Alice" users posting
      for (let i = 0; i < 5; i++) {
        const file = new File([`photo${i}`], `photo${i}.jpg`, { type: 'image/jpeg' });
        const post = await uploadPost(eventId, author, `Post ${i + 1}`, file);
        posts.push(post);
      }

      // Verify all posts have same author
      expect(posts.every(p => p.author === 'Alice')).toBe(true);
      
      // Verify all posts have unique IDs
      const uniqueIds = new Set(posts.map(p => p.id));
      expect(uniqueIds.size).toBe(5);
      
      // Verify each post can be uniquely identified
      posts.forEach((post, index) => {
        const foundPosts = mockPostsDb.filter(p => p.id === post.id);
        expect(foundPosts).toHaveLength(1);
        expect(foundPosts[0].content).toBe(`Post ${index + 1}`);
      });
    });
  });

  describe('File Type Validation Tests', () => {
    it('should reject unsupported file type (.exe)', async () => {
      const eventId = 'event_validation';
      const author = 'Bob';
      const file = new File(['executable'], 'malware.exe', { type: 'application/x-msdownload' });

      await expect(uploadPost(eventId, author, 'Bad file', file))
        .rejects
        .toThrow(ValidationError);

      await expect(uploadPost(eventId, author, 'Bad file', file))
        .rejects
        .toThrow(/Unsupported file type/);

      expect(mockStorageUpload).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('should reject various unsupported file types', async () => {
      const eventId = 'event_validation';
      const author = 'Charlie';

      const unsupportedFiles = [
        new File(['pdf'], 'document.pdf', { type: 'application/pdf' }),
        new File(['zip'], 'archive.zip', { type: 'application/zip' }),
        new File(['doc'], 'document.doc', { type: 'application/msword' }),
        new File(['txt'], 'text.txt', { type: 'text/plain' }),
      ];

      for (const file of unsupportedFiles) {
        await expect(uploadPost(eventId, author, 'Content', file))
          .rejects
          .toThrow(ValidationError);
      }

      expect(mockStorageUpload).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('should accept supported image file types', async () => {
      const eventId = 'event_validation';
      const author = 'Dave';

      const supportedFiles = [
        new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' }),
        new File(['png'], 'photo.png', { type: 'image/png' }),
        new File(['gif'], 'photo.gif', { type: 'image/gif' }),
        new File(['webp'], 'photo.webp', { type: 'image/webp' }),
      ];

      for (const file of supportedFiles) {
        const post = await uploadPost(eventId, author, 'Valid image', file);
        expect(post).toBeDefined();
        expect(post.id).toBeTruthy();
      }

      expect(mockStorageUpload).toHaveBeenCalledTimes(4);
      expect(mockDbInsert).toHaveBeenCalledTimes(4);
    });
  });

  describe('File Size Validation Tests', () => {
    it('should reject file larger than 10MB', async () => {
      const eventId = 'event_size';
      const author = 'Eve';
      
      // Create a file larger than 10MB
      const largeFileSize = 11 * 1024 * 1024; // 11MB
      const largeFile = new File(
        [new ArrayBuffer(largeFileSize)],
        'large.jpg',
        { type: 'image/jpeg' }
      );

      // Mock the size property
      Object.defineProperty(largeFile, 'size', { value: largeFileSize });

      await expect(uploadPost(eventId, author, 'Large file', largeFile))
        .rejects
        .toThrow(ValidationError);

      await expect(uploadPost(eventId, author, 'Large file', largeFile))
        .rejects
        .toThrow(/exceeds maximum allowed size/);

      expect(mockStorageUpload).not.toHaveBeenCalled();
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it('should accept file exactly at 10MB limit', async () => {
      const eventId = 'event_size';
      const author = 'Frank';
      
      const exactSize = 10 * 1024 * 1024; // Exactly 10MB
      const file = new File(
        [new ArrayBuffer(exactSize)],
        'exact.jpg',
        { type: 'image/jpeg' }
      );

      Object.defineProperty(file, 'size', { value: exactSize });

      const post = await uploadPost(eventId, author, 'Exact size file', file);
      
      expect(post).toBeDefined();
      expect(post.id).toBeTruthy();
      expect(mockStorageUpload).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it('should accept file smaller than 10MB', async () => {
      const eventId = 'event_size';
      const author = 'Grace';
      
      const smallSize = 5 * 1024 * 1024; // 5MB
      const file = new File(
        [new ArrayBuffer(smallSize)],
        'small.jpg',
        { type: 'image/jpeg' }
      );

      Object.defineProperty(file, 'size', { value: smallSize });

      const post = await uploadPost(eventId, author, 'Small file', file);
      
      expect(post).toBeDefined();
      expect(post.id).toBeTruthy();
      expect(mockStorageUpload).toHaveBeenCalledTimes(1);
      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it('should reject extremely large files', async () => {
      const eventId = 'event_size';
      const author = 'Henry';
      
      const hugeFileSize = 100 * 1024 * 1024; // 100MB
      const hugeFile = new File(
        [new ArrayBuffer(hugeFileSize)],
        'huge.jpg',
        { type: 'image/jpeg' }
      );

      Object.defineProperty(hugeFile, 'size', { value: hugeFileSize });

      await expect(uploadPost(eventId, author, 'Huge file', hugeFile))
        .rejects
        .toThrow(ValidationError);

      expect(mockStorageUpload).not.toHaveBeenCalled();
    });
  });

  describe('Combined Validation Tests', () => {
    it('should validate both file type and size', async () => {
      const eventId = 'event_combined';
      const author = 'Ivy';

      // Invalid type, valid size
      const badType = new File(['data'], 'file.exe', { type: 'application/x-msdownload' });
      Object.defineProperty(badType, 'size', { value: 1024 });

      await expect(uploadPost(eventId, author, 'Bad type', badType))
        .rejects
        .toThrow(/Unsupported file type/);

      // Valid type, invalid size
      const badSize = new File(['data'], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(badSize, 'size', { value: 11 * 1024 * 1024 });

      await expect(uploadPost(eventId, author, 'Bad size', badSize))
        .rejects
        .toThrow(/exceeds maximum allowed size/);

      // Valid type and size
      const valid = new File(['data'], 'valid.jpg', { type: 'image/jpeg' });
      Object.defineProperty(valid, 'size', { value: 1024 });

      const post = await uploadPost(eventId, author, 'Valid', valid);
      expect(post).toBeDefined();
    });
  });
});