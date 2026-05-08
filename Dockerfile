FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server/ ./server/
COPY client/ ./client/
COPY data/ ./data/
RUN mkdir -p /app/data /app/uploads
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs && \
    chown -R nodeapp:nodejs /app
USER nodeapp
EXPOSE 3001
CMD ["node", "server/index.js"]