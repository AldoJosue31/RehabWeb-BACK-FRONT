FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY . .
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 4200
CMD ["sh", "/app/docker-entrypoint.sh"]
