# TC-10, TC-11

def test_TC10_kpi_cards_load(client, agent_headers):
    """TC-10: KPI endpoint returns correct structure"""
    res = client.get("/analytics/kpi", headers=agent_headers)
    assert res.status_code == 200
    data = res.json()
    assert "total_tickets" in data
    assert "resolution_rate" in data
    assert "avg_response_time_seconds" in data
    assert "negative_sentiment_pct" in data


def test_TC11_sentiment_trend_returns_list(client, agent_headers):
    """TC-11: Sentiment trend endpoint returns a list"""
    res = client.get("/analytics/sentiment-trend", headers=agent_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)
