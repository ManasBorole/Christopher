"""Pronunciation-scoring microservice for the Christopher voice tutor.

The Next.js app streams a learner's spoken clip through OpenAI's Realtime API to
get a transcript, then calls this FastAPI service to grade the attempt against
the reference phrase and return per-word scores plus coaching feedback.

Run:  uvicorn pronunciation_service:app --reload
Test: pytest pronunciation_service.py
"""
from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Christopher Pronunciation Service")


class ScoreRequest(BaseModel):
    reference: str          # phrase the learner was asked to say
    transcript: str         # what the ASR heard
    language: str = "en"


class WordScore(BaseModel):
    word: str
    score: float            # 0-1, similarity of heard word to reference word


class ScoreResponse(BaseModel):
    overall: float
    words: list[WordScore]
    feedback: str


def _similarity(a: str, b: str) -> float:
    """1 - normalized Levenshtein distance. Character-level stand-in for a
    phoneme distance; keeps the service dependency-free and deterministic."""
    a, b = a.lower(), b.lower()
    if not a and not b:
        return 1.0
    m, n = len(a), len(b)
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        cur = [i] + [0] * n
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
        prev = cur
    return 1 - prev[n] / max(m, n)


def score(req: ScoreRequest) -> ScoreResponse:
    ref_words = req.reference.split()
    heard = req.transcript.split()
    words = [
        WordScore(word=w, score=round(_similarity(w, heard[i] if i < len(heard) else ""), 2))
        for i, w in enumerate(ref_words)
    ]
    overall = round(sum(w.score for w in words) / len(words), 2) if words else 0.0
    weakest = min(words, key=lambda w: w.score, default=None)
    if overall >= 0.9:
        feedback = "Excellent — clear and accurate."
    elif weakest is not None:
        feedback = f"Good attempt. Focus on pronouncing '{weakest.word}' more clearly."
    else:
        feedback = "No speech detected — try again."
    return ScoreResponse(overall=overall, words=words, feedback=feedback)


@app.post("/score", response_model=ScoreResponse)
def score_endpoint(req: ScoreRequest) -> ScoreResponse:
    return score(req)


def test_scoring():
    perfect = score(ScoreRequest(reference="good morning", transcript="good morning"))
    assert perfect.overall == 1.0

    partial = score(ScoreRequest(reference="morning", transcript="mornig"))
    assert 0.5 < partial.overall < 0.9
    assert "morning" in partial.feedback        # flags the mispronounced word

    empty = score(ScoreRequest(reference="hello", transcript=""))
    assert empty.overall == 0.0


if __name__ == "__main__":
    test_scoring()
    print("self-check passed")
