const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { formatMessage } = require('actions:notification-helper');

/**
 * @type {SendPhoneMessageAction}
 *
 * This action demonstrates using an action module to share code
 * across multiple actions. The notification-helper module provides
 * utilities for message formatting and tracking.
 */
exports.onExecuteSendPhoneMessage = async (event, api) => {
  const messageId = uuidv4();
  console.log(`Processing phone message. MessageId: ${messageId}`);

  try {
    // Format the message using the module
    const formattedMessage = formatMessage(
      event.message_options.recipient,
      event.message_options.text
    );
    console.log('Formatted message:', formattedMessage);

    // Example: Make an API call to external service
    const response = await axios.post('https://api.example.com/sms/send', {
      to: formattedMessage.recipient,
      body: formattedMessage.message,
      trackingId: formattedMessage.id
    });

    console.log('Message sent successfully:', response.data);
  } catch (error) {
    console.error('Error sending phone message:', error.message);
    // Allow the message to continue even if external API fails
  }
};
