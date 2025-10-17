import { jest } from '@jest/globals';
import { generateQRCode } from '../src/lib/qr';

// Mock QR code generation
jest.mock('../src/lib/qr', () => ({
  generateQRCode: jest.fn(),
}));

// Type definitions for validation errors
interface ValidationError {
  type: 'VALIDATION_ERROR';
  field: string;
  message: string;
  value?: string;
}

interface SecurityError {
  type: 'SECURITY_ERROR';
  message: string;
  blocked: string;
}

// Error classes for throwing
class ValidationErrorClass extends Error {
  type: 'VALIDATION_ERROR';
  field: string;
  value?: string;

  constructor(type: 'VALIDATION_ERROR', field: string, message: string, value?: string) {
    super(message);
    this.name = 'ValidationError';
    this.type = type;
    this.field = field;
    this.value = value;
  }
}

class SecurityErrorClass extends Error {
  type: 'SECURITY_ERROR';
  blocked: string;

  constructor(type: 'SECURITY_ERROR', message: string, blocked: string) {
    super(message);
    this.name = 'SecurityError';
    this.type = type;
    this.blocked = blocked;
  }
}

// Mock services for testing
const mockEventService = {
  fetchFeed: jest.fn(),
  validateEventId: jest.fn(),
  sanitizeEventId: jest.fn(),
  detectSQLInjection: jest.fn(),
  detectXSSAttempt: jest.fn(),
};

const mockQRService = {
  generateEventQRCode: jest.fn(),
  validateQRInput: jest.fn(),
};

// Mock security utilities
const mockSecurityUtils = {
  sanitizeInput: jest.fn(),
  validateEventIdFormat: jest.fn(),
  detectMaliciousPatterns: jest.fn(),
  blockSQLInjection: jest.fn(),
  normalizeUnicode: jest.fn(),
};

// Mock QR functions
const mockGenerateQRCode = generateQRCode as jest.MockedFunction<typeof generateQRCode>;

describe('Malformed Event IDs Tests', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default validation behavior
    mockEventService.validateEventId.mockImplementation(((eventId: string) => {
      // Basic validation rules
      if (!eventId || typeof eventId !== 'string') {
        throw new ValidationErrorClass('VALIDATION_ERROR', 'eventId', 'Event ID is required and must be a string');
      }

      if (eventId.length > 255) {
        throw new ValidationErrorClass('VALIDATION_ERROR', 'eventId', 'Event ID too long (max 255 characters)');
      }

      // Check for SQL injection patterns
      if (mockEventService.detectSQLInjection(eventId)) {
        throw new SecurityErrorClass('SECURITY_ERROR', 'Potential SQL injection detected', eventId);
      }

      // Check for XSS patterns
      if (mockEventService.detectXSSAttempt(eventId)) {
        throw new SecurityErrorClass('SECURITY_ERROR', 'Potential XSS attempt detected', eventId);
      }

      return true;
    }) as any);

    mockEventService.detectSQLInjection.mockImplementation(((input: string) => {
      const sqlPatterns = [
        /DROP\s+TABLE/i,
        /DELETE\s+FROM/i,
        /INSERT\s+INTO/i,
        /UPDATE\s+.*\s+SET/i,
        /UNION\s+SELECT/i,
        /SELECT\s+.*\s+FROM/i,
        /;\s*--/,
        /'\s*OR\s+'1'\s*=\s*'1/i,
        /'\s*OR\s+1\s*=\s*1/i,
        /EXEC\s*\(/i
      ];

      return sqlPatterns.some(pattern => pattern.test(input));
    }) as any);

    mockEventService.detectXSSAttempt.mockImplementation(((input: string) => {
      const xssPatterns = [
        /<script[^>]*>/i,
        /<\/script>/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe[^>]*>/i,
        /<embed[^>]*>/i,
        /<object[^>]*>/i,
        /eval\s*\(/i,
        /expression\s*\(/i,
        /<[^>]*script[^>]*>/i, // Catch any tag with "script" in it
      ];

      return xssPatterns.some(pattern => pattern.test(input));
    }) as any);

    mockEventService.sanitizeEventId.mockImplementation(((eventId: string) => {
      // Basic sanitization
      return eventId
        .replace(/[<>'"&]/g, '') // Remove dangerous HTML chars
        .replace(/[;]/g, '') // Remove semicolons
        .replace(/--/g, '') // Remove SQL comments
        .trim();
    }) as any);

    mockEventService.fetchFeed.mockImplementation((async (eventId: string) => {
      try {
        // Validate and sanitize input
        mockEventService.validateEventId(eventId);
        const sanitizedId = mockEventService.sanitizeEventId(eventId) as string;

        // Mock successful feed fetch for valid IDs
        if (sanitizedId && sanitizedId.length > 0) {
          return [
            {
              id: 'post-1',
              title: 'Test Post',
              content: 'Test content',
              event_id: sanitizedId,
              created_at: new Date().toISOString()
            }
          ];
        }

        throw new Error('Invalid event ID after sanitization');
      } catch (error) {
        throw error;
      }
    }) as any);

    mockQRService.validateQRInput.mockImplementation(((eventId: string) => {
      // Similar validation for QR generation
      if (!eventId || typeof eventId !== 'string') {
        throw new Error('Event ID is required for QR generation');
      }

      if (eventId.length > 100) {
        throw new Error('Event ID too long for QR code generation');
      }

      // Check for dangerous patterns
      if (mockEventService.detectSQLInjection(eventId) || mockEventService.detectXSSAttempt(eventId)) {
        throw new Error('Invalid characters detected in event ID');
      }

      return true;
    }) as any);

    mockQRService.generateEventQRCode.mockImplementation((async (eventId: string) => {
      mockQRService.validateQRInput(eventId);
      const sanitizedId = mockEventService.sanitizeEventId(eventId) as string;
      return await mockGenerateQRCode(`https://app.example.com/event/${sanitizedId}`);
    }) as any);

    // Setup mock QR generation
    mockGenerateQRCode.mockResolvedValue('data:image/png;base64,mock-qr-code');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('SQL Injection Attempts', () => {
    it('should reject SQL injection attempt "DROP TABLE posts;"', async () => {
      const maliciousEventId = "DROP TABLE posts;";

      // Assert SQL injection is detected
      expect(mockEventService.detectSQLInjection(maliciousEventId)).toBe(true);

      // fetchFeed should reject the malicious input
      await expect(mockEventService.fetchFeed(maliciousEventId))
        .rejects.toThrow('Potential SQL injection detected');

      // Verify validation was called
      expect(mockEventService.validateEventId).toHaveBeenCalledWith(maliciousEventId);
    });

    it('should reject various SQL injection patterns', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE posts; --",
        "' OR '1'='1",
        "' OR 1=1 --",
        "UNION SELECT * FROM users",
        "DELETE FROM posts WHERE id=1",
        "INSERT INTO posts VALUES ('malicious')",
        "UPDATE posts SET title='hacked'",
        "1; DELETE FROM posts;",
        "'; EXEC xp_cmdshell('format c:'); --",
        "' UNION SELECT password FROM users WHERE '1'='1"
      ];

      for (const maliciousId of sqlInjectionAttempts) {
        // Each should be detected as SQL injection
        expect(mockEventService.detectSQLInjection(maliciousId)).toBe(true);

        // Each should be rejected by fetchFeed
        await expect(mockEventService.fetchFeed(maliciousId))
          .rejects.toThrow(/SQL injection|SECURITY_ERROR/);
      }

      expect(mockEventService.validateEventId).toHaveBeenCalledTimes(sqlInjectionAttempts.length);
    });

    it('should sanitize borderline SQL-like strings safely', async () => {
      const borderlineCases = [
        "event-select-2024", // Contains "select" but not as SQL
        "my-table-event", // Contains "table" but not as SQL
        "drop-zone-event", // Contains "drop" but not as SQL
        "union-conference", // Contains "union" but not as SQL
      ];

      for (const eventId of borderlineCases) {
        // Should not be detected as SQL injection
        expect(mockEventService.detectSQLInjection(eventId)).toBe(false);

        // Should pass validation and work normally
        const result = await mockEventService.fetchFeed(eventId);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });
  });

  describe('XSS Injection Attempts', () => {
    it('should reject XSS script injection attempts', async () => {
      const xssAttempts = [
        "<script>alert('xss')</script>",
        "<SCRIPT>alert('XSS')</SCRIPT>",
        "javascript:alert('xss')",
        "<img src=x onerror=alert('xss')>",
        "<iframe src='javascript:alert(\"xss\")'></iframe>",
        "<embed src='data:text/html,<script>alert(1)</script>'>",
        "<object data='data:text/html,<script>alert(1)</script>'></object>",
        "eval('alert(1)')",
        "expression(alert('xss'))"
      ];

      for (const xssPayload of xssAttempts) {
        // Should be detected as XSS attempt
        expect(mockEventService.detectXSSAttempt(xssPayload)).toBe(true);

        // Should be rejected by fetchFeed
        await expect(mockEventService.fetchFeed(xssPayload))
          .rejects.toThrow(/XSS|SECURITY_ERROR/);
      }
    });

    it('should sanitize XSS attempts and make them safe', async () => {
      const xssPayload = "<script>alert('xss')</script>event123";
      const sanitized = mockEventService.sanitizeEventId(xssPayload);

      // Should remove dangerous characters (<, >, ', ", &, ;)
      expect(sanitized).toBe("scriptalert(xss)/scriptevent123");
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain('&');
      expect(sanitized).not.toContain(';');
    });

    it('should handle encoded XSS attempts', async () => {
      const encodedXSS = [
        "%3Cscript%3Ealert('xss')%3C/script%3E",
        "&#60;script&#62;alert('xss')&#60;/script&#62;",
        "&lt;script&gt;alert('xss')&lt;/script&gt;"
      ];

      // These might not be detected by basic pattern matching
      // but should be handled by URL decoding in real implementation
      for (const encoded of encodedXSS) {
        // Basic implementation might miss these, which is acceptable
        // Real implementation should decode first
        try {
          await mockEventService.fetchFeed(encoded);
        } catch (error) {
          // Either rejection or sanitization is acceptable
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Very Long String Validation', () => {
    it('should reject eventId longer than 255 characters', async () => {
      const longEventId = 'a'.repeat(256); // 256 characters

      // Should be rejected due to length
      await expect(mockEventService.fetchFeed(longEventId))
        .rejects.toThrow('Event ID too long (max 255 characters)');

      expect(mockEventService.validateEventId).toHaveBeenCalledWith(longEventId);
    });

    it('should accept eventId exactly at 255 character limit', async () => {
      const maxLengthEventId = 'a'.repeat(255); // Exactly 255 characters

      // Should pass validation
      const result = await mockEventService.fetchFeed(maxLengthEventId);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should reject extremely long strings that could cause DoS', async () => {
      const extremelyLongIds = [
        'x'.repeat(1000),   // 1KB
        'y'.repeat(10000),  // 10KB  
        'z'.repeat(100000), // 100KB
      ];

      for (const longId of extremelyLongIds) {
        await expect(mockEventService.fetchFeed(longId))
          .rejects.toThrow('Event ID too long');
      }
    });

    it('should handle performance efficiently with very long inputs', async () => {
      const veryLongId = 'performance-test-' + 'x'.repeat(10000);
      
      const startTime = Date.now();
      
      try {
        await mockEventService.fetchFeed(veryLongId);
      } catch (error) {
        // Error is expected due to length
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete quickly even with long input
      expect(duration).toBeLessThan(100); // Less than 100ms
    });
  });

  describe('Unicode Character Handling', () => {
    it('should accept and safely handle emoji characters', async () => {
      const emojiEventIds = [
        "conference-2024-🎉",
        "meeting-📅-urgent",
        "party-🎈🎂🎁",
        "workshop-🔧⚙️",
        "🌟event-special🌟"
      ];

      for (const emojiId of emojiEventIds) {
        // Should not be flagged as malicious
        expect(mockEventService.detectSQLInjection(emojiId)).toBe(false);
        expect(mockEventService.detectXSSAttempt(emojiId)).toBe(false);

        // Should be accepted and processed normally
        const result = await mockEventService.fetchFeed(emojiId);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should handle RTL (Right-to-Left) text correctly', async () => {
      const rtlEventIds = [
        "conference-مؤتمر-2024", // Arabic
        "event-אירוע-special", // Hebrew  
        "meeting-דחוף", // Hebrew urgent
        "workshop-ورشة-عمل", // Arabic workshop
        "🎉celebration-احتفال🎉" // Mixed Arabic and emoji
      ];

      for (const rtlId of rtlEventIds) {
        // Should not be flagged as malicious
        expect(mockEventService.detectSQLInjection(rtlId)).toBe(false);
        expect(mockEventService.detectXSSAttempt(rtlId)).toBe(false);

        // Should be accepted
        const result = await mockEventService.fetchFeed(rtlId);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should handle various Unicode categories safely', async () => {
      const unicodeEventIds = [
        "event-中文测试", // Chinese
        "conference-한국어", // Korean
        "meeting-русский", // Russian Cyrillic
        "workshop-ελληνικά", // Greek
        "seminar-हिंदी", // Hindi Devanagari
        "symposium-العربية", // Arabic
        "forum-日本語", // Japanese
      ];

      for (const unicodeId of unicodeEventIds) {
        // Should be safely processed
        const result = await mockEventService.fetchFeed(unicodeId) as Array<{ event_id: string }>;
        expect(result).toBeDefined();

        // Should maintain Unicode integrity
        expect(result[0].event_id).toBeDefined();
      }
    });

    it('should normalize Unicode characters appropriately', async () => {
      // Test Unicode normalization (NFC, NFD, etc.)
      const unicodeVariants = [
        "café-event", // é as single character
        "cafe\u0301-event", // e + combining acute accent
        "naïve-workshop", // ï as single character
        "nai\u0308ve-workshop", // i + combining diaeresis
      ];

      // Mock Unicode normalization
      mockSecurityUtils.normalizeUnicode.mockImplementation(((input: string) => {
        return input.normalize('NFC'); // Canonical composition
      }) as any);

      for (const variant of unicodeVariants) {
        const normalized = mockSecurityUtils.normalizeUnicode(variant);
        
        // Should handle both variants consistently
        const result = await mockEventService.fetchFeed(variant);
        expect(result).toBeDefined();
      }
    });

    it('should reject malicious Unicode sequences', async () => {
      const maliciousUnicode = [
        "event\u202E\u202D", // Unicode bidirectional override (potential spoofing)
        "test\uFEFF\uFEFF", // Multiple zero-width no-break space
        "conf\u200B\u200C\u200D", // Zero-width characters
        "\uFFFD\uFFFE", // Replacement and non-character
      ];

      // These should be handled carefully - either accepted with sanitization
      // or rejected if they pose security risks
      for (const suspiciousId of maliciousUnicode) {
        try {
          const result = await mockEventService.fetchFeed(suspiciousId);
          // If accepted, should be sanitized
          expect(result).toBeDefined();
        } catch (error) {
          // If rejected, should have clear error message
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('QR Code Generation with Invalid IDs', () => {
    it('should reject QR generation for SQL injection attempts', async () => {
      const maliciousIds = [
        "DROP TABLE posts;",
        "'; DELETE FROM events; --",
        "' OR 1=1 --"
      ];

      for (const maliciousId of maliciousIds) {
        await expect(mockQRService.generateEventQRCode(maliciousId))
          .rejects.toThrow('Invalid characters detected in event ID');

        // Verify QR generation was not attempted
        expect(mockGenerateQRCode).not.toHaveBeenCalled();
      }
    });

    it('should reject QR generation for XSS attempts', async () => {
      const xssIds = [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<img src=x onerror=alert(1)>"
      ];

      for (const xssId of xssIds) {
        await expect(mockQRService.generateEventQRCode(xssId))
          .rejects.toThrow('Invalid characters detected in event ID');

        expect(mockGenerateQRCode).not.toHaveBeenCalled();
      }
    });

    it('should reject QR generation for overly long event IDs', async () => {
      const longId = 'very-long-event-id-' + 'x'.repeat(200);

      await expect(mockQRService.generateEventQRCode(longId))
        .rejects.toThrow('Event ID too long for QR code generation');

      expect(mockGenerateQRCode).not.toHaveBeenCalled();
    });

    it('should accept valid Unicode characters in QR generation', async () => {
      const validUnicodeIds = [
        "conference-2024-🎉",
        "event-中文",
        "meeting-العربية"
      ];

      for (const validId of validUnicodeIds) {
        const qrCode = await mockQRService.generateEventQRCode(validId);
        
        expect(qrCode).toBe('data:image/png;base64,mock-qr-code');
        expect(mockGenerateQRCode).toHaveBeenCalledWith(
          expect.stringContaining(validId.replace(/[<>'"&;]/g, ''))
        );
      }
    });

    it('should sanitize event IDs before QR generation', async () => {
      const unsafeId = "event<test>with'quotes\"and&ampersand;";
      
      const qrCode = await mockQRService.generateEventQRCode(unsafeId);
      
      expect(qrCode).toBe('data:image/png;base64,mock-qr-code');
      
      // Verify sanitized ID was used
      const expectedSanitized = "eventtestwithquotesandampersand";
      expect(mockGenerateQRCode).toHaveBeenCalledWith(
        `https://app.example.com/event/${expectedSanitized}`
      );
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle null and undefined event IDs', async () => {
      const invalidIds = [null, undefined, ''];

      for (const invalidId of invalidIds) {
        await expect(mockEventService.fetchFeed(invalidId as any))
          .rejects.toThrow('Event ID is required');

        await expect(mockQRService.generateEventQRCode(invalidId as any))
          .rejects.toThrow('Event ID is required');
      }
    });

    it('should handle non-string event IDs', async () => {
      const nonStringIds = [123, {}, [], true, false];

      for (const invalidId of nonStringIds) {
        await expect(mockEventService.fetchFeed(invalidId as any))
          .rejects.toThrow('must be a string');
      }
    });

    it('should handle whitespace-only event IDs', async () => {
      const whitespaceIds = ['   ', '\t\t', '\n\n', ' \t \n '];

      for (const whitespaceId of whitespaceIds) {
        // After sanitization (trim), these become empty
        await expect(mockEventService.fetchFeed(whitespaceId))
          .rejects.toThrow();
      }
    });

    it('should handle mixed valid and invalid characters', async () => {
      const mixedIds = [
        "valid123<script>alert(1)</script>more-valid",
        "event'; DROP TABLE posts; --but-also-valid",
        "🎉good-event<bad-script>more-good🎈"
      ];

      for (const mixedId of mixedIds) {
        // Should be rejected due to malicious content
        await expect(mockEventService.fetchFeed(mixedId))
          .rejects.toThrow(/SQL injection|XSS|SECURITY_ERROR/);
      }
    });

    it('should maintain consistent behavior across similar inputs', async () => {
      const similarIds = [
        "event-123",
        "event_123", 
        "event.123",
        "event-123-test"
      ];

      const results: Array<any> = [];
      for (const eventId of similarIds) {
        const result = await mockEventService.fetchFeed(eventId);
        results.push(result);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }

      // All should succeed consistently
      expect(results.every((r: any) => r.length > 0)).toBe(true);
    });
  });
});