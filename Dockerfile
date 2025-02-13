FROM --platform=$TARGETPLATFORM node:20-slim

ARG TARGETARCH
ENV TARGETARCH=${TARGETARCH:-amd64}

# Install dependencies for ffmpeg and chromium
RUN apt-get update && apt-get install -y \
    ffmpeg \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app directory
WORKDIR /app

# Install global dependencies
RUN npm install -g nodemon rrvideo

# Copy package files
COPY backend/package*.json ./backend/
COPY sdk/package*.json ./sdk/

# Install dependencies
RUN cd backend && npm install
RUN cd sdk && npm install

# Copy source code
COPY backend ./backend
COPY sdk ./sdk

# Build SDK
RUN cd sdk && npm run build

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3100

# Copy start script
COPY start-dev.sh /app/start-dev.sh
RUN chmod +x /app/start-dev.sh

# Start with nodemon for development
CMD ["/app/start-dev.sh"] 