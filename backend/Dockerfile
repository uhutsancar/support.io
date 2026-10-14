# Same Node image as backend/Dockerfile.prod, pinned by digest.
FROM node:26.11.1-alpine@sha256:143494b1da2945f061539253adc65e4f1569ddf07da2d384c022c791a9d90a4a

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
