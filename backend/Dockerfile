# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a

# Install bash and netcat so the container can wait for PostgreSQL during startup
RUN apk add --no-cache bash netcat-openbsd

WORKDIR /usr/src/backend

COPY package*.json ./
RUN npm ci

# Copying full source is useful for image builds; in dev we'll mount the source as a volume.
COPY . .

EXPOSE 3000

# Default to running nodemon from local node_modules so the image works standalone
CMD ["npm", "run", "dev"]
