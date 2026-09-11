from app.main import app
from app.pronunciation import router as pronunciation_router

app.include_router(pronunciation_router)
