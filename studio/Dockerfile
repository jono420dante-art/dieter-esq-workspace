FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ARG VITE_ENGINE_URL=http://localhost:3001
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "preview"]
