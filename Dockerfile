FROM node:20-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/workspace
EXPOSE 80
ENV PORT=80 HOST=0.0.0.0 WORKSPACE_DIR=/app/workspace
CMD ["node", "server.js"]
