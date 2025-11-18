/**
 * Jest Setup File
 * Configures test environment and global mocks
 */

// Electron modules are mocked via __mocks__/electron.js

// Mock Node.js modules
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    kill: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn()
  }))
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn(() => '/mock/dir')
}));

// Global fetch mock
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
);

// Mock window object for browser environment
Object.defineProperty(window, 'electronAPI', {
  value: {
    triggerChildProcess: jest.fn(() => Promise.resolve({ success: true })),
    onChildProcessOutput: jest.fn(),
    takeScreenshot: jest.fn(() => Promise.resolve({ success: true, data: 'mock' })),
    onOverlaySetContent: jest.fn(),
    platform: 'darwin',
    appVersion: '1.0.0'
  },
  writable: true
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.ELECTRON_IS_DEV = '1';
