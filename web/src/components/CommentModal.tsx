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
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Comments</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No comments yet</div>
          ) : (
            <div className="space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    {comment.author.avatar ? (
                      <img 
                        src={comment.author.avatar} 
                        alt={comment.author.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        {comment.author.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm">{comment.author.name}</span>
                      <span className="text-xs text-gray-500">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment Form */}
        {token && user && (
          <div className="p-4 border-t">
            <form onSubmit={handleSubmitComment} className="flex space-x-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed self-end"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentModal;