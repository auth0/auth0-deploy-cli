const jwt = require('jsonwebtoken');
const axios = require('axios');

/**
 * Auth Helper Module
 * Provides JWT validation and token refresh utilities
 */
module.exports = {
  /**
   * Validates a JWT token
   * @param {string} token - JWT token to validate
   * @returns {Promise<object>} Decoded token payload
   */
  async validateToken(token) {
    const secret = actions.secrets.JWT_SECRET;
    try {
      return jwt.verify(token, secret);
    } catch (error) {
      throw new Error('Invalid token: ' + error.message);
    }
  },

  /**
   * Fetches user data from an external API
   * @param {string} userId - User ID to fetch
   * @returns {Promise<object>} User data
   */
  async fetchUserData(userId) {
    const response = await axios.get(`https://api.example.com/users/${userId}`);
    return response.data;
  }
};
