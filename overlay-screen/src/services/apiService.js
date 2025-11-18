import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`Response from ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================================================
// Electron Screenshot Service (not a backend call)
// ============================================================================

/**
 * Take a screenshot using Electron's desktopCapturer API
 * @returns {Promise<{success: boolean, data: string, size: number, display: object}>}
 */
export const takeScreenshot = async () => {
  try {
    // Check if we're in Electron environment
    if (window.electronAPI && window.electronAPI.takeScreenshot) {
      const screenshotResult = await window.electronAPI.takeScreenshot();
      
      if (!screenshotResult.success) {
        throw new Error(screenshotResult.error || 'Failed to take screenshot');
      }
      
      return screenshotResult;
    } else {
      throw new Error('Screenshot functionality not available in this environment');
    }
  } catch (error) {
    throw error;
  }
};

// ============================================================================
// Step Management Endpoints
// ============================================================================

/**
 * Initialize or set a step
 * @param {Object} data - Optional: { lesson_id: number, step_order: number }
 * @returns {Promise<AxiosResponse>} Response with step_name and step_description
 */
export const startStep = async (data = {}) => {
  try {
    const response = await api.post('/api/start-step', data);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Get the current step information
 * @returns {Promise<AxiosResponse>} Response with current step info
 */
export const getCurrentStep = async () => {
  try {
    const response = await api.get('/api/current-step');
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Advance to the next step in the current lesson
 * @returns {Promise<AxiosResponse>} Response with new step info
 */
export const advanceStep = async () => {
  try {
    const response = await api.post('/api/advance-step', {});
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Go to the previous step in the current lesson
 * @returns {Promise<AxiosResponse>} Response with previous step info
 */
export const goToPreviousStep = async () => {
  try {
    const response = await api.post('/api/previous-step', {});
    return response;
  } catch (error) {
    throw error;
  }
};

// ============================================================================
// Help & Screenshot Endpoints
// ============================================================================

/**
 * Analyze screenshot and generate contextual help message
 * @param {string} image - Base64 encoded screenshot (optional, will take if not provided)
 * @param {string} userQuery - Optional user question
 * @returns {Promise<AxiosResponse>} Response with help message
 */
export const sendScreenshot = async (image = null, userQuery = '') => {
  try {
    let base64Image = image;
    
    // Take screenshot if not provided
    if (!base64Image) {
    const screenshotResult = await takeScreenshot();
    if (!screenshotResult.success) {
      throw new Error(screenshotResult.error || 'Failed to take screenshot');
      }
      base64Image = screenshotResult.data;
    }
    
    // Send to backend /screenshot endpoint
    const payload = {
      image: base64Image,
    };
    
    // Add optional user_query if provided
    if (userQuery && userQuery.trim()) {
      payload.user_query = userQuery.trim();
    }
    
    const response = await api.post('/screenshot', payload);
    return response;
  } catch (error) {
    throw error;
  }
};

/**
 * Generate a help tip based on user's query and screenshot
 * Requires both image and user_query (unlike /screenshot where query is optional)
 * @param {string} userQuery - Required user question
 * @param {string} image - Base64 encoded screenshot (optional, will take if not provided)
 * @returns {Promise<AxiosResponse>} Response with help_tip
 */
export const getHelpTip = async (userQuery, conversationHistory = [], image = null) => {
  try {
    if (!userQuery || !userQuery.trim()) {
      throw new Error('user_query is required for help tip');
    }
    
    let base64Image = image;
    
    // Take screenshot if not provided
    if (!base64Image) {
      const screenshotResult = await takeScreenshot();
      if (!screenshotResult.success) {
        throw new Error(screenshotResult.error || 'Failed to take screenshot');
      }
      base64Image = screenshotResult.data;
    }
    
    // Send to backend /api/help-tip endpoint
    const response = await api.post('/api/help-tip', {
      image: base64Image,
      user_query: userQuery.trim(),
      conversation_history: conversationHistory,
    });
    
    return response;
  } catch (error) {
    throw error;
  }
};

// ============================================================================
// Utility Endpoints
// ============================================================================

/**
 * Health check endpoint
 * @returns {Promise<AxiosResponse>} Response with health status
 */
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response;
  } catch (error) {
    throw error;
  }
};

export default api;
