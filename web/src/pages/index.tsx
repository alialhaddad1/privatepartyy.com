import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Header from '../components/Header';
import QRScanner from '../components/QRScanner';

const LandingPage: React.FC = () => {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState('');

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) {
      setError('Event name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: eventName.trim(),
          description: eventDescription.trim(),
          isPublic: isPublic,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Close modal and redirect to QR code page to show the host the QR code
        setShowCreateModal(false);
        router.push(`/host/qr/${data.eventId}?token=${data.token}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create event');
        console.error('Failed to create event:', errorData);
      }
    } catch (error) {
      console.error('Error creating event:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleManualEntry = (input: string) => {
    try {
      // Try to parse as URL first
      if (input.startsWith('http')) {
        const url = new URL(input);
        const eventId = url.pathname.split('/').pop();
        const token = url.searchParams.get('token');

        if (eventId && token) {
          router.push(`/event/${eventId}?token=${token}`);
          return;
        }
      }

      // Otherwise treat as event ID and prompt for token or redirect to join page
      router.push(`/event/${input}`);
    } catch (err) {
      console.error('Error parsing input:', err);
    }
  };

  return (
    <div className="landing-page">
      <Head>
        <title>PrivatePartyy - Share Event Moments Privately</title>
        <meta name="description" content="Create and join private events. Share photos with attendees in real-time." />
      </Head>

      <Header activePage="home" />

      <div className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            Welcome to <span className="brand">PrivatePartyy</span>
          </h1>
          <p className="hero-subtitle">
            Create exclusive events and share moments with your guests in a private, secure space.
            Share photos in real-time, connect with attendees, and create lasting memories.
          </p>

          <div className="action-buttons">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              <span className="btn-icon">🎉</span>
              Create Event
            </button>

            <button
              onClick={() => setShowQRScanner(true)}
              className="btn btn-secondary"
            >
              <span className="btn-icon">📱</span>
              Join Event
            </button>
          </div>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Private & Secure</h3>
            <p>Only attendees with QR codes can access your event</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>Real-time Sharing</h3>
            <p>Upload and view photos as they happen</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Social Features</h3>
            <p>Like, comment, and message other attendees</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3>Easy Access</h3>
            <p>Simple QR code scanning to join events</p>
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Event</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="event-form">
              <div className="form-group">
                <label htmlFor="eventName">Event Name *</label>
                <input
                  type="text"
                  id="eventName"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="My Awesome Party"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="eventDescription">Description</label>
                <textarea
                  id="eventDescription"
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Tell people about your event..."
                  rows={3}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="privacy-label">Event Privacy</label>
                <div className="privacy-options">
                  <button
                    type="button"
                    className={`privacy-btn ${isPublic ? 'active' : ''}`}
                    onClick={() => setIsPublic(true)}
                  >
                    <div className="privacy-icon">🌍</div>
                    <div className="privacy-text">
                      <strong>Public Event</strong>
                      <span>Visible on Events page, accessible with QR code</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`privacy-btn ${!isPublic ? 'active' : ''}`}
                    onClick={() => setIsPublic(false)}
                  >
                    <div className="privacy-icon">🔒</div>
                    <div className="privacy-text">
                      <strong>Private Event</strong>
                      <span>Only accessible via QR code, not listed publicly</span>
                    </div>
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !eventName.trim()}
                  className="btn btn-submit"
                >
                  {isCreating ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="modal-overlay" onClick={() => setShowQRScanner(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scan QR Code</h2>
              <button
                onClick={() => setShowQRScanner(false)}
                className="modal-close"
              >
                ✕
              </button>
            </div>

            <div className="scanner-wrapper">
              <QRScanner />
              <div className="manual-entry-section">
                <input
                  type="text"
                  placeholder="Or enter event code manually"
                  className="form-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      if (target.value.trim()) {
                        handleManualEntry(target.value.trim());
                      }
                    }
                  }}
                />
                <p className="input-hint">
                  Press Enter after typing the code
                </p>
              </div>
            </div>

            <div className="scanner-info">
              <p>Point your camera at a PrivatePartyy QR code to join an event</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .landing-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .hero-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 20px;
        }

        .hero-content {
          text-align: center;
          margin-bottom: 80px;
        }

        .hero-title {
          font-size: 48px;
          font-weight: 700;
          color: white;
          margin: 0 0 20px 0;
          line-height: 1.2;
        }

        .brand {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 20px;
          color: rgba(255, 255, 255, 0.9);
          max-width: 700px;
          margin: 0 auto 40px auto;
          line-height: 1.6;
        }

        .action-buttons {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn {
          padding: 16px 32px;
          font-size: 18px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 10px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
        }

        .btn-primary {
          background: white;
          color: #667eea;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          backdrop-filter: blur(10px);
        }

        .btn-icon {
          font-size: 24px;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 30px;
          margin-top: 60px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 30px;
          border-radius: 16px;
          text-align: center;
          transition: all 0.3s ease;
        }

        .feature-card:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.15);
        }

        .feature-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }

        .feature-card h3 {
          font-size: 20px;
          font-weight: 600;
          color: white;
          margin: 0 0 10px 0;
        }

        .feature-card p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
          margin: 0;
          line-height: 1.5;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
          backdrop-filter: blur(5px);
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          padding: 0;
          width: 100%;
          max-width: 550px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 30px;
          border-bottom: 1px solid #e1e8ed;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #657786;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: #f0f0f0;
          color: #1a1a1a;
        }

        .event-form {
          padding: 30px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.3s;
          font-family: inherit;
          box-sizing: border-box;
        }

        .form-input:focus {
          border-color: #667eea;
        }

        .form-input::placeholder {
          color: #aab8c2;
        }

        textarea.form-input {
          resize: vertical;
          min-height: 80px;
        }

        .privacy-label {
          margin-bottom: 12px;
        }

        .privacy-options {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .privacy-btn {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 16px;
          background: #f8f9fa;
          border: 2px solid #e1e8ed;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: left;
        }

        .privacy-btn:hover {
          background: #f0f2f5;
          border-color: #667eea;
        }

        .privacy-btn.active {
          background: #e8ecff;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .privacy-icon {
          font-size: 32px;
          flex-shrink: 0;
        }

        .privacy-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .privacy-text strong {
          font-size: 15px;
          color: #1a1a1a;
        }

        .privacy-text span {
          font-size: 13px;
          color: #657786;
        }

        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 30px;
        }

        .btn-cancel {
          flex: 1;
          padding: 12px 24px;
          background: #f0f0f0;
          color: #4a4a4a;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-cancel:hover {
          background: #e0e0e0;
        }

        .btn-submit {
          flex: 1;
          padding: 12px 24px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-submit:hover:not(:disabled) {
          background: #5568d3;
        }

        .btn-submit:disabled {
          background: #aaa;
          cursor: not-allowed;
        }

        .scanner-wrapper {
          padding: 20px 30px;
        }

        .manual-entry-section {
          margin-top: 20px;
        }

        .input-hint {
          font-size: 12px;
          color: #657786;
          margin: 8px 0 0 0;
          text-align: center;
        }

        .scanner-info {
          padding: 20px 30px;
          border-top: 1px solid #e1e8ed;
          text-align: center;
        }

        .scanner-info p {
          font-size: 14px;
          color: #657786;
          margin: 0;
        }

        @media (max-width: 768px) {
          .hero-title {
            font-size: 32px;
          }

          .hero-subtitle {
            font-size: 16px;
          }

          .action-buttons {
            flex-direction: column;
            align-items: stretch;
          }

          .btn {
            justify-content: center;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .modal-content {
            max-width: 100%;
            margin: 0;
          }

          .event-form {
            padding: 20px;
          }

          .modal-header {
            padding: 20px;
          }

          .form-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
