# Use Node.js LTS version
FROM node:18

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# Expose your app port (5000 in your case)
EXPOSE 5000

# Start the app
CMD ["node", "server.js"]
