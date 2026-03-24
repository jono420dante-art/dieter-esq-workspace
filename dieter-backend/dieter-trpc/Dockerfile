FROM node:20-alpine

WORKDIR /app

COPY package*.json /app/
RUN npm ci --include=dev

COPY src /app/src
COPY tsconfig.json /app/tsconfig.json

EXPOSE 8790

CMD ["sh", "-c", "npm run start"]
