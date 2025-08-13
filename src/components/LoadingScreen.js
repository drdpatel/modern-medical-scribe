import React from 'react';

const LoadingScreen = ({ logo }) => {
  return (
    <div className="app-container">
      <div className="loading-screen">
        <div className="loading-logo">
          <img src={logo} alt="Aayu Well" className="loading-logo-img" />
        </div>
        <div className="loading-text">Loading Aayu AI Scribe...</div>
        <div className="loading-spinner"></div>
      </div>
    </div>
  );
};

export default LoadingScreen;
