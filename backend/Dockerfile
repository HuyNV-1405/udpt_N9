FROM node:20-alpine

WORKDIR /app

# Cài đặt OpenSSL cần thiết cho Prisma trên Alpine
RUN apk add --no-cache openssl curl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 5000

CMD ["node", "dist/src/server.js"]
