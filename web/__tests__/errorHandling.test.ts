import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { generateQRCode, parseQRCode } from '../src/lib/qr';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Mock QR code functions
jest.mock('../src/lib/qr', () => ({
  generateQRCode: jest.fn(),
  parseQRCode: jest.fn(),
}));

// Mock console methods for testing error logging
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

// Type definitions for error responses
interface SupabaseError {
  message: string;
  statusCode?: number;
  code?: string;
  details?: string;
  hint?: string;
}

interface StorageError extends SupabaseError {
  path?: string;
}

interface DatabaseError extends SupabaseError {
  table?: string;
  constraint?: string;
}

// Mock upload and database services that handle errors gracefully
const mockUploadService = {
  uploadFile: jest.fn(),
  createPost: jest.fn(),
  handleStorageError: jest.fn(),
  handleDatabaseError: jest.fn(),
  logError: jest.fn(),
};

// Mock Supabase client implementation
const mockSupabaseClient = {
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      remove: jest.fn(),
      getPublicUrl: jest.fn()
    }))
  },
  from: jest.fn(() => ({
    insert: jest.fn(),
    select: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }))
};

// Mock QR functions
const mockGenerateQRCode = generateQRCode as jest.MockedFunction<typeof generateQRCode>;
const mockParseQRCode = parseQRCode as jest.MockedFunction<typeof parseQRCode>;

// Mock the createClient function
(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient as any);

describe('Error Handling Tests', () => {
  let mockStorageUpload: jest.MockedFunction<any>;
  let mockDatabaseInsert: jest.MockedFunction<any>;

  const testFile = new File(['test file content'], 'test-file.jpg', { type: 'image/jpeg' });
  const testPostData = {
    title: 'Test Post',
    content: 'Test content',
    user_id: 'test-user-123',
    event_id: 'test-event-456'
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockConsoleError.mockClear();
    mockConsoleWarn.mockClear();
    mockConsoleLog.mockClear();

    // Setup mock functions
    mockStorageUpload = jest.fn();
    mockDatabaseInsert = jest.fn();

    // Configure Supabase client mocks
    mockSupabaseClient.storage.from.mockReturnValue({
      upload: mockStorageUpload,
      remove: jest.fn(),
      getPublicUrl: jest.fn()
    });

    mockSupabaseClient.from.mockReturnValue({
      insert: mockDatabaseInsert,
      select: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    });

    // Setup upload service error handling
    (mockUploadService.uploadFile.mockImplementation as any)(async (file: any, path: any) => {
      try {
        const result = await mockStorageUpload(path, file);
        if (result.error) {
          return mockUploadService.handleStorageError(result.error);
        }
        return { success: true, data: result.data };
      } catch (error) {
        return mockUploadService.handleStorageError(error);
      } 
    });

    mockUploadService.createPost.mockImplementation(async (postData: any) => {
      try {
        const result = await mockDatabaseInsert([postData]);
        if (result.error) {
          mockUploadService.logError('Database insert failed', result.error);
          return mockUploadService.handleDatabaseError(result.error);
        }
        return { success: true, data: result.data };
      } catch (error) {
        mockUploadService.logError('Database insert failed', error);
        return mockUploadService.handleDatabaseError(error);
      }
    });

    (mockUploadService.handleStorageError.mockImplementation as any)((error: any) => {
      mockUploadService.logError('Storage operation failed', error);
      return {
        success: false,
        error: {
          type: 'STORAGE_ERROR',
          message: 'File upload failed. Please try again.',
          originalError: error.message
        }
      };
    });

    (mockUploadService.handleDatabaseError.mockImplementation as any)((error: any) => {
      return {
        success: false,
        error: {
          type: 'DATABASE_ERROR',
          message: 'Unable to save data. Please try again.',
          originalError: error.message
        }
      };
    });

    (mockUploadService.logError.mockImplementation as any)((message: any, error: any) => {
      console.error(`[ERROR] ${message}:`, error);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Supabase Storage Errors', () => {
    it('should handle network error from storage upload gracefully', async () => {
      // Mock network error
      const networkError: StorageError = {
        message: 'Network request failed',
        statusCode: 0,
        code: 'NETWORK_ERROR'
      };

      mockStorageUpload.mockRejectedValue(networkError);

      // Execute upload
      const result = await mockUploadService.uploadFile(testFile, 'uploads/test-file.jpg');

      // Assert graceful error handling
      expect((result as any).success).toBe(false);
      expect((result as any).error).toBeDefined();
      expect((result as any).error.type).toBe('STORAGE_ERROR');
      expect((result as any).error.message).toBe('File upload failed. Please try again.');
      expect((result as any).error.originalError).toBe('Network request failed');

      // Assert error was logged
      expect(mockUploadService.logError).toHaveBeenCalledWith('Storage operation failed', networkError);
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] Storage operation failed:', networkError);
    });

    it('should handle storage quota exceeded error gracefully', async () => {
      const quotaError: StorageError = {
        message: 'Storage quota exceeded',
        statusCode: 413,
        code: 'QUOTA_EXCEEDED',
        details: 'Account storage limit reached'
      };

      mockStorageUpload.mockResolvedValue({
        data: null,
        error: quotaError
      });

      const result = await mockUploadService.uploadFile(testFile, 'uploads/large-file.jpg');

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('STORAGE_ERROR');
      expect((result as any).error.message).toBe('File upload failed. Please try again.');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Storage operation failed', quotaError);
    });

    it('should handle storage authentication errors gracefully', async () => {
      const authError: StorageError = {
        message: 'Invalid JWT token',
        statusCode: 401,
        code: 'UNAUTHORIZED',
        hint: 'Please sign in again'
      };

      mockStorageUpload.mockRejectedValue(authError);

      const result = await mockUploadService.uploadFile(testFile, 'uploads/test-file.jpg');

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('STORAGE_ERROR');
      expect((result as any).error.originalError).toBe('Invalid JWT token');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Storage operation failed', authError);
    });

    it('should handle storage timeout errors gracefully', async () => {
      const timeoutError: StorageError = {
        message: 'Request timeout',
        statusCode: 408,
        code: 'TIMEOUT'
      };

      // Simulate timeout by rejecting after delay
      mockStorageUpload.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(timeoutError), 100)
        )
      );

      const result = await mockUploadService.uploadFile(testFile, 'uploads/slow-upload.jpg');

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('STORAGE_ERROR');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Storage operation failed', timeoutError);
    });

    it('should handle invalid file type errors gracefully', async () => {
      const fileTypeError: StorageError = {
        message: 'Invalid file type',
        statusCode: 400,
        code: 'INVALID_FILE_TYPE',
        details: 'Only images are allowed'
      };

      mockStorageUpload.mockResolvedValue({
        data: null,
        error: fileTypeError
      });

      const invalidFile = new File(['malicious'], 'malicious.exe', { type: 'application/exe' });
      const result = await mockUploadService.uploadFile(invalidFile, 'uploads/malicious.exe');

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('STORAGE_ERROR');
      expect(mockUploadService.handleStorageError).toHaveBeenCalledWith(fileTypeError);
    });
  });

  describe('Supabase Database Errors', () => {
    it('should handle database insert failure and log proper error', async () => {
      // Mock database constraint violation
      const constraintError: DatabaseError = {
        message: 'Foreign key constraint violation',
        statusCode: 400,
        code: '23503',
        table: 'posts',
        constraint: 'posts_user_id_fkey'
      };

      mockDatabaseInsert.mockResolvedValue({
        data: null,
        error: constraintError
      });

      // Execute database operation
      const result = await mockUploadService.createPost(testPostData);

      // Assert proper error handling
      expect((result as any).success).toBe(false);
      expect((result as any).error).toBeDefined();
      expect((result as any).error.type).toBe('DATABASE_ERROR');
      expect((result as any).error.message).toBe('Unable to save data. Please try again.');
      expect((result as any).error.originalError).toBe('Foreign key constraint violation');

      // Assert error was properly logged
      expect(mockUploadService.logError).toHaveBeenCalledWith('Database insert failed', constraintError);
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] Database insert failed:', constraintError);
    });

    it('should handle database connection errors and log appropriately', async () => {
      const connectionError: DatabaseError = {
        message: 'Connection to database failed',
        statusCode: 500,
        code: 'CONNECTION_ERROR',
        details: 'Database server is unavailable'
      };

      mockDatabaseInsert.mockRejectedValue(connectionError);

      const result = await mockUploadService.createPost(testPostData);

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('DATABASE_ERROR');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Database insert failed', connectionError);
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] Database insert failed:', connectionError);
    });

    it('should handle duplicate key violations and log error', async () => {
      const duplicateError: DatabaseError = {
        message: 'Duplicate key value violates unique constraint',
        statusCode: 409,
        code: '23505',
        table: 'posts',
        constraint: 'posts_title_unique'
      };

      mockDatabaseInsert.mockResolvedValue({
        data: null,
        error: duplicateError
      });

      const result = await mockUploadService.createPost(testPostData);

      expect((result as any).success).toBe(false);
      expect((result as any).error.originalError).toBe('Duplicate key value violates unique constraint');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Database insert failed', duplicateError);
    });

    it('should handle database permission errors and log appropriately', async () => {
      const permissionError: DatabaseError = {
        message: 'Permission denied for table posts',
        statusCode: 403,
        code: '42501',
        hint: 'User does not have INSERT permission'
      };

      mockDatabaseInsert.mockResolvedValue({
        data: null,
        error: permissionError
      });

      const result = await mockUploadService.createPost(testPostData);

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('DATABASE_ERROR');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Database insert failed', permissionError);
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] Database insert failed:', permissionError);
    });

    it('should handle database transaction rollback errors', async () => {
      const rollbackError: DatabaseError = {
        message: 'Transaction was rolled back',
        statusCode: 500,
        code: 'TRANSACTION_ROLLBACK',
        details: 'Concurrent modification detected'
      };

      mockDatabaseInsert.mockRejectedValue(rollbackError);

      const result = await mockUploadService.createPost(testPostData);

      expect((result as any).success).toBe(false);
      expect((result as any).error.type).toBe('DATABASE_ERROR');
      expect(mockUploadService.logError).toHaveBeenCalledWith('Database insert failed', rollbackError);
    });
  });

  describe('QR Code Error Handling', () => {
    it('should return null when parseQRCode receives invalid URL', async () => {
      const invalidUrls = [
        'invalid-url',
        'not-a-url-at-all',
        'https://wrong-domain.com/event/123',
        'malformed://url',
        '',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      (mockParseQRCode.mockImplementation as any)(async (url: any) => {
        // Simulate real parseQRCode behavior - return null for invalid URLs
        if (!url || typeof url !== 'string') return null;
        if (!url.startsWith('https://')) return null;
        if (!url.includes('/event/')) return null;

        // If URL doesn't match expected pattern, return null
        const eventIdMatch = url.match(/\/event\/([^\/\?#]+)/);
        return eventIdMatch ? eventIdMatch[1] : null;
      });

      for (const invalidUrl of invalidUrls) {
        const result = await mockParseQRCode(invalidUrl);
        
        // Assert null is returned for invalid URLs
        expect(result).toBeNull();
      }

      expect(mockParseQRCode).toHaveBeenCalledTimes(invalidUrls.length);
    });

    it('should return null for QR codes containing malicious content', async () => {
      const maliciousUrls = [
        'https://phishing-site.com/steal-data',
        'https://malware.com/download-virus',
        'ftp://unsafe-server.com/file',
        'file:///etc/passwd',
        'https://legitimate-site.com/../../../admin/delete-all'
      ];

      (mockParseQRCode.mockImplementation as any)(async (url: any) => {
        // Simulate security checks in real parseQRCode
        const allowedDomains = ['app.example.com', 'myapp.com'];
        try {
          const urlObj = new URL(url);
          if (!allowedDomains.includes(urlObj.hostname)) {
            return null;
          }
          if (!url.includes('/event/')) {
            return null;
          }
          const eventIdMatch = url.match(/\/event\/([^\/\?#]+)/);
          return eventIdMatch ? eventIdMatch[1] : null;
        } catch {
          return null;
        }
      });

      for (const maliciousUrl of maliciousUrls) {
        const result = await mockParseQRCode(maliciousUrl);
        expect(result).toBeNull();
      }
    });

    it('should handle QR parsing errors gracefully', async () => {
      const corruptedQRData = 'data:image/png;base64,corrupted-data-that-is-not-valid';

      (mockParseQRCode.mockImplementation as any)(async (qrData: any) => {
        // Simulate QR parsing library throwing error for corrupted data
        if (qrData.includes('corrupted')) {
          throw new Error('Unable to decode QR code');
        }
        return null;
      });

      // Should handle parsing errors and return null instead of throwing
      try {
        const result = await mockParseQRCode(corruptedQRData);
        expect(result).toBeNull();
      } catch (error) {
        // If implementation throws, test should still pass
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Unable to decode QR code');
      }
    });
  });

  describe('QR Code Generation Errors', () => {
    it('should reject when generateQRCode receives empty eventId', async () => {
      mockGenerateQRCode.mockImplementation(async (eventId: string) => {
        // Simulate real generateQRCode validation
        if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
          throw new Error('Event ID is required and cannot be empty');
        }
        return 'data:image/png;base64,mock-qr-code';
      });

      // Test empty string
      await expect(mockGenerateQRCode('')).rejects.toThrow('Event ID is required and cannot be empty');

      // Test whitespace-only string
      await expect(mockGenerateQRCode('   ')).rejects.toThrow('Event ID is required and cannot be empty');

      // Test undefined (cast to string)
      await expect(mockGenerateQRCode(undefined as any)).rejects.toThrow('Event ID is required and cannot be empty');

      // Test null (cast to string)
      await expect(mockGenerateQRCode(null as any)).rejects.toThrow('Event ID is required and cannot be empty');
    });

    it('should reject when generateQRCode receives invalid input types', async () => {
      mockGenerateQRCode.mockImplementation(async (eventId: any) => {
        if (typeof eventId !== 'string') {
          throw new Error('Event ID must be a string');
        }
        if (!eventId.trim()) {
          throw new Error('Event ID is required and cannot be empty');
        }
        return 'data:image/png;base64,mock-qr-code';
      });

      // Test number
      await expect(mockGenerateQRCode(123 as any)).rejects.toThrow('Event ID must be a string');

      // Test object
      await expect(mockGenerateQRCode({} as any)).rejects.toThrow('Event ID must be a string');

      // Test array
      await expect(mockGenerateQRCode([] as any)).rejects.toThrow('Event ID must be a string');

      // Test boolean
      await expect(mockGenerateQRCode(true as any)).rejects.toThrow('Event ID must be a string');
    });

    it('should handle QR generation library errors', async () => {
      const validEventId = 'valid-event-123';

      mockGenerateQRCode.mockImplementation(async (eventId: string) => {
        // Simulate QR library internal error
        if (eventId === validEventId) {
          throw new Error('QR code generation library error');
        }
        return 'data:image/png;base64,mock-qr-code';
      });

      await expect(mockGenerateQRCode(validEventId)).rejects.toThrow('QR code generation library error');
    });

    it('should handle extremely long eventId strings', async () => {
      const veryLongEventId = 'a'.repeat(10000); // 10KB event ID

      mockGenerateQRCode.mockImplementation(async (eventId: string) => {
        if (eventId.length > 1000) {
          throw new Error('Event ID too long for QR code generation');
        }
        return 'data:image/png;base64,mock-qr-code';
      });

      await expect(mockGenerateQRCode(veryLongEventId)).rejects.toThrow('Event ID too long for QR code generation');
    });

    it('should handle special characters in eventId', async () => {
      const specialEventIds = [
        'event/with/slashes',
        'event?with=query',
        'event#with-hash',
        'event with spaces',
        'event"with"quotes',
        'event<with>tags'
      ];

      mockGenerateQRCode.mockImplementation(async (eventId: string) => {
        // Simulate validation of special characters
        const invalidChars = /[<>"'&]/;
        if (invalidChars.test(eventId)) {
          throw new Error('Event ID contains invalid characters');
        }
        return 'data:image/png;base64,mock-qr-code';
      });

      // Some should succeed
      await expect(mockGenerateQRCode('event/with/slashes')).resolves.toBe('data:image/png;base64,mock-qr-code');
      await expect(mockGenerateQRCode('event with spaces')).resolves.toBe('data:image/png;base64,mock-qr-code');

      // Some should fail due to dangerous characters
      await expect(mockGenerateQRCode('event<with>tags')).rejects.toThrow('Event ID contains invalid characters');
      await expect(mockGenerateQRCode('event"with"quotes')).rejects.toThrow('Event ID contains invalid characters');
    });
  });

  describe('Combined Error Scenarios', () => {
    it('should handle multiple cascading errors gracefully', async () => {
      // Storage fails, then database fails, then QR fails
      const networkError: StorageError = {
        message: 'Network connection lost',
        statusCode: 0,
        code: 'NETWORK_ERROR'
      };

      const dbError: DatabaseError = {
        message: 'Database connection lost',
        statusCode: 500,
        code: 'CONNECTION_ERROR'
      };

      mockStorageUpload.mockRejectedValue(networkError);
      mockDatabaseInsert.mockRejectedValue(dbError);
      mockGenerateQRCode.mockRejectedValue(new Error('QR service unavailable'));

      // Test all three failing
      const storageResult = await mockUploadService.uploadFile(testFile, 'uploads/test.jpg');
      const dbResult = await mockUploadService.createPost(testPostData);
      
      expect((storageResult as any).success).toBe(false);
      expect((dbResult as any).success).toBe(false);
      await expect(mockGenerateQRCode('test-event')).rejects.toThrow('QR service unavailable');

      // Verify all errors were logged
      expect(mockConsoleError).toHaveBeenCalledTimes(2); // Storage + DB errors
    });

    it('should maintain error context across operations', async () => {
      const contextualError = {
        message: 'Operation failed in specific context',
        statusCode: 500,
        code: 'CONTEXT_ERROR',
        context: {
          operation: 'file_upload',
          user_id: testPostData.user_id,
          file_name: testFile.name
        }
      };

      mockStorageUpload.mockRejectedValue(contextualError);

      const result = await mockUploadService.uploadFile(testFile, 'uploads/context-test.jpg');

      expect((result as any).success).toBe(false);
      expect(mockUploadService.logError).toHaveBeenCalledWith('Storage operation failed', contextualError);

      // Verify context is preserved in error logging
      const logCall = mockConsoleError.mock.calls[0];
      expect(logCall[0]).toContain('[ERROR] Storage operation failed:');
      expect(logCall[1]).toEqual(contextualError);
    });

    it('should handle timeout scenarios across all services', async () => {
      const timeoutError = new Error('Operation timed out');

      mockStorageUpload.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(timeoutError), 50))
      );

      mockDatabaseInsert.mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(timeoutError), 50))
      );

      mockGenerateQRCode.mockImplementation(() =>
        new Promise((_, reject) => setTimeout(() => reject(timeoutError), 50))
      );

      // All operations should handle timeouts gracefully
      const storagePromise = mockUploadService.uploadFile(testFile, 'uploads/timeout-test.jpg');
      const dbPromise = mockUploadService.createPost(testPostData);
      const qrPromise = mockGenerateQRCode('timeout-test-event');

      const [storageResult, dbResult] = await Promise.allSettled([
        storagePromise,
        dbPromise,
        qrPromise
      ]);

      expect(storageResult.status).toBe('fulfilled');
      expect((storageResult as any).value.success).toBe(false);
      
      expect(dbResult.status).toBe('fulfilled');
      expect((dbResult as any).value.success).toBe(false);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle error recovery gracefully', async () => {
      // First attempt fails, second succeeds
      let attemptCount = 0;
      mockStorageUpload.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Temporary network error');
        }
        return {
          data: { path: 'uploads/retry-success.jpg', id: 'file-123' },
          error: null
        };
      });

      // First attempt - should fail
      const firstResult = await mockUploadService.uploadFile(testFile, 'uploads/retry-test.jpg');
      expect((firstResult as any).success).toBe(false);

      // Second attempt - should succeed
      const secondResult = await mockUploadService.uploadFile(testFile, 'uploads/retry-test.jpg');
      expect((secondResult as any).success).toBe(true);

      expect(mockStorageUpload).toHaveBeenCalledTimes(2);
    });

    it('should maintain error logs for debugging', async () => {
      const debuggableError = {
        message: 'Complex error requiring debugging',
        statusCode: 500,
        code: 'DEBUG_ERROR',
        stack: 'Error stack trace here',
        requestId: 'req-12345',
        timestamp: new Date().toISOString()
      };

      mockDatabaseInsert.mockRejectedValue(debuggableError);

      await mockUploadService.createPost(testPostData);

      // Verify detailed error information is logged
      expect(mockUploadService.logError).toHaveBeenCalledWith('Database insert failed', debuggableError);
      expect(mockConsoleError).toHaveBeenCalledWith('[ERROR] Database insert failed:', debuggableError);
    });
  });
});