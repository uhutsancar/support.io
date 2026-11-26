# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a

RUN apk add --no-cache bash

WORKDIR /usr/src/admin-panel

COPY package*.json ./
RUN npm ci

# Copy source (dev will mount the folder)
COPY . .

EXPOSE 5173

# Start Vite dev server listening on all interfaces so host can access it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
