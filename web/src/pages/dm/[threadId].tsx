import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
// MessagesList and MessageInput components need to be created

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  timestamp: string;
  type?: 'text' | 'image' | 'system';
}

interface Thread {
  id: string;
  participants: Array<{
    id: string;
    name: string;
    avatar?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
  isSubscribed: boolean;
}

interface DMPageProps {
  initialMessages: Message[];
  thread: Thread;
  user: User;
  token: string;
}

const DMPage: React.FC<DMPageProps> = ({ 
  initialMessages, 
  thread, 
  user, 
  token 
}) => {
  const router = useRouter();
  const { threadId } = router.query;
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [messageInput, setMessageInput] = useState<string>('');
  const [localUser, setLocalUser] = useState<User | null>(null);
  const [localThread, setLocalThread] = useState<Thread>(thread);
  const [userLoaded, setUserLoaded] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [messageLimit, setMessageLimit] = useState(10);
  const [remaining, setRemaining] = useState(10);

  // Load user from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedProfile = localStorage.getItem('userProfile');
      console.log('🔍 [DM Page] Raw localStorage userProfile:', storedProfile);

      if (storedProfile) {
        try {
          const profile = JSON.parse(storedProfile);
          console.log('👤 [DM Page] Parsed user profile:', profile);

          if (!profile.id || profile.id.length < 10) {
            console.error('❌ [DM Page] Invalid user ID in profile:', profile.id);
            setError('Invalid user profile. Please refresh or rejoin the event.');
            setUserLoaded(true);
            return;
          }

          setLocalUser({
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar,
            isSubscribed: false,
          });
          setUserLoaded(true);
        } catch (err) {
          console.error('❌ [DM Page] Error parsing user profile:', err);
          setError('Could not load user profile');
          setUserLoaded(true);
        }
      } else {
        console.warn('⚠️ [DM Page] No user profile in localStorage');
        setError('No user profile found. Please rejoin the event.');
        setUserLoaded(true);
      }
    }
  }, []);

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    sendMessage(messageInput);
    setMessageInput('');
  };

  // Use local user if available
  const currentUser = localUser || user;

  // Get the other participant
  const otherParticipant = localThread.participants.find(p => p.id !== currentUser.id);

  const fetchMessages = useCallback(async () => {
    if (!currentUser || !threadId) {
      console.warn('Cannot fetch messages: missing currentUser or threadId');
      return;
    }

    try {
      console.log(`📥 [DM Page] Fetching messages for thread ${threadId}, user ${currentUser.id}`);
      const response = await fetch(`/api/dm-threads/${threadId}/messages?userId=${encodeURIComponent(currentUser.id)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (response.status === 403) {
          setError('You do not have permission to view this conversation');
          return;
        }
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);

      // Update message count and limit from API
      if (typeof data.messageCount === 'number') {
        setMessageCount(data.messageCount);
      }
      if (typeof data.limit === 'number') {
        setMessageLimit(data.limit);
      }
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining);
      }

      // Update thread data from API response
      if (data.thread) {
        console.log('✅ [DM Page] Updating thread data from API:', data.thread);
        setLocalThread({
          id: data.thread.id,
          participants: [
            {
              id: data.thread.participant1Id,
              name: data.thread.participant1Name,
              avatar: data.thread.participant1Avatar
            },
            {
              id: data.thread.participant2Id,
              name: data.thread.participant2Name,
              avatar: data.thread.participant2Avatar
            }
          ],
          createdAt: data.thread.createdAt,
          updatedAt: data.thread.updatedAt
        });
      }

      setError('');
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    }
  }, [threadId, token, router, currentUser]);

  const sendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    if (!content.trim()) return;

    // Check if limit reached
    if (messageCount >= messageLimit) {
      setError(`You've reached the ${messageLimit} message limit. Exchange contact info to continue chatting!`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempMessage: Message = {
      id: tempId,
      content,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderAvatar: currentUser.avatar,
      timestamp: new Date().toISOString(),
      type,
    };

    // Optimistically add message
    setMessages(prev => [...prev, tempMessage]);

    try {
      const response = await fetch(`/api/dm-threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          content,
          type,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429) {
          // Message limit reached
          setError(errorData.message || 'Message limit reached');
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          setTimeout(() => setError(''), 5000);
          return;
        }
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Update counts from response
      if (typeof data.messageCount === 'number') {
        setMessageCount(data.messageCount);
      }
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining);
      }

      // Replace temp message with real message
      setMessages(prev =>
        prev.map(msg => msg.id === tempId ? data.message : msg)
      );

    } catch (err) {
      console.error('Error sending message:', err);

      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));

      // Show error
      setError('Failed to send message. Please try again.');
      setTimeout(() => setError(''), 5000);
    }
  };

  // Set up polling for new messages
  useEffect(() => {
    // Wait for user to be loaded from localStorage
    if (!userLoaded || !localUser || !threadId) {
      console.log('⏸️ [DM Page] Waiting for user to load before polling');
      return;
    }

    console.log(`▶️ [DM Page] Starting polling for user ${localUser.id}`);

    // Initial fetch
    fetchMessages();

    // Start polling
    const interval = setInterval(() => {
      fetchMessages();
    }, 3000); // Poll every 3 seconds

    setPollingInterval(interval);

    // Handle visibility change to pause/resume polling
    const handleVisibilityChange = () => {
      if (document.hidden && pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // Only depend on userLoaded and threadId - fetchMessages is stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoaded, localUser, threadId]);

  // Show loading state while user profile loads
  if (!userLoaded) {
    return (
      <div className="dm-page loading">
        <div className="loading-message">
          Loading your profile...
        </div>
      </div>
    );
  }

  // Show error if user didn't load properly
  if (userLoaded && !localUser) {
    return (
      <div className="dm-page error">
        <div className="error-message">
          {error || 'Could not load your profile. Please rejoin the event.'}
        </div>
      </div>
    );
  }

  if (!thread || !otherParticipant) {
    return (
      <div className="dm-page error">
        <div className="error-message">
          Conversation not found or you don't have permission to view it.
        </div>
      </div>
    );
  }

  return (
    <div className="dm-page">
      <div className="dm-header">
        <div className="participant-info">
          {otherParticipant.avatar && otherParticipant.avatar.startsWith('http') ? (
            <img
              src={otherParticipant.avatar}
              alt={otherParticipant.name}
              className="participant-avatar"
              onError={(e) => {
                // Fallback to emoji if image fails to load
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="participant-avatar-emoji">
              {otherParticipant.avatar || '👤'}
            </div>
          )}
          <div className="participant-details">
            <h2 className="participant-name">{otherParticipant.name}</h2>
            <span className="conversation-status">
              {messageCount}/{messageLimit} messages used
              {remaining > 0 && (
                <span className="remaining-count"> • {remaining} remaining</span>
              )}
              {remaining === 0 && (
                <span className="limit-reached"> • Limit reached!</span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={() => router.back()}
          className="back-button"
        >
          ← Back
        </button>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="messages-container">
        <div className="messages-list">
          {loading && messages.length === 0 && (
            <div className="loading-message">Loading messages...</div>
          )}
          
          {messages.length === 0 && !loading && (
            <div className="empty-messages">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.senderId === currentUser.id ? 'own-message' : 'other-message'}`}
            >
              <div className="message-content">
                <div className="message-header">
                  <span className="sender-name">
                    {message.senderId === currentUser.id ? 'You' : message.senderName}
                  </span>
                  <span className="message-time">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="message-text">{message.content}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="message-input-container">
        {remaining > 0 ? (
          <div className="message-input">
            <input
              type="text"
              placeholder={`Message ${otherParticipant.name}...`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              disabled={loading}
              className="message-text-input"
            />
            <button
              onClick={handleSendMessage}
              disabled={loading || !messageInput.trim()}
              className="send-button"
            >
              Send
            </button>
          </div>
        ) : (
          <div className="message-limit-reached">
            <p>💬 You've reached the {messageLimit} message limit for this conversation.</p>
            <p className="limit-hint">Exchange contact info to continue chatting outside the app!</p>
          </div>
        )}
      </div>

      <style>{`
        .dm-page {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          max-width: 800px;
          margin: 0 auto;
          background-color: #f9fafb;
        }

        .dm-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e1e8ed;
          background-color: #f8f9fa;
        }

        .participant-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .participant-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
        }

        .participant-avatar-emoji {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background-color: #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }

        .participant-details {
          display: flex;
          flex-direction: column;
        }

        .participant-name {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
        }

        .conversation-status {
          font-size: 14px;
          color: #657786;
        }

        .remaining-count {
          color: #059669;
          font-weight: 500;
        }

        .limit-reached {
          color: #dc2626;
          font-weight: 600;
        }

        .back-button {
          padding: 8px 16px;
          background-color: #1da1f2;
          color: white;
          border: none;
          border-radius: 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }

        .back-button:hover {
          background-color: #1991db;
        }

        .error-banner {
          background-color: #ffebee;
          color: #c62828;
          padding: 12px 20px;
          border-left: 4px solid #f44336;
          margin: 0;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background-color: #ffffff;
        }

        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message {
          display: flex;
          max-width: 70%;
        }

        .own-message {
          align-self: flex-end;
        }

        .own-message .message-content {
          background-color: #3b82f6;
          color: white;
          border-radius: 16px 16px 4px 16px;
        }

        .other-message {
          align-self: flex-start;
        }

        .other-message .message-content {
          background-color: #f3f4f6;
          color: #111827;
          border-radius: 16px 16px 16px 4px;
        }

        .message-content {
          padding: 12px 16px;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }

        .message-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          gap: 12px;
        }

        .sender-name {
          font-size: 12px;
          font-weight: 600;
          opacity: 0.8;
        }

        .message-time {
          font-size: 11px;
          opacity: 0.6;
        }

        .message-text {
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
        }

        .empty-messages {
          text-align: center;
          padding: 60px 20px;
          color: #6b7280;
        }

        .message-input {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .message-text-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .message-text-input:focus {
          border-color: #3b82f6;
        }

        .send-button {
          padding: 12px 24px;
          background-color: #3b82f6;
          color: white;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background-color 0.2s;
        }

        .send-button:hover:not(:disabled) {
          background-color: #2563eb;
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .message-input-container {
          border-top: 1px solid #e1e8ed;
          padding: 20px;
          background-color: #f8f9fa;
        }

        .message-limit-reached {
          text-align: center;
          padding: 20px;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #f59e0b;
          border-radius: 12px;
        }

        .message-limit-reached p {
          margin: 0;
          color: #92400e;
          font-size: 15px;
          font-weight: 500;
        }

        .limit-hint {
          margin-top: 8px !important;
          font-size: 13px !important;
          font-weight: 400 !important;
          color: #78350f;
        }

        .dm-page.error,
        .dm-page.loading {
          justify-content: center;
          align-items: center;
          background-color: #f9fafb;
        }

        .error-message,
        .loading-message {
          text-align: center;
          max-width: 400px;
          padding: 40px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }

        .error-message {
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .loading-message {
          color: #1e40af;
          border: 1px solid #dbeafe;
        }

        .error-message::before {
          content: '⚠️';
          display: block;
          font-size: 48px;
          margin-bottom: 16px;
        }

        .loading-message::before {
          content: '⏳';
          display: block;
          font-size: 48px;
          margin-bottom: 16px;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @media (max-width: 768px) {
          .dm-page {
            height: 100vh;
          }

          .dm-header {
            padding: 15px;
          }

          .participant-name {
            font-size: 16px;
          }

          .messages-container {
            padding: 15px;
          }

          .message-input-container {
            padding: 15px;
          }
        }
      `}</style>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { threadId } = context.query;

  // For now, return minimal props and let client-side fetch handle it
  // We'll need user info from localStorage on client side
  return {
    props: {
      initialMessages: [],
      thread: {
        id: threadId as string,
        participants: [], // Will be populated client-side
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      user: {
        id: 'temp',
        name: 'Loading...',
        isSubscribed: false,
      },
      token: (context.query.token as string) || '',
    },
  };
};

export default DMPage;