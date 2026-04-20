# TC-01, TC-02, TC-12, TC-13

def test_TC01_valid_login(client, auth_headers):
    """TC-01: Valid credentials login → JWT returned (200)"""
    res = client.post("/auth/login", json={"email": "test@example.com", "password": "pass123"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_TC02_invalid_password(client):
    """TC-02: Invalid password → 401"""
    res = client.post("/auth/login", json={"email": "test@example.com", "password": "wrongpass"})
    assert res.status_code == 401


def test_TC12_admin_accesses_agent_route(client, agent_headers):
    """TC-12: Agent accesses analytics route → 200"""
    res = client.get("/analytics/kpi", headers=agent_headers)
    assert res.status_code == 200


def test_TC13_customer_accesses_admin_route(client, auth_headers):
    """TC-13: Customer accesses analytics route → 403"""
    res = client.get("/analytics/kpi", headers=auth_headers)
    assert res.status_code == 403
