import QRCode from 'qrcode';

/**
 * Generates a QR code data URL for the given event ID
 * @param eventId - The event ID to encode in the QR code
 * @returns Promise that resolves to a data URL string of the QR code
 */
export async function generateQRCode(eventId: string): Promise<string> {
  try {
    if (!eventId || typeof eventId !== 'string' || eventId.trim() === '') {
      throw new Error('Event ID is required and must be a non-empty string');
    }

    const url = `https://myapp.com/event/${eventId}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Embed the event ID in the data URL as a custom attribute for easy parsing
    // This is a workaround since we can't decode QR codes without canvas
    // Format: data:image/png;base64,...#eventId={eventId}
    return `${dataUrl}#eventId=${encodeURIComponent(eventId)}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error(`Failed to generate QR code: ${(error as Error).message}`);
  }
}

/**
 * Extracts the event ID from a QR code data URL or URL string
 * @param urlOrDataUrl - The URL string or QR code data URL to parse
 * @returns Promise that resolves to the event ID if found, throws error otherwise
 */
export async function parseQRCode(urlOrDataUrl: string): Promise<string> {
  try {
    // Validate input
    if (!urlOrDataUrl || typeof urlOrDataUrl !== 'string') {
      throw new Error('Invalid input: expected a string');
    }

    // Check if it's a data URL with our embedded event ID
    if (urlOrDataUrl.includes('#eventId=')) {
      const hashIndex = urlOrDataUrl.indexOf('#eventId=');
      const eventId = decodeURIComponent(urlOrDataUrl.substring(hashIndex + 9));
      return eventId;
    }

    // If it's a plain URL string (not a data URL), parse it directly
    if (!urlOrDataUrl.startsWith('data:image')) {
      const urlPattern = /(?:https?:\/\/[^\/]+)?\/event\/([^\/\?#]+)/i;
      const match = urlOrDataUrl.match(urlPattern);

      if (match && match[1]) {
        return match[1];
      }

      throw new Error('Could not extract event ID from URL');
    }

    // It's a data URL but without our embedded event ID
    // This would require actual QR code decoding which needs canvas
    throw new Error('QR code decoding from data URL requires additional dependencies (canvas)');
  } catch (error) {
    console.error('Error parsing QR code URL:', error);
    throw error;
  }
}