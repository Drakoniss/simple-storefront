FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
COPY client/ ./client/
COPY data/ ./data/
RUN mkdir -p /app/data /app/uploads
EXPOSE 3001
CMD ["node", "server/index.js"]