from app.main import app
from app.pronunciation import router as pronunciation_router
from app.tts import router as tts_router

app.include_router(pronunciation_router)
app.include_router(tts_router)
