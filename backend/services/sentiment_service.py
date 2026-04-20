from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from models.models import SentimentLabel

_analyzer = SentimentIntensityAnalyzer()


def analyze(text: str) -> tuple[float, SentimentLabel]:
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]

    if compound >= 0.05:
        label = SentimentLabel.positive
    elif compound <= -0.05:
        label = SentimentLabel.negative
    else:
        label = SentimentLabel.neutral

    return compound, label
