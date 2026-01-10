# Build stage - Use latest Go for security patches
FROM golang:1.24.4-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Copy go mod files from root (for replace directive to work)
COPY go/go.mod go/go.sum ./go/
COPY services/facilitator/go.mod ./services/facilitator/

# Download dependencies
WORKDIR /app/services/facilitator
RUN go mod download

# Copy source code
WORKDIR /app
COPY go/ ./go/
COPY services/facilitator/ ./services/facilitator/

# Build the binary
WORKDIR /app/services/facilitator
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /facilitator ./cmd/facilitator

# Runtime stage
FROM alpine:3.19

# Install ca-certificates for HTTPS
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN adduser -D -g '' appuser

# Copy binary from builder
COPY --from=builder /facilitator /facilitator

# Use non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the binary
CMD ["/facilitator"]
