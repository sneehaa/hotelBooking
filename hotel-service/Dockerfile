FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 5501

CMD ["npx", "nodemon", "--legacy-watch", "index.js"]
