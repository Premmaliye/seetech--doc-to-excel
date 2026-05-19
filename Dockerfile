# ==========================================
# STAGE 1: Build Frontend and TS Backend
# ==========================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package management files
COPY package*.json ./

# Install all development and production dependencies
RUN npm ci

# Copy the entire workspace
COPY . .

# Compile Vite React frontend (to /dist) and TS Express server (to /dist/server)
RUN npm run build:all


# ==========================================
# STAGE 2: Lightweight Production Runner
# ==========================================
FROM node:20-slim AS runner

WORKDIR /app

# Install system dependencies (Python 3, Pip, VirtualEnv, and PDF conversion libraries)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy python dependencies and set up virtual environment
COPY python/requirements.txt ./python/
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install --no-cache-dir -r python/requirements.txt

# Configure environment path to use the Python virtual environment automatically
ENV PATH="/app/venv/bin:$PATH"

# Copy package management files and install ONLY production-grade dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JS frontend assets and backend server from builder
COPY --from=builder /app/dist ./dist

# Copy Python scripts and support files
COPY ocr_runner.py pdf_to_images.py text_extractor.py ./
COPY python/ ./python/

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the production server port
EXPOSE 3000

# Run the compiled production Express server
CMD ["node", "dist/server/index.js"]
