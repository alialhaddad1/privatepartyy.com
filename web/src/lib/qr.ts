import QRCode from 'qrcode';

/**
 * Generates a QR code data URL for the given event ID
 * @param eventId - The event ID to encode in the QR code
 * @returns Promise that resolves to a data URL string of the QR code
 */
export async function generateQRCode(eventId: string): Promise<string> {
  try {
    const url = `https://myapp.com/event/${eventId}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Extracts the event ID from a QR code URL
 * @param url - The URL from a scanned QR code
 * @returns The event ID if found, null otherwise
 */
export function parseQRCode(url: string): string | null {
  try {
    // Handle both full URLs and relative paths
    const urlPattern = /(?:https?:\/\/[^\/]+)?\/event\/([^\/\?#]+)/i;
    const match = url.match(urlPattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing QR code URL:', error);
    return null;
  }
}