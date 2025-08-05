// API Testing Setup - Node.js environment
// This setup is specifically for testing API routes in Node.js environment

// Mock NextAuth for API tests
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({
    data: null,
    status: 'loading',
  })),
  signIn: jest.fn(),
  signOut: jest.fn(),
  SessionProvider: ({ children }) => children,
}));

// Mock Next.js navigation for API tests
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Node.js File implementation for API tests
global.File = class MockFile {
  constructor(fileBits, fileName, options) {
    this.name = fileName;
    this.size = fileBits[0] ? fileBits[0].length : 0;
    this.type = options?.type || '';
  }
  
  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(this.size));
  }
  
  text() {
    return Promise.resolve('');
  }
};

// Node.js FormData implementation for API tests
global.FormData = class MockFormData {
  constructor() {
    this._data = new Map();
  }
  
  append(key, value) {
    this._data.set(key, value);
  }
  
  get(key) {
    return this._data.get(key);
  }
  
  has(key) {
    return this._data.has(key);
  }
  
  entries() {
    return this._data.entries();
  }
};

// Mock Request and Response for Next.js API testing
if (typeof Request === 'undefined') {
  global.Request = class MockRequest {
    constructor(url, options = {}) {
      this.url = url;
      this.method = options.method || 'GET';
      this.headers = new Map(Object.entries(options.headers || {}));
      this._body = options.body;
    }
    
    json() {
      return Promise.resolve(JSON.parse(this._body || '{}'));
    }
    
    formData() {
      return Promise.resolve(new FormData());
    }
    
    text() {
      return Promise.resolve(this._body || '');
    }
  };
}

if (typeof Response === 'undefined') {
  global.Response = class MockResponse {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.statusText = options.statusText || 'OK';
      this.headers = new Map(Object.entries(options.headers || {}));
    }
    
    json() {
      return Promise.resolve(JSON.parse(this.body || '{}'));
    }
    
    text() {
      return Promise.resolve(this.body || '');
    }
  };
}

// Mock Headers
if (typeof Headers === 'undefined') {
  global.Headers = class MockHeaders extends Map {
    constructor(init) {
      super();
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.set(key, value);
        });
      }
    }
  };
}

// Silence console during tests unless it's an actual error
const originalError = console.error;
const originalLog = console.log;

beforeAll(() => {
  console.error = (...args) => {
    // Only show actual errors, not React warnings
    if (
      typeof args[0] === 'string' &&
      !args[0].includes('Warning:') &&
      !args[0].includes('React')
    ) {
      originalError.call(console, ...args);
    }
  };
  
  // Keep logs for test output
  console.log = originalLog;
});

afterAll(() => {
  console.error = originalError;
  console.log = originalLog;
});
