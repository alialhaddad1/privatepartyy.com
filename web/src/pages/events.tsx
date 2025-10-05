import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';

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
  createdAt: string;
}

const EventsPage: React.FC = () => {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events?isPublic=true&limit=50&orderBy=date&order=asc');

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data = await response.json();
      setEvents(data.events || []);
      setError('');
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
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

  return (
    <div className="events-page">
      <Head>
        <title>Public Events - PrivatePartyy</title>
        <meta name="description" content="Browse and join public events on PrivatePartyy" />
      </Head>

      <Header activePage="events" />

      <div className="container">
        <div className="page-header">
          <h1>Public Events</h1>
          <p className="subtitle">Discover and join exciting events happening around you</p>
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
            <button onClick={fetchEvents} className="retry-button">
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
            {filteredEvents.length === 0 ? (
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
              filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="event-card"
                  onClick={() => handleEventClick(event.id)}
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
                        {event.tags.map((tag, index) => (
                          <span key={index} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
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

        .events-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
          margin-top: 30px;
        }

        .event-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .event-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
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

          .page-header h1 {
            font-size: 28px;
          }

          .subtitle {
            font-size: 16px;
          }

          .events-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default EventsPage;
