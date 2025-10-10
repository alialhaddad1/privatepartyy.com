import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  isPublic: boolean;
}

const AVATAR_OPTIONS = [
  '😊', '😎', '🎉', '🎨', '🎵', '⚡', '🌟', '🔥',
  '💜', '💙', '💚', '🧡', '🎭', '🎪', '🎯', '✨'
];

const GENERATIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'gen-alpha', label: 'Gen Alpha (2013-present)' },
  { value: 'gen-z', label: 'Gen Z (1997-2012)' },
  { value: 'millennial', label: 'Millennial (1981-1996)' },
  { value: 'gen-x', label: 'Gen X (1965-1980)' },
  { value: 'boomer', label: 'Boomer (1946-1964)' },
  { value: 'silent', label: 'Silent Gen (1928-1945)' },
];

const AccountPage: React.FC = () => {
  const router = useRouter();
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [generation, setGeneration] = useState('');
  const [saving, setSaving] = useState(false);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showFullAppModal, setShowFullAppModal] = useState(false);
  const [attemptedAdvancedEdit, setAttemptedAdvancedEdit] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
      setGeneration(profile.generation || '');
    }
  }, [user, profile, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchMyEvents();
      fetchAttendingEvents();
    }
  }, [user]);

  const fetchMyEvents = async () => {
    try {
      const response = await fetch(`/api/events?hostId=${user?.id}`);
      if (response.ok) {
        const data = await response.json();
        setMyEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching my events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchAttendingEvents = async () => {
    try {
      // This will need a new API endpoint
      const response = await fetch('/api/events/attending');
      if (response.ok) {
        const data = await response.json();
        setAttendingEvents(data.events || []);
      }
    } catch (error) {
      console.error('Error fetching attending events:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        display_name: displayName,
        bio: bio,
        avatar_url: avatarUrl,
        generation: generation
      });

      if (error) {
        alert('Failed to update profile');
      } else {
        setIsEditing(false);
      }
    } catch (error) {
      alert('An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(profile?.display_name || '');
    setBio(profile?.bio || '');
    setAvatarUrl(profile?.avatar_url || '');
    setGeneration(profile?.generation || '');
    setIsEditing(false);
  };

  const handleAdvancedFieldClick = () => {
    setAttemptedAdvancedEdit(true);
    setShowFullAppModal(true);
  };

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className="account-page">
      <Head>
        <title>My Account - PrivatePartyy</title>
      </Head>

      <Header activePage="account" />

      <div className="container">
        <div className="profile-section">
          <h1>My Account</h1>

          <div className="profile-card">
            <div className="profile-header">
              <div className="avatar">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.display_name} />
                ) : (
                  <div className="avatar-placeholder">
                    {(profile.display_name || profile.email)[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="profile-info">
                <p className="email">{profile.email}</p>
                <p className="user-id">User ID: {user.id.substring(0, 8)}...</p>
              </div>
            </div>

            {isEditing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="form-group">
                  <label>Avatar</label>
                  <div className="avatar-grid">
                    {AVATAR_OPTIONS.map((avatar) => (
                      <button
                        key={avatar}
                        type="button"
                        onClick={() => setAvatarUrl(avatar)}
                        className={`avatar-option ${avatarUrl === avatar ? 'selected' : ''}`}
                      >
                        {avatar}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Generation</label>
                  <select
                    value={generation}
                    onChange={(e) => setGeneration(e.target.value)}
                  >
                    {GENERATIONS.map((gen) => (
                      <option key={gen.value} value={gen.value}>
                        {gen.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
                </div>

                <div className="advanced-section">
                  <h3>Additional Details</h3>
                  <p className="hint-text">Want to add more personal details like interests, website, or social links?</p>
                  <button
                    type="button"
                    onClick={handleAdvancedFieldClick}
                    className="access-app-btn"
                  >
                    Access Full App Features
                  </button>
                </div>

                <div className="form-actions">
                  <button onClick={handleSave} disabled={saving} className="save-btn">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={handleCancel} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="profile-display">
                <div className="field">
                  <label>Display Name</label>
                  <p>{profile.display_name || 'Not set'}</p>
                </div>

                <div className="field">
                  <label>Generation</label>
                  <p>{GENERATIONS.find(g => g.value === profile.generation)?.label || 'Not set'}</p>
                </div>

                <div className="field">
                  <label>Bio</label>
                  <p>{profile.bio || 'No bio added'}</p>
                </div>

                <button onClick={() => setIsEditing(true)} className="edit-btn">
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="events-section">
          <h2>My Events</h2>
          {loadingEvents ? (
            <div className="loading-state">Loading events...</div>
          ) : myEvents.length === 0 ? (
            <div className="empty-state">
              <p>You haven't created any events yet</p>
              <button onClick={() => router.push('/')} className="create-btn">
                Create Your First Event
              </button>
            </div>
          ) : (
            <div className="events-grid">
              {myEvents.map((event) => (
                <div
                  key={event.id}
                  className="event-card"
                  onClick={() => router.push(`/event/${event.id}`)}
                >
                  <h3>{event.title}</h3>
                  <p className="event-date">
                    📅 {event.date} at {event.time}
                  </p>
                  {event.location && <p className="event-location">📍 {event.location}</p>}
                  <span className={`badge ${event.isPublic ? 'public' : 'private'}`}>
                    {event.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="events-section">
          <h2>Events I'm Attending</h2>
          {attendingEvents.length === 0 ? (
            <div className="empty-state">
              <p>You're not attending any events yet</p>
              <button onClick={() => router.push('/events')} className="browse-btn">
                Browse Events
              </button>
            </div>
          ) : (
            <div className="events-grid">
              {attendingEvents.map((event) => (
                <div
                  key={event.id}
                  className="event-card"
                  onClick={() => router.push(`/event/${event.id}`)}
                >
                  <h3>{event.title}</h3>
                  <p className="event-date">
                    📅 {event.date} at {event.time}
                  </p>
                  {event.location && <p className="event-location">📍 {event.location}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Access Full App Modal */}
      {showFullAppModal && (
        <div className="modal-overlay" onClick={() => setShowFullAppModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowFullAppModal(false)}>
              ×
            </button>
            <div className="modal-icon">🎉</div>
            <h2>Access Full App</h2>
            <p className="modal-text">
              Additional profile features are part of our premium experience.
              This feature will be available soon as we continue to build out PrivatePartyy!
            </p>
            <button onClick={() => setShowFullAppModal(false)} className="modal-btn">
              Got it
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .account-page {
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .profile-section h1 {
          font-size: 32px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 24px;
        }

        .profile-card {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 40px;
        }

        .profile-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 30px;
          border-bottom: 1px solid #e1e8ed;
        }

        .avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          overflow: hidden;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          color: white;
        }

        .profile-info {
          flex: 1;
        }

        .email {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 5px 0;
        }

        .user-id {
          font-size: 14px;
          color: #657786;
          margin: 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #4a4a4a;
          margin-bottom: 8px;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          outline: none;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          border-color: #667eea;
        }

        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
          margin-top: 8px;
        }

        .avatar-option {
          width: 100%;
          aspect-ratio: 1;
          font-size: 24px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-option:hover {
          border-color: #667eea;
          transform: scale(1.1);
        }

        .avatar-option.selected {
          border-color: #667eea;
          background: #e8ecff;
          transform: scale(1.1);
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }

        .advanced-section {
          margin-top: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 2px dashed #e1e8ed;
        }

        .advanced-section h3 {
          margin: 0 0 10px 0;
          font-size: 18px;
          color: #1a1a1a;
        }

        .hint-text {
          margin: 0 0 15px 0;
          font-size: 14px;
          color: #657786;
        }

        .access-app-btn {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          color: #667eea;
          background: white;
          border: 2px solid #667eea;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .access-app-btn:hover {
          background: #667eea;
          color: white;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .save-btn,
        .cancel-btn,
        .edit-btn,
        .create-btn,
        .browse-btn {
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .save-btn,
        .create-btn,
        .browse-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .save-btn:hover,
        .create-btn:hover,
        .browse-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .cancel-btn {
          background: #e1e8ed;
          color: #4a4a4a;
        }

        .cancel-btn:hover {
          background: #d1d8dd;
        }

        .save-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .field {
          margin-bottom: 20px;
        }

        .field label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #657786;
          margin-bottom: 5px;
        }

        .field p {
          font-size: 16px;
          color: #1a1a1a;
          margin: 0;
        }

        .edit-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-top: 10px;
        }

        .events-section {
          margin-bottom: 40px;
        }

        .events-section h2 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 20px;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }

        .event-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .event-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .event-card h3 {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .event-date,
        .event-location {
          font-size: 14px;
          color: #657786;
          margin: 6px 0;
        }

        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-top: 12px;
        }

        .badge.public {
          background-color: #e8f5e9;
          color: #2e7d32;
        }

        .badge.private {
          background-color: #fff3e0;
          color: #e65100;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: white;
          border-radius: 12px;
        }

        .empty-state p {
          font-size: 16px;
          color: #657786;
          margin: 0 0 20px 0;
        }

        .loading-state {
          text-align: center;
          padding: 40px;
          color: #657786;
        }

        .loading-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: #f8f9fa;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e1e8ed;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 20px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 40px;
          max-width: 450px;
          width: 100%;
          position: relative;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          text-align: center;
        }

        .modal-close {
          position: absolute;
          top: 15px;
          right: 15px;
          background: none;
          border: none;
          font-size: 32px;
          cursor: pointer;
          color: #657786;
          line-height: 1;
          padding: 5px;
          transition: color 0.2s;
        }

        .modal-close:hover {
          color: #1a1a1a;
        }

        .modal-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }

        .modal-content h2 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 15px 0;
        }

        .modal-text {
          font-size: 16px;
          color: #657786;
          line-height: 1.6;
          margin: 0 0 30px 0;
        }

        .modal-btn {
          padding: 14px 32px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .modal-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        @media (max-width: 768px) {
          .container {
            padding: 20px 15px;
          }

          .profile-header {
            flex-direction: column;
            text-align: center;
          }

          .events-grid {
            grid-template-columns: 1fr;
          }

          .form-actions {
            flex-direction: column;
          }

          .avatar-grid {
            grid-template-columns: repeat(6, 1fr);
          }

          .modal-content {
            padding: 30px 20px;
          }

          .modal-icon {
            font-size: 48px;
          }
        }

        @media (max-width: 480px) {
          .avatar-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default AccountPage;
