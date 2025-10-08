import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useRouter } from 'next/router';

interface HeaderProps {
  activePage?: string;
}

const Header: React.FC<HeaderProps> = ({ activePage }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Events', href: '/events' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' }
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleAccountClick = () => {
    if (user) {
      setShowAccountMenu(!showAccountMenu);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setShowAccountMenu(false);
    router.push('/');
  };

  return (
    <>
      <header className="header">
        <div className="header-container">
          <div className="header-content">
            {/* Logo */}
            <div className="logo-section">
              <a href="/" className="logo-link">
                <div className="logo-icon">
                  <span>🎉</span>
                </div>
                <span className="logo-text">PrivatePartyy</span>
              </a>
            </div>

            {/* Desktop Navigation */}
            <nav className="desktop-nav">
              <div className="nav-links">
                {navItems.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className={`nav-link ${activePage === item.name.toLowerCase() ? 'active' : ''}`}
                  >
                    {item.name}
                  </a>
                ))}
                <button
                  onClick={handleAccountClick}
                  className="account-button"
                >
                  {user ? (
                    <span className="account-text">{profile?.display_name || 'Account'}</span>
                  ) : (
                    'Log In'
                  )}
                </button>
                {showAccountMenu && user && (
                  <div className="account-menu">
                    <a href="/account" className="account-menu-item">
                      My Account
                    </a>
                    <button onClick={handleSignOut} className="account-menu-item sign-out">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </nav>

            {/* Mobile menu button */}
            <div className="mobile-menu-btn">
              <button
                onClick={toggleMobileMenu}
                className="menu-toggle"
                aria-label="Toggle menu"
              >
                {!isMobileMenuOpen ? (
                  <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ) : (
                  <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="mobile-nav">
            <div className="mobile-nav-content">
              {navItems.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className={`mobile-nav-link ${activePage === item.name.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              {user ? (
                <>
                  <a
                    href="/account"
                    className="mobile-nav-link"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    My Account
                  </a>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="mobile-nav-link sign-out"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsAuthModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="mobile-nav-link login-btn"
                >
                  Log In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <style jsx>{`
        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(102, 126, 234, 0.1);
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          height: 70px;
        }

        .logo-section {
          flex-shrink: 0;
        }

        .logo-link {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          transition: transform 0.2s;
        }

        .logo-link:hover {
          transform: scale(1.02);
        }

        .logo-icon {
          width: 45px;
          height: 45px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .logo-text {
          font-size: 22px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .desktop-nav {
          display: none;
        }

        @media (min-width: 768px) {
          .desktop-nav {
            display: block;
          }
        }

        .nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-link {
          padding: 10px 20px;
          font-size: 15px;
          font-weight: 600;
          color: #4a4a4a;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.3s;
          position: relative;
        }

        .nav-link:hover {
          color: #667eea;
          background: rgba(102, 126, 234, 0.1);
        }

        .nav-link.active {
          color: #667eea;
          background: rgba(102, 126, 234, 0.15);
        }

        .nav-link.active::after {
          content: '';
          position: absolute;
          bottom: 5px;
          left: 20px;
          right: 20px;
          height: 2px;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          border-radius: 2px;
        }

        .account-button {
          padding: 10px 24px;
          font-size: 15px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
        }

        .account-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .account-menu {
          position: absolute;
          top: 60px;
          right: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
          min-width: 180px;
          overflow: hidden;
          z-index: 200;
        }

        .account-menu-item {
          display: block;
          width: 100%;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 500;
          color: #4a4a4a;
          text-decoration: none;
          border: none;
          background: none;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .account-menu-item:hover {
          background-color: #f5f5f5;
        }

        .account-menu-item.sign-out {
          color: #c33;
          border-top: 1px solid #e1e8ed;
        }

        .mobile-menu-btn {
          display: block;
        }

        @media (min-width: 768px) {
          .mobile-menu-btn {
            display: none;
          }
        }

        .menu-toggle {
          background: none;
          border: none;
          padding: 8px;
          cursor: pointer;
          color: #4a4a4a;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .menu-toggle:hover {
          background: rgba(102, 126, 234, 0.1);
          color: #667eea;
        }

        .icon {
          width: 24px;
          height: 24px;
        }

        .mobile-nav {
          display: block;
          border-top: 1px solid rgba(102, 126, 234, 0.1);
        }

        @media (min-width: 768px) {
          .mobile-nav {
            display: none;
          }
        }

        .mobile-nav-content {
          padding: 12px 20px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .mobile-nav-link {
          padding: 12px 16px;
          font-size: 16px;
          font-weight: 600;
          color: #4a4a4a;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s;
          border: none;
          background: none;
          width: 100%;
          text-align: left;
          cursor: pointer;
        }

        .mobile-nav-link:hover {
          background: rgba(102, 126, 234, 0.1);
          color: #667eea;
        }

        .mobile-nav-link.active {
          background: rgba(102, 126, 234, 0.15);
          color: #667eea;
          border-left: 3px solid #667eea;
        }

        .mobile-nav-link.login-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin-top: 8px;
        }

        .mobile-nav-link.sign-out {
          color: #c33;
          border-top: 1px solid #e1e8ed;
          margin-top: 8px;
        }
      `}</style>
    </>
  );
};

export default Header;
