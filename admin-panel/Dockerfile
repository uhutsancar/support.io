# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80

RUN apk add --no-cache bash

WORKDIR /usr/src/admin-panel

COPY package*.json ./
RUN npm install

# Copy source (dev will mount the folder)
COPY . .

EXPOSE 5173

# Start Vite dev server listening on all interfaces so host can access it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
