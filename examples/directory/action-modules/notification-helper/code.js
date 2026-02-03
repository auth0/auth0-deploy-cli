const { v4: uuidv4 } = require('uuid');

/**
 * Notification Helper Module
 * Provides utility functions for notification handling
 */
module.exports = {
  /**
   * Formats a phone message with tracking metadata
   * @param {string} recipient - Phone number
   * @param {string} message - Message content
   * @returns {object} Formatted message object
   */
  formatMessage: function(recipient, message) {
    return {
      id: uuidv4(),
      recipient,
      message,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
  }
};
