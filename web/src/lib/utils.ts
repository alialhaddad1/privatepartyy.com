/**
 * Formats an ISO date string to a human-readable format
 * @param dateString - ISO date string (e.g., "2025-09-30T19:00:00Z")
 * @returns Formatted date string (e.g., "Sep 30, 2025 7:00 PM")
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Generates a short random ID with an optional prefix
 * @param prefix - Optional prefix to add to the ID
 * @returns Random ID string (e.g., "abc123" or "user_abc123")
 */
export function randomId(prefix?: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Generate 6 random characters
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return prefix ? `${prefix}_${result}` : result;
}

/**
 * Validates if a string is a valid URL
 * @param url - URL string to validate
 * @returns True if URL is valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}