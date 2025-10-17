import React, { useState, useEffect } from 'react';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  avatar?: string;
}

interface CommentModalProps {
  postId: string;
  token?: string;
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const CommentModal: React.FC<CommentModalProps> = ({ postId, token, isOpen, onClose, user }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && postId) {
      fetchComments();
    }
  }, [isOpen, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        headers: {
          ...(token && { Authorization: `Bearer ${token}` })
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Map API response to Comment interface
        const mappedComments = (data.comments || []).map((c: any) => ({
          id: c.id,
          content: c.content,
          author: {
            id: c.authorId,
            name: c.authorName,
            avatar: c.authorAvatar
          },
          createdAt: c.createdAt
        }));
        setComments(mappedComments);
      }
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim() || !token || !user) return;

    setSubmitting(true);

    // Optimistic update
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      content: newComment.trim(),
      author: {
        id: user.id,
        name: user.name,
        avatar: user.avatar
      },
      createdAt: new Date().toISOString()
    };

    setComments(prev => [...prev, optimisticComment]);
    setNewComment('');

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          content: optimisticComment.content,
          authorId: user.id,
          authorName: user.name,
          authorAvatar: user.avatar || '👤'
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Map the response to Comment interface
        const newCommentData: Comment = {
          id: data.comment.id,
          content: data.comment.content,
          author: {
            id: data.comment.authorId,
            name: data.comment.authorName,
            avatar: data.comment.authorAvatar
          },
          createdAt: data.comment.createdAt
        };
        // Replace optimistic comment with real data
        setComments(prev =>
          prev.map(comment =>
            comment.id === optimisticComment.id ? newCommentData : comment
          )
        );
      } else {
        // Remove optimistic comment on failure
        setComments(prev => prev.filter(comment => comment.id !== optimisticComment.id));
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
      // Remove optimistic comment on error
      setComments(prev => prev.filter(comment => comment.id !== optimisticComment.id));
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    if (diffWeeks < 4) return `${diffWeeks}w`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="comment-modal-overlay" onClick={onClose}>
        <div className="comment-modal-container" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="comment-modal-header">
            <h2 className="comment-modal-title">Comments</h2>
            <button
              onClick={onClose}
              className="comment-modal-close"
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Comments List */}
          <div className="comment-modal-content">
            {loading ? (
              <div className="comment-loading">
                <div className="loading-spinner"></div>
              </div>
            ) : comments.length === 0 ? (
              <div className="comment-empty">
                <div className="empty-icon">💬</div>
                <p className="empty-text">No comments yet</p>
                <p className="empty-subtext">Be the first to comment</p>
              </div>
            ) : (
              <div className="comments-list">
                {comments.map(comment => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-avatar">
                      {comment.author.avatar ? (
                        <div className="avatar-wrapper">
                          <span className="avatar-emoji">{comment.author.avatar}</span>
                        </div>
                      ) : (
                        <div className="avatar-fallback">
                          <span>{comment.author.name.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                    </div>
                    <div className="comment-content">
                      <div className="comment-body">
                        <span className="comment-author">{comment.author.name}</span>
                        <span className="comment-text">{comment.content}</span>
                      </div>
                      <div className="comment-meta">
                        <span className="comment-time">{formatDate(comment.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comment Form */}
          {token && user ? (
            <div className="comment-modal-footer">
              <div className="comment-input-avatar">
                {user.avatar ? (
                  <div className="avatar-wrapper-small">
                    <span className="avatar-emoji-small">{user.avatar}</span>
                  </div>
                ) : (
                  <div className="avatar-fallback-small">
                    <span>{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </div>
              <form onSubmit={handleSubmitComment} className="comment-input-form">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="comment-input"
                  disabled={submitting}
                  maxLength={500}
                />
                {newComment.trim() && (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="comment-submit"
                  >
                    {submitting ? 'Posting...' : 'Post'}
                  </button>
                )}
              </form>
            </div>
          ) : (
            <div className="comment-modal-footer-login">
              <p>Log in to comment</p>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .comment-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .comment-modal-container {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 500px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .comment-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid #efefef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .comment-modal-title {
          font-size: 16px;
          font-weight: 600;
          color: #000;
          margin: 0;
        }

        .comment-modal-close {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .comment-modal-close:hover {
          background-color: #f5f5f5;
        }

        .comment-modal-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px 0;
          min-height: 200px;
        }

        .comment-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #dbdbdb;
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .comment-empty {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 600;
          color: #262626;
          margin: 0 0 4px 0;
        }

        .empty-subtext {
          font-size: 14px;
          color: #8e8e8e;
          margin: 0;
        }

        .comments-list {
          padding: 0;
        }

        .comment-item {
          display: flex;
          padding: 12px 20px;
          gap: 12px;
          transition: background-color 0.15s;
        }

        .comment-item:hover {
          background-color: #fafafa;
        }

        .comment-avatar {
          flex-shrink: 0;
        }

        .avatar-wrapper, .avatar-fallback {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .avatar-wrapper {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .avatar-emoji {
          font-size: 18px;
        }

        .avatar-fallback {
          background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);
          font-size: 14px;
          font-weight: 600;
          color: white;
        }

        .comment-content {
          flex: 1;
          min-width: 0;
        }

        .comment-body {
          margin-bottom: 4px;
          line-height: 18px;
        }

        .comment-author {
          font-weight: 600;
          font-size: 14px;
          color: #262626;
          margin-right: 6px;
        }

        .comment-text {
          font-size: 14px;
          color: #262626;
          word-wrap: break-word;
        }

        .comment-meta {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .comment-time {
          font-size: 12px;
          color: #8e8e8e;
        }

        .comment-modal-footer {
          padding: 16px 20px;
          border-top: 1px solid #efefef;
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .comment-modal-footer-login {
          padding: 16px 20px;
          border-top: 1px solid #efefef;
          text-align: center;
          color: #8e8e8e;
          font-size: 14px;
        }

        .comment-input-avatar {
          flex-shrink: 0;
        }

        .avatar-wrapper-small, .avatar-fallback-small {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .avatar-wrapper-small {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .avatar-emoji-small {
          font-size: 16px;
        }

        .avatar-fallback-small {
          background: linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%);
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .comment-input-form {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .comment-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
          color: #262626;
          padding: 0;
          background: transparent;
        }

        .comment-input::placeholder {
          color: #8e8e8e;
        }

        .comment-input:disabled {
          opacity: 0.5;
        }

        .comment-submit {
          background: none;
          border: none;
          color: #0095f6;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          transition: opacity 0.2s;
        }

        .comment-submit:hover:not(:disabled) {
          opacity: 0.7;
        }

        .comment-submit:disabled {
          opacity: 0.3;
          cursor: default;
        }

        @media (max-width: 640px) {
          .comment-modal-container {
            max-width: 100%;
            max-height: 90vh;
            border-radius: 12px 12px 0 0;
          }
        }
      `}</style>
    </>
  );
};

export default CommentModal;