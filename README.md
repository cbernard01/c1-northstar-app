# C1 Northstar App

A modern Next.js application with Microsoft Entra ID authentication, built for enterprise deployment.

## Features

- 🔐 Microsoft Entra ID (Azure AD) authentication
- 📊 PostgreSQL database with Prisma ORM
- 🎨 Modern UI with ShadCN components
- 🚀 Ready for Azure deployment
- 🐳 Docker support for containerized deployment
- 📝 TypeScript throughout

## Prerequisites

- Node.js 20+
- PostgreSQL database
- Microsoft Entra ID app registration

## Getting Started

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Update `.env.local` with your values:
   - Database connection string
   - NextAuth configuration
   - Microsoft Entra ID credentials

3. **Set up the database:**
   ```bash
   npm run db:push
   # or for migrations
   npm run db:migrate
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Microsoft Entra ID Setup

1. Register an application in Azure Portal
2. Add redirect URI: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
3. Create a client secret
4. Update `.env.local` with:
   - `AUTH_MICROSOFT_ENTRA_ID_ID` - Application (client) ID
   - `AUTH_MICROSOFT_ENTRA_ID_SECRET` - Client secret value
   - `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` - Directory (tenant) ID

## Docker Deployment

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

2. **Production build:**
   ```bash
   docker build -t c1-northstar-app .
   ```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run db:studio` - Open Prisma Studio
- `npm run db:migrate` - Run database migrations

## Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── (auth)/       # Authentication routes
│   ├── (app)/        # Protected app routes
│   └── api/          # API routes
├── components/       # React components
│   └── ui/          # ShadCN UI components
├── lib/             # Utilities and configuration
└── types/           # TypeScript type definitions
```

## Deployment to Azure

This application is optimized for Azure App Service deployment:

1. Create an Azure App Service (Linux, Node.js 20)
2. Configure environment variables in Application Settings
3. Deploy using Azure DevOps or GitHub Actions
4. Ensure PostgreSQL database is accessible

## License

Private and confidential.