FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY . .

ENV NODE_ENV=production

EXPOSE 8765

CMD ["npm", "start"]
