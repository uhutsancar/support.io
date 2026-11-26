# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

RUN apk add --no-cache bash

WORKDIR /usr/src/admin-panel

COPY package*.json ./
RUN npm ci

# Copy source (dev will mount the folder)
COPY . .

EXPOSE 5173

# Start Vite dev server listening on all interfaces so host can access it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
