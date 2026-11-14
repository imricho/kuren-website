# Development image: runs the Vite dev server with hot reload.
# (A production build will be served as static files by Nginx in a later workstream.)
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
