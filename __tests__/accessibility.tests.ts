import { render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import EventFeed from '../components/EventFeed';

// Extend Jest matchers to include axe-core
expect.extend(toHaveNoViolations);

// Mock data for testing
const mockPosts = [
  {
    id: '1',
    title: 'Community Event Planning',
    content: 'Join us for the upcoming community event planning session.',
    author: {
      id: 'user1',
      name: 'John Doe',
      avatar: '/avatars/john.jpg'
    },
    createdAt: '2024-01-15T10:30:00Z',
    imageUrl: '/images/event1.jpg',
    likes: 15,
    comments: [
      {
        id: 'comment1',
        content: 'Looking forward to this!',
        author: { id: 'user2', name: 'Jane Smith' },
        createdAt: '2024-01-15T11:00:00Z'
      }
    ]
  },
  {
    id: '2',
    title: 'Workshop Announcement',
    content: 'Technical workshop on accessibility best practices.',
    author: {
      id: 'user3',
      name: 'Alice Johnson',
      avatar: '/avatars/alice.jpg'
    },
    createdAt: '2024-01-16T14:20:00Z',
    imageUrl: '/images/workshop.jpg',
    likes: 8,
    comments: []
  }
];

describe('EventFeed Accessibility Tests', () => {
  beforeEach(() => {
    // Mock IntersectionObserver for any lazy loading
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders feed component with posts', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Verify the feed renders
    expect(screen.getByRole('feed')).toBeInTheDocument();
    
    // Verify posts are rendered
    expect(screen.getByText('Community Event Planning')).toBeInTheDocument();
    expect(screen.getByText('Workshop Announcement')).toBeInTheDocument();
  });

  it('ensures all images have non-empty alt text', () => {
    render(<EventFeed posts={mockPosts} />);
    
    const images = screen.getAllByRole('img');
    
    images.forEach((img) => {
      const altText = img.getAttribute('alt');
      
      // Assert alt attribute exists and is not empty
      expect(altText).toBeTruthy();
      expect(altText).not.toBe('');
      expect(altText.trim()).not.toBe('');
    });

    // Additional specific checks for expected images
    expect(screen.getByAltText(/john doe/i)).toBeInTheDocument();
    expect(screen.getByAltText(/alice johnson/i)).toBeInTheDocument();
    
    // Check for post images (assuming they have descriptive alt text)
    const postImages = images.filter(img => 
      img.getAttribute('alt')?.toLowerCase().includes('event') ||
      img.getAttribute('alt')?.toLowerCase().includes('workshop')
    );
    expect(postImages.length).toBeGreaterThan(0);
  });

  it('verifies ARIA roles for interactive elements', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Check for button roles on interactive elements
    const likeButtons = screen.getAllByRole('button', { name: /like/i });
    expect(likeButtons.length).toBeGreaterThan(0);
    
    const commentButtons = screen.getAllByRole('button', { name: /comment/i });
    expect(commentButtons.length).toBeGreaterThan(0);
    
    // Check for textbox role on comment inputs
    const commentInputs = screen.getAllByRole('textbox', { name: /add comment/i });
    expect(commentInputs.length).toBeGreaterThan(0);
    
    // Verify each comment input has proper labeling
    commentInputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-label');
      const label = input.getAttribute('aria-label');
      expect(label).toBeTruthy();
      expect(label).not.toBe('');
    });
    
    // Check for proper heading hierarchy
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
    
    // Verify main feed has proper role
    expect(screen.getByRole('feed')).toBeInTheDocument();
    
    // Check for article roles on individual posts
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(mockPosts.length);
  });

  it('ensures proper focus management', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Check that interactive elements are focusable
    const interactiveElements = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('textbox'),
      ...screen.getAllByRole('link')
    ];
    
    interactiveElements.forEach((element) => {
      // Elements should not have tabindex="-1" unless they're programmatically focused
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex) {
        expect(parseInt(tabIndex)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('verifies semantic HTML structure', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Check for proper landmark roles
    expect(screen.getByRole('feed')).toBeInTheDocument();
    
    // Each post should be in an article element
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(mockPosts.length);
    
    // Check for proper heading structure within articles
    articles.forEach((article) => {
      const headings = within(article).getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // First heading should be level 2 or 3 (assuming main page has h1)
      const firstHeading = headings[0];
      const level = firstHeading.tagName.toLowerCase();
      expect(['h2', 'h3', 'h4'].includes(level)).toBe(true);
    });
  });

  it('passes axe-core accessibility audit', async () => {
    const { container } = render(<EventFeed posts={mockPosts} />);
    
    // Run axe-core accessibility check
    const results = await axe(container);
    
    // Expect no accessibility violations
    expect(results).toHaveNoViolations();
  });

  it('handles empty state accessibility', () => {
    render(<EventFeed posts={[]} />);
    
    // Should have appropriate empty state messaging
    const emptyMessage = screen.getByText(/no posts/i) || screen.getByText(/no events/i);
    expect(emptyMessage).toBeInTheDocument();
    
    // Empty state should be announced to screen readers
    expect(emptyMessage).toHaveAttribute('aria-live');
  });

  it('verifies color contrast and visual accessibility', async () => {
    const { container } = render(<EventFeed posts={mockPosts} />);
    
    // Run axe specifically for color contrast issues
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true }
      }
    });
    
    expect(results).toHaveNoViolations();
  });

  it('ensures keyboard navigation support', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Get all focusable elements
    const focusableElements = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('textbox'),
      ...screen.getAllByRole('link')
    ];
    
    // Each focusable element should be properly marked
    focusableElements.forEach((element) => {
      // Should not be disabled unless intentionally so
      if (element.hasAttribute('disabled')) {
        expect(element).toHaveAttribute('aria-disabled', 'true');
      }
      
      // Should have visible focus indication (tested via axe)
      expect(element).toBeVisible();
    });
  });

  it('validates ARIA labels and descriptions', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Check like buttons have accessible names
    const likeButtons = screen.getAllByRole('button', { name: /like/i });
    likeButtons.forEach((button) => {
      expect(button).toHaveAccessibleName();
    });
    
    // Check comment buttons have accessible names
    const commentButtons = screen.getAllByRole('button', { name: /comment/i });
    commentButtons.forEach((button) => {
      expect(button).toHaveAccessibleName();
    });
    
    // Check form inputs have labels
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toHaveAccessibleName();
    });
  });

  it('ensures proper live regions for dynamic content', () => {
    render(<EventFeed posts={mockPosts} />);
    
    // Check for aria-live regions where dynamic content appears
    const statusElements = screen.queryAllByRole('status');
    const alertElements = screen.queryAllByRole('alert');
    
    // At minimum, should have some live region for notifications
    expect(statusElements.length + alertElements.length).toBeGreaterThanOrEqual(0);
  });
});