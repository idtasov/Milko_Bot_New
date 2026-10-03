FROM node:22-alpine
WORKDIR /usr/src/app
# Install dependencies first so Docker can cache this layer between code changes
COPY package.json ./
RUN npm install --omit=dev
COPY . .
# Hosts that run containers (Koyeb, Fly, etc.) route traffic to this port; override with PORT
ENV PORT=4200
EXPOSE 4200
# Slash commands are registered at start (not build) because the token is only available at runtime
CMD [ "npm", "run", "deploy-and-start" ]
