import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface EmailOnlyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const EmailOnlyAuthModal: React.FC<EmailOnlyAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signInWithEmail, user } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // If user is already logged in, close modal and trigger success immediately
  React.useEffect(() => {
    if (isOpen && user) {
      setMessage('You are already logged in!');
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      }, 500);
    }
  }, [isOpen, user, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error } = await signInWithEmail(email);

      if (error) {
        setError(error.message || 'Failed to send magic link');
        setLoading(false);
        return;
      }

      // Magic link sent successfully
      setMessage('Check your email for a login link! It may take a minute to arrive.');
      setLoading(false);

      // Keep modal open so user can see the success message
      setTimeout(() => {
        if (onSuccess) onSuccess();
        handleClose();
      }, 5000); // Give them time to read the message
    } catch (err) {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setMessage('');
    onClose();
  };

  return (
    <>
      <div className="modal-overlay" onClick={handleClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={handleClose}>
            ×
          </button>

          <h2 className="modal-title">Log In to Continue</h2>
          <p className="modal-subtitle">
            Enter your email and we'll send you a magic link to log in instantly
          </p>

          <form onSubmit={handleEmailSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoFocus
                disabled={loading || !!message}
              />
            </div>

            {error && <div className="error-message">{error}</div>}
            {message && <div className="success-message">{message}</div>}

            <button type="submit" className="submit-button" disabled={loading || !!message}>
              {loading ? 'Sending...' : message ? 'Link Sent!' : 'Send Magic Link'}
            </button>

            <p className="info-text">
              No password needed! We'll send you a secure link to log in. If you don't have an account, we'll create one for you automatically.
            </p>
          </form>
        </div>
      </div>

      <style jsx>{`
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
        }

        .close-button {
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

        .close-button:hover {
          color: #1a1a1a;
        }

        .modal-title {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 10px 0;
          text-align: center;
        }

        .modal-subtitle {
          font-size: 14px;
          color: #657786;
          text-align: center;
          margin: 0 0 30px 0;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #4a4a4a;
        }

        .form-group input {
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.3s;
        }

        .form-group input:focus {
          border-color: #667eea;
        }

        .form-group input.disabled-input {
          background-color: #f5f5f5;
          color: #657786;
          cursor: not-allowed;
        }

        .error-message {
          background-color: #fee;
          color: #c33;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
        }

        .success-message {
          background-color: #e8f5e9;
          color: #2e7d32;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
        }

        .submit-button {
          padding: 14px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .info-text {
          text-align: center;
          font-size: 12px;
          color: #657786;
          margin: 0;
          line-height: 1.4;
        }

        @media (max-width: 480px) {
          .modal-content {
            padding: 30px 20px;
          }

          .modal-title {
            font-size: 24px;
          }
        }
      `}</style>
    </>
  );
};

export default EmailOnlyAuthModal;
