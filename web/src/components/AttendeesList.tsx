import React, { useState, useEffect } from 'react';

interface Attendee {
  id: string;
  user_id: string;
  user_profiles: {
    display_name: string;
    avatar_url?: string;
  };
}

interface AttendeesListProps {
  eventId: string;
  refreshTrigger?: number;
}

const AttendeesList: React.FC<AttendeesListProps> = ({ eventId, refreshTrigger = 0 }) => {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendees();
  }, [eventId, refreshTrigger]);

  const fetchAttendees = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/attendees`);
      if (response.ok) {
        const data = await response.json();
        setAttendees(data.attendees || []);
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading attendees...</div>;
  }

  return (
    <div className="attendees-list">
      <h3 className="attendees-count">
        {attendees.length} {attendees.length === 1 ? 'person' : 'people'} going
      </h3>

      {attendees.length > 0 && (
        <div className="attendees-grid">
          {attendees.map((attendee) => (
            <div key={attendee.id} className="attendee-card">
              {attendee.user_profiles?.avatar_url ? (
                <img
                  src={attendee.user_profiles.avatar_url}
                  alt={attendee.user_profiles?.display_name || 'User'}
                  className="attendee-avatar"
                />
              ) : (
                <div className="avatar-placeholder">
                  {(attendee.user_profiles?.display_name || 'U')[0].toUpperCase()}
                </div>
              )}
              <span className="attendee-name">
                {attendee.user_profiles?.display_name || 'User'}
              </span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .attendees-list {
          margin: 30px 0;
        }

        .attendees-count {
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 20px;
        }

        .attendees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
        }

        .attendee-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          transition: transform 0.2s;
        }

        .attendee-card:hover {
          transform: translateY(-2px);
          background: #f0f0f0;
        }

        .attendee-avatar,
        .avatar-placeholder {
          width: 50px;
          height: 50px;
          border-radius: 50%;
        }

        .attendee-avatar {
          object-fit: cover;
        }

        .avatar-placeholder {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 700;
        }

        .attendee-name {
          font-size: 14px;
          font-weight: 500;
          color: #4a4a4a;
          text-align: center;
          word-break: break-word;
        }

        .loading {
          text-align: center;
          padding: 20px;
          color: #657786;
          font-size: 14px;
        }

        @media (max-width: 768px) {
          .attendees-grid {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            gap: 12px;
          }

          .attendee-card {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default AttendeesList;
