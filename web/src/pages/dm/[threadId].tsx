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

  // Load user from localStorage
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
            isSubscribed: false,
          });
        } catch (err) {
          console.error('Error parsing user profile:', err);
        }
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
    try {
      const response = await fetch(`/api/dm-threads/${threadId}/messages`, {
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
      setError('');
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    }
  }, [threadId, token, router]);

  const sendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    if (!content.trim()) return;

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
          content,
          type,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const sentMessage = await response.json();
      
      // Replace temp message with real message
      setMessages(prev => 
        prev.map(msg => msg.id === tempId ? sentMessage : msg)
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
    const startPolling = () => {
      const interval = setInterval(() => {
        fetchMessages();
      }, 3000); // Poll every 3 seconds

      setPollingInterval(interval);
    };

    // Initial fetch
    if (messages.length === 0) {
      fetchMessages();
    }

    // Start polling
    startPolling();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [fetchMessages, messages.length, pollingInterval]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

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
            fetchMessages();
          }, 3000);
          setPollingInterval(interval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollingInterval, fetchMessages]);

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
          {otherParticipant.avatar && (
            <img 
              src={otherParticipant.avatar} 
              alt={otherParticipant.name}
              className="participant-avatar"
            />
          )}
          <div className="participant-details">
            <h2 className="participant-name">{otherParticipant.name}</h2>
            <span className="conversation-status">
              {messages.length} messages
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
        {currentUser.isSubscribed ? (
          <div className="message-input">
            <input
              type="text"
              placeholder={`Message ${otherParticipant.name}...`}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
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
          <div className="subscription-gate">
            <p>Subscribe to PrivatePartyy to send direct messages</p>
            <button 
              onClick={() => router.push('/subscribe')}
              className="subscribe-button"
            >
              Subscribe Now
            </button>
          </div>
        )}
      </div>

      <style>{`
        .dm-page {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 800px;
          margin: 0 auto;
          background-color: #fff;
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

        .message-input-container {
          border-top: 1px solid #e1e8ed;
          padding: 20px;
          background-color: #f8f9fa;
        }

        .subscription-gate {
          text-align: center;
          padding: 20px;
          background-color: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
        }

        .subscription-gate p {
          margin: 0 0 15px 0;
          color: #856404;
          font-size: 16px;
        }

        .subscribe-button {
          padding: 12px 24px;
          background-color: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
        }

        .subscribe-button:hover {
          background-color: #218838;
        }

        .dm-page.error {
          justify-content: center;
          align-items: center;
        }

        .error-message {
          text-align: center;
          color: #657786;
          font-size: 16px;
          padding: 40px;
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