FROM node:20-slim

# Install system dependencies, unzip, and google-chrome-stable for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg ca-certificates procps libxss1 unzip \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to skip downloading browser during npm install & use installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
