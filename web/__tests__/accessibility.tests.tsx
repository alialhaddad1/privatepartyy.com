// @ts-nocheck
// Minimal test utilities - no heavy dependencies required
import React from 'react';
import { render, screen, axe, toHaveNoViolations, customMatchers, cleanup } from './test-utils';
import Feed from '../src/components/Feed';

// Extend Jest matchers with minimal implementations
expect.extend(toHaveNoViolations);
expect.extend(customMatchers);

// Mock fetch for API calls
(global as any).fetch = jest.fn();

// Mock data for testing
const mockPosts = [
  {
    id: '1',
    content: 'Join us for the upcoming community event planning session.',
    author: {
      id: 'user1',
      name: 'John Doe',
      avatar: '/avatars/john.jpg'
    },
    createdAt: '2024-01-15T10:30:00Z',
    likes: 15,
    isLiked: false,
    comments: 1,
    media: [{
      type: 'image' as const,
      url: '/images/event1.jpg'
    }]
  },
  {
    id: '2',
    content: 'Technical workshop on accessibility best practices.',
    author: {
      id: 'user3',
      name: 'Alice Johnson',
      avatar: '/avatars/alice.jpg'
    },
    createdAt: '2024-01-16T14:20:00Z',
    likes: 8,
    isLiked: false,
    comments: 0,
    media: [{
      type: 'image' as const,
      url: '/images/workshop.jpg'
    }]
  }
];

describe('Feed Accessibility Tests', () => {
  beforeEach(() => {
    // Mock IntersectionObserver for any lazy loading
    (global as any).IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));

    // Mock fetch to return posts
    ((global as any).fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPosts,
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders feed component with proper heading', async () => {
    render(<Feed eventId="test-event-1" />);

    // Wait for the feed to load and verify the heading renders
    const heading = await screen.findByText('Event Feed');
    expect(heading).toBeInTheDocument();
  });

  it('verifies ARIA roles for interactive elements', async () => {
    render(<Feed eventId="test-event-1" />);

    // Wait for posts to load
    await screen.findByText('Event Feed');

    // Check for button roles on interactive elements (refresh button should exist)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    // Check for proper heading hierarchy
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('ensures proper focus management', async () => {
    render(<Feed eventId="test-event-1" />);

    await screen.findByText('Event Feed');

    // Check that interactive elements are focusable
    const buttons = screen.getAllByRole('button');

    buttons.forEach((element: HTMLElement) => {
      // Elements should not have negative tabindex unless programmatically focused
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex) {
        expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(-1);
      }
    });
  });

  it('verifies semantic HTML structure', async () => {
    render(<Feed eventId="test-event-1" />);

    await screen.findByText('Event Feed');

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);

    // Verify heading is h2
    const mainHeading = headings.find((h: HTMLElement) => h.textContent === 'Event Feed');
    expect(mainHeading?.tagName.toLowerCase()).toBe('h2');
  });

  it('passes axe-core accessibility audit', async () => {
    const { container } = render(<Feed eventId="test-event-1" />);

    await screen.findByText('Event Feed');

    // Run axe-core accessibility check
    const results = await axe(container);

    // Expect no accessibility violations
    // @ts-expect-error - Custom matcher added via expect.extend
    expect(results).toHaveNoViolations();
  });

  it('handles loading state accessibility', async () => {
    // Mock slow loading - never resolves during test
    ((global as any).fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<Feed eventId="test-event-1" />);

    // Wait a bit for React to render, then check for loading indicator
    await new Promise(resolve => setTimeout(resolve, 50));

    // Should show loading indicator
    const loadingSpinner = document.querySelector('.animate-spin');
    expect(loadingSpinner).toBeTruthy();
  });

  it('handles empty state accessibility', async () => {
    // Mock empty posts array
    ((global as any).fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(<Feed eventId="test-event-1" />);

    // Should have appropriate empty state messaging
    const emptyMessage = await screen.findByText(/no posts yet/i);
    expect(emptyMessage).toBeInTheDocument();
  });

  it('verifies color contrast and visual accessibility', async () => {
    const { container } = render(<Feed eventId="test-event-1" />);

    await screen.findByText('Event Feed');

    // Run axe specifically for color contrast issues
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    // @ts-expect-error - Custom matcher added via expect.extend
    expect(results).toHaveNoViolations();
  });

  it('ensures keyboard navigation support', async () => {
    render(<Feed eventId="test-event-1" />);

    await screen.findByText('Event Feed');

    // Get all focusable elements
    const buttons = screen.getAllByRole('button');

    // Each focusable element should be properly marked
    buttons.forEach((element: HTMLElement) => {
      // Should be in the document and interactive
      expect(element).toBeInTheDocument();

      // Buttons should be focusable (no negative tabindex)
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex !== null) {
        expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('validates button accessible names', async () => {
    render(<Feed eventId="test-event-1" />);

    await screen.findByText('Event Feed');

    // Check refresh button has accessible name
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it('handles error state accessibility', async () => {
    // Mock fetch error
    ((global as any).fetch as jest.Mock).mockRejectedValue(new Error('Failed to load posts'));

    render(<Feed eventId="test-event-1" />);

    // Should show error message (exact text from component)
    const errorMessage = await screen.findByText('Failed to load posts');
    expect(errorMessage).toBeInTheDocument();

    // Should have a retry button
    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
  });
});
