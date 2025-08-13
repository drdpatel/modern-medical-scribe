import React from 'react';

const LoginModal = ({ 
  show, 
  onClose, 
  logo, 
  loginForm, 
  setLoginForm, 
  onSubmit, 
  loginError 
}) => {
  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content glass-modal" onClick={(e) => e.stopPropagation()}>
        {logo && (
          <div className="modal-logo">
            <img src={logo} alt="Aayu Well" className="modal-logo-img" />
          </div>
        )}
        <h3 className="modal-title">Sign In</h3>
        <p className="modal-subtitle">Enter your credentials to continue</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="text" 
              className="form-input glass-input"
              value={loginForm.username || ''}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              placeholder="Username"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password" 
              className="form-input glass-input"
              value={loginForm.password || ''}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              placeholder="Password"
              required
            />
          </div>

          {loginError && (
            <div className="error-message">
              {loginError}
            </div>
          )}

          <button type="submit" className="btn btn-glass-primary btn-full">
            Sign In
          </button>
        </form>

        <div className="login-help">
          <strong>Demo Credentials:</strong><br />
          darshan@aayuwell.com / Aayuscribe1212@
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
