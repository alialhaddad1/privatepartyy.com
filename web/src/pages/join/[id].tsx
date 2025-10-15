import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import EmailOnlyAuthModal from '../../components/EmailOnlyAuthModal';
import { useAuth } from '../../contexts/AuthContext';

// Simple avatar options
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

const JoinEventPage: React.FC = () => {
  const router = useRouter();
  const { id: queryId, token: queryToken } = router.query;
  const { user } = useAuth();

  // Store id and token in state once available from query
  const [eventId, setEventId] = useState<string>('');
  const [eventToken, setEventToken] = useState<string>('');
  const [step, setStep] = useState<'choose' | 'setup' | 'auth'>('choose');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [initials, setInitials] = useState('');
  const [email, setEmail] = useState('');
  const [generation, setGeneration] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Update state when query params are available
  useEffect(() => {
    console.log('Query params:', { queryId, queryToken });
    if (queryId && typeof queryId === 'string') {
      console.log('Setting eventId:', queryId);
      setEventId(queryId);
    }
    if (queryToken && typeof queryToken === 'string') {
      console.log('Setting eventToken:', queryToken);
      setEventToken(queryToken);
    }
  }, [queryId, queryToken]);

  // Check if user is already logged in via Supabase auth
  useEffect(() => {
    if (user && eventId && eventToken) {
      // User is logged in, go directly to event
      router.push(`/event/${eventId}?token=${eventToken}`);
    }
  }, [user, eventId, eventToken, router]);

  // Check if user already has a profile stored (legacy localStorage approach)
  useEffect(() => {
    const storedProfile = localStorage.getItem('userProfile');
    if (storedProfile && eventId && eventToken && !user) {
      // User already has a profile, go directly to event
      router.push(`/event/${eventId}?token=${eventToken}`);
    }
  }, [eventId, eventToken, user, router]);

  // Check if profile exists by email (for returning users)
  const checkExistingProfile = async (email: string) => {
    try {
      const response = await fetch(`/api/users/profile?email=${encodeURIComponent(email)}`);
      if (response.ok) {
        const data = await response.json();
        return data.profile;
      }
    } catch (err) {
      console.error('Error checking existing profile:', err);
    }
    return null;
  };

  const handleChooseAnonymous = () => {
    setIsAnonymous(true);
    setStep('setup');
    setInitials('');
  };

  const handleChooseInitials = () => {
    setIsAnonymous(false);
    setStep('setup');
  };

  const handleJoinEvent = async () => {
    // Validate email
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    // Validate initials if not anonymous
    if (!isAnonymous && initials.trim().length === 0) {
      setError('Please enter your initials (1-3 characters)');
      return;
    }

    if (initials.length > 3) {
      setError('Initials must be 1-3 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if profile already exists for this email
      const existingProfile = await checkExistingProfile(email.trim().toLowerCase());

      let userProfile;

      if (existingProfile) {
        // Use existing profile but update if needed
        console.log('Found existing profile for:', email);
        userProfile = {
          id: existingProfile.id,
          name: isAnonymous ? 'Anonymous' : initials.toUpperCase(),
          email: email.trim().toLowerCase(),
          generation: generation || existingProfile.generation,
          avatar: selectedAvatar,
          isAnonymous,
          createdAt: existingProfile.createdAt,
        };
      } else {
        // Create new profile
        userProfile = {
          id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          name: isAnonymous ? 'Anonymous' : initials.toUpperCase(),
          email: email.trim().toLowerCase(),
          generation: generation || null,
          avatar: selectedAvatar,
          isAnonymous,
          createdAt: new Date().toISOString(),
        };
      }

      // Save profile to backend for cross-event persistence
      const response = await fetch('/api/users/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userProfile),
      });

      if (!response.ok) {
        console.warn('Failed to save profile to backend');
        // Continue anyway - localStorage will work
      }

      // Store in localStorage for immediate access
      localStorage.setItem('userProfile', JSON.stringify(userProfile));

      // Redirect to event feed - use window.location for more reliable redirect
      console.log('About to redirect with:', { eventId, eventToken, queryId, queryToken });

      // Use the most reliable source - prefer state, fall back to query
      const finalEventId = eventId || queryId;
      const finalEventToken = eventToken || queryToken;

      if (finalEventId && finalEventToken) {
        const redirectUrl = `/event/${finalEventId}?token=${finalEventToken}`;
        console.log('Redirecting to:', redirectUrl);
        window.location.href = redirectUrl;
      } else {
        console.error('Missing params:', { eventId, eventToken, queryId, queryToken });
        setError('Missing event information. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error joining event:', err);
      setError('Failed to join event. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('choose');
    setError('');
  };

  return (
    <div className="join-page">
      <Head>
        <title>Join Event - PrivatePartyy</title>
        <meta name="description" content="Quick setup to join the event" />
      </Head>

      <div className="join-container">
        <div className="join-card">
          <div className="logo">
            <h1>🎉 PrivatePartyy</h1>
          </div>

          {step === 'choose' ? (
            <>
              <button onClick={() => router.back()} className="back-button">
                ← Back
              </button>

              <h2>Join the Event</h2>
              <p className="subtitle">Choose how you'd like to join:</p>

              <div className="options-container">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="option-button primary"
                >
                  <div className="option-icon">📧</div>
                  <div className="option-content">
                    <strong>Quick Login with Email</strong>
                    <span>Access the event instantly with your email</span>
                  </div>
                </button>

                <div className="divider">
                  <span>or join as a guest</span>
                </div>

                <button
                  onClick={handleChooseAnonymous}
                  className="option-button"
                >
                  <div className="option-icon">👤</div>
                  <div className="option-content">
                    <strong>Anonymous</strong>
                    <span>Join without sharing your identity</span>
                  </div>
                </button>

                <button
                  onClick={handleChooseInitials}
                  className="option-button"
                >
                  <div className="option-icon">✏️</div>
                  <div className="option-content">
                    <strong>With Initials</strong>
                    <span>Show your initials (1-3 characters)</span>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={handleBack} className="back-button">
                ← Back
              </button>

              <h2>{isAnonymous ? 'Join Anonymously' : 'Enter Your Info'}</h2>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="form-input"
                  required
                  autoFocus
                />
                <small className="input-hint">For keeping your account across events</small>
              </div>

              {!isAnonymous && (
                <div className="form-group">
                  <label htmlFor="initials">Your Initials *</label>
                  <input
                    type="text"
                    id="initials"
                    value={initials}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase();
                      if (value.length <= 3) {
                        setInitials(value);
                      }
                    }}
                    placeholder="AB"
                    className="initials-input"
                    maxLength={3}
                  />
                  <small className="input-hint">1-3 characters</small>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="generation">Generation (Optional)</label>
                <select
                  id="generation"
                  value={generation}
                  onChange={(e) => setGeneration(e.target.value)}
                  className="form-input"
                >
                  {GENERATIONS.map((gen) => (
                    <option key={gen.value} value={gen.value}>
                      {gen.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Choose an Avatar</label>
                <div className="avatar-grid">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`avatar-option ${selectedAvatar === avatar ? 'selected' : ''}`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                onClick={handleJoinEvent}
                disabled={loading || !email.trim() || (!isAnonymous && initials.trim().length === 0)}
                className="join-button"
              >
                {loading ? 'Joining...' : 'Join Event'}
              </button>

              <p className="privacy-note">
                Your profile is saved for use across all events
              </p>
            </>
          )}
        </div>
      </div>

      <EmailOnlyAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          const finalEventId = eventId || queryId;
          const finalEventToken = eventToken || queryToken;

          if (finalEventId && finalEventToken) {
            router.push(`/event/${finalEventId}?token=${finalEventToken}`);
          } else {
            console.error('Cannot redirect: missing event info', { eventId, eventToken, queryId, queryToken });
          }
        }}
      />

      <style jsx>{`
        .join-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .join-container {
          width: 100%;
          max-width: 500px;
        }

        .join-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .logo {
          text-align: center;
          margin-bottom: 30px;
        }

        .logo h1 {
          font-size: 28px;
          margin: 0;
          color: #667eea;
        }

        h2 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 10px 0;
          text-align: center;
        }

        .subtitle {
          text-align: center;
          color: #657786;
          margin: 0 0 30px 0;
          font-size: 16px;
        }

        .options-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .option-button {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 20px;
          background: #f8f9fa;
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: left;
          width: 100%;
        }

        .option-button:hover {
          background: #f0f2f5;
          border-color: #667eea;
          transform: translateY(-2px);
        }

        .option-button.primary {
          border-color: #667eea;
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        }

        .option-button.primary:hover {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
          border-color: #764ba2;
        }

        .divider {
          text-align: center;
          color: #657786;
          font-size: 14px;
          margin: 10px 0;
          position: relative;
        }

        .divider::before,
        .divider::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 35%;
          height: 1px;
          background: #e1e8ed;
        }

        .divider::before {
          left: 0;
        }

        .divider::after {
          right: 0;
        }

        .divider span {
          padding: 0 10px;
          background: white;
          position: relative;
        }

        .option-icon {
          font-size: 40px;
          flex-shrink: 0;
        }

        .option-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .option-content strong {
          font-size: 18px;
          color: #1a1a1a;
        }

        .option-content span {
          font-size: 14px;
          color: #657786;
        }

        .back-button {
          background: none;
          border: none;
          color: #667eea;
          font-size: 16px;
          cursor: pointer;
          padding: 8px 0;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .back-button:hover {
          text-decoration: underline;
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
          border-radius: 12px;
          outline: none;
          transition: border-color 0.3s;
          font-family: inherit;
          box-sizing: border-box;
        }

        .form-input:focus {
          border-color: #667eea;
        }

        .initials-input {
          width: 100%;
          padding: 16px;
          font-size: 24px;
          text-align: center;
          border: 2px solid #e1e8ed;
          border-radius: 12px;
          outline: none;
          transition: border-color 0.3s;
          font-weight: 700;
          letter-spacing: 4px;
          text-transform: uppercase;
          box-sizing: border-box;
        }

        .initials-input:focus {
          border-color: #667eea;
        }

        .input-hint {
          display: block;
          text-align: center;
          color: #657786;
          font-size: 12px;
          margin-top: 6px;
        }

        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
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
          overflow: hidden;
          box-sizing: border-box;
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

        .error-message {
          background: #fee;
          color: #c33;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 16px;
          text-align: center;
        }

        .join-button {
          width: 100%;
          padding: 16px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }

        .join-button:hover:not(:disabled) {
          background: #5568d3;
        }

        .join-button:disabled {
          background: #aaa;
          cursor: not-allowed;
        }

        .privacy-note {
          text-align: center;
          color: #657786;
          font-size: 12px;
          margin: 16px 0 0 0;
        }

        @media (max-width: 600px) {
          .join-card {
            padding: 30px 20px;
          }

          .logo h1 {
            font-size: 24px;
          }

          h2 {
            font-size: 20px;
          }

          .avatar-grid {
            grid-template-columns: repeat(6, 1fr);
            gap: 6px;
          }

          .avatar-option {
            font-size: 18px;
          }
        }

        @media (max-width: 400px) {
          .avatar-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
          }

          .avatar-option {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default JoinEventPage;
