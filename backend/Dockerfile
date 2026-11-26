# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5

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
