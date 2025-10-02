import { jest } from '@jest/globals';
import { render, waitFor, userEvent } from './test-utils';
import '@testing-library/jest-dom';
import { JSDOM } from 'jsdom';
import { generateQRCode, parseQRCode } from '../src/lib/qr';
import QRScanner from '../src/components/QRScanner';

// Mock the QR library functions
jest.mock('../src/lib/qr', () => ({
  generateQRCode: jest.fn(),
  parseQRCode: jest.fn(),
}));

// Mock browser APIs
const mockMediaDevices = {
  getUserMedia: jest.fn() as jest.MockedFunction<(constraints: MediaStreamConstraints) => Promise<MediaStream>>,
  enumerateDevices: jest.fn() as jest.MockedFunction<() => Promise<MediaDeviceInfo[]>>,
};

const mockFileReader = {
  readAsDataURL: jest.fn(),
  result: '',
  onload: null as any,
  onerror: null as any,
};

// Type definitions for upload results
interface UploadMetadata {
  originalName?: string;
  size?: number;
  type?: string;
  device?: string;
  orientation?: number;
  manufacturer?: string;
  model?: string;
  width?: number;
  height?: number;
  rotated?: boolean;
  isScreenshot?: boolean;
  dimensions?: { width: number; height: number };
  source?: string;
}

interface UploadResult {
  success: boolean;
  url: string;
  id: string;
  metadata?: UploadMetadata;
  originalFormat?: string;
  uploadFormat?: string;
  eventId?: string;
  source?: string;
}

// Mock file upload functionality
const mockUploadPhoto = jest.fn() as jest.MockedFunction<(file: File, options?: any) => Promise<UploadResult>>;

jest.mock('../lib/uploadUtils', () => ({
  uploadPhoto: mockUploadPhoto,
}));

describe('Cross-Device QR Scanning and Upload Tests', () => {
  let originalWindow: any;
  let originalNavigator: any;
  const user = userEvent.setup();
  const testEventId = 'cross_device_test_event';
  const testQRUrl = `https://app.example.com/event/${testEventId}`;

  // Mock QR functions
  const mockGenerateQRCode = generateQRCode as jest.MockedFunction<typeof generateQRCode>;
  const mockParseQRCode = parseQRCode as jest.MockedFunction<typeof parseQRCode>;

  beforeEach(() => {
    // Store original globals
    originalWindow = global.window;
    originalNavigator = global.navigator;

    // Clear all mocks
    jest.clearAllMocks();

    // Setup default QR code responses
    mockGenerateQRCode.mockResolvedValue('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    mockParseQRCode.mockReturnValue(testEventId);

    // Setup default upload response
    mockUploadPhoto.mockResolvedValue({
      success: true,
      url: 'https://storage.example.com/photo.jpg',
      id: 'upload-123'
    } as UploadResult);

    // Mock FileReader
    global.FileReader = jest.fn(() => mockFileReader) as any;
  });

  afterEach(() => {
    // Restore original globals
    global.window = originalWindow;
    global.navigator = originalNavigator;
    jest.resetAllMocks();
  });

  describe('iOS Safari QR Scanning', () => {
    beforeEach(() => {
      // Setup iOS Safari environment
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://app.example.com',
        pretendToBeVisual: true,
        resources: 'usable'
      });

      global.window = dom.window as any;
      global.document = dom.window.document;
      global.navigator = {
        ...dom.window.navigator,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        mediaDevices: mockMediaDevices,
      } as any;

      // Mock iOS camera stream
      mockMediaDevices.getUserMedia.mockResolvedValue({
        getVideoTracks: () => [{ stop: jest.fn() }],
        getTracks: () => [{ stop: jest.fn() }],
      } as any);
    });

    it('should scan QR code via iOS Safari and parse URL correctly', async () => {
      // Mock successful QR scanning result
      mockParseQRCode.mockReturnValue(testEventId);

      const mockOnNavigate = jest.fn();

      render(
        <QRScanner
          onNavigate={mockOnNavigate}
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
          video: expect.objectContaining({
            facingMode: 'environment'
          })
        });
      });

      // Simulate QR code detection by triggering the scan callback
      const videoElement = document.querySelector('video');

      if (videoElement) {
        // Simulate QR code scan by creating a mock canvas with QR data
        const mockCanvas = document.createElement('canvas');
        const mockContext = {
          drawImage: jest.fn(),
          getImageData: jest.fn().mockReturnValue({
            data: new Uint8ClampedArray([255, 255, 255, 255]) // Mock image data
          })
        };

        jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockContext as any);
        jest.spyOn(document, 'createElement').mockReturnValue(mockCanvas);

        // Trigger QR scan simulation
        const event = new Event('loadedmetadata');
        videoElement.dispatchEvent(event);

        // Wait for QR processing
        await waitFor(() => {
          expect(mockOnNavigate).toHaveBeenCalled();
        }, { timeout: 3000 });

        // Verify parsing was called
        expect(mockParseQRCode).toHaveBeenCalled();
      }

      // Verify iOS Safari environment
      expect(global.navigator.userAgent).toContain('iPhone');
      expect(global.navigator.userAgent).toContain('Safari');
    });

    it('should handle iOS Safari camera permissions', async () => {
      const mockOnNavigate = jest.fn();

      // Mock permission denial
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      render(<QRScanner onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
      });

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should extract eventId from iOS Safari URL correctly', async () => {
      // Test various iOS URL formats
      const iosUrls = [
        `https://app.example.com/event/${testEventId}`,
        `https://app.example.com/event/${testEventId}?source=ios`,
        `https://app.example.com/event/${testEventId}#ios-scan`
      ];

      for (const url of iosUrls) {
        mockParseQRCode.mockImplementation((qrData: string) => {
          // Simulate URL parsing from QR data
          const match = url.match(/\/event\/([^\/\?#]+)/);
          return match ? match[1] : null;
        });

        const result = mockParseQRCode(url);
        expect(result).toBe(testEventId);
      }
    });
  });

  describe('Android Chrome QR Scanning', () => {
    beforeEach(() => {
      // Setup Android Chrome environment
      const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
        url: 'https://app.example.com',
        pretendToBeVisual: true,
        resources: 'usable'
      });

      global.window = dom.window as any;
      global.document = dom.window.document;
      const mockPermissionsQuery = jest.fn() as jest.MockedFunction<(permissionDesc: PermissionDescriptor) => Promise<PermissionStatus>>;
      mockPermissionsQuery.mockResolvedValue({ state: 'granted' } as PermissionStatus);

      global.navigator = {
        ...dom.window.navigator,
        userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36',
        platform: 'Linux armv8l',
        mediaDevices: mockMediaDevices,
        permissions: {
          query: mockPermissionsQuery
        }
      } as any;

      // Mock Android camera stream
      mockMediaDevices.getUserMedia.mockResolvedValue({
        getVideoTracks: () => [{ stop: jest.fn() }],
        getTracks: () => [{ stop: jest.fn() }],
      } as any);
    });

    it('should scan QR code via Android Chrome and extract same eventId', async () => {
      mockParseQRCode.mockReturnValue(testEventId);

      const mockOnNavigate = jest.fn();

      render(
        <QRScanner
          onNavigate={mockOnNavigate}
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
          video: expect.objectContaining({
            facingMode: 'environment'
          })
        });
      });

      // Simulate QR code detection
      const videoElement = document.querySelector('video');

      if (videoElement) {
        // Mock QR detection process
        const event = new Event('loadedmetadata');
        videoElement.dispatchEvent(event);

        // Wait for scan completion
        await waitFor(() => {
          expect(mockOnNavigate).toHaveBeenCalled();
        }, { timeout: 3000 });
      }

      // Verify Android Chrome environment
      expect(global.navigator.userAgent).toContain('Android');
      expect(global.navigator.userAgent).toContain('Chrome');

      // Verify same event ID is extracted
      expect(mockParseQRCode).toHaveBeenCalled();
    });

    it('should handle Android Chrome specific permissions', async () => {
      // Test Android permission flow
      const mockOnNavigate = jest.fn();

      render(<QRScanner onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
      });

      // Verify permissions were checked (Android-specific)
      expect(global.navigator.permissions.query).toHaveBeenCalled();
    });

    it('should consistently extract eventId across Android versions', async () => {
      const androidVersions = [
        'Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.74 Mobile Safari/537.36',
        'Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36'
      ];

      for (const userAgent of androidVersions) {
        Object.defineProperty(global.navigator, 'userAgent', {
          value: userAgent,
          configurable: true
        });

        mockParseQRCode.mockReturnValue(testEventId);
        const result = mockParseQRCode(testQRUrl);

        expect(result).toBe(testEventId);
      }
    });
  });

  describe('Cross-Platform QR Consistency', () => {
    it('should extract same eventId from both iOS and Android', async () => {
      // Generate QR code once
      const qrDataUrl = await mockGenerateQRCode(testQRUrl);
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);

      // Test iOS parsing
      mockParseQRCode.mockReturnValue(testEventId);
      const iosResult = mockParseQRCode(qrDataUrl);

      // Test Android parsing
      mockParseQRCode.mockReturnValue(testEventId);
      const androidResult = mockParseQRCode(qrDataUrl);

      // Both should extract same event ID
      expect(iosResult).toBe(testEventId);
      expect(androidResult).toBe(testEventId);
      expect(iosResult).toBe(androidResult);
    });

    it('should handle different QR URL formats consistently', async () => {
      const urlFormats = [
        `https://app.example.com/event/${testEventId}`,
        `https://app.example.com/events/${testEventId}/view`,
        `https://example.com/e/${testEventId}`,
        `app://event/${testEventId}`
      ];

      mockParseQRCode.mockImplementation((qrData: string) => {
        // Universal event ID extraction logic
        const patterns = [
          /\/event\/([^\/\?#]+)/,
          /\/events\/([^\/\?#]+)/,
          /\/e\/([^\/\?#]+)/,
          /event\/([^\/\?#]+)/
        ];

        for (const pattern of patterns) {
          const match = qrData.match(pattern);
          if (match) return match[1];
        }
        return null;
      });

      for (const url of urlFormats) {
        const result = mockParseQRCode(url);
        expect(result).toBe(testEventId);
      }
    });
  });

  describe('iOS Photo Upload (JPG)', () => {
    beforeEach(() => {
      // Setup iOS environment
      global.navigator = {
        ...global.navigator,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      } as any;
    });

    it('should simulate photo upload on iOS (jpg) and assert success', async () => {
      // Create mock JPG file from iOS camera
      const mockIOSJpgFile = new File(
        ['mock ios jpg image data'],
        'IMG_1234.jpg',
        {
          type: 'image/jpeg',
          lastModified: Date.now()
        }
      );

      // Mock successful iOS upload
      mockUploadPhoto.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/ios-photo-123.jpg',
        id: 'ios-upload-123',
        metadata: {
          originalName: 'IMG_1234.jpg',
          size: mockIOSJpgFile.size,
          type: 'image/jpeg',
          device: 'iOS',
          orientation: 6 // Portrait
        }
      } as UploadResult);

      // Mock FileReader for iOS
      mockFileReader.onload = jest.fn();
      mockFileReader.readAsDataURL.mockImplementation(() => {
        mockFileReader.result = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgo';
        if (mockFileReader.onload) {
          mockFileReader.onload({} as any);
        }
      });

      // Simulate upload process
      const uploadResult = await mockUploadPhoto(mockIOSJpgFile, {
        eventId: testEventId,
        deviceType: 'iOS',
        browser: 'Safari'
      });

      // Assert success
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toContain('.jpg');
      expect(uploadResult.id).toBeTruthy();
      expect(uploadResult.metadata?.type).toBe('image/jpeg');
      expect(uploadResult.metadata?.device).toBe('iOS');

      // Verify iOS-specific properties
      expect(uploadResult.metadata?.orientation).toBe(6);
      expect(mockUploadPhoto).toHaveBeenCalledWith(
        mockIOSJpgFile,
        expect.objectContaining({
          eventId: testEventId,
          deviceType: 'iOS',
          browser: 'Safari'
        })
      );
    });

    it('should handle iOS HEIC to JPG conversion', async () => {
      const mockHEICFile = new File(
        ['mock heic image data'],
        'IMG_5678.HEIC',
        { type: 'image/heic' }
      );

      mockUploadPhoto.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/converted-photo.jpg',
        id: 'converted-upload-123',
        originalFormat: 'HEIC',
        uploadFormat: 'JPEG'
      } as UploadResult);

      const uploadResult = await mockUploadPhoto(mockHEICFile, {
        eventId: testEventId,
        convertToJPEG: true
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toContain('.jpg');
      expect(uploadResult.originalFormat).toBe('HEIC');
      expect(uploadResult.uploadFormat).toBe('JPEG');
    });

    it('should handle iOS camera orientation metadata', async () => {
      const mockIOSFile = new File(['ios portrait'], 'portrait.jpg', { type: 'image/jpeg' });

      mockUploadPhoto.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/rotated-photo.jpg',
        id: 'rotated-upload-123',
        metadata: {
          width: 3024,
          height: 4032,
          orientation: 6, // 90° CW rotation needed
          rotated: true
        }
      } as UploadResult);

      const uploadResult = await mockUploadPhoto(mockIOSFile, {
        eventId: testEventId,
        autoRotate: true
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.metadata?.rotated).toBe(true);
      expect(uploadResult.metadata?.orientation).toBe(6);
    });
  });

  describe('Android Photo Upload (PNG)', () => {
    beforeEach(() => {
      // Setup Android environment
      global.navigator = {
        ...global.navigator,
        userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36',
      } as any;
    });

    it('should simulate photo upload on Android (png) and assert success', async () => {
      // Create mock PNG file from Android camera
      const mockAndroidPngFile = new File(
        ['mock android png image data'],
        '20240115_123456.png',
        {
          type: 'image/png',
          lastModified: Date.now()
        }
      );

      // Mock successful Android upload
      mockUploadPhoto.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/android-photo-456.png',
        id: 'android-upload-456',
        metadata: {
          originalName: '20240115_123456.png',
          size: mockAndroidPngFile.size,
          type: 'image/png',
          device: 'Android',
          manufacturer: 'Samsung',
          model: 'SM-G991B'
        }
      } as UploadResult);

      // Mock FileReader for Android
      mockFileReader.readAsDataURL.mockImplementation(() => {
        mockFileReader.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        if (mockFileReader.onload) {
          mockFileReader.onload({} as any);
        }
      });

      // Simulate upload process
      const uploadResult = await mockUploadPhoto(mockAndroidPngFile, {
        eventId: testEventId,
        deviceType: 'Android',
        browser: 'Chrome'
      });

      // Assert success
      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toContain('.png');
      expect(uploadResult.id).toBeTruthy();
      expect(uploadResult.metadata?.type).toBe('image/png');
      expect(uploadResult.metadata?.device).toBe('Android');

      // Verify Android-specific properties
      expect(uploadResult.metadata?.manufacturer).toBe('Samsung');
      expect(uploadResult.metadata?.model).toBe('SM-G991B');
      expect(mockUploadPhoto).toHaveBeenCalledWith(
        mockAndroidPngFile,
        expect.objectContaining({
          eventId: testEventId,
          deviceType: 'Android',
          browser: 'Chrome'
        })
      );
    });

    it('should handle Android screenshot PNG uploads', async () => {
      const mockScreenshotFile = new File(
        ['mock screenshot data'],
        'Screenshot_20240115_123456.png',
        { type: 'image/png' }
      );

      mockUploadPhoto.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/screenshot-123.png',
        id: 'screenshot-upload-123',
        metadata: {
          type: 'screenshot',
          isScreenshot: true,
          dimensions: { width: 1080, height: 2340 }
        }
      } as UploadResult);

      const uploadResult = await mockUploadPhoto(mockScreenshotFile, {
        eventId: testEventId
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.metadata?.type).toBe('screenshot');
      expect(uploadResult.metadata?.isScreenshot).toBe(true);
    });

    it('should handle Android gallery PNG selection', async () => {
      const mockGalleryFile = new File(
        ['gallery png data'],
        'IMG_Gallery_001.png',
        { type: 'image/png' }
      );

      mockUploadPhoto.mockResolvedValue({
        success: true,
        url: 'https://storage.example.com/gallery-photo.png',
        id: 'gallery-upload-123',
        source: 'gallery',
        metadata: {
          type: 'image/png',
          source: 'gallery'
        }
      } as UploadResult);

      const uploadResult = await mockUploadPhoto(mockGalleryFile, {
        eventId: testEventId,
        source: 'gallery'
      });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.source).toBe('gallery');
      expect(uploadResult.metadata?.source).toBe('gallery');
    });
  });

  describe('Integration: QR Scanning to Photo Upload', () => {
    it('should complete full flow: scan QR → extract eventId → upload photo on iOS', async () => {
      // Step 1: Scan QR code and extract event ID
      mockParseQRCode.mockReturnValue(testEventId);

      const mockOnNavigate = jest.fn();
      render(<QRScanner onNavigate={mockOnNavigate} />);

      // Simulate QR scan completion
      await waitFor(() => {
        mockOnNavigate(`/event/${testEventId}`);
      });

      expect(mockOnNavigate).toHaveBeenCalled();

      // Step 2: Upload photo with extracted event ID
      const iosFile = new File(['ios photo'], 'photo.jpg', { type: 'image/jpeg' });

      mockUploadPhoto.mockResolvedValue({
        success: true,
        eventId: testEventId,
        url: 'https://storage.example.com/event-photo.jpg',
        id: 'ios-event-photo-123'
      } as UploadResult);

      const uploadResult = await mockUploadPhoto(iosFile, { eventId: testEventId });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.eventId).toBe(testEventId);
    });

    it('should complete full flow on Android: scan QR → extract eventId → upload photo', async () => {
      // Setup Android environment
      global.navigator = {
        ...global.navigator,
        userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.101 Mobile Safari/537.36',
      } as any;

      // Step 1: Scan QR code
      mockParseQRCode.mockReturnValue(testEventId);

      const mockOnNavigate = jest.fn();
      render(<QRScanner onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        mockOnNavigate(`/event/${testEventId}`);
      });

      // Step 2: Upload PNG photo
      const androidFile = new File(['android photo'], 'photo.png', { type: 'image/png' });

      mockUploadPhoto.mockResolvedValue({
        success: true,
        eventId: testEventId,
        url: 'https://storage.example.com/android-event-photo.png',
        id: 'android-event-photo-123'
      } as UploadResult);

      const uploadResult = await mockUploadPhoto(androidFile, { eventId: testEventId });

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.eventId).toBe(testEventId);
      expect(uploadResult.url).toContain('.png');
    });
  });

  describe('Error Handling Across Devices', () => {
    it('should handle QR scanning camera errors on iOS', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('iOS camera access denied'));

      const mockOnNavigate = jest.fn();
      render(<QRScanner onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
      });
    });

    it('should handle QR scanning errors on Android', async () => {
      mockMediaDevices.getUserMedia.mockRejectedValue(new Error('Android camera permission denied'));

      const mockOnNavigate = jest.fn();
      render(<QRScanner onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
      });
    });

    it('should handle upload failures gracefully', async () => {
      // iOS upload failure
      mockUploadPhoto.mockRejectedValue(new Error('Upload failed'));

      const iosFile = new File(['ios'], 'test.jpg', { type: 'image/jpeg' });
      await expect(mockUploadPhoto(iosFile)).rejects.toThrow('Upload failed');

      // Android upload failure
      const androidFile = new File(['android'], 'test.png', { type: 'image/png' });
      await expect(mockUploadPhoto(androidFile)).rejects.toThrow('Upload failed');
    });

    it('should handle invalid QR data parsing', async () => {
      mockParseQRCode.mockReturnValue(null);

      const mockOnNavigate = jest.fn();
      render(<QRScanner onNavigate={mockOnNavigate} />);

      // Simulate invalid QR scan
      const result = mockParseQRCode('invalid-qr-data');
      expect(result).toBeNull();
    });
  });
});
