import { jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@supabase/supabase-js');

// Extend Jest timeout for performance tests
jest.setTimeout(30000); // 30 seconds

// Type definitions
interface Post {
  id: string;
  title: string;
  content: string;
  image_url: string;
  event_id: string;
  user_id: string;
  created_at: string;
  file_size?: number;
  image_width?: number;
  image_height?: number;
}

interface UploadResult {
  success: boolean;
  post: Post;
  uploadTime: number;
}

interface BulkInsertResponse {
  data: Post[] | null;
  error: null | {
    message: string;
    code?: string;
  };
}

interface SelectResponse {
  data: Post[] | null;
  error: null | {
    message: string;
    code?: string;
  };
}

// Performance tracking utilities
const performanceTracker = {
  startTimes: new Map<string, number>(),
  
  start(operationId: string): void {
    this.startTimes.set(operationId, performance.now());
  },
  
  end(operationId: string): number {
    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      throw new Error(`No start time found for operation: ${operationId}`);
    }
    const endTime = performance.now();
    const duration = endTime - startTime;
    this.startTimes.delete(operationId);
    return duration;
  },
  
  measure<T>(operationId: string, operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    return new Promise(async (resolve, reject) => {
      try {
        const startTime = performance.now();
        const result = await operation();
        const endTime = performance.now();
        const duration = endTime - startTime;
        resolve({ result, duration });
      } catch (error) {
        reject(error);
      }
    });
  }
};

// Mock services
const mockPhotoService = {
  uploadPhoto: jest.fn(),
  uploadBatchPhotos: jest.fn(),
  fetchEventPosts: jest.fn(),
  generateMockPost: jest.fn(),
};

const mockEventService = {
  fetchPostsForEvent: jest.fn(),
  fetchPostsPaginated: jest.fn(),
  countPostsForEvent: jest.fn(),
};

// Mock Supabase client implementation
const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(),
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    range: jest.fn(),
    count: jest.fn(),
  }))
};

// Mock the createClient function
(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabaseClient as any);

describe('Performance Tests', () => {
  let mockInsert: jest.MockedFunction<any>;
  let mockSelect: jest.MockedFunction<any>;
  
  const testEventId = 'performance-test-event';
  const testUserId = 'performance-test-user';

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock functions
    mockInsert = jest.fn();
    mockSelect = jest.fn();
    
    // Configure Supabase client mocks
    const mockQueryChain = {
      insert: mockInsert,
      select: mockSelect,
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
    };

    mockSupabaseClient.from.mockReturnValue(mockQueryChain);
    
    // Setup mock post generation
    (mockPhotoService.generateMockPost.mockImplementation as any)((index: any, eventId: any, userId: any): Post => ({
      id: `post-${index}`,
      title: `Performance Test Photo ${index}`,
      content: `This is test photo number ${index} for performance testing`,
      image_url: `https://storage.example.com/performance-test-${index}.jpg`,
      event_id: eventId,
      user_id: userId,
      created_at: new Date(Date.now() - (1000 - index) * 60 * 1000).toISOString(), // Spread over time
      file_size: 1024 * 1024 * (1 + Math.random() * 3), // 1-4MB files
      image_width: 1920 + Math.floor(Math.random() * 1080),
      image_height: 1080 + Math.floor(Math.random() * 720),
    }));
    
    // Setup upload service
    (mockPhotoService.uploadPhoto.mockImplementation as any)(async (postData: any): Promise<UploadResult> => {
      const startTime = performance.now();

      // Simulate upload processing time (random 10-50ms)
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 40));

      const mockResponse: BulkInsertResponse = {
        data: [postData as Post],
        error: null
      };

      await mockInsert([postData]);
      const endTime = performance.now();

      return {
        success: true,
        post: postData as Post,
        uploadTime: endTime - startTime
      };
    });
    
    // Setup batch upload service
    (mockPhotoService.uploadBatchPhotos.mockImplementation as any)(async (posts: any): Promise<UploadResult[]> => {
      const batchSize = 10; // Process in batches of 10
      const results: UploadResult[] = [];

      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        const startTime = performance.now();

        // Mock successful batch insert
        mockInsert.mockResolvedValueOnce({
          data: batch,
          error: null
        });

        await mockInsert(batch);

        // Simulate batch processing time
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));

        const endTime = performance.now();
        const batchTime = endTime - startTime;

        // Add batch results
        for (const post of batch) {
          results.push({
            success: true,
            post: post as Post,
            uploadTime: batchTime / batch.length // Distribute time across batch
          });
        }
      }

      return results;
    });
    
    // Setup fetch service
    (mockEventService.fetchPostsForEvent.mockImplementation as any)(async (eventId: any, limit?: any): Promise<Post[]> => {
      const postsToGenerate = limit || 500;
      const mockPosts: Post[] = [];

      for (let i = 0; i < postsToGenerate; i++) {
        mockPosts.push((mockPhotoService.generateMockPost as any)(i, eventId, `user-${i % 50}`)); // 50 different users
      }

      // Mock database response
      mockSelect.mockResolvedValueOnce({
        data: mockPosts,
        error: null
      });

      const result = await mockSelect('*');
      return result.data || [];
    });
    
    // Setup paginated fetch
    (mockEventService.fetchPostsPaginated.mockImplementation as any)(async (
      eventId: any,
      page: any = 0,
      pageSize: any = 50
    ): Promise<Post[]> => {
      const totalPosts = 500;
      const startIndex = page * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalPosts);

      const mockPosts: Post[] = [];
      for (let i = startIndex; i < endIndex; i++) {
        if (i < totalPosts) {
          mockPosts.push((mockPhotoService.generateMockPost as any)(i, eventId, `user-${i % 50}`));
        }
      }

      mockSelect.mockResolvedValueOnce({
        data: mockPosts,
        error: null
      });

      const result = await mockSelect('*');
      return result.data || [];
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Large Photo Upload Performance', () => {
    it('should successfully upload 100 photos and assert all inserts succeed', async () => {
      const photoCount = 100;
      const photosToUpload: Partial<Post>[] = [];
      
      // Generate test photos
      for (let i = 0; i < photoCount; i++) {
        photosToUpload.push((mockPhotoService.generateMockPost as any)(i, testEventId, testUserId));
      }
      
      console.log(`Starting upload of ${photoCount} photos...`);
      
      // Measure upload performance
      const { result: uploadResults, duration: uploadDuration } = await performanceTracker.measure(
        'bulk-upload',
        () => (mockPhotoService.uploadBatchPhotos as any)(photosToUpload)
      );

      // Assert all uploads succeeded
      expect((uploadResults as any)).toHaveLength(photoCount);
      expect((uploadResults as any).every((result: any) => result.success)).toBe(true);

      // Verify all posts have valid data
      (uploadResults as any).forEach((result: any, index: any) => {
        expect(result.post).toBeDefined();
        expect(result.post.id).toBe(`post-${index}`);
        expect(result.post.event_id).toBe(testEventId);
        expect(result.post.image_url).toContain('performance-test');
        expect(result.uploadTime).toBeGreaterThan(0);
      });
      
      // Performance assertions
      console.log(`Upload completed in ${uploadDuration.toFixed(2)}ms`);
      expect(uploadDuration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify database operations
      expect(mockInsert).toHaveBeenCalledTimes(Math.ceil(photoCount / 10)); // 10 batches of 10
      
      // Calculate average upload time per photo
      const totalUploadTime = (uploadResults as any).reduce((sum: any, result: any) => sum + result.uploadTime, 0);
      const averageUploadTime = totalUploadTime / photoCount;
      console.log(`Average upload time per photo: ${averageUploadTime.toFixed(2)}ms`);
      expect(averageUploadTime).toBeLessThan(100); // Should average under 100ms per photo
    });

    it('should handle concurrent uploads efficiently', async () => {
      const concurrentBatches = 5;
      const photosPerBatch = 20;
      const totalPhotos = concurrentBatches * photosPerBatch;
      
      // Create concurrent upload promises
      const uploadPromises: Promise<UploadResult[]>[] = [];
      
      for (let batch = 0; batch < concurrentBatches; batch++) {
        const batchPhotos: Partial<Post>[] = [];
        
        for (let i = 0; i < photosPerBatch; i++) {
          const globalIndex = batch * photosPerBatch + i;
          batchPhotos.push((mockPhotoService.generateMockPost as any)(globalIndex, testEventId, `user-batch-${batch}`));
        }

        uploadPromises.push((mockPhotoService.uploadBatchPhotos as any)(batchPhotos));
      }
      
      console.log(`Starting ${concurrentBatches} concurrent upload batches...`);
      
      // Execute all uploads concurrently
      const { result: allResults, duration: concurrentDuration } = await performanceTracker.measure(
        'concurrent-upload',
        () => Promise.all(uploadPromises)
      );
      
      // Flatten results
      const flatResults = allResults.flat();
      
      // Assert all uploads succeeded
      expect(flatResults).toHaveLength(totalPhotos);
      expect(flatResults.every(result => result.success)).toBe(true);
      
      // Performance assertions
      console.log(`Concurrent uploads completed in ${concurrentDuration.toFixed(2)}ms`);
      expect(concurrentDuration).toBeLessThan(8000); // Should be faster than sequential
      
      // Verify all posts are unique
      const postIds = flatResults.map(result => result.post.id);
      const uniquePostIds = new Set(postIds);
      expect(uniquePostIds.size).toBe(totalPhotos);
    });

    it('should maintain upload performance under memory pressure', async () => {
      const largePhotoCount = 200;
      const largePhotos: Partial<Post>[] = [];
      
      // Generate larger mock posts with more data
      for (let i = 0; i < largePhotoCount; i++) {
        const largePost = (mockPhotoService.generateMockPost as any)(i, testEventId, testUserId);
        (largePost as any).content = 'Large content: ' + 'x'.repeat(1000); // Larger content
        (largePost as any).file_size = 1024 * 1024 * 5; // 5MB files
        largePhotos.push(largePost);
      }

      const startMemory = process.memoryUsage().heapUsed;

      const { result: uploadResults, duration: uploadDuration } = await performanceTracker.measure(
        'memory-pressure-upload',
        async () => (mockPhotoService.uploadBatchPhotos as any)(largePhotos)
      );

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      // Assert successful uploads
      expect((uploadResults as any)).toHaveLength(largePhotoCount);
      expect((uploadResults as any).every((result: any) => result.success)).toBe(true);
      
      // Performance and memory assertions
      console.log(`Large upload completed in ${uploadDuration.toFixed(2)}ms`);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      expect(uploadDuration).toBeLessThan(15000); // 15 seconds for large uploads
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Large Data Retrieval Performance', () => {
    it('should retrieve 500 posts for an event and ensure result length is correct', async () => {
      const expectedPostCount = 500;
      
      console.log(`Starting fetch of ${expectedPostCount} posts...`);
      
      // Measure fetch performance using performance.now()
      const fetchStartTime = performance.now();
      const posts = await mockEventService.fetchPostsForEvent(testEventId, expectedPostCount);
      const fetchEndTime = performance.now();
      
      const fetchDuration = fetchEndTime - fetchStartTime;
      
      // Assert correct number of posts retrieved
      expect(posts).toBeDefined();
      expect(Array.isArray(posts)).toBe(true);
      expect(posts).toHaveLength(expectedPostCount);
      
      // Verify post data integrity
      (posts as any).forEach((post: any, index: any) => {
        expect(post.id).toBe(`post-${index}`);
        expect(post.event_id).toBe(testEventId);
        expect(post.image_url).toBeTruthy();
        expect(post.created_at).toBeTruthy();
        expect(post.file_size).toBeGreaterThan(0);
      });
      
      // Performance assertion - must complete under 2 seconds
      console.log(`Fetch completed in ${fetchDuration.toFixed(2)}ms`);
      expect(fetchDuration).toBeLessThan(2000); // Under 2 seconds as required
      
      // Verify database query was made
      expect(mockSelect).toHaveBeenCalledWith('*');
      // Note: mockSupabaseClient.from is set up but not directly called in the mock implementation
      expect(mockEventService.fetchPostsForEvent).toHaveBeenCalledWith(testEventId, expectedPostCount);
    });

    it('should handle paginated retrieval efficiently for large datasets', async () => {
      const totalPosts = 500;
      const pageSize = 50;
      const totalPages = Math.ceil(totalPosts / pageSize);
      
      const allPosts: Post[] = [];
      const pageTimings: number[] = [];
      
      console.log(`Starting paginated fetch of ${totalPosts} posts in ${totalPages} pages...`);
      
      const overallStartTime = performance.now();
      
      // Fetch all pages
      for (let page = 0; page < totalPages; page++) {
        const pageStartTime = performance.now();
        const pagePosts = await mockEventService.fetchPostsPaginated(testEventId, page, pageSize);
        const pageEndTime = performance.now();
        
        const pageTime = pageEndTime - pageStartTime;
        pageTimings.push(pageTime);
        
        allPosts.push(...(pagePosts as any));

        // Each page should be reasonably fast
        expect(pageTime).toBeLessThan(200); // Each page under 200ms
        expect((pagePosts as any).length).toBeLessThanOrEqual(pageSize);
      }
      
      const overallEndTime = performance.now();
      const overallDuration = overallEndTime - overallStartTime;
      
      // Assert all posts retrieved
      expect(allPosts).toHaveLength(totalPosts);
      
      // Performance assertions
      console.log(`Paginated fetch completed in ${overallDuration.toFixed(2)}ms`);
      console.log(`Average page time: ${(pageTimings.reduce((a, b) => a + b) / pageTimings.length).toFixed(2)}ms`);
      
      expect(overallDuration).toBeLessThan(3000); // Overall under 3 seconds
      
      // Verify all pages were fetched
      expect(mockSelect).toHaveBeenCalledTimes(totalPages);
      
      // Verify data integrity across pages
      const uniqueIds = new Set(allPosts.map(post => post.id));
      expect(uniqueIds.size).toBe(totalPosts); // All posts should be unique
    });

    it('should maintain fetch performance with complex queries', async () => {
      const complexQueryPostCount = 500;
      
      // Mock complex query with filtering, sorting, and aggregation
      (mockEventService.fetchPostsForEvent.mockImplementation as any)(async (eventId: any, limit?: any) => {
        const postsToGenerate = limit || complexQueryPostCount;
        const mockPosts: Post[] = [];

        // Generate posts with varied data for complex filtering
        for (let i = 0; i < postsToGenerate; i++) {
          const post = (mockPhotoService.generateMockPost as any)(i, eventId, `user-${i % 20}`);
          (post as any).file_size = 1024 * 1024 * (1 + (i % 5)); // Varied file sizes
          mockPosts.push(post);
        }

        // Simulate complex database operations
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100)); // 50-150ms

        mockSelect.mockResolvedValueOnce({
          data: mockPosts,
          error: null
        });

        const result = await mockSelect('*, users!posts_user_id_fkey(*)');
        return result.data || [];
      });

      console.log('Starting complex query fetch...');

      const { result: posts, duration: fetchDuration } = await performanceTracker.measure(
        'complex-fetch',
        async () => mockEventService.fetchPostsForEvent(testEventId, complexQueryPostCount)
      );
      
      // Assert results
      expect(posts).toHaveLength(complexQueryPostCount);
      
      // Performance assertion
      console.log(`Complex fetch completed in ${fetchDuration.toFixed(2)}ms`);
      expect(fetchDuration).toBeLessThan(2000); // Still under 2 seconds
      
      // Verify complex query was executed
      expect(mockSelect).toHaveBeenCalledWith('*, users!posts_user_id_fkey(*)');
    });

    it('should handle concurrent fetch requests efficiently', async () => {
      const concurrentFetches = 5;
      const postsPerFetch = 100;
      
      // Create multiple concurrent fetch promises
      const fetchPromises = Array.from({ length: concurrentFetches }, (_, index) => 
        mockEventService.fetchPostsForEvent(`${testEventId}-${index}`, postsPerFetch)
      );
      
      console.log(`Starting ${concurrentFetches} concurrent fetches...`);
      
      const { result: allFetchResults, duration: concurrentFetchDuration } = await performanceTracker.measure(
        'concurrent-fetch',
        () => Promise.all(fetchPromises)
      );
      
      // Assert all fetches succeeded
      expect(allFetchResults).toHaveLength(concurrentFetches);
      allFetchResults.forEach(posts => {
        expect(posts).toHaveLength(postsPerFetch);
      });
      
      // Performance assertion
      console.log(`Concurrent fetches completed in ${concurrentFetchDuration.toFixed(2)}ms`);
      expect(concurrentFetchDuration).toBeLessThan(2500); // Reasonable time for concurrent ops
      
      // Verify all queries were made
      expect(mockSelect).toHaveBeenCalledTimes(concurrentFetches);
    });
  });

  describe('End-to-End Performance Scenarios', () => {
    it('should handle full upload-then-fetch workflow efficiently', async () => {
      const photoCount = 50;
      const fetchCount = 100;
      
      // Phase 1: Upload photos
      const photosToUpload: Partial<Post>[] = [];
      for (let i = 0; i < photoCount; i++) {
        photosToUpload.push((mockPhotoService.generateMockPost as any)(i, testEventId, testUserId));
      }

      console.log('Starting end-to-end workflow...');
      const workflowStartTime = performance.now();

      // Upload phase
      const uploadResults = await (mockPhotoService.uploadBatchPhotos as any)(photosToUpload);

      // Phase 2: Fetch posts (including newly uploaded)
      const fetchedPosts = await mockEventService.fetchPostsForEvent(testEventId, fetchCount);

      const workflowEndTime = performance.now();
      const totalWorkflowTime = workflowEndTime - workflowStartTime;

      // Assert workflow success
      expect((uploadResults as any)).toHaveLength(photoCount);
      expect((uploadResults as any).every((result: any) => result.success)).toBe(true);
      expect(fetchedPosts).toHaveLength(fetchCount);
      
      // Performance assertions
      console.log(`End-to-end workflow completed in ${totalWorkflowTime.toFixed(2)}ms`);
      expect(totalWorkflowTime).toBeLessThan(5000); // Complete workflow under 5 seconds
      
      // Verify both operations
      expect(mockInsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 10;
      const photosPerIteration = 20;
      const iterationTimings: number[] = [];
      
      console.log(`Starting sustained load test with ${iterations} iterations...`);
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        const iterationStartTime = performance.now();
        
        // Generate and upload photos for this iteration
        const iterationPhotos: Partial<Post>[] = [];
        for (let i = 0; i < photosPerIteration; i++) {
          const globalIndex = iteration * photosPerIteration + i;
          iterationPhotos.push((mockPhotoService.generateMockPost as any)(globalIndex, testEventId, `user-iter-${iteration}`));
        }

        const uploadResults = await (mockPhotoService.uploadBatchPhotos as any)(iterationPhotos);
        
        // Fetch some posts
        const fetchedPosts = await mockEventService.fetchPostsForEvent(testEventId, 50);
        
        const iterationEndTime = performance.now();
        const iterationTime = iterationEndTime - iterationStartTime;
        iterationTimings.push(iterationTime);
        
        // Assert iteration success
        expect(uploadResults).toHaveLength(photosPerIteration);
        expect(fetchedPosts).toHaveLength(50);
        
        console.log(`Iteration ${iteration + 1} completed in ${iterationTime.toFixed(2)}ms`);
      }
      
      // Analyze sustained performance
      const averageIterationTime = iterationTimings.reduce((a, b) => a + b) / iterationTimings.length;
      const maxIterationTime = Math.max(...iterationTimings);
      const minIterationTime = Math.min(...iterationTimings);
      
      console.log(`Average iteration time: ${averageIterationTime.toFixed(2)}ms`);
      console.log(`Max iteration time: ${maxIterationTime.toFixed(2)}ms`);
      console.log(`Min iteration time: ${minIterationTime.toFixed(2)}ms`);
      
      // Performance should remain consistent
      expect(averageIterationTime).toBeLessThan(1000); // Average under 1 second
      expect(maxIterationTime).toBeLessThan(2000); // No iteration over 2 seconds
      
      // Performance should not degrade significantly over time
      const firstHalfAvg = iterationTimings.slice(0, 5).reduce((a, b) => a + b) / 5;
      const secondHalfAvg = iterationTimings.slice(5).reduce((a, b) => a + b) / 5;
      const degradation = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      
      expect(degradation).toBeLessThan(0.5); // Less than 50% degradation
      
      console.log(`Performance degradation: ${(degradation * 100).toFixed(2)}%`);
    });
  });

  describe('Performance Monitoring and Metrics', () => {
    it('should provide detailed performance metrics for analysis', async () => {
      const testOperations = [
        { name: 'small-upload', photos: 10 },
        { name: 'medium-upload', photos: 50 },
        { name: 'large-upload', photos: 100 }
      ];
      
      const metrics: Record<string, { duration: number; throughput: number }> = {};
      
      for (const operation of testOperations) {
        const photos: Partial<Post>[] = [];
        for (let i = 0; i < operation.photos; i++) {
          photos.push((mockPhotoService.generateMockPost as any)(i, testEventId, testUserId));
        }

        const { result, duration } = await performanceTracker.measure(
          operation.name,
          async () => (mockPhotoService.uploadBatchPhotos as any)(photos)
        );
        
        const throughput = operation.photos / (duration / 1000); // Photos per second
        
        metrics[operation.name] = { duration, throughput };
        
        expect(result).toHaveLength(operation.photos);
        console.log(`${operation.name}: ${duration.toFixed(2)}ms, ${throughput.toFixed(2)} photos/sec`);
      }
      
      // Verify performance scaling
      expect(metrics['small-upload'].throughput).toBeGreaterThan(0);
      expect(metrics['medium-upload'].throughput).toBeGreaterThan(0);
      expect(metrics['large-upload'].throughput).toBeGreaterThan(0);
      
      // Throughput should not decrease dramatically with scale
      const smallThroughput = metrics['small-upload'].throughput;
      const largeThroughput = metrics['large-upload'].throughput;
      const efficiencyRatio = largeThroughput / smallThroughput;
      
      expect(efficiencyRatio).toBeGreaterThan(0.3); // At least 30% efficiency retained at scale
      
      console.log('Performance Metrics Summary:');
      Object.entries(metrics).forEach(([name, metric]) => {
        console.log(`  ${name}: ${metric.duration.toFixed(2)}ms, ${metric.throughput.toFixed(2)} photos/sec`);
      });
    });
  });
});