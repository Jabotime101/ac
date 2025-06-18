# Use official Node.js LTS image
FROM node:18

# Install ffmpeg with all codecs including mp3, aac, and other audio formats
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    libmp3lame0 \
    libfdk-aac1 \
    libvorbis0a \
    libopus0 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Build Next.js app
RUN npm run build

# Expose the port Render will use
EXPOSE 10000

# Set environment variable for production
ENV NODE_ENV=production

# Start the custom server
CMD ["node", "server.js"] 