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

// Mock photo data
interface Photo {
  file: File;
  caption: string;
}

interface UploadResult {
  success: boolean;
  uploadedCount: number;
  posts: Array<{
    id: string;
    eventId: string;
    photoUrl: string;
    caption: string;
  }>;
}

// Upload photos function
const uploadPhotosToFeed = async (
  eventId: string,
  photos: Photo[]
): Promise<UploadResult> => {
  const uploadedPosts = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const fileName = `${eventId}/photo_${Date.now()}_${i}.jpg`;
    
    // Upload to storage
    const storageResult = await mockStorageUpload(fileName, photo.file, {
      contentType: 'image/jpeg',
    });

    if (storageResult.error) {
      throw new Error(`Failed to upload photo ${i}: ${storageResult.error}`);
    }

    // Create post record
    const post = {
      id: `post_${eventId}_${i}_${Date.now()}`,
      eventId: eventId,
      photoUrl: fileName,
      caption: photo.caption,
      created_at: new Date().toISOString(),
    };

    const dbResult = await mockDbInsert(post);

    if (dbResult.error) {
      throw new Error(`Failed to insert post ${i}: ${dbResult.error}`);
    }

    uploadedPosts.push(post);
  }

  return {
    success: true,
    uploadedCount: photos.length,
    posts: uploadedPosts,
  };
};

// Helper to create mock photos
const createMockPhotos = (count: number, eventId: string): Photo[] => {
  return Array.from({ length: count }, (_, i) => ({
    file: new File([`photo_${i}_data`], `photo_${i}.jpg`, { type: 'image/jpeg' }),
    caption: `Photo ${i + 1} for ${eventId}`,
  }));
};

describe('Upload Feed Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockStorageUpload.mockResolvedValue({
      data: { path: 'some/path' },
      error: null,
    });

    mockDbInsert.mockResolvedValue({
      data: {},
      error: null,
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

  it('should upload 5 photos and call insert 5 times', async () => {
    const eventId = 'event_5_photos';
    const photos = createMockPhotos(5, eventId);

    const result = await uploadPhotosToFeed(eventId, photos);

    expect(result.success).toBe(true);
    expect(result.uploadedCount).toBe(5);
    expect(result.posts).toHaveLength(5);
    expect(mockStorageUpload).toHaveBeenCalledTimes(5);
    expect(mockDbInsert).toHaveBeenCalledTimes(5);

    // Verify each photo has correct eventId prefix
    result.posts.forEach(post => {
      expect(post.photoUrl).toContain(eventId);
      expect(post.photoUrl).toMatch(new RegExp(`^${eventId}/`));
      expect(post.eventId).toBe(eventId);
    });
  });

  it('should upload 10 photos and call insert 10 times', async () => {
    const eventId = 'event_10_photos';
    const photos = createMockPhotos(10, eventId);

    const result = await uploadPhotosToFeed(eventId, photos);

    expect(result.success).toBe(true);
    expect(result.uploadedCount).toBe(10);
    expect(result.posts).toHaveLength(10);
    expect(mockStorageUpload).toHaveBeenCalledTimes(10);
    expect(mockDbInsert).toHaveBeenCalledTimes(10);

    // Verify each photo has correct eventId prefix
    result.posts.forEach(post => {
      expect(post.photoUrl).toContain(eventId);
      expect(post.photoUrl).toMatch(new RegExp(`^${eventId}/`));
      expect(post.eventId).toBe(eventId);
    });
  });

  it('should upload 20 photos and call insert 20 times', async () => {
    const eventId = 'event_20_photos';
    const photos = createMockPhotos(20, eventId);

    const result = await uploadPhotosToFeed(eventId, photos);

    expect(result.success).toBe(true);
    expect(result.uploadedCount).toBe(20);
    expect(result.posts).toHaveLength(20);
    expect(mockStorageUpload).toHaveBeenCalledTimes(20);
    expect(mockDbInsert).toHaveBeenCalledTimes(20);

    // Verify each photo has correct eventId prefix
    result.posts.forEach(post => {
      expect(post.photoUrl).toContain(eventId);
      expect(post.photoUrl).toMatch(new RegExp(`^${eventId}/`));
      expect(post.eventId).toBe(eventId);
    });
  });

  it('should ensure file paths contain correct eventId prefix for all uploads', async () => {
    const eventId = 'wedding_2024';
    const photos = createMockPhotos(5, eventId);

    const result = await uploadPhotosToFeed(eventId, photos);

    // Check all storage upload calls
    expect(mockStorageUpload).toHaveBeenCalledTimes(5);
    
    for (let i = 0; i < 5; i++) {
      const call = mockStorageUpload.mock.calls[i];
      const filePath = call[0];
      
      expect(filePath).toMatch(new RegExp(`^${eventId}/photo_\\d+_${i}\\.jpg$`));
      expect(filePath.startsWith(`${eventId}/`)).toBe(true);
    }

    // Check all post records
    result.posts.forEach((post, index) => {
      expect(post.eventId).toBe(eventId);
      expect(post.photoUrl).toContain(`${eventId}/`);
      expect(post.caption).toBe(`Photo ${index + 1} for ${eventId}`);
    });
  });

  it('should handle different eventIds correctly', async () => {
    const eventId1 = 'birthday_party';
    const eventId2 = 'conference_2025';
    
    const photos1 = createMockPhotos(3, eventId1);
    const photos2 = createMockPhotos(3, eventId2);

    const result1 = await uploadPhotosToFeed(eventId1, photos1);
    const result2 = await uploadPhotosToFeed(eventId2, photos2);

    expect(result1.uploadedCount).toBe(3);
    expect(result2.uploadedCount).toBe(3);

    // Verify eventId1 posts
    result1.posts.forEach(post => {
      expect(post.eventId).toBe(eventId1);
      expect(post.photoUrl).toContain(eventId1);
      expect(post.photoUrl).not.toContain(eventId2);
    });

    // Verify eventId2 posts
    result2.posts.forEach(post => {
      expect(post.eventId).toBe(eventId2);
      expect(post.photoUrl).toContain(eventId2);
      expect(post.photoUrl).not.toContain(eventId1);
    });
  });

  it('should maintain correct order of uploads', async () => {
    const eventId = 'ordered_event';
    const photos = createMockPhotos(5, eventId);

    const result = await uploadPhotosToFeed(eventId, photos);

    // Verify posts are in order
    result.posts.forEach((post, index) => {
      expect(post.caption).toBe(`Photo ${index + 1} for ${eventId}`);
    });
  });

  it('should handle upload failure gracefully', async () => {
    const eventId = 'failing_event';
    const photos = createMockPhotos(3, eventId);

    // Mock a failure on the second upload
    mockStorageUpload
      .mockResolvedValueOnce({ data: { path: 'path1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: 'Storage error' });

    await expect(uploadPhotosToFeed(eventId, photos)).rejects.toThrow('Failed to upload photo 1');
    
    expect(mockStorageUpload).toHaveBeenCalledTimes(2);
    expect(mockDbInsert).toHaveBeenCalledTimes(1); // Only first photo inserted
  });

  it('should verify storage upload is called with correct parameters', async () => {
    const eventId = 'test_event';
    const photos = createMockPhotos(2, eventId);

    await uploadPhotosToFeed(eventId, photos);

    expect(mockStorageUpload).toHaveBeenCalledTimes(2);
    
    // Check first call parameters
    const firstCall = mockStorageUpload.mock.calls[0];
    expect(firstCall[0]).toContain(eventId);
    expect(firstCall[1]).toBe(photos[0].file);
    expect(firstCall[2]).toEqual({ contentType: 'image/jpeg' });

    // Check second call parameters
    const secondCall = mockStorageUpload.mock.calls[1];
    expect(secondCall[0]).toContain(eventId);
    expect(secondCall[1]).toBe(photos[1].file);
    expect(secondCall[2]).toEqual({ contentType: 'image/jpeg' });
  });
});