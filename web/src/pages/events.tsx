import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location?: string;
  maxAttendees?: number;
  currentAttendees?: number;
  isPublic: boolean;
  hostId: string;
  hostName?: string;
  tags?: string[];
  imageUrl?: string;
  token?: string;
  createdAt: string;
}

const EventsPage: React.FC = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [publicEvents, setPublicEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMyEvents();
    }
    fetchPublicEvents();
  }, [user]);

  const fetchMyEvents = async () => {
    try {
      // Fetch ALL events hosted by this user (both public and private)
      // Private events should only be visible when the user is logged in
      const response = await fetch(`/api/events?hostId=${user?.id}&limit=50&orderBy=date&order=asc`);
      if (response.ok) {
        const data = await response.json();
        setMyEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error fetching my events:', err);
    }
  };

  const fetchPublicEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events?isPublic=true&limit=50&orderBy=date&order=asc');

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setPublicEvents(data.events || []);
      setError('');
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMyEvents = myEvents.filter(event => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      event.title.toLowerCase().includes(search) ||
      event.description?.toLowerCase().includes(search) ||
      event.location?.toLowerCase().includes(search) ||
      event.tags?.some(tag => tag.toLowerCase().includes(search))
    );
  });

  const filteredPublicEvents = publicEvents.filter(event => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      event.title.toLowerCase().includes(search) ||
      event.description?.toLowerCase().includes(search) ||
      event.location?.toLowerCase().includes(search) ||
      event.tags?.some(tag => tag.toLowerCase().includes(search))
    );
  });

  const handleEventClick = (eventId: string) => {
    // Redirect to event page (users will need a token to view)
    router.push(`/event/${eventId}`);
  };

  const formatDate = (date: string, time: string) => {
    try {
      const eventDate = new Date(`${date}T${time}`);
      return eventDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return `${date} at ${time}`;
    }
  };

  const copyEventLink = async (eventId: string, token?: string) => {
    if (!token) return;

    const link = `${window.location.origin}/join/${eventId}?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedEventId(eventId);
      setTimeout(() => setCopiedEventId(null), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  return (
    <div className="events-page">
      <Head>
        <title>Public Events - PrivatePartyy</title>
        <meta name="description" content="Browse and join public events on PrivatePartyy" />
      </Head>

      <Header activePage="events" />

      <div className="container">
        {/* My Events Section - Show first if user is logged in and has events */}
        {user && filteredMyEvents.length > 0 && (
          <div className="section">
            <div className="section-header">
              <div className="header-content">
                <h1 className="section-title-large">My Events</h1>
                <p className="subtitle">Events you're hosting</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="create-event-btn"
              >
                <span className="btn-icon">🎉</span>
                Create Event
              </button>
            </div>
            <div className="events-grid">
              {filteredMyEvents.map((event: Event) => (
                <div
                  key={event.id}
                  className="event-card my-event"
                  onClick={() => handleEventClick(event.id)}
                >
                  {event.imageUrl && (
                    <div className="event-image">
                      <img src={event.imageUrl} alt={event.title} />
                    </div>
                  )}
                  <div className="event-content">
                    <div className="badges-container">
                      <div className="host-badge">Your Event</div>
                      {!event.isPublic && (
                        <div className="private-badge">🔒 Private</div>
                      )}
                    </div>
                    <h3 className="event-title">{event.title}</h3>

                    <div className="event-meta">
                      <div className="meta-item">
                        📅 {formatDate(event.date, event.time)}
                      </div>
                      {event.location && (
                        <div className="meta-item">
                          📍 {event.location}
                        </div>
                      )}
                      {event.maxAttendees && (
                        <div className="meta-item">
                          👥 {event.currentAttendees || 0} / {event.maxAttendees} attending
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="event-description">
                        {event.description.length > 150
                          ? `${event.description.substring(0, 150)}...`
                          : event.description}
                      </p>
                    )}

                    {event.tags && event.tags.length > 0 && (
                      <div className="event-tags">
                        {event.tags.map((tag: string, index: number) => (
                          <span key={index} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Public Events Section */}
        <div className={`section ${user && filteredMyEvents.length > 0 ? 'public-events-section' : ''}`}>
          <div className="section-header">
            <div className="header-content">
              <h1 className="section-title-large">Public Events</h1>
              <p className="subtitle">Discover and join exciting events happening around you</p>
            </div>
            {(!user || filteredMyEvents.length === 0) && (
              <button
                onClick={() => router.push('/')}
                className="create-event-btn"
              >
                <span className="btn-icon">🎉</span>
                Create Event
              </button>
            )}
          </div>

          <div className="search-section">
            <input
              type="text"
              placeholder="Search events by name, location, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
              <button onClick={fetchPublicEvents} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading events...</p>
            </div>
          ) : (
            <div className="events-grid">
              {filteredPublicEvents.length === 0 ? (
                <div className="empty-state">
                  <h3>{searchTerm ? 'No events match your search' : 'No public events available'}</h3>
                  <p>
                    {searchTerm
                      ? 'Try a different search term'
                      : 'Be the first to create a public event!'}
                  </p>
                  <button
                    onClick={() => router.push('/')}
                    className="create-event-button"
                  >
                    Create Event
                  </button>
                </div>
              ) : (
                filteredPublicEvents.map((event: Event) => (
                  <div
                    key={event.id}
                    className="event-card"
                  >
                    {event.imageUrl && (
                      <div className="event-image">
                        <img src={event.imageUrl} alt={event.title} />
                      </div>
                    )}
                    <div className="event-content">
                      <h3 className="event-title">{event.title}</h3>

                      <div className="event-meta">
                        <div className="meta-item">
                          📅 {formatDate(event.date, event.time)}
                        </div>
                        {event.location && (
                          <div className="meta-item">
                            📍 {event.location}
                          </div>
                        )}
                        {event.hostName && (
                          <div className="meta-item">
                            👤 Hosted by {event.hostName}
                          </div>
                        )}
                        {event.maxAttendees && (
                          <div className="meta-item">
                            👥 {event.currentAttendees || 0} / {event.maxAttendees} attending
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <p className="event-description">
                          {event.description.length > 150
                            ? `${event.description.substring(0, 150)}...`
                            : event.description}
                        </p>
                      )}

                      {event.tags && event.tags.length > 0 && (
                        <div className="event-tags">
                          {event.tags.map((tag: string, index: number) => (
                            <span key={index} className="tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Show join link for public events that user didn't create */}
                      {event.token && event.hostId !== user?.id && (
                        <div className="event-join-section">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyEventLink(event.id, event.token);
                            }}
                            className="copy-link-btn"
                          >
                            {copiedEventId === event.id ? '✓ Copied!' : '🔗 Copy Join Link'}
                          </button>
                          <div className="event-token">
                            Token: <code>{event.token}</code>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .events-page {
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .page-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .page-header h1 {
          font-size: 36px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 10px 0;
        }

        .subtitle {
          font-size: 18px;
          color: #657786;
          margin: 0;
        }

        .search-section {
          max-width: 600px;
          margin: 0 auto 40px auto;
        }

        .search-input {
          width: 100%;
          padding: 12px 20px;
          font-size: 16px;
          border: 2px solid #e1e8ed;
          border-radius: 50px;
          outline: none;
          transition: border-color 0.3s;
        }

        .search-input:focus {
          border-color: #1da1f2;
        }

        .error-message {
          background-color: #f8d7da;
          color: #721c24;
          padding: 15px 20px;
          margin-bottom: 20px;
          border-radius: 8px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .retry-button {
          padding: 8px 16px;
          background-color: #721c24;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .retry-button:hover {
          background-color: #5a161d;
        }

        .loading-state {
          text-align: center;
          padding: 60px 20px;
          color: #657786;
        }

        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #e1e8ed;
          border-top: 4px solid #1da1f2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .section {
          margin-bottom: 60px;
        }

        .public-events-section {
          padding-top: 60px;
          border-top: 2px solid #e1e8ed;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 30px;
          gap: 20px;
        }

        .header-content {
          flex: 1;
        }

        .section-title-large {
          font-size: 36px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 8px 0;
        }

        .section-title {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 24px 0;
        }

        .subtitle {
          font-size: 16px;
          color: #657786;
          margin: 0;
        }

        .create-event-btn {
          padding: 12px 28px;
          font-size: 16px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .create-event-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-icon {
          font-size: 20px;
        }

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }

        .event-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
        }

        .event-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
        }

        .event-card.my-event {
          border: 2px solid #667eea;
        }

        .badges-container {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .host-badge {
          display: inline-block;
          padding: 4px 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .private-badge {
          display: inline-block;
          padding: 4px 12px;
          background: #ff9800;
          color: white;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .event-image {
          width: 100%;
          height: 200px;
          overflow: hidden;
          background-color: #f0f0f0;
        }

        .event-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .event-content {
          padding: 20px;
        }

        .event-title {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 15px 0;
        }

        .event-meta {
          margin-bottom: 15px;
        }

        .meta-item {
          font-size: 14px;
          color: #657786;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .event-description {
          font-size: 14px;
          color: #4a4a4a;
          line-height: 1.5;
          margin: 0 0 15px 0;
        }

        .event-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .tag {
          padding: 4px 12px;
          background-color: #e8f5fe;
          color: #1da1f2;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .event-join-section {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e1e8ed;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .copy-link-btn {
          padding: 10px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .copy-link-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .event-token {
          font-size: 12px;
          color: #657786;
          text-align: center;
        }

        .event-token code {
          background: #f0f0f0;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          color: #667eea;
          font-weight: 600;
        }

        .empty-state {
          text-align: center;
          padding: 80px 20px;
          background: white;
          border-radius: 12px;
          grid-column: 1 / -1;
        }

        .empty-state h3 {
          font-size: 24px;
          color: #1a1a1a;
          margin: 0 0 10px 0;
        }

        .empty-state p {
          font-size: 16px;
          color: #657786;
          margin: 0 0 20px 0;
        }

        .create-event-button {
          padding: 12px 30px;
          background-color: #1da1f2;
          color: white;
          border: none;
          border-radius: 24px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: background-color 0.2s;
        }

        .create-event-button:hover {
          background-color: #1991db;
        }

        @media (max-width: 768px) {
          .container {
            padding: 20px 15px;
          }

          .section-header {
            flex-direction: column;
            align-items: stretch;
          }

          .section-title-large {
            font-size: 28px;
          }

          .subtitle {
            font-size: 14px;
          }

          .create-event-btn {
            width: 100%;
            justify-content: center;
          }

          .events-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .my-events-section {
            padding-top: 40px;
          }
        }
      `}</style>
    </div>
  );
};

export default EventsPage;
