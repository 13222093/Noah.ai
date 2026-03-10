# Dockerfile for Next.js App (noah.ai)

# Stage 1: Builder
# In this stage, we install dependencies and build the Next.js application.
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package.json and lock file
COPY package*.json ./

# Force clean install for cross-platform compatibility
RUN rm -rf node_modules package-lock.json && npm install

# Copy the rest of the application source code
COPY . .

# Build the Next.js application (NEXT_STANDALONE=1 enables standalone output for Docker)
RUN NEXT_STANDALONE=1 npm run build

# Stage 2: Runner
# This is the final, lightweight image that will run in production.
FROM node:20-alpine AS runner
WORKDIR /app

# Set the environment to production
ENV NODE_ENV=production
# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Copy the standalone output from the builder stage.
# This includes only the necessary files to run the app.
COPY --from=builder /app/.next/standalone ./

# Copy the public assets
COPY --from=builder /app/public ./public

# Expose the port the app runs on
EXPOSE 3000

# The command to start the application
# The standalone output creates a server.js file to run the app.
CMD ["node", "server.js"]
