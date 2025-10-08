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

const AccountPage: React.FC = () => {
  const router = useRouter();
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (profile) {
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
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
        bio: bio
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
    setIsEditing(false);
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
                  <label>Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
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
        .form-group textarea {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          outline: none;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: #667eea;
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
        }
      `}</style>
    </div>
  );
};

export default AccountPage;
