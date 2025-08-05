# Testing Documentation

## Overview

This document outlines the comprehensive testing infrastructure and test coverage implemented for the C1 Northstar Sales Intelligence Platform MVP frontend.

## Testing Infrastructure

### Setup

The testing infrastructure has been configured with:

- **Jest** - Test runner and assertion library
- **React Testing Library** - Component testing utilities
- **@testing-library/user-event** - User interaction simulation
- **jest-axe** - Accessibility testing
- **@testing-library/jest-dom** - Custom DOM matchers

### Configuration

- **jest.config.js** - Jest configuration with Next.js integration
- **jest.setup.js** - Global test setup and mocks
- **Test utilities** - Custom render functions and helpers

### Scripts

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:ci       # Run tests in CI mode
npm run test:accessibility # Run accessibility-specific tests
```

## Test Coverage

### ✅ Completed Test Suites

#### 1. Authentication Flow Tests

**Location**: `src/__tests__/components/auth/`

- **MicrosoftSignInButton** - Complete test coverage including:
  - Rendering with proper UI elements
  - Loading states and user feedback
  - Sign-in functionality with NextAuth integration
  - Error handling and retry logic
  - Accessibility compliance (ARIA, keyboard navigation)
  - Visual state management

- **AuthWrapper** - Authentication boundary component:
  - Session state management
  - Redirect behavior for unauthenticated users
  - Loading states during authentication checks
  - Integration with auth store
  - Error boundary behavior

- **AuthStore** - Zustand store for authentication:
  - User state management
  - Authentication status tracking
  - Login/logout operations
  - State persistence and consistency

#### 2. Dashboard Component Tests

**Location**: `src/__tests__/components/dashboard/`

- **DashboardStats** - Statistics display component:
  - Data visualization and formatting
  - Change indicators (positive/negative trends)
  - Responsive grid layout
  - Icon and color theming
  - Accessibility compliance

- **StatusCard** - Job/process status cards:
  - Multiple status states (running, completed, failed, pending, queued)
  - Progress indicators and animations
  - Action menus and controls
  - Time formatting and last updated displays
  - Interactive elements and click handlers

#### 3. File Upload System Tests

**Location**: `src/__tests__/components/upload/` and `src/__tests__/stores/`

- **FileUploadZone** - Main upload interface:
  - Drag and drop functionality
  - File validation (type, size, count limits)
  - Upload progress tracking
  - Error handling and user feedback
  - Multiple file selection
  - Auto-upload vs manual upload modes

- **UploadStore** - File upload state management:
  - File queue management
  - Upload progress tracking
  - Status state management
  - File validation logic
  - Computed state functions

### 🚧 Partially Completed

#### 4. Test Utilities and Accessibility Helpers

**Location**: `src/__tests__/utils/`

- **Test Utils** - Custom render functions with providers
- **Accessibility Helpers** - Automated accessibility testing
- **Mock Helpers** - File mocking and test data creation

## Testing Patterns and Best Practices

### Component Testing Strategy

1. **Arrange-Act-Assert Pattern**

   ```typescript
   // Arrange
   const mockProps = { onClick: jest.fn() }

   // Act
   render(<Component {...mockProps} />)
   const button = screen.getByRole('button')
   fireEvent.click(button)

   // Assert
   expect(mockProps.onClick).toHaveBeenCalled()
   ```

2. **User-Centric Testing**
   - Test behavior from user perspective
   - Use semantic queries (getByRole, getByLabelText)
   - Simulate real user interactions with userEvent

3. **Accessibility Testing**
   ```typescript
   it('has no accessibility violations', async () => {
     const { container } = render(<Component />)
     await testAccessibility(container)
   })
   ```

### Store Testing Strategy

1. **State Management Testing**
   - Test initial state
   - Test action handlers
   - Test computed values
   - Test state consistency

2. **Mock Strategy**
   - Mock external dependencies
   - Mock browser APIs (File, FileList, etc.)
   - Mock third-party libraries (icons, auth)

### Error Handling Testing

- Network failures
- Validation errors
- Authentication failures
- File upload errors
- User feedback mechanisms

## Test Coverage Goals

Current test coverage focuses on:

- **Critical User Paths**: Authentication, file upload, dashboard interaction
- **Error Scenarios**: Network issues, validation failures, edge cases
- **Accessibility**: Screen reader compatibility, keyboard navigation
- **Responsive Design**: Mobile and desktop layouts
- **State Management**: Store actions and computed values

## Known Issues and Limitations

1. **ES Module Compatibility**: Some third-party libraries require additional Jest configuration
2. **Mock Complexity**: Complex components may require extensive mocking
3. **Integration Tests**: Limited integration testing between components
4. **Performance Tests**: No performance benchmarking tests implemented

## Future Testing Priorities

### 📋 Pending Test Suites

1. **Job Submission Form Tests**
   - Form validation
   - Submission handling
   - Progress tracking

2. **Navigation and Routing Tests**
   - Route protection
   - Navigation behavior
   - Breadcrumb functionality

3. **Data Tables Tests**
   - Sorting functionality
   - Filtering capabilities
   - Pagination behavior

4. **Real-time Updates Tests**
   - WebSocket connection handling
   - Live data updates
   - Connection error recovery

5. **Error Handling Tests**
   - Global error boundaries
   - API error responses
   - User error feedback

6. **Advanced Accessibility Tests**
   - Color contrast validation
   - Screen reader scenarios
   - Keyboard-only navigation flows

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Run specific test file
npm test -- ComponentName.test.tsx

# Run tests with coverage report
npm run test:coverage
```

### Continuous Integration

Tests are configured to run in CI with the following command:

```bash
npm run test:ci
```

This runs tests once with coverage reporting and no watch mode.

## Test File Structure

```
src/
├── __tests__/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── MicrosoftSignInButton.test.tsx
│   │   │   └── AuthWrapper.test.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardStats.test.tsx
│   │   │   └── StatusCard.test.tsx
│   │   └── upload/
│   │       └── FileUploadZone.test.tsx
│   ├── stores/
│   │   ├── authStore.test.ts
│   │   └── uploadStore.test.ts
│   └── utils/
│       ├── accessibility-helpers.ts
│       └── test-utils.tsx
├── jest.config.js
└── jest.setup.js
```

## Conclusion

The testing infrastructure provides a solid foundation for ensuring code quality and preventing regressions. The focus on user-centric testing, accessibility compliance, and comprehensive error handling helps ensure a robust and inclusive application.

The test suite covers the most critical user flows and provides confidence in the authentication system, file upload functionality, and dashboard interactions. Future work should focus on expanding coverage to remaining components and implementing integration tests.
