import React from 'react';

const WelcomeScreen = ({ logo, onSignIn }) => {
  return (
    <div className="login-container">
      <div className="login-background"></div>
      <div className="login-card glass-card">
        <div className="login-logo">
          <img src={logo} alt="Aayu Well" className="login-logo-img" />
        </div>
        <h2 className="login-title">Welcome to Aayu AI Scribe</h2>
        <p className="login-subtitle">Secure Medical Documentation Platform</p>
        <button className="btn btn-glass-primary" onClick={onSignIn}>
          Sign In
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
