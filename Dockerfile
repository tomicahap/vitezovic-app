# Koristimo istu verziju
FROM node:20-alpine

# OVO JE NOVO: Ovo prisiljava Next.js da koristi Webpack umjesto Turbopacka
ENV NEXT_PRIVATE_LOCAL_WEBPACK=true

RUN apk add --no-cache python3 make g++
# ... ostatak tvog Dockerfile-a

# OVO JE NOVO: Instaliramo alate potrebne za "prevodenje" koda
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Kopiramo package datoteke
COPY package*.json ./

# Instaliramo ovisnosti (sad ce raditi jer ima alate)
RUN npm install

# Kopiramo ostatak koda
COPY . .

# Radimo build
# Ogranicavamo memoriju na 1.5GB (1536MB) da ne "pukne" server
RUN NODE_OPTIONS="--max-old-space-size=1024" npm run build --no-turbo
# Izlažemo port
EXPOSE 3000

# Pokrecemo aplikaciju
CMD ["npm", "start"]