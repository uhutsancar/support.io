FROM node:18-alpine

# Install bash and netcat so the container can wait for Mongo during startup
RUN apk add --no-cache bash netcat-openbsd

WORKDIR /usr/src/backend

COPY package*.json ./
RUN npm install

# Copying full source is useful for image builds; in dev we'll mount the source as a volume.
COPY . .

EXPOSE 3000

# Default to running nodemon from local node_modules so the image works standalone
CMD ["/bin/sh", "-c", "./node_modules/.bin/nodemon src/server.js"]
