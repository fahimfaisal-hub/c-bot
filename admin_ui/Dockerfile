FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
RUN useradd --create-home --uid 1000 --shell /bin/bash appuser
COPY --from=build --chown=appuser:appuser /app/dist ./dist
USER appuser
EXPOSE 3000
CMD ["python3", "-m", "http.server", "3000", "--directory", "dist"]
