from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.datasets import router as datasets_router
from app.agents.agent_01_conversational import router as agent_01_router
from app.agents.agent_02_autopilot import router as agent_02_router
from app.agents.agent_03_ml_experimenter import router as agent_03_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"], # Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(datasets_router, prefix=f"{settings.API_V1_STR}/datasets", tags=["datasets"])
app.include_router(agent_01_router, prefix=f"{settings.API_V1_STR}/agents/01", tags=["agent-01"])
app.include_router(agent_02_router, prefix=f"{settings.API_V1_STR}/agents/02", tags=["agent-02"])
app.include_router(agent_03_router, prefix=f"{settings.API_V1_STR}/agents/03", tags=["agent-03"])

@app.get("/")
def root():
    return {"message": "Welcome to Darelm API"}
