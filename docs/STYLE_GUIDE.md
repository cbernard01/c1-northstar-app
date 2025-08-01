# Development Standards Guide

## File Organization

### File Size Limits

Files must not exceed these line limits (excluding imports, comments, and whitespace):

- Controllers/Routes: **150 lines**
- Use Cases/Services: **100 lines**
- Domain/Business Logic: **50 lines**
- Components: **150 lines**
- Utilities: **100 lines**
- Type Definitions: **150 lines**

### Directory Structure

Use this exact structure:

```bash
backend/src/
├── [domain]/
│   ├── controllers/
│   ├── use-cases/
│   ├── domain/
│   ├── types/
│   └── lib/
└── shared/

frontend/src/
├── components/
│   ├── features/[domain]/
│   ├── ui/
│   └── shared/
├── hooks/
├── services/
└── types/
```

### File Naming

Use these exact patterns:

```bash
# Backend
user-controller.ts          # ✓ kebab-case for files
create-user-use-case.ts     # ✓ action-entity-type
validate-user.ts            # ✓ verb-noun for domain
user-types.ts              # ✓ entity-types

# Frontend
UserProfile.tsx            # ✓ PascalCase for components
useUserData.ts            # ✓ camelCase starting with 'use'
user-service.ts           # ✓ kebab-case for services
```

## Naming Conventions

### Functions

Always use these patterns:

```typescript
// ✓ Actions: verbNoun
function createUser() {}
function validateEmail() {}
function updateProfile() {}

// ✓ Queries: getNoun or findNoun
function getUser() {}
function findUsers() {}
function fetchOrders() {}

// ✓ Predicates: is/has/can + Adjective
function isValid() {}
function hasPermission() {}
function canDelete() {}

// ❌ Don't use vague names
function process() {} // Too vague
function handle() {} // Too generic
function doStuff() {} // Meaningless
```

### Variables

Follow these rules:

```typescript
// ✓ Booleans: is/has/can + Adjective
const isLoading = true;
const hasPermission = false;
const canEdit = true;

// ✓ Collections: plural nouns
const users = [];
const activeOrders = [];
const completedTasks = [];

// ✓ Constants: UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;
const API_BASE_URL = "https://api.example.com";

// ❌ Don't use unclear names
const data = []; // Too generic
const temp = {}; // Meaningless
const x = 5; // Single letters (except loop counters)
```

### Types and Interfaces

Use these exact patterns:

```typescript
// ✓ Interfaces: PascalCase, descriptive
interface User {
  id: string;
  email: string;
}

// ✓ Request/Response types: end with Request/Response
interface CreateUserRequest {
  email: string;
  password: string;
}

interface CreateUserResponse {
  id: string;
  email: string;
}

// ✓ Props: ComponentName + Props
interface UserProfileProps {
  userId: string;
  onUpdate: () => void;
}

// ❌ Don't use generic names
interface Data {} // Too generic
interface Info {} // Meaningless
interface IUser {} // Don't prefix with 'I'
```

## Function Rules

### Parameters

Never exceed 4 parameters:

```typescript
// ✓ 4 or fewer parameters
function createUser(email: string, password: string, name: string, age: number) {}

// ✓ Use object for more parameters
function createUser(data: {
  email: string;
  password: string;
  name: string;
  age: number;
  address: string;
}) {}

// ❌ Too many parameters
function createUser(email: string, password: string, name: string, age: number, address: string) {}
```

### Function Length

Functions must not exceed 30 lines:

```typescript
// ✓ Focused, single-purpose function
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    throw new Error("Email is required");
  }

  if (!emailRegex.test(email)) {
    throw new Error("Invalid email format");
  }

  return true;
}

// ❌ Function too long - split into smaller functions
function processUserRegistration() {
  // 50+ lines of mixed concerns
  // Validation, creation, email sending, logging, etc.
}
```

### Nesting Depth

Never exceed 3 levels of nesting:

```typescript
// ✓ Maximum 3 levels
function processUsers(users: User[]) {
  for (const user of users) {
    // Level 1
    if (user.isActive) {
      // Level 2
      if (user.hasPermission("admin")) {
        // Level 3
        processAdminUser(user);
      }
    }
  }
}

// ❌ Too deeply nested
function processUsers(users: User[]) {
  for (const user of users) {
    // Level 1
    if (user.isActive) {
      // Level 2
      if (user.hasPermission("admin")) {
        // Level 3
        if (user.lastLogin > cutoffDate) {
          // Level 4 - TOO DEEP
          // Process user
        }
      }
    }
  }
}

// ✓ Refactor to reduce nesting
function processUsers(users: User[]) {
  const activeUsers = users.filter((user) => user.isActive);
  const adminUsers = activeUsers.filter((user) => user.hasPermission("admin"));
  const recentUsers = adminUsers.filter((user) => user.lastLogin > cutoffDate);

  recentUsers.forEach(processAdminUser);
}
```

## Layer Separation Rules

### Controllers/Routes Layer

Controllers must only handle HTTP concerns:

```typescript
// ✓ Controller responsibilities only
export async function createUser(req: Request, res: Response) {
  // 1. Validate request
  if (!req.body.email) {
    return res.status(400).json({ error: "Email required" });
  }

  // 2. Call use case
  const result = await createUserUseCase.execute(req.body);

  // 3. Return response
  return res.status(201).json(result);
}

// ❌ Business logic in controller
export async function createUser(req: Request, res: Response) {
  // Validation
  if (!req.body.email) {
    return res.status(400).json({ error: "Email required" });
  }

  // ❌ Business logic doesn't belong here
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const user = await db.users.create({
    email: req.body.email,
    password: hashedPassword,
    createdAt: new Date(),
  });

  // ❌ Side effects don't belong here
  await sendWelcomeEmail(user.email);

  return res.status(201).json(user);
}
```

### Use Cases/Services Layer

Use cases orchestrate business workflows:

```typescript
// ✓ Use case responsibilities
export class CreateUserUseCase {
  async execute(data: CreateUserRequest): Promise<User> {
    // 1. Validate business rules
    await this.validateUserCreation(data);

    // 2. Create user
    const user = await this.userDomain.createUser(data);

    // 3. Handle side effects
    await this.emailService.sendWelcomeEmail(user.email);

    // 4. Publish events
    await this.eventBus.publish("user.created", { userId: user.id });

    return user;
  }
}

// ❌ HTTP concerns in use case
export class CreateUserUseCase {
  async execute(req: Request): Promise<Response> {
    // ❌ HTTP types
    // ❌ HTTP validation
    if (!req.body.email) {
      return { status: 400, error: "Email required" };
    }

    const user = await this.createUser(req.body);
    return { status: 201, data: user }; // ❌ HTTP response
  }
}
```

### Domain Layer

Domain functions contain only business rules:

```typescript
// ✓ Pure business logic
export function validateUserAge(birthDate: Date): void {
  const age = calculateAge(birthDate);
  const MIN_AGE = 13;

  if (age < MIN_AGE) {
    throw new DomainError(`User must be at least ${MIN_AGE} years old`);
  }
}

export function calculateSubscriptionPrice(plan: Plan, discountCode?: string): number {
  let price = plan.basePrice;

  if (discountCode) {
    const discount = getDiscount(discountCode);
    price = price * (1 - discount.percentage);
  }

  return Math.round(price * 100) / 100; // Round to 2 decimals
}

// ❌ Infrastructure concerns in domain
export function validateUserAge(birthDate: Date): void {
  // ❌ Database query in domain
  const existingUser = await db.users.findByBirthDate(birthDate);

  // ❌ HTTP response in domain
  if (age < MIN_AGE) {
    return { status: 400, error: "Too young" };
  }

  // ❌ External API call in domain
  await emailService.sendAgeVerificationEmail(email);
}
```

## Error Handling

### Error Types

Create specific error classes:

```typescript
// ✓ Domain-specific errors
export class ValidationError extends Error {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`);
    this.name = "NotFoundError";
  }
}

// ✓ Use specific error types
function validateEmail(email: string): void {
  if (!email) {
    throw new ValidationError("email", "Email is required");
  }

  if (!isValidEmailFormat(email)) {
    throw new ValidationError("email", "Invalid email format");
  }
}

// ❌ Generic errors
function validateEmail(email: string): void {
  if (!email) {
    throw new Error("Bad input"); // Too generic
  }
}
```

### Error Handling Pattern

Handle errors at appropriate layers:

```typescript
// ✓ Domain layer throws specific errors
export function createUser(data: CreateUserData): User {
  if (!data.email) {
    throw new ValidationError("email", "Email is required");
  }
  // ... business logic
}

// ✓ Use case layer catches and transforms
export class CreateUserUseCase {
  async execute(data: CreateUserRequest): Promise<User> {
    try {
      return await this.userDomain.createUser(data);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new UseCaseError("User creation failed", error);
      }
      throw error;
    }
  }
}

// ✓ Controller layer converts to HTTP responses
export async function createUser(req: Request, res: Response) {
  try {
    const result = await createUserUseCase.execute(req.body);
    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
```

## Component Rules (Frontend)

### Component Structure

Components must follow this structure:

```typescript
// ✓ Proper component structure
interface UserProfileProps {
  userId: string;
  onUpdate: (user: User) => void;
}

export function UserProfile({ userId, onUpdate }: UserProfileProps) {
  // 1. Hooks at the top
  const { user, loading, error } = useUser(userId);
  const [isEditing, setIsEditing] = useState(false);

  // 2. Event handlers
  const handleEdit = () => setIsEditing(true);
  const handleSave = (userData: User) => {
    onUpdate(userData);
    setIsEditing(false);
  };

  // 3. Early returns for loading/error states
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return <NotFound />;

  // 4. Main render
  return (
    <div className="user-profile">
      {isEditing ? (
        <UserEditForm user={user} onSave={handleSave} />
      ) : (
        <UserDisplay user={user} onEdit={handleEdit} />
      )}
    </div>
  );
}

// ❌ Poor component structure
export function UserProfile({ userId, onUpdate }: UserProfileProps) {
  const { user, loading, error } = useUser(userId);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div>Error: {error}</div>
      ) : !user ? (
        <div>Not found</div>
      ) : (
        <div>
          {/* Complex nested JSX without proper separation */}
          {isEditing ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              // ❌ Complex logic inline in JSX
              const formData = new FormData(e.target);
              const userData = Object.fromEntries(formData);
              onUpdate(userData);
              setIsEditing(false);
            }}>
              {/* Form fields */}
            </form>
          ) : (
            // ❌ Large display logic inline
            <div>
              {/* Many lines of display JSX */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Testing Requirements

### Test File Naming

Use exact naming patterns:

```bash
user-controller.ts → user-controller.test.ts
UserProfile.tsx → UserProfile.test.tsx
validateEmail.ts → validateEmail.test.ts
```

### Test Structure

Tests must follow this structure:

```typescript
// ✓ Proper test structure
describe("validateEmail", () => {
  it("should accept valid email addresses", () => {
    expect(() => validateEmail("user@example.com")).not.toThrow();
    expect(() => validateEmail("test.email+tag@domain.co.uk")).not.toThrow();
  });

  it("should reject empty email", () => {
    expect(() => validateEmail("")).toThrow("Email is required");
    expect(() => validateEmail(null)).toThrow("Email is required");
  });

  it("should reject invalid email format", () => {
    expect(() => validateEmail("invalid-email")).toThrow("Invalid email format");
    expect(() => validateEmail("@domain.com")).toThrow("Invalid email format");
  });
});

// ❌ Poor test structure
describe("email tests", () => {
  it("should work", () => {
    // ❌ Vague test name and multiple assertions without clear purpose
    expect(validateEmail("user@example.com")).toBeTruthy();
    expect(validateEmail("bad")).toBeFalsy();
  });
});
```

## Documentation Requirements

### Function Comments

Add comments for complex business logic only:

```typescript
// ✓ Comment complex business rules
/**
 * Calculates subscription price with promotional discounts
 *
 * Business Rules:
 * - Student discount: 50% off for .edu emails
 * - Loyalty discount: 10% off after 12 months
 * - Discounts are not stackable
 */
function calculateSubscriptionPrice(user: User, plan: Plan): number {
  // Implementation
}

// ✓ Self-documenting code doesn't need comments
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

// ❌ Don't comment obvious code
function getUserId(): string {
  // Returns the user ID
  return this.userId;
}
```

### File Headers

Add headers only for complex files:

```typescript
/**
 * @fileoverview User authentication and authorization logic
 *
 * Handles user login, registration, and permission checking.
 * Integrates with external OAuth providers and manages JWT tokens.
 *
 * Business Rules:
 * - Users must verify email before account activation
 * - Failed login attempts are rate limited
 * - Admin users have access to all resources
 */
```

## Prohibited Patterns

### Never Do These

```typescript
// ❌ Magic numbers
setTimeout(callback, 86400000); // Use named constant
const users = data.slice(0, 10); // Use named constant

// ✓ Use named constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 10;

// ❌ Deeply nested conditions
if (user) {
  if (user.isActive) {
    if (user.hasPermission("admin")) {
      if (user.lastLogin > cutoff) {
        // Do something
      }
    }
  }
}

// ✓ Early returns or guard clauses
if (!user || !user.isActive) return;
if (!user.hasPermission("admin")) return;
if (user.lastLogin <= cutoff) return;
// Do something

// ❌ Large parameter objects without typing
function createUser(data) {
  // No type
  return api.post("/users", data);
}

// ✓ Typed parameters
interface CreateUserData {
  email: string;
  password: string;
  name: string;
}

function createUser(data: CreateUserData) {
  return api.post("/users", data);
}
```

## Enforcement

These rules are mandatory. Code that violates these standards must be refactored before merge.
