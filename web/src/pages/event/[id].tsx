import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Header from '../../components/Header';
import Feed from '../../components/Feed';
import UploadWidget from '../../components/UploadWidget';

interface Post {
  id: string;
  content?: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  createdAt: string;
  type: 'text' | 'image';
}

interface EventData {
  id: string;
  name: string;
  description?: string;
  hostId: string;
  hostName: string;
  location?: string;
  date?: string;
  isActive: boolean;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
  isSubscribed: boolean;
}

interface EventFeedPageProps {
  initialPosts: Post[];
  event: EventData;
  user: User | null;
  token: string;
  isHost: boolean;
}

const EventFeedPage: React.FC<EventFeedPageProps> = ({
  initialPosts,
  event,
  user: serverUser,
  token,
  isHost
}) => {
  const router = useRouter();
  const { id } = router.query;
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [eventData, setEventData] = useState<EventData>(event);
  const [isUserHost, setIsUserHost] = useState(isHost);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load user profile from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedProfile = localStorage.getItem('userProfile');
      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile);
          setLocalUser({
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar,
            isSubscribed: false, // Local users are not subscribed by default
          });
        } catch (err) {
          console.error('Error parsing user profile:', err);
        }
      } else if (!serverUser) {
        // No profile found, redirect to join page
        router.push(`/join/${id}?token=${token}`);
      }
    }
  }, [serverUser, id, token, router]);

  // Fetch event data to get host information
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const response = await fetch(`/api/events/${id}?token=${token}`);
        if (response.ok) {
          const data = await response.json();
          setEventData({
            id: data.id,
            name: data.name || data.title,
            description: data.description || '',
            hostId: data.host_id || '',
            hostName: data.host_name || '',
            location: data.location || '',
            date: data.date || '',
            isActive: true,
          });

          // Check if current user is the host
          // Match by ID OR by email (since localStorage users have different IDs each time)
          const currentUser = serverUser || localUser;
          if (currentUser && data.host_id) {
            const isHostById = currentUser.id === data.host_id;
            const isHostByEmail = currentUser.id && localUser?.id &&
                                   data.host_email &&
                                   localUser.id.includes('user_'); // Check if it's a localStorage user

            // For localStorage users, check if the event's token matches the current event
            // This is a workaround: if they're viewing the event with the token, and there's no auth user,
            // we can check localStorage for a flag that they created this event
            let isCreator = false;
            if (typeof window !== 'undefined') {
              const createdEvents = localStorage.getItem('createdEvents');
              if (createdEvents) {
                try {
                  const events = JSON.parse(createdEvents);
                  isCreator = events.includes(data.id);
                } catch (e) {
                  console.error('Error parsing createdEvents:', e);
                }
              }
            }

            setIsUserHost(isHostById || isCreator);
          }
        }
      } catch (err) {
        console.error('Error fetching event data:', err);
      }
    };

    if (id && token) {
      fetchEventData();
    }
  }, [id, token, serverUser, localUser]);

  // Use server user if available, otherwise use local user
  const user = serverUser || localUser;

  const fetchPosts = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    
    try {
      const response = await fetch(`/api/events/${id}/posts?token=${token}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          setError('You do not have permission to view this event');
          return;
        }
        throw new Error('Failed to fetch posts');
      }

      const data = await response.json();
      setPosts(data.posts || []);
      setError('');
    } catch (err) {
      console.error('Error fetching posts:', err);
      setError('Failed to load posts');
    } finally {
      if (showLoader) setLoading(false);
      setRefreshing(false);
    }
  }, [id, token, router]);

  const handleLike = async (postId: string) => {
    if (!user?.isSubscribed) {
      setError('Subscribe to PrivatePartyy to like posts');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      // Optimistically update UI
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1
          };
        }
        return post;
      }));

      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Revert optimistic update
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes + 1 : post.likes - 1
            };
          }
          return post;
        }));
        throw new Error('Failed to like post');
      }
    } catch (err) {
      console.error('Error liking post:', err);
      setError('Failed to like post');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleComment = async (postId: string) => {
    if (!user?.isSubscribed) {
      setError('Subscribe to PrivatePartyy to comment on posts');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Navigate to post detail or open comment modal
    // For now, we'll just show an alert
    alert('Comment functionality would open a modal or navigate to post detail');
  };

  const handleDM = async (userId: string) => {
    if (!user?.isSubscribed) {
      setError('Subscribe to PrivatePartyy to send direct messages');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      // Create or find existing DM thread
      const response = await fetch('/api/dms/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participantId: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create DM thread');
      }

      const { threadId } = await response.json();
      router.push(`/dm/${threadId}`);
    } catch (err) {
      console.error('Error creating DM:', err);
      setError('Failed to start conversation');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUploadComplete = (postId: string) => {
    setShowUpload(false);
    // Refresh posts to show the new upload
    fetchPosts(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPosts(false);
  };

  const handleCopyLink = async () => {
    const eventUrl = `${window.location.origin}/join/${id}?token=${token}`;
    try {
      await navigator.clipboard.writeText(eventUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = eventUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  // Set up polling for new posts
  useEffect(() => {
    const startPolling = () => {
      const interval = setInterval(() => {
        fetchPosts(false);
      }, 30000); // Poll every 30 seconds

      setPollingInterval(interval);
    };

    // Start polling
    startPolling();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [fetchPosts, pollingInterval]);

  // Handle visibility change to pause/resume polling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      } else {
        if (!pollingInterval) {
          const interval = setInterval(() => {
            fetchPosts(false);
          }, 30000);
          setPollingInterval(interval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollingInterval, fetchPosts]);

  if (!eventData) {
    return (
      <div className="event-page error">
        <Head>
          <title>Event Not Found - PrivatePartyy</title>
        </Head>
        <div className="error-message">
          Event not found or you don't have permission to view it.
        </div>
      </div>
    );
  }

  return (
    <div className="event-page">
      <Head>
        <title>{eventData.name} - PrivatePartyy</title>
        <meta name="description" content={eventData.description || `Join ${eventData.name} on PrivatePartyy`} />
      </Head>

      <Header />

      <div className="event-header">
        <div className="event-info">
          <h1 className="event-title">{eventData.name}</h1>
          {eventData.description && (
            <p className="event-description">{eventData.description}</p>
          )}
          <div className="event-meta">
            <span className="host-info">Hosted by {eventData.hostName}</span>
            {eventData.location && <span className="location">{eventData.location}</span>}
            {eventData.date && <span className="date">{new Date(eventData.date).toLocaleDateString()}</span>}
          </div>
        </div>

        <div className="event-actions">
          {isUserHost && (
            <>
              <button
                onClick={() => router.push(`/host/qr/${id}?token=${token}`)}
                className="qr-button"
              >
                Show QR Code
              </button>
              <button
                onClick={handleCopyLink}
                className="copy-link-button"
              >
                {copySuccess ? '✓ Copied!' : '🔗 Copy Link'}
              </button>
            </>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="refresh-button"
          >
            {refreshing ? '↻' : '↻'} Refresh
          </button>

          {user && (
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="upload-toggle"
            >
              {showUpload ? '✕ Close' : '📷 Upload'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          {error.includes('Subscribe') && (
            <button 
              onClick={() => router.push('/subscribe')}
              className="subscribe-link"
            >
              Subscribe Now
            </button>
          )}
        </div>
      )}

      {showUpload && user && (
        <div className="upload-section">
          <UploadWidget
            eventId={id as string}
            token={token}
            onUploadComplete={handleUploadComplete}
            onError={(error) => setError(error)}
          />
        </div>
      )}

      <div className="feed-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading posts...</p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="post-wrapper">
                <div className="post-card">
                  <div className="post-header">
                    <div className="author-info">
                      <div className="author-avatar">
                        {post.authorAvatar}
                      </div>
                      <div className="author-details">
                        <span className="author-name">{post.authorName}</span>
                        <span className="post-time">
                          {new Date(post.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    {user && post.authorId !== user.id && (
                      <button
                        onClick={() => handleDM(post.authorId)}
                        className="dm-button"
                        disabled={!user.isSubscribed}
                      >
                        Message
                      </button>
                    )}
                  </div>

                  <div className="post-content">
                    {post.content && (
                      <p className="post-text">{post.content}</p>
                    )}
                    {post.imageUrl && (
                      <img 
                        src={post.imageUrl} 
                        alt="Post content"
                        className="post-image"
                      />
                    )}
                  </div>

                  <div className="post-actions">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`action-button like-button ${post.isLiked ? 'liked' : ''}`}
                      disabled={!user?.isSubscribed}
                    >
                      ❤️ {post.likes}
                    </button>
                    
                    <button
                      onClick={() => handleComment(post.id)}
                      className="action-button comment-button"
                      disabled={!user?.isSubscribed}
                    >
                      💬 {post.comments}
                    </button>
                  </div>

                  {!user?.isSubscribed && (
                    <div className="subscription-overlay">
                      <p>Subscribe to interact with posts</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="empty-state">
            <h3>No posts yet</h3>
            <p>Be the first to share something at {eventData.name}!</p>
            {user && !showUpload && (
              <button
                onClick={() => setShowUpload(true)}
                className="upload-prompt"
              >
                Upload a Photo
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        .event-page {
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .event-page.error {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }

        .error-message {
          text-align: center;
          color: #657786;
          font-size: 18px;
          padding: 40px;
        }

        .event-header {
          background-color: white;
          border-bottom: 1px solid #e1e8ed;
          padding: 20px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 20px;
        }

        .event-info {
          flex: 1;
          min-width: 300px;
        }

        .event-title {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .event-description {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: #657786;
          line-height: 1.5;
        }

        .event-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          font-size: 14px;
          color: #657786;
        }

        .host-info {
          font-weight: 600;
          color: #1da1f2;
        }

        .event-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        .qr-button {
          padding: 10px 20px;
          background-color: #17a2b8;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .qr-button:hover {
          background-color: #138496;
        }

        .copy-link-button {
          padding: 10px 20px;
          background-color: #6610f2;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background-color 0.2s;
        }

        .copy-link-button:hover {
          background-color: #560bd0;
        }

        .refresh-button {
          padding: 10px 16px;
          background-color: #6c757d;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .refresh-button:hover:not(:disabled) {
          background-color: #545b62;
        }

        .refresh-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-toggle {
          padding: 10px 20px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .upload-toggle:hover {
          background-color: #218838;
        }

        .error-banner {
          background-color: #f8d7da;
          color: #721c24;
          padding: 15px 20px;
          margin: 0 20px 20px 20px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .subscribe-link {
          padding: 6px 12px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
        }

        .subscribe-link:hover {
          background-color: #218838;
        }

        .upload-section {
          margin: 0 20px 20px 20px;
          background-color: white;
          border-radius: 8px;
          padding: 20px;
          border: 1px solid #e1e8ed;
        }

        .feed-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .loading-state {
          text-align: center;
          padding: 60px 20px;
          color: #657786;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #e1e8ed;
          border-top: 4px solid #1da1f2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 15px auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #657786;
          background-color: white;
          border-radius: 8px;
          border: 1px solid #e1e8ed;
        }

        .empty-state h3 {
          margin: 0 0 10px 0;
          color: #1a1a1a;
        }

        .empty-state p {
          margin: 0 0 20px 0;
          font-size: 16px;
        }

        .upload-prompt {
          padding: 12px 24px;
          background-color: #1da1f2;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
        }

        .upload-prompt:hover {
          background-color: #1991db;
        }

        .posts-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .post-wrapper {
          width: 100%;
        }

        .post-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e1e8ed;
          transition: box-shadow 0.2s;
        }

        .post-card:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .post-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .author-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }

        .author-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .author-name {
          font-weight: 600;
          color: #1a1a1a;
          font-size: 15px;
        }

        .post-time {
          font-size: 13px;
          color: #657786;
        }

        .dm-button {
          padding: 6px 12px;
          background: #1da1f2;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
        }

        .dm-button:hover:not(:disabled) {
          background: #1991db;
        }

        .dm-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .post-content {
          margin-bottom: 15px;
        }

        .post-text {
          font-size: 15px;
          color: #1a1a1a;
          line-height: 1.5;
          margin: 0 0 12px 0;
        }

        .post-image {
          width: 100%;
          border-radius: 12px;
          max-height: 500px;
          object-fit: cover;
        }

        .post-actions {
          display: flex;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid #e1e8ed;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: none;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          color: #657786;
          transition: background 0.2s;
        }

        .action-button:hover:not(:disabled) {
          background: #f0f2f5;
        }

        .action-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .like-button.liked {
          color: #e0245e;
        }

        .subscription-overlay {
          margin-top: 12px;
          padding: 12px;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 6px;
          text-align: center;
          font-size: 13px;
          color: #856404;
        }

        @media (max-width: 768px) {
          .event-header {
            flex-direction: column;
            align-items: stretch;
          }

          .event-actions {
            justify-content: center;
          }

          .event-title {
            font-size: 24px;
          }

          .feed-container {
            padding: 0 10px;
          }

          .upload-section {
            margin: 0 10px 20px 10px;
          }

          .error-banner {
            margin: 0 10px 20px 10px;
          }
        }
      `}</style>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id, token } = context.query;

  if (!token) {
    // No token provided, redirect to join page
    return {
      redirect: {
        destination: `/join/${id}`,
        permanent: false,
      },
    };
  }

  try {
    // Build the base URL
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Fetch event data
    const eventResponse = await fetch(`${baseUrl}/api/events/${id}?token=${token}`);

    if (!eventResponse.ok) {
      // Event not found or invalid token
      return {
        redirect: {
          destination: `/join/${id}`,
          permanent: false,
        },
      };
    }

    const eventData = await eventResponse.json();

    // Fetch posts
    const postsResponse = await fetch(`${baseUrl}/api/events/${id}/posts?token=${token}`);
    const postsData = postsResponse.ok ? await postsResponse.json() : { posts: [] };

    return {
      props: {
        initialPosts: postsData.posts || [],
        event: {
          id: eventData.id,
          name: eventData.name || eventData.title,
          description: eventData.description || '',
          hostId: eventData.host_id || '',
          hostName: eventData.host_name || '',
          location: eventData.location || '',
          date: eventData.date || '',
          isActive: true,
        },
        user: null,
        token: token as string,
        isHost: false, // Will be determined client-side
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    // On error, redirect to join page
    return {
      redirect: {
        destination: `/join/${id}`,
        permanent: false,
      },
    };
  }
};

export default EventFeedPage;