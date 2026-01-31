// Test setup file
require('dotenv').config({ path: '.env.test' });

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent',
      }),
    },
  }));
});

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Generate a random email for testing
  randomEmail: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,

  // Wait helper
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};
