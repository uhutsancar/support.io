FROM node:18-alpine

RUN apk add --no-cache bash

WORKDIR /usr/src/admin-panel

COPY package*.json ./
RUN npm install

# Copy source (dev will mount the folder)
COPY . .

EXPOSE 5173

# Start Vite dev server listening on all interfaces so host can access it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
