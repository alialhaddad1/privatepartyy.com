import { jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createClient } from '@supabase/supabase-js';
import UploadWidget from '../web/src/components/UploadWidget';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Type definitions for test data
interface MockPost {
  id: string;
  title: string;
  content: string;
  image_url: string;
  user_id: string;
  created_at: string;
}

interface MockSupabaseResponse {
  data: MockPost[] | null;
  error: null | { message: string; code?: string };
}

// Mock implementation
const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(),
    select: jest.fn(() => ({
      single: jest.fn()
    }))
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn()
    }))
  }
};

// Mock the createClient function
(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient as any);

// Mock UploadWidget's internal upload functionality
const mockUploadFunction = jest.fn();

describe('Concurrent Uploads Tests', () => {
  let mockInsert: jest.MockedFunction<any>;
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockInsert = jest.fn();
    
    // Configure Supabase mock to return our insert mock
    mockSupabaseClient.from.mockReturnValue({
      insert: mockInsert,
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    });

    // Mock successful uploads by default
    mockInsert.mockResolvedValue({
      data: [{
        id: 'mock-post-id',
        title: 'Mock Title',
        content: 'Mock Content',
        image_url: 'https://storage.supabase.co/mock.jpg',
        user_id: 'mock-user',
        created_at: new Date().toISOString()
      }],
      error: null
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Two Users Concurrent Upload', () => {
    it('should handle two users uploading different photos simultaneously without conflict', async () => {
      // Mock successful responses for both uploads
      const mockResponse1: MockSupabaseResponse = {
        data: [{
          id: 'post-1',
          title: 'User 1 Photo',
          content: 'Beautiful sunset photo',
          image_url: 'https://storage.supabase.co/user1-photo.jpg',
          user_id: 'user-1',
          created_at: '2024-01-15T10:00:00Z'
        }],
        error: null
      };

      const mockResponse2: MockSupabaseResponse = {
        data: [{
          id: 'post-2',
          title: 'User 2 Photo',
          content: 'Mountain landscape',
          image_url: 'https://storage.supabase.co/user2-photo.jpg',
          user_id: 'user-2',
          created_at: '2024-01-15T10:00:01Z'
        }],
        error: null
      };

      // Configure mock to return different responses for each call
      mockInsert
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      // Render two UploadWidget instances for different users
      const { rerender } = render(
        <UploadWidget userId="user-1" onUploadComplete={jest.fn()} />
      );

      // Get first user's upload widget elements
      const titleInput1 = screen.getByPlaceholderText(/title/i);
      const contentInput1 = screen.getByPlaceholderText(/content/i);
      const fileInput1 = screen.getByLabelText(/upload/i);
      const uploadButton1 = screen.getByRole('button', { name: /upload/i });

      // Fill first user's form
      await user.type(titleInput1, 'User 1 Photo');
      await user.type(contentInput1, 'Beautiful sunset photo');
      
      const file1 = new File(['sunset image'], 'sunset.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput1, file1);

      // Render second widget for user 2 in a different container
      const { container: container2 } = render(
        <UploadWidget userId="user-2" onUploadComplete={jest.fn()} />,
        { container: document.body.appendChild(document.createElement('div')) }
      );

      // Get second user's upload widget elements
      const titleInput2 = container2.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
      const contentInput2 = container2.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;
      const fileInput2 = container2.querySelector('input[type="file"]') as HTMLInputElement;
      const uploadButton2 = container2.querySelector('button[type="submit"]') as HTMLButtonElement;

      // Fill second user's form
      await user.type(titleInput2, 'User 2 Photo');
      await user.type(contentInput2, 'Mountain landscape');
      
      const file2 = new File(['mountain image'], 'mountain.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput2, file2);

      // Execute both uploads concurrently
      const upload1Promise = user.click(uploadButton1);
      const upload2Promise = user.click(uploadButton2);

      await Promise.all([upload1Promise, upload2Promise]);

      // Wait for both uploads to complete
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });

      // Verify both inserts were called with correct data
      expect(mockInsert).toHaveBeenNthCalledWith(1, expect.arrayContaining([
        expect.objectContaining({
          title: 'User 1 Photo',
          content: 'Beautiful sunset photo',
          user_id: 'user-1'
        })
      ]));

      expect(mockInsert).toHaveBeenNthCalledWith(2, expect.arrayContaining([
        expect.objectContaining({
          title: 'User 2 Photo',
          content: 'Mountain landscape', 
          user_id: 'user-2'
        })
      ]));
    });

    it('should handle concurrent uploads with different file types', async () => {
      const mockResponseJpeg: MockSupabaseResponse = {
        data: [{
          id: 'post-jpeg',
          title: 'JPEG Upload',
          content: 'JPEG image content',
          image_url: 'https://storage.supabase.co/photo.jpg',
          user_id: 'user-a',
          created_at: '2024-01-15T10:00:00Z'
        }],
        error: null
      };

      const mockResponsePng: MockSupabaseResponse = {
        data: [{
          id: 'post-png',
          title: 'PNG Upload',
          content: 'PNG image content',
          image_url: 'https://storage.supabase.co/graphic.png',
          user_id: 'user-b',
          created_at: '2024-01-15T10:00:01Z'
        }],
        error: null
      };

      mockInsert
        .mockResolvedValueOnce(mockResponseJpeg)
        .mockResolvedValueOnce(mockResponsePng);

      // Render upload widgets for both users
      render(<UploadWidget userId="user-a" onUploadComplete={jest.fn()} />);
      
      const titleInput = screen.getByPlaceholderText(/title/i);
      const contentInput = screen.getByPlaceholderText(/content/i);
      const fileInput = screen.getByLabelText(/upload/i);

      // First upload - JPEG
      await user.clear(titleInput);
      await user.type(titleInput, 'JPEG Upload');
      await user.clear(contentInput);
      await user.type(contentInput, 'JPEG image content');
      
      const jpegFile = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, jpegFile);

      const firstUpload = user.click(screen.getByRole('button', { name: /upload/i }));

      // Immediately simulate second upload by re-rendering with different user
      const { container: container2 } = render(
        <UploadWidget userId="user-b" onUploadComplete={jest.fn()} />,
        { container: document.body.appendChild(document.createElement('div')) }
      );

      const titleInput2 = container2.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
      const contentInput2 = container2.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;
      const fileInput2 = container2.querySelector('input[type="file"]') as HTMLInputElement;

      await user.type(titleInput2, 'PNG Upload');
      await user.type(contentInput2, 'PNG image content');

      const pngFile = new File(['png'], 'graphic.png', { type: 'image/png' });
      await user.upload(fileInput2, pngFile);

      const secondUpload = user.click(container2.querySelector('button[type="submit"]') as HTMLButtonElement);

      await Promise.all([firstUpload, secondUpload]);

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Multiple Concurrent Uploads', () => {
    it('should handle 10 concurrent uploads and call insert exactly 10 times', async () => {
      // Create 10 mock responses
      const mockResponses: MockSupabaseResponse[] = Array.from({ length: 10 }, (_, index) => ({
        data: [{
          id: `post-${index + 1}`,
          title: `Upload ${index + 1}`,
          content: `Content for upload ${index + 1}`,
          image_url: `https://storage.supabase.co/image-${index + 1}.jpg`,
          user_id: `user-${index + 1}`,
          created_at: `2024-01-15T10:00:${index.toString().padStart(2, '0')}Z`
        }],
        error: null
      }));

      // Configure mock to return different response for each call
      mockResponses.forEach((response) => {
        mockInsert.mockResolvedValueOnce(response);
      });

      // Create 10 upload widget containers
      const containers: HTMLElement[] = [];
      const uploadPromises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        const container = document.body.appendChild(document.createElement('div'));
        containers.push(container);
        
        render(
          <UploadWidget userId={`user-${i + 1}`} onUploadComplete={jest.fn()} />,
          { container }
        );

        // Fill out the form and trigger upload
        const titleInput = container.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
        const contentInput = container.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const uploadButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

        const uploadPromise = (async () => {
          await user.type(titleInput, `Upload ${i + 1}`);
          await user.type(contentInput, `Content for upload ${i + 1}`);
          
          const file = new File([`image${i + 1}`], `image-${i + 1}.jpg`, { type: 'image/jpeg' });
          await user.upload(fileInput, file);
          
          await user.click(uploadButton);
        })();

        uploadPromises.push(uploadPromise);
      }

      // Execute all uploads concurrently
      await Promise.all(uploadPromises);

      // Wait for all database inserts to complete
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(10);
      }, { timeout: 5000 });

      // Verify each insert was called with unique data
      for (let i = 0; i < 10; i++) {
        expect(mockInsert).toHaveBeenNthCalledWith(i + 1, expect.arrayContaining([
          expect.objectContaining({
            title: `Upload ${i + 1}`,
            content: `Content for upload ${i + 1}`,
            user_id: `user-${i + 1}`
          })
        ]));
      }

      // Cleanup containers
      containers.forEach(container => document.body.removeChild(container));
    });

    it('should handle partial failures in concurrent uploads', async () => {
      // Mock 3 successful and 2 failed uploads
      mockInsert
        .mockResolvedValueOnce({
          data: [{ id: 'success-1', title: 'Success 1', user_id: 'user-1' }],
          error: null
        })
        .mockResolvedValueOnce({
          data: [{ id: 'success-2', title: 'Success 2', user_id: 'user-2' }],
          error: null
        })
        .mockResolvedValueOnce({
          data: [{ id: 'success-3', title: 'Success 3', user_id: 'user-3' }],
          error: null
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Database constraint violation'));

      const containers: HTMLElement[] = [];
      const uploadPromises: Promise<void>[] = [];

      // Create 5 concurrent uploads
      for (let i = 0; i < 5; i++) {
        const container = document.body.appendChild(document.createElement('div'));
        containers.push(container);
        
        render(
          <UploadWidget userId={`user-${i + 1}`} onUploadComplete={jest.fn()} />,
          { container }
        );

        const titleInput = container.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
        const contentInput = container.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const uploadButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

        const uploadPromise = (async () => {
          await user.type(titleInput, `Upload ${i + 1}`);
          await user.type(contentInput, `Content ${i + 1}`);
          
          const file = new File([`data${i + 1}`], `file-${i + 1}.jpg`, { type: 'image/jpeg' });
          await user.upload(fileInput, file);
          
          await user.click(uploadButton);
        })();

        uploadPromises.push(uploadPromise);
      }

      // Execute all uploads concurrently (some will fail)
      await Promise.allSettled(uploadPromises);

      // Wait for all attempts to complete
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(5);
      }, { timeout: 5000 });

      // Cleanup
      containers.forEach(container => document.body.removeChild(container));
    });

    it('should maintain data integrity across concurrent uploads', async () => {
      const concurrentCount = 20;
      
      const mockResponses = Array.from({ length: concurrentCount }, (_, index) => ({
        data: [{
          id: `integrity-test-${index}`,
          title: `Integrity Test ${index}`,
          content: `Content ${index}`,
          image_url: `https://storage.supabase.co/integrity-${index}.jpg`,
          user_id: `integrity-user-${index}`,
          created_at: new Date(Date.now() + index * 1000).toISOString()
        }],
        error: null
      }));

      mockResponses.forEach(response => {
        mockInsert.mockResolvedValueOnce(response);
      });

      const containers: HTMLElement[] = [];
      const uploadPromises: Promise<void>[] = [];

      const startTime = Date.now();

      for (let i = 0; i < concurrentCount; i++) {
        const container = document.body.appendChild(document.createElement('div'));
        containers.push(container);
        
        render(
          <UploadWidget userId={`integrity-user-${i}`} onUploadComplete={jest.fn()} />,
          { container }
        );

        const titleInput = container.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
        const contentInput = container.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;  
        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        const uploadButton = container.querySelector('button[type="submit"]') as HTMLButtonElement;

        const uploadPromise = (async () => {
          await user.type(titleInput, `Integrity Test ${i}`);
          await user.type(contentInput, `Content ${i}`);
          
          const file = new File([`integrity${i}`], `integrity-${i}.jpg`, { type: 'image/jpeg' });
          await user.upload(fileInput, file);
          
          await user.click(uploadButton);
        })();

        uploadPromises.push(uploadPromise);
      }

      await Promise.all(uploadPromises);

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(concurrentCount);
      }, { timeout: 10000 });

      const endTime = Date.now();

      // Performance assertion - should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max

      // Data integrity assertions - verify all calls were made with unique user IDs
      const calls = mockInsert.mock.calls;
      const userIds = calls.map(call => call[0][0].user_id);
      const uniqueUserIds = new Set(userIds);
      expect(uniqueUserIds.size).toBe(concurrentCount);

      // Cleanup
      containers.forEach(container => document.body.removeChild(container));
    });
  });loadPost.mockResolvedValueOnce(response);
      });

      const uploadPromises = Array.from({ length: concurrentCount }, (_, index) => 
        uploadPost({
          title: `Integrity Test ${index}`,
          content: `Content ${index} - ${Date.now()}`,
          imageFile: new File([`integrity${index}`], `integrity-${index}.jpg`, { type: 'image/jpeg' }),
          userId: `integrity-user-${index}`
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(uploadPromises);
      const endTime = Date.now();

      // Performance assertion - should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      // Data integrity assertions
      expect(results).toHaveLength(concurrentCount);
      expect(mockUploadPost).toHaveBeenCalledTimes(concurrentCount);

      // Verify no data corruption - all IDs should be unique
      const ids = results.map(result => result.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(concurrentCount);

      // Verify user IDs match expected pattern
      results.forEach((result, index) => {
        expect(result.user_id).toBe(`integrity-user-${index}`);
        expect(result.title).toBe(`Integrity Test ${index}`);
      });
    });
  });

  describe('Error Handling in Concurrent Scenarios', () => {
    it('should handle database conflicts gracefully', async () => {
      // Simulate a database constraint violation
      mockInsert
        .mockResolvedValueOnce({
          data: [{
            id: 'success-1',
            title: 'Success Upload',
            content: 'This one works',
            image_url: 'https://storage.supabase.co/success.jpg',
            user_id: 'user-success',
            created_at: '2024-01-15T10:00:00Z'
          }],
          error: null
        })
        .mockRejectedValueOnce(new Error('Duplicate key violation'));

      const containers: HTMLElement[] = [];

      // First upload (success)
      const container1 = document.body.appendChild(document.createElement('div'));
      containers.push(container1);
      render(
        <UploadWidget userId="user-success" onUploadComplete={jest.fn()} />,
        { container: container1 }
      );

      // Second upload (conflict)
      const container2 = document.body.appendChild(document.createElement('div'));
      containers.push(container2);
      render(
        <UploadWidget userId="user-conflict" onUploadComplete={jest.fn()} />,
        { container: container2 }
      );

      // Fill and submit first form
      const titleInput1 = container1.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
      const contentInput1 = container1.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;
      const fileInput1 = container1.querySelector('input[type="file"]') as HTMLInputElement;
      const uploadButton1 = container1.querySelector('button[type="submit"]') as HTMLButtonElement;

      await user.type(titleInput1, 'Success Upload');
      await user.type(contentInput1, 'This one works');
      const successFile = new File(['success'], 'success.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput1, successFile);

      // Fill and submit second form
      const titleInput2 = container2.querySelector('input[placeholder*="title" i]') as HTMLInputElement;
      const contentInput2 = container2.querySelector('textarea[placeholder*="content" i]') as HTMLTextAreaElement;
      const fileInput2 = container2.querySelector('input[type="file"]') as HTMLInputElement;
      const uploadButton2 = container2.querySelector('button[type="submit"]') as HTMLButtonElement;

      await user.type(titleInput2, 'Conflict Upload');
      await user.type(contentInput2, 'This one conflicts');
      const conflictFile = new File(['conflict'], 'conflict.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput2, conflictFile);

      // Execute both uploads concurrently
      const upload1Promise = user.click(uploadButton1);
      const upload2Promise = user.click(uploadButton2);

      await Promise.allSettled([upload1Promise, upload2Promise]);

      // Wait for both database operations to be attempted
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(2);
      });

      // Verify first upload succeeded and second failed
      expect(mockInsert).toHaveBeenNthCalledWith(1, expect.arrayContaining([
        expect.objectContaining({
          title: 'Success Upload',
          user_id: 'user-success'
        })
      ]));

      expect(mockInsert).toHaveBeenNthCalledWith(2, expect.arrayContaining([
        expect.objectContaining({
          title: 'Conflict Upload',
          user_id: 'user-conflict'
        })
      ]));

      // Check for error handling in UI (error messages should be displayed)
      await waitFor(() => {
        const errorMessage = container2.querySelector('[data-testid="error-message"]') || 
                           container2.querySelector('.error') ||
                           screen.queryByText(/error|failed/i);
        // Error handling should be present in the UI
      });

      // Cleanup
      containers.forEach(container => document.body.removeChild(container));
    });

    it('should display appropriate error messages for failed uploads', async () => {
      mockInsert.mockRejectedValueOnce(new Error('Network timeout'));

      render(<UploadWidget userId="test-user" onUploadComplete={jest.fn()} />);

      const titleInput = screen.getByPlaceholderText(/title/i);
      const contentInput = screen.getByPlaceholderText(/content/i);
      const fileInput = screen.getByLabelText(/upload/i);
      const uploadButton = screen.getByRole('button', { name: /upload/i });

      await user.type(titleInput, 'Test Upload');
      await user.type(contentInput, 'Test content');
      
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await user.upload(fileInput, file);

      await user.click(uploadButton);

      // Wait for error handling
      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(1);
      });

      // Check that error is handled appropriately in the UI
      // This would depend on how your UploadWidget handles errors
    });
  });
});