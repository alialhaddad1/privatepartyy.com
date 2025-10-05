import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../components/Header';

const AboutPage: React.FC = () => {
  const router = useRouter();

  return (
    <div className="about-page">
      <Head>
        <title>About - PrivatePartyy</title>
        <meta name="description" content="Learn about PrivatePartyy and our mission to make event sharing simple and private" />
      </Head>

      <Header activePage="about" />

      <div className="container">
        <div className="hero-section">
          <h1>About PrivatePartyy</h1>
          <p className="tagline">Making event memories private, social, and unforgettable</p>
        </div>

        <div className="content-section">
          <div className="content-card">
            <h2>🎉 What is PrivatePartyy?</h2>
            <p>
              PrivatePartyy is a revolutionary event photo-sharing platform that brings people together
              in a private, secure environment. We believe that the best moments at events should be
              shared only with those who were there, creating an intimate digital space for your memories.
            </p>
          </div>

          <div className="content-card">
            <h2>🎯 Our Mission</h2>
            <p>
              We aim to transform how people capture and share moments at private events. Whether it's
              a wedding, birthday party, corporate event, or intimate gathering, PrivatePartyy provides
              a secure platform where attendees can upload, view, and interact with photos in real-time,
              creating a collaborative memory album that everyone can enjoy.
            </p>
          </div>

          <div className="content-card">
            <h2>✨ Key Features</h2>
            <ul className="features-list">
              <li>
                <strong>QR Code Access:</strong> Simple and secure event joining via QR code scanning
              </li>
              <li>
                <strong>Private Feeds:</strong> Photos are only visible to event attendees
              </li>
              <li>
                <strong>Real-time Sharing:</strong> Upload and view photos as the event happens
              </li>
              <li>
                <strong>Social Interaction:</strong> Like, comment, and connect with other attendees
              </li>
              <li>
                <strong>Host Controls:</strong> Event creators have full control over their events
              </li>
              <li>
                <strong>Mobile First:</strong> Designed for seamless use on smartphones
              </li>
            </ul>
          </div>

          <div className="content-card">
            <h2>🔒 Privacy & Security</h2>
            <p>
              Your privacy matters to us. Events on PrivatePartyy are private by default, and only
              those with a valid access token can view and contribute to an event's feed. We use
              industry-standard encryption and security practices to keep your memories safe.
            </p>
          </div>

          <div className="content-card">
            <h2>🚀 How It Works</h2>
            <ol className="steps-list">
              <li>
                <strong>Create an Event:</strong> Set up your event with a name, description, and details
              </li>
              <li>
                <strong>Share the QR Code:</strong> Display the QR code at your event venue
              </li>
              <li>
                <strong>Guests Join:</strong> Attendees scan the code to access the private feed
              </li>
              <li>
                <strong>Share Moments:</strong> Everyone uploads photos and interacts in real-time
              </li>
              <li>
                <strong>Cherish The Moment:</strong> All photos are saved and accessible to attendees, but only on the day of the event. People you want to meet, photos you want to learn more about, and anything else you want to do with the pictures should be done AT the event! It's way more fun that way.
              </li>
            </ol>
          </div>

          <div className="cta-section">
            <h2>Ready to Create Your First Event?</h2>
            <p>Join thousands of hosts who trust PrivatePartyy for their special occasions</p>
            <button
              onClick={() => router.push('/')}
              className="cta-button"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .about-page {
          min-height: 100vh;
          background-color: #f8f9fa;
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .hero-section {
          text-align: center;
          padding: 60px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 16px;
          margin-bottom: 40px;
          color: white;
        }

        .hero-section h1 {
          font-size: 48px;
          font-weight: 700;
          margin: 0 0 15px 0;
        }

        .tagline {
          font-size: 20px;
          opacity: 0.95;
          margin: 0;
          font-weight: 300;
        }

        .content-section {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .content-card {
          background: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        .content-card h2 {
          font-size: 28px;
          color: #1a1a1a;
          margin: 0 0 20px 0;
        }

        .content-card p {
          font-size: 16px;
          line-height: 1.8;
          color: #4a4a4a;
          margin: 0;
        }

        .features-list,
        .steps-list {
          margin: 15px 0 0 0;
          padding: 0 0 0 20px;
        }

        .features-list li,
        .steps-list li {
          font-size: 16px;
          line-height: 1.8;
          color: #4a4a4a;
          margin-bottom: 12px;
        }

        .features-list strong,
        .steps-list strong {
          color: #667eea;
          font-weight: 600;
        }

        .cta-section {
          text-align: center;
          padding: 50px 30px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border-radius: 16px;
          color: white;
          margin-top: 20px;
        }

        .cta-section h2 {
          font-size: 32px;
          margin: 0 0 15px 0;
        }

        .cta-section p {
          font-size: 18px;
          margin: 0 0 30px 0;
          opacity: 0.95;
        }

        .cta-button {
          padding: 15px 40px;
          font-size: 18px;
          font-weight: 600;
          color: #f5576c;
          background: white;
          border: none;
          border-radius: 50px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        @media (max-width: 768px) {
          .container {
            padding: 20px 15px;
          }

          .hero-section {
            padding: 40px 20px;
          }

          .hero-section h1 {
            font-size: 32px;
          }

          .tagline {
            font-size: 16px;
          }

          .content-card {
            padding: 20px;
          }

          .content-card h2 {
            font-size: 24px;
          }

          .cta-section {
            padding: 30px 20px;
          }

          .cta-section h2 {
            font-size: 24px;
          }

          .cta-section p {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default AboutPage;
