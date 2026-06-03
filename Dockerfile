FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install dependencies and create directories
USER root

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Change ownership of the app directory to the pptruser (provided by the base image)
RUN chown -R pptruser:pptruser /usr/src/app

# Switch back to the non-root user
USER pptruser

# Start the application
CMD [ "npm", "start" ]
