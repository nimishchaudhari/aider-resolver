FROM node:18-alpine

# Install git and other dependencies
RUN apk add --no-cache git python3 py3-pip curl bash

# Install Aider
RUN pip3 install aider-chat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Set entrypoint
ENTRYPOINT ["node", "/app/dist/index.js"]
