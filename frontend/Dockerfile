FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
# npm ci 대신 install 사용: Windows에서 생성한 lockfile에 linux용 optional 의존성
# (@emnapi/* — rolldown/tailwind oxide의 wasm 폴백)이 누락되는 npm 버그 회피
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build


FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
