import React, { useState } from 'react';
import Head from 'next/head';
import Header from '../components/Header';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setStatus('error');
      setErrorMessage('Please fill in all required fields');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setStatus('error');
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setStatus('sending');
    setErrorMessage('');

    try {
      // In a real application, you would send this to your backend API
      // For now, we'll simulate a successful submission
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Here you would typically make an API call like:
      // const response = await fetch('/api/contact', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData)
      // });

      setStatus('success');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });

      // Reset success message after 5 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to send message. Please try again or email us directly.');
    }
  };

  return (
    <div className="contact-page">
      <Head>
        <title>Contact Us - PrivatePartyy</title>
        <meta name="description" content="Get in touch with the PrivatePartyy team" />
      </Head>

      <Header activePage="contact" />

      <div className="container">
        <div className="header-section">
          <h1>Contact Us</h1>
          <p>We'd love to hear from you! Send us a message and we'll get back to you as soon as possible.</p>
        </div>

        <div className="content-wrapper">
          <div className="contact-form-section">
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  required
                  disabled={status === 'sending'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  required
                  disabled={status === 'sending'}
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  disabled={status === 'sending'}
                >
                  <option value="">Select a subject</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="feature">Feature Request</option>
                  <option value="bug">Report a Bug</option>
                  <option value="business">Business Inquiry</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Tell us how we can help you..."
                  rows={6}
                  required
                  disabled={status === 'sending'}
                />
              </div>

              {status === 'error' && (
                <div className="alert alert-error">
                  {errorMessage}
                </div>
              )}

              {status === 'success' && (
                <div className="alert alert-success">
                  Thank you for your message! We'll get back to you soon.
                </div>
              )}

              <button
                type="submit"
                className="submit-button"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          <div className="info-section">
            <div className="info-card">
              <h3>📧 Email Support</h3>
              <p>For immediate assistance, you can email us directly at:</p>
              <a href="mailto:support@privatepartyy.com" className="email-link">
                support@privatepartyy.com
              </a>
            </div>

            <div className="info-card">
              <h3>⏰ Response Time</h3>
              <p>We typically respond to all inquiries within 24-48 hours during business days.</p>
            </div>

            <div className="info-card">
              <h3>💬 Common Questions</h3>
              <ul>
                <li>How do I create an event?</li>
                <li>How do guests join my event?</li>
                <li>Is my data secure?</li>
                <li>Can I delete photos?</li>
              </ul>
              <p className="faq-note">Check our FAQ section (coming soon) for quick answers!</p>
            </div>

            <div className="info-card">
              <h3>🐛 Report Issues</h3>
              <p>
                Found a bug? Please include as much detail as possible:
                device type, browser, and steps to reproduce the issue.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .contact-page {
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .header-section {
          text-align: center;
          margin-bottom: 50px;
        }

        .header-section h1 {
          font-size: 42px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 0 0 15px 0;
        }

        .header-section p {
          font-size: 18px;
          color: #657786;
          margin: 0;
          max-width: 600px;
          margin: 0 auto;
        }

        .content-wrapper {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
        }

        .contact-form-section {
          background: white;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .contact-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 8px;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #e1e8ed;
          border-radius: 8px;
          outline: none;
          transition: border-color 0.3s;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #1da1f2;
        }

        .form-group input:disabled,
        .form-group select:disabled,
        .form-group textarea:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .form-group textarea {
          resize: vertical;
          min-height: 120px;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
        }

        .alert-error {
          background-color: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }

        .alert-success {
          background-color: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }

        .submit-button {
          padding: 14px 32px;
          font-size: 16px;
          font-weight: 600;
          color: white;
          background-color: #1da1f2;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.2s;
        }

        .submit-button:hover:not(:disabled) {
          background-color: #1991db;
          transform: translateY(-1px);
        }

        .submit-button:disabled {
          background-color: #aaa;
          cursor: not-allowed;
          transform: none;
        }

        .info-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .info-card {
          background: white;
          padding: 25px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .info-card h3 {
          font-size: 18px;
          color: #1a1a1a;
          margin: 0 0 12px 0;
        }

        .info-card p {
          font-size: 14px;
          color: #4a4a4a;
          line-height: 1.6;
          margin: 0;
        }

        .info-card ul {
          margin: 10px 0;
          padding: 0 0 0 20px;
        }

        .info-card li {
          font-size: 14px;
          color: #4a4a4a;
          line-height: 1.8;
        }

        .email-link {
          display: inline-block;
          margin-top: 10px;
          color: #1da1f2;
          font-weight: 600;
          font-size: 16px;
          text-decoration: none;
          transition: color 0.2s;
        }

        .email-link:hover {
          color: #1991db;
          text-decoration: underline;
        }

        .faq-note {
          margin-top: 10px;
          font-style: italic;
          color: #657786;
        }

        @media (max-width: 968px) {
          .content-wrapper {
            grid-template-columns: 1fr;
          }

          .contact-form-section {
            padding: 25px;
          }
        }

        @media (max-width: 768px) {
          .container {
            padding: 20px 15px;
          }

          .header-section h1 {
            font-size: 32px;
          }

          .header-section p {
            font-size: 16px;
          }

          .contact-form-section {
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default ContactPage;
