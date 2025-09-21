/**
 * Validates JWT token format
 * @param {string} token - JWT token to validate
 * @returns {boolean} - true if token format is valid
 */
export const isValidTokenFormat = (token) => {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  const parts = token.split('.');
  return parts.length === 3;
};

/**
 * Validates if token payload is readable (not expired or malformed)
 * @param {string} token - JWT token to validate
 * @returns {boolean} - true if payload can be decoded
 */
export const isValidTokenPayload = (token) => {
  try {
    if (!isValidTokenFormat(token)) {
      return false;
    }
    
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    
    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return false;
    }
    
    // Check if token has required fields
    return decoded.id && decoded.username && decoded.email;
  } catch (error) {
    return false;
  }
};


export const cleanupInvalidTokens = () => {
  const token = sessionStorage.getItem('token');
  const user = sessionStorage.getItem('user');
  
  let shouldCleanup = false;
  
  // Check token format and validity
  if (token && !isValidTokenPayload(token)) {
    shouldCleanup = true;
  }
  
  // Check user data format
  if (user) {
    try {
      const userData = JSON.parse(user);
      if (!userData.id || !userData.username || !userData.email) {
        shouldCleanup = true;
      }
    } catch (error) {
      shouldCleanup = true;
    }
  }
  
  // If token exists but user doesn't, or vice versa
  if ((token && !user) || (!token && user)) {
    shouldCleanup = true;
  }
  
  if (shouldCleanup) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    return true;
  }
  
  return false;
};

/**
 * Gets valid authentication data from sessionStorage
 * @returns {Object|null} - { token, user } if valid, null otherwise
 */
export const getValidAuthData = () => {
  const token = sessionStorage.getItem('token');
  const userData = sessionStorage.getItem('user');
  
  if (!token || !userData) {
    return null;
  }
  
  if (!isValidTokenPayload(token)) {
    cleanupInvalidTokens();
    return null;
  }
  
  try {
    const user = JSON.parse(userData);
    if (!user.id || !user.username || !user.email) {
      cleanupInvalidTokens();
      return null;
    }
    
    return { token, user };
  } catch (error) {
    cleanupInvalidTokens();
    return null;
  }
};