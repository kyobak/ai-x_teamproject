# 백엔드 컨테이너. Render/Fly 는 PORT 환경변수로 포트를 지정하므로 ${PORT:-8000} 으로 받습니다.
FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server server
COPY jobs/data jobs/data
ENV PYTHONUNBUFFERED=1
CMD ["sh", "-c", "python -m uvicorn app.main:app --app-dir server --host 0.0.0.0 --port ${PORT:-8000}"]
