import * as SpeechSDK from 'microsoft-cognitiveservices-speech-sdk';
import axios from 'axios';

class SpeechService {
  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || 'https://aayuscribe-api-fthtanaubda4dveb.eastus2-01.azurewebsites.net/api';
    this.recognizer = null;
    this.audioConfig = null;
    this.tokenExpiryTime = null;
    this.cachedToken = null;
    this.cachedRegion = null;
  }

  /**
   * Get speech token from backend
   */
  async getSpeechToken() {
    try {
      // Check if we have a valid cached token
      if (this.cachedToken && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
        return {
          token: this.cachedToken,
          region: this.cachedRegion
        };
      }

      // Get current user for auth headers
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      
      if (!currentUser.id) {
        throw new Error('User not authenticated');
      }
      
      const response = await axios.get(`${this.apiBaseUrl}/speech-token`, {
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-role': currentUser.role || ''
        },
        timeout: 10000
      });
      
      if (response.data && response.data.token) {
        // Cache the token for 8 minutes (tokens are valid for 10 minutes)
        this.cachedToken = response.data.token;
        this.cachedRegion = response.data.region;
        this.tokenExpiryTime = Date.now() + (8 * 60 * 1000);
        
        return response.data;
      } else {
        throw new Error('Invalid response from speech token service');
      }
    } catch (error) {
      console.error('Failed to get speech token:', error);
      
      // Clear cache on error
      this.cachedToken = null;
      this.cachedRegion = null;
      this.tokenExpiryTime = null;
      
      if (error.response?.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      } else if (error.response?.status === 403) {
        throw new Error('You do not have permission to use speech services.');
      } else {
        throw new Error('Failed to initialize speech service. Please contact administrator.');
      }
    }
  }

  /**
   * Initialize speech recognizer with token
   */
  async initializeRecognizer() {
    try {
      // Clean up existing recognizer
      this.cleanup();
      
      // Get token from backend
      const { token, region } = await this.getSpeechToken();
      
      if (!token || !region) {
        throw new Error('Invalid speech service configuration');
      }
      
      // Create speech config using token (not API key)
      const speechConfig = SpeechSDK.SpeechConfig.fromAuthorizationToken(token, region);
      speechConfig.speechRecognitionLanguage = 'en-US';
      speechConfig.enableDictation();
      
      // Configure for long recordings
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs,
        '3600000' // 1 hour
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs,
        '3600000' // 1 hour
      );
      speechConfig.setProperty(
        SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
        '3000' // 3 seconds
      );
      
      // Create audio config
      this.audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      
      // Create recognizer
      this.recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, this.audioConfig);
      
      return this.recognizer;
    } catch (error) {
      console.error('Failed to initialize speech recognizer:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Start continuous recognition
   */
  async startRecognition(callbacks = {}) {
    try {
      // Initialize recognizer
      await this.initializeRecognizer();
      
      if (!this.recognizer) {
        throw new Error('Failed to create speech recognizer');
      }
      
      // Set up event handlers
      if (callbacks.onRecognizing) {
        this.recognizer.recognizing = callbacks.onRecognizing;
      }
      
      if (callbacks.onRecognized) {
        this.recognizer.recognized = callbacks.onRecognized;
      }
      
      if (callbacks.onSessionStarted) {
        this.recognizer.sessionStarted = callbacks.onSessionStarted;
      }
      
      if (callbacks.onSessionStopped) {
        this.recognizer.sessionStopped = callbacks.onSessionStopped;
      }
      
      if (callbacks.onCanceled) {
        this.recognizer.canceled = callbacks.onCanceled;
      }
      
      // Start recognition
      return new Promise((resolve, reject) => {
        this.recognizer.startContinuousRecognitionAsync(
          () => {
            console.log('Speech recognition started successfully');
            resolve();
          },
          (error) => {
            console.error('Failed to start recognition:', error);
            reject(new Error(`Failed to start recording: ${error}`));
          }
        );
      });
    } catch (error) {
      console.error('Start recognition error:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop continuous recognition
   */
  async stopRecognition() {
    if (!this.recognizer) {
      return Promise.resolve();
    }
    
    return new Promise((resolve, reject) => {
      this.recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log('Speech recognition stopped successfully');
          resolve();
        },
        (error) => {
          console.error('Failed to stop recognition:', error);
          // Resolve anyway to avoid hanging
          resolve();
        }
      );
    });
  }

  /**
   * Pause recognition (stop but keep recognizer)
   */
  async pauseRecognition() {
    return this.stopRecognition();
  }

  /**
   * Resume recognition (restart with same recognizer)
   */
  async resumeRecognition(callbacks = {}) {
    // Re-initialize to get fresh token if needed
    return this.startRecognition(callbacks);
  }

  /**
   * Clean up resources
   */
  cleanup() {
    try {
      if (this.recognizer) {
        try {
          this.recognizer.dispose();
        } catch (e) {
          console.error('Error disposing recognizer:', e);
        }
        this.recognizer = null;
      }
      
      if (this.audioConfig) {
        try {
          this.audioConfig.close();
        } catch (e) {
          console.error('Error closing audio config:', e);
        }
        this.audioConfig = null;
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

// Export singleton instance
const speechService = new SpeechService();
export default speechService;
