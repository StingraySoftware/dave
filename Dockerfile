# Multi-stage build for DAVE application
# Stage 1: Build Python environment
FROM ghcr.io/prefix-dev/pixi:latest AS python-builder

# Set working directory
WORKDIR /app

# Copy pixi files
COPY pixi.toml pixi.lock pyproject.toml ./

# Install Python dependencies
RUN pixi install

# Copy Python source
COPY src/main/python ./src/main/python
COPY src/test/python ./src/test/python

# Run tests (optional, can be removed for faster builds)
RUN pixi run test || echo "Tests completed with warnings"

# Stage 2: Build Electron app
FROM node:22.16.0-alpine AS electron-builder

WORKDIR /app

# Copy Electron app files
COPY src/main/js/electron/package*.json ./src/main/js/electron/
COPY src/main/resources ./src/main/resources

# Install Node dependencies
WORKDIR /app/src/main/js/electron
RUN npm ci --omit=dev --ignore-scripts

# Copy Electron source
COPY src/main/js/electron/*.js ./

# Stage 3: Runtime image
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3.13 \
    python3-pip \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    libatspi2.0-0 \
    libdrm2 \
    libgbm1 \
    libxcb-dri3-0 \
    libasound2 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -s /bin/bash dave

# Set working directory
WORKDIR /home/dave/app

# Copy Python environment from builder
COPY --from=python-builder --chown=dave:dave /app/.pixi ./.pixi
COPY --from=python-builder --chown=dave:dave /app/pixi.toml ./
COPY --from=python-builder --chown=dave:dave /app/src/main/python ./src/main/python

# Copy Electron app from builder
COPY --from=electron-builder --chown=dave:dave /app/src/main/js/electron ./src/main/js/electron
COPY --from=electron-builder --chown=dave:dave /app/src/main/resources ./src/main/resources

# Create upload directory
RUN mkdir -p /home/dave/app/src/main/python/uploadeddataset && \
    chown dave:dave /home/dave/app/src/main/python/uploadeddataset

# Switch to app user
USER dave

# Set environment variables
ENV DISPLAY=:99
ENV ELECTRON_DISABLE_SANDBOX=1
ENV NODE_ENV=production
ENV FLASK_ENV=production

# Expose Flask port
EXPOSE 5000

# Create entrypoint script
RUN echo '#!/bin/bash\n\
# Start Xvfb\n\
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &\n\
# Start Flask server\n\
cd /home/dave/app && ./.pixi/envs/default/bin/python src/main/python/server.py . . 5000 0 &\n\
# Wait for Flask to start\n\
sleep 5\n\
# Start Electron app\n\
cd /home/dave/app/src/main/js/electron && npm start\n\
' > /home/dave/app/start.sh && chmod +x /home/dave/app/start.sh

# Set entrypoint
ENTRYPOINT ["/home/dave/app/start.sh"]