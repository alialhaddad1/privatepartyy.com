import { GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import ProfileSummary from '../../components/ProfileSummary';
import Header from '../../components/Header';

interface UserProfile {
  id: string;
  username: string;
  initials: string;
  avatar?: string;
  generation: string;
  socials?: {
    instagram?: string;
    twitter?: string;
    snapchat?: string;
  };
  isSubscribed?: boolean;
}

interface UserPost {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes: number;
  comments: number;
}

interface ProfilePageProps {
  user: UserProfile;
  initialPosts: UserPost[];
  error?: string;
}

const UserPostsList: React.FC<{ posts: UserPost[] }> = ({ posts }) => {
  if (posts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No posts yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div key={post.id} className="bg-white rounded-lg shadow p-4">
          {post.imageUrl && (
            <img 
              src={post.imageUrl} 
              alt="Post" 
              className="w-full h-48 object-cover rounded-lg mb-3"
            />
          )}
          <p className="text-gray-800 mb-2">{post.content}</p>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{new Date(post.createdAt).toLocaleDateString()}</span>
            <div className="flex space-x-4">
              <span>{post.likes} likes</span>
              <span>{post.comments} comments</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user, initialPosts, error }) => {
  const [posts, setPosts] = useState<UserPost[]>(initialPosts || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user?.id) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/users/${user.id}/posts`);
        if (response.ok) {
          const postsData = await response.json();
          setPosts(postsData);
        }
      } catch (err) {
        console.error('Error fetching posts:', err);
      } finally {
        setLoading(false);
      }
    };

    if (initialPosts.length === 0) {
      fetchPosts();
    }
  }, [user?.id, initialPosts.length]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-gray-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="mb-4">
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.username}
                  className="w-20 h-20 rounded-full mx-auto object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center mx-auto">
                  <span className="text-white text-2xl font-bold">{user.initials}</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{user.username}</h1>
            <p className="text-gray-600">{user.generation}</p>
          </div>
        </div>

        {user.isSubscribed && user.socials && (
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Social Links</h3>
            <div className="space-y-2">
              {user.socials.instagram && (
                <a 
                  href={`https://instagram.com/${user.socials.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-pink-600 hover:text-pink-700"
                >
                  <span className="mr-2">📷</span>
                  @{user.socials.instagram}
                </a>
              )}
              {user.socials.twitter && (
                <a 
                  href={`https://twitter.com/${user.socials.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-blue-600 hover:text-blue-700"
                >
                  <span className="mr-2">🐦</span>
                  @{user.socials.twitter}
                </a>
              )}
              {user.socials.snapchat && (
                <a 
                  href={`https://snapchat.com/add/${user.socials.snapchat}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-yellow-600 hover:text-yellow-700"
                >
                  <span className="mr-2">👻</span>
                  {user.socials.snapchat}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">Posts</h2>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading posts...</p>
              </div>
            ) : (
              <UserPostsList posts={posts} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;
  
  try {
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/${id}`);
    
    if (!userResponse.ok) {
      return {
        props: {
          user: null,
          initialPosts: [],
          error: 'User not found'
        }
      };
    }

    const user = await userResponse.json();
    
    // Try to fetch initial posts
    let initialPosts = [];
    try {
      const postsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/users/${id}/posts`);
      if (postsResponse.ok) {
        initialPosts = await postsResponse.json();
      }
    } catch (err) {
      console.error('Error fetching initial posts:', err);
    }
    
    return {
      props: {
        user,
        initialPosts
      }
    };
  } catch (error) {
    return {
      props: {
        user: null,
        initialPosts: [],
        error: 'Error fetching user data'
      }
    };
  }
};

export default ProfilePage;