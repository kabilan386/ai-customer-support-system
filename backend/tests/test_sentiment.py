# TC-07, TC-08
from services.sentiment_service import analyze
from models.models import SentimentLabel


def test_TC07_positive_message():
    """TC-07: Positive message → score > 0, label positive"""
    score, label = analyze("This is absolutely wonderful! I love the service!")
    assert score > 0
    assert label == SentimentLabel.positive


def test_TC08_negative_message():
    """TC-08: Negative message → score < 0, label negative"""
    score, label = analyze("This is terrible and I hate everything about it!")
    assert score < 0
    assert label == SentimentLabel.negative
