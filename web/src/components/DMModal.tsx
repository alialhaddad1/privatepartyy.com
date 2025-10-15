import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  createdAt: string;
}

interface DMModalProps {
  isOpen: boolean;
  onClose: () => void;
  threadId: string;
  currentUser: {
    id: string;
    name: string;
    avatar: string;
  };
  otherUser: {
    id: string;
    name: string;
    avatar: string;
  };
  eventId: string;
}

const MESSAGE_LIMIT = 10;

const DMModal: React.FC<DMModalProps> = ({
  isOpen,
  onClose,
  threadId,
  currentUser,
  otherUser,
  eventId
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [remaining, setRemaining] = useState(MESSAGE_LIMIT);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && threadId) {
      fetchMessages();
    }
  }, [isOpen, threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/dm-threads/${threadId}/messages?userId=${currentUser.id}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setMessageCount(data.messageCount || 0);
      setRemaining(data.remaining || 0);
      setError('');
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    if (remaining <= 0) {
      setError(`You've reached the ${MESSAGE_LIMIT} message limit. Exchange contact info!`);
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await fetch(`/api/dm-threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderId: currentUser.id,
          senderName: currentUser.name,
          senderAvatar: currentUser.avatar,
          content: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to send message');
      }

      const data = await response.json();

      // Add new message to list
      setMessages([...messages, data.message]);
      setMessageCount(data.messageCount);
      setRemaining(data.remaining);
      setNewMessage('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="dm-modal-overlay" onClick={onClose} />
      <div className="dm-modal">
        <div className="dm-modal-header">
          <div className="dm-modal-user-info">
            <div className="dm-modal-avatar">{otherUser.avatar}</div>
            <div className="dm-modal-user-details">
              <h3>{otherUser.name}</h3>
              <p className="dm-limit-text">
                {remaining > 0 ? (
                  <>
                    {remaining} of {MESSAGE_LIMIT} messages remaining
                  </>
                ) : (
                  <span className="limit-reached">Message limit reached!</span>
                )}
              </p>
            </div>
          </div>
          <button className="dm-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {remaining <= 3 && remaining > 0 && (
          <div className="dm-warning">
            ⚠️ Only {remaining} messages left! Meet in real life or exchange contact info before the limit runs out.
          </div>
        )}

        {remaining === 0 && (
          <div className="dm-limit-reached-banner">
            🎉 You've used all {MESSAGE_LIMIT} messages! Time to meet in person or exchange contact info. These messages will be deleted at the end of the night.
          </div>
        )}

        <div className="dm-messages-container">
          {loading ? (
            <div className="dm-loading">
              <div className="spinner"></div>
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="dm-empty">
              <p>No messages yet. Say hi! 👋</p>
              <p className="dm-reminder">
                Remember: You have {MESSAGE_LIMIT} messages to break the ice and exchange info before this chat disappears!
              </p>
            </div>
          ) : (
            <div className="dm-messages-list">
              {messages.map((msg) => {
                const isMine = msg.senderId === currentUser.id;
                return (
                  <div
                    key={msg.id}
                    className={`dm-message ${isMine ? 'dm-message-mine' : 'dm-message-theirs'}`}
                  >
                    <div className="dm-message-bubble">
                      <p className="dm-message-content">{msg.content}</p>
                      <span className="dm-message-time">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {error && (
          <div className="dm-error">
            {error}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="dm-input-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              remaining > 0
                ? `Message ${otherUser.name}...`
                : 'Message limit reached'
            }
            disabled={sending || remaining <= 0}
            className="dm-input"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim() || remaining <= 0}
            className="dm-send-button"
          >
            {sending ? '...' : '➤'}
          </button>
        </form>

        <style jsx>{`
          .dm-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 999;
          }

          .dm-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 500px;
            height: 600px;
            max-height: 80vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            display: flex;
            flex-direction: column;
          }

          .dm-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            border-bottom: 1px solid #e1e8ed;
          }

          .dm-modal-user-info {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .dm-modal-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
          }

          .dm-modal-user-details h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
          }

          .dm-limit-text {
            margin: 2px 0 0 0;
            font-size: 12px;
            color: #657786;
          }

          .limit-reached {
            color: #e0245e;
            font-weight: 600;
          }

          .dm-modal-close {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #f0f2f5;
            border: none;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #657786;
            transition: background 0.2s;
          }

          .dm-modal-close:hover {
            background: #e1e8ed;
          }

          .dm-warning {
            padding: 12px 20px;
            background: #fff3cd;
            border-bottom: 1px solid #ffc107;
            color: #856404;
            font-size: 13px;
            font-weight: 500;
            text-align: center;
          }

          .dm-limit-reached-banner {
            padding: 12px 20px;
            background: #d4edda;
            border-bottom: 1px solid #28a745;
            color: #155724;
            font-size: 13px;
            font-weight: 500;
            text-align: center;
          }

          .dm-messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            background: #f8f9fa;
          }

          .dm-loading,
          .dm-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #657786;
            text-align: center;
            padding: 20px;
          }

          .dm-empty p {
            margin: 8px 0;
          }

          .dm-reminder {
            font-size: 12px;
            color: #657786;
            max-width: 300px;
            line-height: 1.4;
          }

          .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #e1e8ed;
            border-top: 3px solid #1da1f2;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 12px;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .dm-messages-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .dm-message {
            display: flex;
            width: 100%;
          }

          .dm-message-mine {
            justify-content: flex-end;
          }

          .dm-message-theirs {
            justify-content: flex-start;
          }

          .dm-message-bubble {
            max-width: 75%;
            padding: 10px 14px;
            border-radius: 16px;
            position: relative;
          }

          .dm-message-mine .dm-message-bubble {
            background: #1da1f2;
            color: white;
            border-bottom-right-radius: 4px;
          }

          .dm-message-theirs .dm-message-bubble {
            background: white;
            color: #1a1a1a;
            border-bottom-left-radius: 4px;
            border: 1px solid #e1e8ed;
          }

          .dm-message-content {
            margin: 0 0 4px 0;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
          }

          .dm-message-time {
            font-size: 11px;
            opacity: 0.7;
          }

          .dm-error {
            padding: 12px 20px;
            background: #f8d7da;
            color: #721c24;
            font-size: 13px;
            text-align: center;
            border-top: 1px solid #f5c6cb;
          }

          .dm-input-form {
            display: flex;
            gap: 8px;
            padding: 16px 20px;
            border-top: 1px solid #e1e8ed;
            background: white;
          }

          .dm-input {
            flex: 1;
            padding: 10px 14px;
            border: 1px solid #e1e8ed;
            border-radius: 20px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s;
          }

          .dm-input:focus {
            border-color: #1da1f2;
          }

          .dm-input:disabled {
            background: #f0f2f5;
            cursor: not-allowed;
          }

          .dm-send-button {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #1da1f2;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
          }

          .dm-send-button:hover:not(:disabled) {
            background: #1991db;
          }

          .dm-send-button:disabled {
            background: #ccc;
            cursor: not-allowed;
          }

          @media (max-width: 600px) {
            .dm-modal {
              width: 100%;
              height: 100%;
              max-height: 100vh;
              border-radius: 0;
            }
          }
        `}</style>
      </div>
    </>
  );
};

export default DMModal;
