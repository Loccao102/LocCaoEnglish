FROM python:3.12-slim
WORKDIR /app
COPY ai-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY ai-service/app ./app
EXPOSE 8090
CMD ["uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8090"]
