# Lumen Store - Node.js (Express) + Python engine in one container
# Build:  docker build -t lumen-store .
# Run:    docker run -p 10000:10000 --env-file .env lumen-store
FROM node:22-bookworm-slim

# Python 3 runtime for the processing engine + CA certificates for TLS to the cloud database
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python dependencies (PyMySQL)
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Node dependencies (production only)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Application code
COPY backend ./backend
COPY engine ./engine
COPY database ./database
COPY frontend ./frontend
COPY deploy ./deploy

ENV NODE_ENV=production \
    PORT=10000 \
    PYTHON_PATH=python3 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 10000
USER node
CMD ["sh", "deploy/entrypoint.sh"]
