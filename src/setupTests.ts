// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock TensorFlow.js globally for all tests
jest.mock('@tensorflow/tfjs', () => ({
  sequential: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn(() => Promise.resolve()),
    predict: jest.fn(() => ({
      data: jest.fn(() => Promise.resolve([0.1, 0.9, 0.05, 0.02])),
      dispose: jest.fn()
    })),
    save: jest.fn(() => Promise.resolve({})),
    dispose: jest.fn(),
    layers: [{ getConfig: () => ({ batchInputShape: [null, 100] }) }]
  })),
  layers: {
    dense: jest.fn(() => ({})),
    dropout: jest.fn(() => ({}))
  },
  train: {
    adam: jest.fn(() => ({}))
  },
  tensor2d: jest.fn(() => ({
    dispose: jest.fn()
  })),
  loadLayersModel: jest.fn(() => Promise.resolve({
    compile: jest.fn(),
    fit: jest.fn(() => Promise.resolve()),
    predict: jest.fn(() => ({
      data: jest.fn(() => Promise.resolve([0.1, 0.9, 0.05, 0.02])),
      dispose: jest.fn()
    })),
    save: jest.fn(() => Promise.resolve({})),
    dispose: jest.fn(),
    layers: [{ getConfig: () => ({ batchInputShape: [null, 100] }) }]
  })),
  io: {
    fromMemory: jest.fn(),
    withSaveHandler: jest.fn((handler) => handler)
  }
}));

// Polyfill for structuredClone (needed for fake-indexeddb)
if (!global.structuredClone) {
  global.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

// Polyfill for TextEncoder and TextDecoder (needed for Natural.js)
if (!global.TextEncoder) {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Mock IndexedDB for testing
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';

(global as any).indexedDB = new FDBFactory();
(global as any).IDBKeyRange = FDBKeyRange;