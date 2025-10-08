import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface GoingButtonProps {
  eventId: string;
  initialIsGoing: boolean;
  onToggle: () => void;
}

const GoingButton: React.FC<GoingButtonProps> = ({ eventId, initialIsGoing, onToggle }) => {
  const { user } = useAuth();
  const [isGoing, setIsGoing] = useState(initialIsGoing);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!user) {
      alert('Please log in to RSVP to events');
      return;
    }

    setLoading(true);
    try {
      // Get the current session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in to RSVP');
        return;
      }

      const method = isGoing ? 'DELETE' : 'POST';
      const response = await fetch(`/api/events/${eventId}/attendees`, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsGoing(!isGoing);
        onToggle();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update attendance');
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Failed to update attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`going-button ${isGoing ? 'going' : 'not-going'}`}
    >
      {loading ? 'Updating...' : isGoing ? '✓ Going' : '+ I\'m Going'}

      <style jsx>{`
        .going-button {
          padding: 14px 32px;
          font-size: 16px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          border: none;
          transition: all 0.3s;
        }

        .going-button.not-going {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .going-button.going {
          background: #e8f5e9;
          color: #2e7d32;
          border: 2px solid #2e7d32;
        }

        .going-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .going-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </button>
  );
};

export default GoingButton;
