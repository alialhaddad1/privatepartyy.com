import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Type definitions for mock responses
interface MockStorageResponse {
  data: {
    path: string;
    id: string;
    fullPath: string;
  } | null;
  error: null | {
    message: string;
    statusCode?: number;
  };
}

interface MockDatabaseResponse {
  data: Array<{
    id: string;
    title: string;
    content: string;
    image_url: string;
    user_id: string;
    created_at: string;
  }> | null;
  error: null | {
    message: string;
    code?: string;
    statusCode?: number;
  };
}

interface MockRemoveResponse {
  data: {
    path: string;
  }[] | null;
  error: null | {
    message: string;
    statusCode?: number;
  };
}

// Mock upload service that handles the complete upload flow
const mockUploadService = {
  uploadPost: jest.fn(),
  cleanupOrphanedFile: jest.fn(),
  validateUpload: jest.fn(),
};

// Mock Supabase client implementation
const mockSupabaseClient = {
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      remove: jest.fn(),
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: 'https://storage.example.com/test-file.jpg' }
      }))
    }))
  },
  from: jest.fn(() => ({
    insert: jest.fn(),
    select: jest.fn(() => ({
      single: jest.fn()
    }))
  }))
};

// Mock the createClient function
(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient as any);

describe('Data Consistency Tests', () => {
  let mockStorageUpload: jest.MockedFunction<any>;
  let mockStorageRemove: jest.MockedFunction<any>;
  let mockDatabaseInsert: jest.MockedFunction<any>;

  const testFile = new File(['test image data'], 'test-image.jpg', { type: 'image/jpeg' });
  const testPostData = {
    title: 'Test Post',
    content: 'Test content for data consistency',
    user_id: 'test-user-123',
    event_id: 'test-event-456'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock functions
    mockStorageUpload = jest.fn();
    mockStorageRemove = jest.fn();
    mockDatabaseInsert = jest.fn();

    // Configure Supabase client mocks
    mockSupabaseClient.storage.from.mockReturnValue({
      upload: mockStorageUpload,
      remove: mockStorageRemove,
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: 'https://storage.example.com/test-file.jpg' }
      }))
    });

    mockSupabaseClient.from.mockReturnValue({
      insert: mockDatabaseInsert,
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    });

    // Mock upload service implementation
    mockUploadService.uploadPost.mockImplementation(async (file: File, postData: any) => {
      try {
        // Step 1: Upload file to storage
        const storageResponse = await mockStorageUpload(`uploads/${file.name}`, file);
        
        if (storageResponse.error) {
          throw new Error(`Storage upload failed: ${storageResponse.error.message}`);
        }

        // Step 2: Insert post data to database
        const dbResponse = await mockDatabaseInsert([{
          ...postData,
          image_url: storageResponse.data.fullPath
        }]);

        if (dbResponse.error) {
          // Database insert failed - cleanup orphaned file
          await mockUploadService.cleanupOrphanedFile(storageResponse.data.path);
          throw new Error(`Database insert failed: ${dbResponse.error.message}`);
        }

        return {
          success: true,
          data: dbResponse.data[0],
          storagePath: storageResponse.data.path
        };
      } catch (error) {
        throw error;
      }
    });

    mockUploadService.cleanupOrphanedFile.mockImplementation(async (filePath: string) => {
      const removeResponse = await mockStorageRemove([filePath]);
      return removeResponse;
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Storage Upload Success, Database Insert Failure', () => {
    it('should trigger orphaned file cleanup when storage succeeds but database insert fails', async () => {
      // Mock successful storage upload
      const mockStorageResponse: MockStorageResponse = {
        data: {
          path: 'uploads/test-image.jpg',
          id: 'storage-file-123',
          fullPath: 'https://storage.example.com/uploads/test-image.jpg'
        },
        error: null
      };

      // Mock failed database insert
      const mockDatabaseError: MockDatabaseResponse = {
        data: null,
        error: {
          message: 'Foreign key constraint violation',
          code: '23503',
          statusCode: 400
        }
      };

      // Mock successful cleanup
      const mockRemoveResponse: MockRemoveResponse = {
        data: [{ path: 'uploads/test-image.jpg' }],
        error: null
      };

      // Configure mocks
      mockStorageUpload.mockResolvedValue(mockStorageResponse);
      mockDatabaseInsert.mockResolvedValue(mockDatabaseError);
      mockStorageRemove.mockResolvedValue(mockRemoveResponse);

      // Execute upload - should fail due to database error
      await expect(mockUploadService.uploadPost(testFile, testPostData))
        .rejects.toThrow('Database insert failed: Foreign key constraint violation');

      // Assert storage upload was called
      expect(mockStorageUpload).toHaveBeenCalledWith('uploads/test-image.jpg', testFile);

      // Assert database insert was attempted
      expect(mockDatabaseInsert).toHaveBeenCalledWith([{
        ...testPostData,
        image_url: 'https://storage.example.com/uploads/test-image.jpg'
      }]);

      // Assert orphaned file cleanup was triggered
      expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledWith('uploads/test-image.jpg');
      expect(mockStorageRemove).toHaveBeenCalledWith(['uploads/test-image.jpg']);
    });

    it('should handle different types of database errors with proper cleanup', async () => {
      const databaseErrors = [
        {
          message: 'Duplicate key value violates unique constraint',
          code: '23505',
          statusCode: 409
        },
        {
          message: 'Connection timeout',
          code: 'TIMEOUT',
          statusCode: 504
        },
        {
          message: 'Permission denied for table posts',
          code: '42501',
          statusCode: 403
        }
      ];

      for (const [index, error] of databaseErrors.entries()) {
        jest.clearAllMocks();

        const mockStorageResponse: MockStorageResponse = {
          data: {
            path: `uploads/test-image-${index}.jpg`,
            id: `storage-file-${index}`,
            fullPath: `https://storage.example.com/uploads/test-image-${index}.jpg`
          },
          error: null
        };

        const mockDatabaseError: MockDatabaseResponse = {
          data: null,
          error
        };

        const mockRemoveResponse: MockRemoveResponse = {
          data: [{ path: `uploads/test-image-${index}.jpg` }],
          error: null
        };

        mockStorageUpload.mockResolvedValue(mockStorageResponse);
        mockDatabaseInsert.mockResolvedValue(mockDatabaseError);
        mockStorageRemove.mockResolvedValue(mockRemoveResponse);

        const testFileForError = new File(['test'], `test-image-${index}.jpg`, { type: 'image/jpeg' });

        await expect(mockUploadService.uploadPost(testFileForError, testPostData))
          .rejects.toThrow(`Database insert failed: ${error.message}`);

        // Verify cleanup was called for each error type
        expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledWith(`uploads/test-image-${index}.jpg`);
        expect(mockStorageRemove).toHaveBeenCalledWith([`uploads/test-image-${index}.jpg`]);
      }
    });

    it('should handle cleanup failure gracefully', async () => {
      // Mock successful storage upload
      const mockStorageResponse: MockStorageResponse = {
        data: {
          path: 'uploads/test-image.jpg',
          id: 'storage-file-123',
          fullPath: 'https://storage.example.com/uploads/test-image.jpg'
        },
        error: null
      };

      // Mock failed database insert
      const mockDatabaseError: MockDatabaseResponse = {
        data: null,
        error: {
          message: 'Database connection lost',
          statusCode: 500
        }
      };

      // Mock failed cleanup
      const mockRemoveError: MockRemoveResponse = {
        data: null,
        error: {
          message: 'File not found',
          statusCode: 404
        }
      };

      mockStorageUpload.mockResolvedValue(mockStorageResponse);
      mockDatabaseInsert.mockResolvedValue(mockDatabaseError);
      mockStorageRemove.mockResolvedValue(mockRemoveError);

      // Update cleanup function to handle removal errors
      mockUploadService.cleanupOrphanedFile.mockImplementation(async (filePath: string) => {
        const removeResponse = await mockStorageRemove([filePath]);
        if (removeResponse.error) {
          console.warn(`Cleanup failed for ${filePath}: ${removeResponse.error.message}`);
        }
        return removeResponse;
      });

      // Execute upload
      await expect(mockUploadService.uploadPost(testFile, testPostData))
        .rejects.toThrow('Database insert failed: Database connection lost');

      // Assert cleanup was attempted despite failure
      expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledWith('uploads/test-image.jpg');
      expect(mockStorageRemove).toHaveBeenCalledWith(['uploads/test-image.jpg']);
    });

    it('should handle multiple concurrent upload failures with proper cleanup', async () => {
      const concurrentUploads = 3;
      const uploads: Promise<any>[] = [];

      for (let i = 0; i < concurrentUploads; i++) {
        // Setup mocks for each upload
        const mockStorageResponse: MockStorageResponse = {
          data: {
            path: `uploads/concurrent-${i}.jpg`,
            id: `storage-file-${i}`,
            fullPath: `https://storage.example.com/uploads/concurrent-${i}.jpg`
          },
          error: null
        };

        const mockDatabaseError: MockDatabaseResponse = {
          data: null,
          error: {
            message: `Concurrent operation conflict ${i}`,
            code: 'CONFLICT',
            statusCode: 409
          }
        };

        const mockRemoveResponse: MockRemoveResponse = {
          data: [{ path: `uploads/concurrent-${i}.jpg` }],
          error: null
        };

        mockStorageUpload.mockResolvedValueOnce(mockStorageResponse);
        mockDatabaseInsert.mockResolvedValueOnce(mockDatabaseError);
        mockStorageRemove.mockResolvedValueOnce(mockRemoveResponse);

        const concurrentFile = new File(['concurrent'], `concurrent-${i}.jpg`, { type: 'image/jpeg' });
        uploads.push(mockUploadService.uploadPost(concurrentFile, { ...testPostData, id: i }));
      }

      // All uploads should fail
      const results = await Promise.allSettled(uploads);
      
      expect(results.every(result => result.status === 'rejected')).toBe(true);

      // Verify all cleanups were triggered
      expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledTimes(concurrentUploads);
      expect(mockStorageRemove).toHaveBeenCalledTimes(concurrentUploads);

      for (let i = 0; i < concurrentUploads; i++) {
        expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledWith(`uploads/concurrent-${i}.jpg`);
      }
    });
  });

  describe('Both Operations Succeed', () => {
    it('should not trigger cleanup when both storage upload and database insert succeed', async () => {
      // Mock successful storage upload
      const mockStorageResponse: MockStorageResponse = {
        data: {
          path: 'uploads/success-test.jpg',
          id: 'storage-file-success',
          fullPath: 'https://storage.example.com/uploads/success-test.jpg'
        },
        error: null
      };

      // Mock successful database insert
      const mockDatabaseSuccess: MockDatabaseResponse = {
        data: [{
          id: 'post-123',
          title: testPostData.title,
          content: testPostData.content,
          image_url: 'https://storage.example.com/uploads/success-test.jpg',
          user_id: testPostData.user_id,
          created_at: '2024-01-15T10:00:00Z'
        }],
        error: null
      };

      // Configure mocks for success scenario
      mockStorageUpload.mockResolvedValue(mockStorageResponse);
      mockDatabaseInsert.mockResolvedValue(mockDatabaseSuccess);

      // Execute upload - should succeed
      const result = await mockUploadService.uploadPost(testFile, testPostData);

      // Assert successful result
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('post-123');
      expect(result.storagePath).toBe('uploads/success-test.jpg');

      // Assert storage upload was called
      expect(mockStorageUpload).toHaveBeenCalledWith('uploads/test-image.jpg', testFile);

      // Assert database insert was called
      expect(mockDatabaseInsert).toHaveBeenCalledWith([{
        ...testPostData,
        image_url: 'https://storage.example.com/uploads/success-test.jpg'
      }]);

      // Assert NO cleanup was triggered
      expect(mockUploadService.cleanupOrphanedFile).not.toHaveBeenCalled();
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it('should handle multiple successful uploads without triggering cleanup', async () => {
      const successfulUploads = 5;
      const uploads: Promise<any>[] = [];

      for (let i = 0; i < successfulUploads; i++) {
        const mockStorageResponse: MockStorageResponse = {
          data: {
            path: `uploads/success-${i}.jpg`,
            id: `storage-success-${i}`,
            fullPath: `https://storage.example.com/uploads/success-${i}.jpg`
          },
          error: null
        };

        const mockDatabaseSuccess: MockDatabaseResponse = {
          data: [{
            id: `post-success-${i}`,
            title: `${testPostData.title} ${i}`,
            content: testPostData.content,
            image_url: `https://storage.example.com/uploads/success-${i}.jpg`,
            user_id: testPostData.user_id,
            created_at: new Date(Date.now() + i * 1000).toISOString()
          }],
          error: null
        };

        mockStorageUpload.mockResolvedValueOnce(mockStorageResponse);
        mockDatabaseInsert.mockResolvedValueOnce(mockDatabaseSuccess);

        const successFile = new File([`success-${i}`], `success-${i}.jpg`, { type: 'image/jpeg' });
        uploads.push(mockUploadService.uploadPost(successFile, { ...testPostData, title: `${testPostData.title} ${i}` }));
      }

      // All uploads should succeed
      const results = await Promise.all(uploads);
      
      expect(results.length).toBe(successfulUploads);
      expect(results.every(result => result.success === true)).toBe(true);

      // Verify NO cleanups were triggered
      expect(mockUploadService.cleanupOrphanedFile).not.toHaveBeenCalled();
      expect(mockStorageRemove).not.toHaveBeenCalled();

      // Verify all database inserts were successful
      expect(mockDatabaseInsert).toHaveBeenCalledTimes(successfulUploads);
      expect(mockStorageUpload).toHaveBeenCalledTimes(successfulUploads);
    });

    it('should maintain data integrity across successful operations', async () => {
      const testCases = [
        { fileName: 'image1.jpg', title: 'First Image', userId: 'user-1' },
        { fileName: 'image2.png', title: 'Second Image', userId: 'user-2' },
        { fileName: 'image3.gif', title: 'Third Image', userId: 'user-3' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const mockStorageResponse: MockStorageResponse = {
          data: {
            path: `uploads/${testCase.fileName}`,
            id: `storage-${testCase.userId}`,
            fullPath: `https://storage.example.com/uploads/${testCase.fileName}`
          },
          error: null
        };

        const mockDatabaseSuccess: MockDatabaseResponse = {
          data: [{
            id: `post-${testCase.userId}`,
            title: testCase.title,
            content: 'Test content',
            image_url: `https://storage.example.com/uploads/${testCase.fileName}`,
            user_id: testCase.userId,
            created_at: new Date().toISOString()
          }],
          error: null
        };

        mockStorageUpload.mockResolvedValue(mockStorageResponse);
        mockDatabaseInsert.mockResolvedValue(mockDatabaseSuccess);

        const file = new File(['test'], testCase.fileName, { type: 'image/jpeg' });
        const result = await mockUploadService.uploadPost(file, {
          title: testCase.title,
          content: 'Test content',
          user_id: testCase.userId
        });

        // Verify data integrity
        expect(result.success).toBe(true);
        expect(result.data.title).toBe(testCase.title);
        expect(result.data.user_id).toBe(testCase.userId);
        expect(result.data.image_url).toContain(testCase.fileName);

        // Verify no cleanup was triggered
        expect(mockUploadService.cleanupOrphanedFile).not.toHaveBeenCalled();
      }
    });
  });

  describe('Storage Upload Failure', () => {
    it('should not trigger cleanup when storage upload fails initially', async () => {
      // Mock failed storage upload
      const mockStorageError: MockStorageResponse = {
        data: null,
        error: {
          message: 'Storage quota exceeded',
          statusCode: 413
        }
      };

      mockStorageUpload.mockResolvedValue(mockStorageError);

      // Execute upload - should fail at storage stage
      await expect(mockUploadService.uploadPost(testFile, testPostData))
        .rejects.toThrow('Storage upload failed: Storage quota exceeded');

      // Assert storage upload was attempted
      expect(mockStorageUpload).toHaveBeenCalledWith('uploads/test-image.jpg', testFile);

      // Assert database insert was NOT called
      expect(mockDatabaseInsert).not.toHaveBeenCalled();

      // Assert NO cleanup was triggered (no file to clean up)
      expect(mockUploadService.cleanupOrphanedFile).not.toHaveBeenCalled();
      expect(mockStorageRemove).not.toHaveBeenCalled();
    });

    it('should handle various storage upload errors without cleanup', async () => {
      const storageErrors = [
        { message: 'File too large', statusCode: 413 },
        { message: 'Invalid file type', statusCode: 400 },
        { message: 'Storage service unavailable', statusCode: 503 },
        { message: 'Authentication failed', statusCode: 401 }
      ];

      for (const error of storageErrors) {
        jest.clearAllMocks();

        mockStorageUpload.mockResolvedValue({
          data: null,
          error
        });

        await expect(mockUploadService.uploadPost(testFile, testPostData))
          .rejects.toThrow(`Storage upload failed: ${error.message}`);

        // Verify no cleanup for each storage error
        expect(mockUploadService.cleanupOrphanedFile).not.toHaveBeenCalled();
        expect(mockStorageRemove).not.toHaveBeenCalled();
        expect(mockDatabaseInsert).not.toHaveBeenCalled();
      }
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle partial success scenarios correctly', async () => {
      // Mock successful storage but null database response (edge case)
      const mockStorageResponse: MockStorageResponse = {
        data: {
          path: 'uploads/edge-case.jpg',
          id: 'storage-edge',
          fullPath: 'https://storage.example.com/uploads/edge-case.jpg'
        },
        error: null
      };

      // Mock database returning null data but no error (unusual but possible)
      const mockDatabaseNull: MockDatabaseResponse = {
        data: null,
        error: null
      };

      mockStorageUpload.mockResolvedValue(mockStorageResponse);
      mockDatabaseInsert.mockResolvedValue(mockDatabaseNull);

      // Update service to handle null data as error
      mockUploadService.uploadPost.mockImplementation(async (file: File, postData: any) => {
        const storageResponse = await mockStorageUpload(`uploads/${file.name}`, file);
        if (storageResponse.error) {
          throw new Error(`Storage upload failed: ${storageResponse.error.message}`);
        }

        const dbResponse = await mockDatabaseInsert([{ ...postData, image_url: storageResponse.data.fullPath }]);
        
        if (dbResponse.error || !dbResponse.data) {
          await mockUploadService.cleanupOrphanedFile(storageResponse.data.path);
          throw new Error('Database insert failed: No data returned');
        }

        return { success: true, data: dbResponse.data[0] };
      });

      await expect(mockUploadService.uploadPost(testFile, testPostData))
        .rejects.toThrow('Database insert failed: No data returned');

      // Verify cleanup was triggered for null data case
      expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledWith('uploads/edge-case.jpg');
    });

    it('should handle timeout scenarios with proper cleanup', async () => {
      const mockStorageResponse: MockStorageResponse = {
        data: {
          path: 'uploads/timeout-test.jpg',
          id: 'storage-timeout',
          fullPath: 'https://storage.example.com/uploads/timeout-test.jpg'
        },
        error: null
      };

      // Simulate database timeout
      mockStorageUpload.mockResolvedValue(mockStorageResponse);
      mockDatabaseInsert.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database operation timed out')), 100)
        )
      );

      mockStorageRemove.mockResolvedValue({
        data: [{ path: 'uploads/timeout-test.jpg' }],
        error: null
      });

      await expect(mockUploadService.uploadPost(testFile, testPostData))
        .rejects.toThrow('Database operation timed out');

      // Verify cleanup was triggered after timeout
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(mockUploadService.cleanupOrphanedFile).toHaveBeenCalledWith('uploads/timeout-test.jpg');
    });
  });
});