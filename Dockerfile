FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server/ ./server/
COPY client/ ./client/
COPY data/ ./data/

# Create directories for persistent volumes (writable by all users)
RUN mkdir -p /app/data /app/uploads && chmod 777 /app/data /app/uploads

# Expose application port
EXPOSE 3001

# Start application
CMD ["node", "server/index.js"]
