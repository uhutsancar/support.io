# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:26.10.0-alpine@sha256:0b36e8c136b94cd4fcf02188228e76c31ad5872eef3fec8cbd2eee500cfd9e80

# Install bash and netcat so the container can wait for PostgreSQL during startup
RUN apk add --no-cache bash netcat-openbsd

WORKDIR /usr/src/backend

COPY package*.json ./
RUN npm install

# Copying full source is useful for image builds; in dev we'll mount the source as a volume.
COPY . .

EXPOSE 3000

# Default to running nodemon from local node_modules so the image works standalone
CMD ["npm", "run", "dev"]
