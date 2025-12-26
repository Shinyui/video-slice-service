FROM node:20-bullseye

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY src ./src

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/app.js"]

