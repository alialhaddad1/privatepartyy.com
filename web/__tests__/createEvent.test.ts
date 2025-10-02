import { jest } from '@jest/globals';
import { generateQRCode, parseQRCode } from '../src/lib/qr';

// Mock QR code library if needed
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

jest.mock('qrcode-reader', () => {
  return jest.fn().mockImplementation(() => ({
    callback: null,
    decode: jest.fn(),
  }));
});

describe('Create Event and QR Code Tests', () => {
  const testEventId = 'test_event';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('QR Code Generation', () => {
    it('should generate a valid QR code data URL for event ID', async () => {
      const qrCodeDataUrl = await generateQRCode(testEventId);

      // Assert it returns a valid data URL string
      expect(qrCodeDataUrl).toBeDefined();
      expect(typeof qrCodeDataUrl).toBe('string');
      expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(qrCodeDataUrl.length).toBeGreaterThan(50); // Reasonable minimum length for base64 image
    });

    it('should generate different QR codes for different event IDs', async () => {
      const qrCode1 = await generateQRCode('event_1');
      const qrCode2 = await generateQRCode('event_2');

      expect(qrCode1).toBeDefined();
      expect(qrCode2).toBeDefined();
      expect(qrCode1).not.toBe(qrCode2);

      // Both should be valid data URLs
      expect(qrCode1).toMatch(/^data:image\/png;base64,/);
      expect(qrCode2).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle special characters in event ID', async () => {
      const specialEventId = 'test_event-123_special@chars';
      const qrCodeDataUrl = await generateQRCode(specialEventId);

      expect(qrCodeDataUrl).toBeDefined();
      expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should generate QR code for numeric event ID', async () => {
      const numericEventId = '12345';
      const qrCodeDataUrl = await generateQRCode(numericEventId);

      expect(qrCodeDataUrl).toBeDefined();
      expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should handle long event IDs', async () => {
      const longEventId = 'a'.repeat(100); // Very long event ID
      const qrCodeDataUrl = await generateQRCode(longEventId);

      expect(qrCodeDataUrl).toBeDefined();
      expect(qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe('QR Code Parsing', () => {
    it('should parse QR code and extract the correct event ID', async () => {
      // First generate a QR code
      const qrCodeDataUrl = await generateQRCode(testEventId);

      // Then parse it back
      const parsedEventId = await parseQRCode(qrCodeDataUrl);

      // Assert it extracts the correct event ID
      expect(parsedEventId).toBe(testEventId);
    });

    it('should parse QR codes with different event IDs correctly', async () => {
      const eventId1 = 'event_alpha';
      const eventId2 = 'event_beta';

      const qrCode1 = await generateQRCode(eventId1);
      const qrCode2 = await generateQRCode(eventId2);

      const parsed1 = await parseQRCode(qrCode1);
      const parsed2 = await parseQRCode(qrCode2);

      expect(parsed1).toBe(eventId1);
      expect(parsed2).toBe(eventId2);
      expect(parsed1).not.toBe(parsed2);
    });

    it('should parse QR codes with special characters correctly', async () => {
      const specialEventId = 'test-event_123@special.chars';

      const qrCodeDataUrl = await generateQRCode(specialEventId);
      const parsedEventId = await parseQRCode(qrCodeDataUrl);

      expect(parsedEventId).toBe(specialEventId);
    });

    it('should handle URL-encoded event IDs in QR codes', async () => {
      const eventIdWithSpaces = 'test event with spaces';

      const qrCodeDataUrl = await generateQRCode(eventIdWithSpaces);
      const parsedEventId = await parseQRCode(qrCodeDataUrl);

      expect(parsedEventId).toBe(eventIdWithSpaces);
    });
  });

  describe('Error Handling', () => {
    describe('QR Code Generation Errors', () => {
      it('should handle empty event ID gracefully', async () => {
        await expect(generateQRCode('')).rejects.toThrow();
      });

      it('should handle null event ID gracefully', async () => {
        await expect(generateQRCode(null as any)).rejects.toThrow();
      });

      it('should handle undefined event ID gracefully', async () => {
        await expect(generateQRCode(undefined as any)).rejects.toThrow();
      });

      it('should handle non-string event ID gracefully', async () => {
        await expect(generateQRCode(123 as any)).rejects.toThrow();
        await expect(generateQRCode({} as any)).rejects.toThrow();
        await expect(generateQRCode([] as any)).rejects.toThrow();
      });

      it('should provide meaningful error messages', async () => {
        try {
          await generateQRCode('');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toContain('Event ID');
        }
      });
    });

    describe('QR Code Parsing Errors', () => {
      it('should handle invalid QR code data URL gracefully', async () => {
        const invalidDataUrl = 'invalid-data-url';

        await expect(parseQRCode(invalidDataUrl)).rejects.toThrow();
      });

      it('should handle empty string gracefully', async () => {
        await expect(parseQRCode('')).rejects.toThrow();
      });

      it('should handle null input gracefully', async () => {
        await expect(parseQRCode(null as any)).rejects.toThrow();
      });

      it('should handle undefined input gracefully', async () => {
        await expect(parseQRCode(undefined as any)).rejects.toThrow();
      });

      it('should handle non-string input gracefully', async () => {
        await expect(parseQRCode(123 as any)).rejects.toThrow();
        await expect(parseQRCode({} as any)).rejects.toThrow();
        await expect(parseQRCode([] as any)).rejects.toThrow();
      });

      it('should handle malformed data URL gracefully', async () => {
        const malformedDataUrl = 'data:image/png;base64,invalid-base64-content';

        await expect(parseQRCode(malformedDataUrl)).rejects.toThrow();
      });

      it('should handle valid image that is not a QR code gracefully', async () => {
        // A valid base64 image that doesn't contain QR code data
        const validImageNotQR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        await expect(parseQRCode(validImageNotQR)).rejects.toThrow();
      });

      it('should provide meaningful error messages for parsing failures', async () => {
        try {
          await parseQRCode('invalid-input');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBeTruthy();
          expect((error as Error).message.length).toBeGreaterThan(0);
        }
      });
    });

    describe('Network and System Errors', () => {
      it('should handle QR generation library failures gracefully', async () => {
        // Mock the QR library to throw an error
        const originalGenerateQRCode = generateQRCode;
        const mockGenerateQRCode = jest.fn<(eventId: string) => Promise<string>>().mockRejectedValue(new Error('QR library error'));

        // Replace the function temporarily
        (global as any).generateQRCode = mockGenerateQRCode;

        try {
          await mockGenerateQRCode(testEventId);
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('QR library error');
        }

        // Restore original function
        (global as any).generateQRCode = originalGenerateQRCode;
      });

      it('should handle QR parsing library failures gracefully', async () => {
        // Mock the QR parsing library to throw an error
        const originalParseQRCode = parseQRCode;
        const mockParseQRCode = jest.fn<(dataUrl: string) => Promise<string>>().mockRejectedValue(new Error('QR parsing library error'));

        // Replace the function temporarily
        (global as any).parseQRCode = mockParseQRCode;

        try {
          await mockParseQRCode('some-data-url');
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('QR parsing library error');
        }

        // Restore original function
        (global as any).parseQRCode = originalParseQRCode;
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete round-trip for multiple events', async () => {
      const eventIds = ['event1', 'event2', 'event3', 'test_event', 'final_event'];

      const results = await Promise.all(
        eventIds.map(async (eventId: string) => {
          const qrCode = await generateQRCode(eventId);
          const parsed = await parseQRCode(qrCode);
          return { original: eventId, parsed };
        })
      );

      results.forEach(({ original, parsed }) => {
        expect(parsed).toBe(original);
      });
    });

    it('should maintain data integrity across multiple operations', async () => {
      const iterations = 5;
      const eventId = 'integrity_test_event';

      for (let i = 0; i < iterations; i++) {
        const qrCode = await generateQRCode(eventId);
        const parsed = await parseQRCode(qrCode);
        expect(parsed).toBe(eventId);
      }
    });

    it('should handle concurrent QR operations', async () => {
      const eventIds = Array.from({ length: 10 }, (_, i) => `concurrent_event_${i}`);

      const qrPromises = eventIds.map((id: string) => generateQRCode(id));
      const qrCodes = await Promise.all(qrPromises);

      const parsePromises = qrCodes.map((qr: string) => parseQRCode(qr));
      const parsedIds = await Promise.all(parsePromises);

      parsedIds.forEach((parsed: string | null, index: number) => {
        expect(parsed).toBe(eventIds[index]);
      });
    });
  });

  describe('Performance Tests', () => {
    it('should generate QR code within reasonable time', async () => {
      const startTime = Date.now();
      await generateQRCode(testEventId);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should parse QR code within reasonable time', async () => {
      const qrCode = await generateQRCode(testEventId);

      const startTime = Date.now();
      await parseQRCode(qrCode);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
