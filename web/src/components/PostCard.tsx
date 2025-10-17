import React, { useState } from 'react';
import CommentModal from './CommentModal';

interface Post {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  likes: number;
  isLiked: boolean;
  comments: number;
  media?: {
    type: 'image' | 'video';
    url: string;
  }[];
}

interface User {
  id: string;
  name: string;
  avatar?: string;
}

interface PostCardProps {
  post: Post;
  token?: string;
  onLike: () => void;
  user?: User | null;
}

const PostCard: React.FC<PostCardProps> = ({ post, token, onLike, user = null }) => {
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return diffMins < 1 ? 'now' : `${diffMins}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else if (diffDays < 7) {
      return `${diffDays}d`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-4 flex items-center space-x-3">
          <div className="flex-shrink-0">
            {post.author.avatar ? (
              <img
                src={post.author.avatar}
                alt={post.author.name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-700">
                  {post.author.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{post.author.name}</h3>
            <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
          </div>
        </div>

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className="relative">
            {post.media[0].type === 'image' ? (
              <img
                src={post.media[0].url}
                alt="Post content"
                className="w-full h-auto object-cover max-h-96"
              />
            ) : (
              <video
                src={post.media[0].url}
                controls
                className="w-full h-auto object-cover max-h-96"
              />
            )}
          </div>
        )}

        {/* Content */}
        {post.content && (
          <div className="p-4 pt-3">
            <p className="text-gray-900 whitespace-pre-wrap">{post.content}</p>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Like Button */}
              <button
                onClick={onLike}
                disabled={!token}
                className={`flex items-center space-x-1 ${
                  post.isLiked 
                    ? 'text-red-500' 
                    : 'text-gray-500 hover:text-red-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <svg
                  className="w-6 h-6"
                  fill={post.isLiked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <span className="text-sm font-medium">{post.likes}</span>
              </button>

              {/* Comment Button */}
              <button
                onClick={() => setIsCommentModalOpen(true)}
                className="flex items-center space-x-1 text-gray-500 hover:text-blue-500"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span className="text-sm font-medium">{post.comments}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment Modal */}
      <CommentModal
        postId={post.id}
        token={token}
        isOpen={isCommentModalOpen}
        onClose={() => setIsCommentModalOpen(false)}
        user={user}
      />
    </>
  );
};

export default PostCard;