FROM golang:1.23-alpine AS build
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -mod=readonly -o /out/api ./cmd/api

FROM alpine:3.21
RUN adduser -D app
USER app
COPY --from=build /out/api /api
EXPOSE 8080
ENTRYPOINT ["/api"]
