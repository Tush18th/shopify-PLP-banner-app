FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Remix app
RUN npm run build

# Expose port
EXPOSE 3000

# Run migrations then start
CMD ["npm", "run", "docker-start"]
