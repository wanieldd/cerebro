# syntax=docker/dockerfile:1
FROM nikolaik/python-nodejs:python3.13-nodejs23 AS build

WORKDIR /app

# Install frontend deps and build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci --silent
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Backend
FROM nikolaik/python-nodejs:python3.13-nodejs23 AS runtime

WORKDIR /app

# Install uv
RUN pip install uv --quiet

# Copy backend
COPY backend/ ./backend/
COPY --from=build /app/frontend/dist ./frontend/dist
COPY launch.py .

# Install backend deps
RUN cd backend && uv sync --no-dev

EXPOSE 3333

CMD ["uv", "run", "--directory", "backend", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3333"]
