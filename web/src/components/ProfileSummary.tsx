import React from 'react';

interface SocialLink {
  platform: string;
  url: string;
  icon: string;
}

interface Profile {
  id: string;
  name: string;
  avatar?: string;
  generation?: string;
  bio?: string;
  socialLinks?: SocialLink[];
}

interface ProfileSummaryProps {
  profile: Profile;
  showSocialLinks?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ProfileSummary: React.FC<ProfileSummaryProps> = ({ 
  profile, 
  showSocialLinks = false, 
  size = 'md' 
}) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const sizeClasses = {
    sm: {
      avatar: 'w-12 h-12',
      text: 'text-sm',
      name: 'text-base font-medium',
      generation: 'text-xs',
      initials: 'text-sm'
    },
    md: {
      avatar: 'w-16 h-16',
      text: 'text-base',
      name: 'text-lg font-semibold',
      generation: 'text-sm',
      initials: 'text-lg'
    },
    lg: {
      avatar: 'w-24 h-24',
      text: 'text-lg',
      name: 'text-xl font-bold',
      generation: 'text-base',
      initials: 'text-2xl'
    }
  };

  const getSocialIcon = (platform: string) => {
    const icons: { [key: string]: string } = {
      twitter: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z',
      linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 2a2 2 0 11-4 0 2 2 0 014 0z',
      instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
      github: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'
    };
    return icons[platform.toLowerCase()] || '';
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {profile.avatar ? (
          <img
            src={profile.avatar}
            alt={profile.name}
            className={`${sizeClasses[size].avatar} rounded-full object-cover`}
          />
        ) : (
          <div className={`${sizeClasses[size].avatar} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center`}>
            <span className={`${sizeClasses[size].initials} font-bold text-white`}>
              {getInitials(profile.name)}
            </span>
          </div>
        )}
      </div>

      {/* Profile Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h3 className={`${sizeClasses[size].name} text-gray-900 truncate`}>
            {profile.name}
          </h3>
          {profile.generation && (
            <span className={`${sizeClasses[size].generation} text-gray-500 bg-gray-100 px-2 py-1 rounded-full`}>
              {profile.generation}
            </span>
          )}
        </div>
        
        {profile.bio && (
          <p className={`${sizeClasses[size].text} text-gray-600 mt-1 line-clamp-2`}>
            {profile.bio}
          </p>
        )}

        {/* Social Links */}
        {showSocialLinks && profile.socialLinks && profile.socialLinks.length > 0 && (
          <div className="flex items-center space-x-3 mt-2">
            {profile.socialLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                title={`${profile.name} on ${link.platform}`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d={getSocialIcon(link.platform)} />
                </svg>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileSummary;