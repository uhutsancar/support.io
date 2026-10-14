# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:26.11.1-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a

RUN apk add --no-cache bash

WORKDIR /usr/src/admin-panel

COPY package*.json ./
RUN npm install

# Copy source (dev will mount the folder)
COPY . .

EXPOSE 5173

# Start Vite dev server listening on all interfaces so host can access it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
