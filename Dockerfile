# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npx vite build

# Stage 2: Build backend
FROM golang:1.25-alpine AS backend-build
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -o /threelab-server .

# Stage 3: Production image
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-build /threelab-server ./threelab-server
COPY --from=frontend-build /app/frontend/dist ./static

ENV THREELAB_PORT=8080
ENV THREELAB_STATIC_DIR=/app/static

EXPOSE 8080
CMD ["./threelab-server"]
