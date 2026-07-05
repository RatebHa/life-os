import '@testing-library/jest-dom';

// Silence console.error noise in tests unless explicitly needed
// (store error handlers call console.error on catch)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = String(args[0]);
    // Suppress known benign noise
    if (
      msg.includes('ReactDOM.render') ||
      msg.includes('act(...)') ||
      msg.includes('Not implemented:')
    ) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
