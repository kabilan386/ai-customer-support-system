import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    client.post("/auth/register", json={"email": "test@example.com", "name": "Test", "password": "pass123", "role": "customer"})
    res = client.post("/auth/login", json={"email": "test@example.com", "password": "pass123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def agent_headers(client):
    client.post("/auth/register", json={"email": "agent@example.com", "name": "Agent", "password": "pass123", "role": "agent"})
    res = client.post("/auth/login", json={"email": "agent@example.com", "password": "pass123"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
