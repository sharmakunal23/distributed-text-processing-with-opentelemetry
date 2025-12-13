# Build the browser client (Vite) then serve it via Nginx.
FROM node:24-alpine AS build
WORKDIR /client
COPY client/package.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM nginx:1.28.0-alpine
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /client/dist /usr/share/nginx/html
