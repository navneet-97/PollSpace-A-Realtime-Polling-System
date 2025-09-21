import axios from 'axios';
import { isValidTokenFormat } from './tokenUtils';


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
const API_BASE_URL = `${BACKEND_URL}/api`;

// Advanced request queue management
class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.concurrentLimit = 5;
    this.activeRequests = 0;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.activeRequests >= this.concurrentLimit) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.concurrentLimit) {
      const { requestFn, resolve, reject } = this.queue.shift();
      this.activeRequests++;

      requestFn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.activeRequests--;
          this.process();
        });
    }

    this.processing = false;
  }
}


class CircuitBreaker {
  constructor(threshold = 5, resetTimeout = 60000) {
    this.failureThreshold = threshold;
    this.resetTimeout = resetTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}


const requestQueue = new RequestQueue();
const circuitBreaker = new CircuitBreaker();


const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000, // Increased timeout for better reliability
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Enhanced retry configuration
  retries: 5, // Increased retries
  retryDelay: (retryCount) => {
    // More sophisticated backoff: base delay + jitter
    const baseDelay = Math.pow(2, retryCount) * 1000;
    const jitter = Math.random() * 1000;
    return Math.min(baseDelay + jitter, 30000); // Cap at 30 seconds
  },
  maxRedirects: 5,
  validateStatus: (status) => status < 500, // Don't throw on 4xx errors
});


const retryRequest = (config, retryCount = 0) => {
  return new Promise((resolve, reject) => {
    const maxRetries = config.retries || 5;
    const delay = config.retryDelay ? config.retryDelay(retryCount) : Math.pow(2, retryCount) * 1000;
    
    // Retry request with exponential backoff
    
    setTimeout(() => {
      // Use circuit breaker for retries
      circuitBreaker.execute(() => {
        return api.request({
          ...config,
          __isRetryRequest: true,
          __retryCount: retryCount + 1,
          timeout: Math.min(config.timeout + (retryCount * 5000), 60000) // Progressive timeout increase
        });
      })
      .then(resolve)
      .catch(reject);
    }, delay);
  });
};


const shouldRetry = (error, retryCount, maxRetries) => {
  if (retryCount >= maxRetries) return false;
  
  // Don't retry client errors (4xx) except for specific cases
  if (error.response?.status >= 400 && error.response?.status < 500) {
    // Retry only for rate limiting and auth errors that might resolve
    return [401, 429, 408].includes(error.response.status);
  }
  
  // Retry server errors (5xx) and network errors
  if (error.response?.status >= 500 || !error.response) {
    return true;
  }
  
  // Retry timeout errors
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return true;
  }
  
  return false;
};


api.interceptors.request.use(
  (config) => {
    // Add timestamp for request duration tracking
    config.metadata = { startTime: new Date() };
    
    // Add authentication token
    const token = sessionStorage.getItem('token');
    if (token) {
      // Validate token format before sending
      if (isValidTokenFormat(token)) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Invalid token format detected, removing from sessionStorage
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
        return Promise.reject(new Error('Invalid token format'));
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


api.interceptors.response.use(
  (response) => {
    // Log successful requests with duration
    
    // Reset circuit breaker on success
    circuitBreaker.onSuccess();
    
    return response;
  },
  async (error) => {
    const { config, response } = error;
    const duration = config?.metadata ? new Date() - config.metadata.startTime : 0;
    const retryCount = config?.__retryCount || 0;
    const maxRetries = config?.retries || 5;
    
    
    const errorContext = {
      method: config?.method?.toUpperCase(),
      url: config?.url,
      duration: `${duration}ms`,
      status: response?.status,
      statusText: response?.statusText,
      retryCount: retryCount,
      maxRetries: maxRetries,
      error: response?.data?.error || error.message,
      code: error.code
    };
    
    // Error logging handled by response handlers

    
    if (response?.status === 401 || response?.status === 403) {
      // Authentication failed, clearing sessionStorage
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      
      // Only redirect if not already on login/register page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000); // Give time for any pending operations
      }
      
      return Promise.reject(error);
    }

    
    if (config && !config.__isRetryRequest && shouldRetry(error, retryCount, maxRetries)) {
      
      if (response?.status === 429) {
        // Rate limited - waiting longer before retry
        // Exponential backoff with higher base for rate limiting
        const rateLimitDelay = Math.pow(3, retryCount) * 2000 + Math.random() * 2000;
        
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            retryRequest(config, retryCount)
              .then(resolve)
              .catch(reject);
          }, Math.min(rateLimitDelay, 60000)); // Cap at 1 minute
        });
      }
      
      
      if (response?.status >= 500 || !response || error.code === 'ECONNABORTED') {
        const errorType = !response ? 'Network' : error.code === 'ECONNABORTED' ? 'Timeout' : 'Server';
        // Error - retrying
        
        return retryRequest(config, retryCount);
      }
    }

    
    circuitBreaker.onFailure();

    
    const enhancedError = {
      ...error,
      isRetryableError: shouldRetry(error, 0, maxRetries),
      retryCount: retryCount,
      duration: duration,
      timestamp: new Date().toISOString()
    };

    return Promise.reject(enhancedError);
  }
);


api.safeGet = async (url, config = {}) => {
  try {
    const response = await requestQueue.add(() => 
      circuitBreaker.execute(() => api.get(url, config))
    );
    return { data: response.data, error: null, success: true, status: response.status };
  } catch (error) {
    // Safe GET failed - handled by error handlers
    return { 
      data: null, 
      error: error.response?.data?.error || error.message, 
      success: false,
      status: error.response?.status,
      retryable: error.isRetryableError
    };
  }
};

api.safePost = async (url, data, config = {}) => {
  try {
    const response = await requestQueue.add(() => 
      circuitBreaker.execute(() => api.post(url, data, config))
    );
    return { data: response.data, error: null, success: true, status: response.status };
  } catch (error) {
    // Safe POST failed - handled by error handlers
    return { 
      data: null, 
      error: error.response?.data?.error || error.message, 
      success: false,
      status: error.response?.status,
      retryable: error.isRetryableError
    };
  }
};

api.safePut = async (url, data, config = {}) => {
  try {
    const response = await requestQueue.add(() => 
      circuitBreaker.execute(() => api.put(url, data, config))
    );
    return { data: response.data, error: null, success: true, status: response.status };
  } catch (error) {
    // Safe PUT failed - handled by error handlers
    return { 
      data: null, 
      error: error.response?.data?.error || error.message, 
      success: false,
      status: error.response?.status,
      retryable: error.isRetryableError
    };
  }
};

api.safeDelete = async (url, config = {}) => {
  try {
    const response = await requestQueue.add(() => 
      circuitBreaker.execute(() => api.delete(url, config))
    );
    return { data: response.data, error: null, success: true, status: response.status };
  } catch (error) {
    // Safe DELETE failed - handled by error handlers
    return { 
      data: null, 
      error: error.response?.data?.error || error.message, 
      success: false,
      status: error.response?.status,
      retryable: error.isRetryableError
    };
  }
};

export default api;