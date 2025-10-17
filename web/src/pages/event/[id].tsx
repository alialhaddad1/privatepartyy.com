import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import Head from 'next/head';
import Header from '../../components/Header';
import Feed from '../../components/Feed';
import UploadWidget from '../../components/UploadWidget';
import CommentModal from '../../components/CommentModal';

interface MediaItem {
  id: string;
  mediaType: string;
  mediaUrl: string;
  fileKey: string;
  thumbnailUrl?: string;
  originalFilename: string;
  displayOrder: number;
}

interface Post {
  id: string;
  content?: string;
  caption?: string;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  createdAt: string;
  type: 'text' | 'image' | 'media';
  mediaItems?: MediaItem[];
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
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [allowDMs, setAllowDMs] = useState<boolean | null>(null);
  const [dmThreads, setDmThreads] = useState<any[]>([]);
  const [showDMInbox, setShowDMInbox] = useState(false);

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

  // Fetch user preferences (including allowDMs setting)
  useEffect(() => {
    const fetchUserPreferences = async () => {
      if (!user || !id) return;

      try {
        const response = await fetch(`/api/events/user-preferences?eventId=${id}&userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAllowDMs(data.preferences.allowDMs);
        } else {
          // Default to true if no preference found
          setAllowDMs(true);
        }
      } catch (err) {
        console.error('Error fetching user preferences:', err);
        setAllowDMs(true);
      }
    };

    fetchUserPreferences();
  }, [user, id, token]);

  // Fetch DM threads if user allows DMs
  useEffect(() => {
    const fetchDMThreads = async () => {
      if (!user || !id || allowDMs === null || !allowDMs) return;

      try {
        const response = await fetch(`/api/events/${id}/dm-threads?userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDmThreads(data.threads || []);
        }
      } catch (err) {
        console.error('Error fetching DM threads:', err);
      }
    };

    fetchDMThreads();

    // Poll for new threads every 30 seconds
    const interval = setInterval(fetchDMThreads, 30000);
    return () => clearInterval(interval);
  }, [user, id, token, allowDMs]);

  // One-time logging on mount
  useEffect(() => {
    console.log(`🎬 [Event Page] Mounted with ${initialPosts.length} initial posts`);
    if (initialPosts.length > 0) {
      console.log(`📋 [Event Page] Initial post IDs: ${initialPosts.map(p => p.id).join(', ')}`);
    }
  }, []); // Empty deps array - only run once on mount

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
      console.log(`📥 [Event Page] Received ${data.posts?.length || 0} posts from API`);
      if (data.posts && data.posts.length > 0) {
        console.log(`📋 [Event Page] Post IDs: ${data.posts.map((p: Post) => p.id).join(', ')}`);
      }
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
    if (!user) {
      setError('You must be logged in to like posts');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      const wasLiked = post?.isLiked ?? false;

      // Optimistically update UI
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isLiked: !p.isLiked,
            likes: p.isLiked ? p.likes - 1 : p.likes + 1
          };
        }
        return p;
      }));

      const response = await fetch(`/api/posts/${postId}/likes`, {
        method: wasLiked ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          wasLiked
            ? { userId: user.id }
            : { userId: user.id, userName: user.name, userAvatar: user.avatar || '👤' }
        ),
      });

      if (!response.ok) {
        // Revert optimistic update
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isLiked: wasLiked,
              likes: wasLiked ? p.likes + 1 : p.likes - 1
            };
          }
          return p;
        }));

        if (response.status === 409) {
          // Already liked - just update UI to reflect that
          setPosts(prev => prev.map(p => {
            if (p.id === postId) {
              return { ...p, isLiked: true };
            }
            return p;
          }));
          return;
        }

        throw new Error('Failed to like post');
      }

      console.log(`✅ Post ${postId} ${wasLiked ? 'unliked' : 'liked'}`);
    } catch (err) {
      console.error('Error liking post:', err);
      setError('Failed to like post');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleComment = async (postId: string) => {
    setSelectedPostId(postId);
    setCommentModalOpen(true);
  };

  const handleCommentModalClose = () => {
    setCommentModalOpen(false);
    setSelectedPostId(null);
    // Refresh posts to get updated comment counts
    fetchPosts(false);
  };

  const handleDM = async (userId: string) => {
    try {
      if (!user) {
        setError('You must be logged in to send messages');
        setTimeout(() => setError(''), 3000);
        return;
      }

      // Find the post author's info
      const post = posts.find(p => p.authorId === userId);
      if (!post) {
        setError('Could not find user information');
        setTimeout(() => setError(''), 3000);
        return;
      }

      // Create or find existing DM thread
      const response = await fetch(`/api/events/${id}/dm-threads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentUserId: user.id,
          currentUserName: user.name,
          currentUserAvatar: user.avatar || '👤',
          otherUserId: post.authorId,
          otherUserName: post.authorName,
          otherUserAvatar: post.authorAvatar || '👤'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create DM thread');
      }

      const { thread } = await response.json();
      console.log(`🔀 [Event Page] Redirecting to DM thread ${thread.id}`);
      window.location.href = `/dm/${thread.id}`;
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

      {/* DM Inbox Section - Only show if user allows DMs and has threads */}
      {user && allowDMs && dmThreads.length > 0 && (
        <div className="dm-inbox-section">
          <div className="dm-inbox-header">
            <button
              onClick={() => setShowDMInbox(!showDMInbox)}
              className="dm-inbox-toggle"
            >
              <span className="dm-inbox-title">
                💬 Messages {dmThreads.length > 0 && <span className="dm-count">({dmThreads.length})</span>}
              </span>
              <span className="dm-toggle-icon">{showDMInbox ? '▼' : '▶'}</span>
            </button>
          </div>

          {showDMInbox && (
            <div className="dm-threads-list">
              {dmThreads.map((thread) => {
                // Determine who the other person is
                const isParticipant1 = thread.participant1Id === user.id;
                const otherParticipantName = isParticipant1 ? thread.participant2Name : thread.participant1Name;
                const otherParticipantAvatar = isParticipant1 ? thread.participant2Avatar : thread.participant1Avatar;

                return (
                  <div
                    key={thread.id}
                    className="dm-thread-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `/dm/${thread.id}`;
                    }}
                  >
                    <div className="dm-thread-avatar">
                      {otherParticipantAvatar}
                    </div>
                    <div className="dm-thread-info">
                      <div className="dm-thread-name">{otherParticipantName}</div>
                      {thread.lastMessageAt && (
                        <div className="dm-thread-time">
                          {new Date(thread.lastMessageAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    {thread.messageCount > 0 && (
                      <div className="dm-thread-count">{thread.messageCount}</div>
                    )}
                  </div>
                );
              })}
            </div>
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
                      >
                        Message
                      </button>
                    )}
                  </div>

                  <div className="post-content">
                    {post.content && (
                      <p className="post-text">{post.content}</p>
                    )}
                    {post.caption && (
                      <p className="post-caption">{post.caption}</p>
                    )}
                    {post.type === 'media' && post.mediaItems && post.mediaItems.length > 0 ? (
                      <div className="media-grid">
                        {post.mediaItems.map((media) => (
                          <img
                            key={media.id}
                            src={media.mediaUrl}
                            alt={media.originalFilename || "Post media"}
                            className="post-media-item"
                          />
                        ))}
                      </div>
                    ) : post.imageUrl ? (
                      <img
                        src={post.imageUrl}
                        alt="Post content"
                        className="post-image"
                      />
                    ) : null}
                  </div>

                  <div className="post-actions">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`action-button like-button ${post.isLiked ? 'liked' : ''}`}
                    >
                      ❤️ {post.likes}
                    </button>

                    <button
                      onClick={() => handleComment(post.id)}
                      className="action-button comment-button"
                    >
                      💬 {post.comments}
                    </button>
                  </div>
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

      {selectedPostId && (
        <CommentModal
          postId={selectedPostId}
          token={token}
          isOpen={commentModalOpen}
          onClose={handleCommentModalClose}
          user={user}
        />
      )}

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

        .post-caption {
          font-size: 15px;
          color: #1a1a1a;
          line-height: 1.5;
          margin: 0 0 12px 0;
          font-style: italic;
        }

        .post-image {
          width: 100%;
          border-radius: 12px;
          max-height: 500px;
          object-fit: cover;
        }

        .media-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .post-media-item {
          width: 100%;
          border-radius: 12px;
          object-fit: cover;
          aspect-ratio: 1;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .post-media-item:hover {
          transform: scale(1.02);
        }

        @media (max-width: 768px) {
          .media-grid {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
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

        .dm-inbox-section {
          margin: 0 20px 20px 20px;
          background-color: white;
          border-radius: 8px;
          border: 1px solid #e1e8ed;
          overflow: hidden;
        }

        .dm-inbox-header {
          border-bottom: 1px solid #e1e8ed;
        }

        .dm-inbox-toggle {
          width: 100%;
          padding: 16px 20px;
          background: none;
          border: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .dm-inbox-toggle:hover {
          background-color: #f8f9fa;
        }

        .dm-inbox-title {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .dm-count {
          color: #1da1f2;
          font-weight: 700;
        }

        .dm-toggle-icon {
          color: #657786;
          font-size: 12px;
        }

        .dm-threads-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .dm-thread-item {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #f0f2f5;
          cursor: pointer;
          transition: background-color 0.2s;
          gap: 12px;
        }

        .dm-thread-item:last-child {
          border-bottom: none;
        }

        .dm-thread-item:hover {
          background-color: #f8f9fa;
        }

        .dm-thread-avatar {
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

        .dm-thread-info {
          flex: 1;
          min-width: 0;
        }

        .dm-thread-name {
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 4px;
        }

        .dm-thread-time {
          font-size: 13px;
          color: #657786;
        }

        .dm-thread-count {
          background-color: #1da1f2;
          color: white;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 12px;
          min-width: 24px;
          text-align: center;
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

          .dm-inbox-section {
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