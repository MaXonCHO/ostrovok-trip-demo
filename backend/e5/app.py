"""Private E5 score service. Hotel content, filters and SQLite stay in Next.js."""
import hashlib
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

DATA = Path(os.environ.get("E5_DATA_DIR", Path(__file__).resolve().parents[2] / "data/final"))
MODEL = "intfloat/multilingual-e5-small"
state = {}
inference_lock = Lock()

@asynccontextmanager
async def lifespan(app):
    metadata = json.loads((DATA / "embedding_metadata.json").read_text())
    text_bytes = (DATA / "hotel_search_texts.jsonl").read_bytes()
    documents = [json.loads(line) for line in text_bytes.decode().splitlines() if line.strip()]
    ids = json.loads((DATA / "hotel_embedding_ids.json").read_text())
    if metadata["model"] != MODEL or metadata["dimension"] != 384 or metadata.get("normalized") is not True:
        raise ValueError("Unsupported embedding model or normalization")
    if ids != [str(d["hotel_id"]) for d in documents] or len(ids) != len(set(ids)):
        raise ValueError("Embedding IDs do not match document order")
    if hashlib.sha256(text_bytes).hexdigest() != metadata["text_file_sha256"]:
        raise ValueError("Embedding source hash mismatch")
    matrix = np.load(DATA / "hotel_embeddings.npy", allow_pickle=False)
    if matrix.shape != (len(ids), 384) or len(ids) != metadata["count"] or not np.isfinite(matrix).all():
        raise ValueError("Invalid embedding matrix")
    if not np.allclose(np.linalg.norm(matrix, axis=1), 1, atol=1e-3):
        raise ValueError("Embedding rows are not normalized")
    model = SentenceTransformer(MODEL, device="cpu")
    model.max_seq_length = 512
    # Check real model compatibility with three archived rows before serving.
    samples = sorted(set([0, len(ids)//2, len(ids)-1]))
    encoded = model.encode(["passage: " + documents[i]["embedding_text"] for i in samples], normalize_embeddings=True, convert_to_numpy=True)
    compatibility = [float(np.dot(encoded[j], matrix[i])) for j,i in enumerate(samples)]
    if min(compatibility) < 0.995:
        raise ValueError("Model is incompatible with archived embedding rows")
    state.update(model=model, matrix=matrix, ids=ids, metadata=metadata, compatibility=compatibility)
    yield
    state.clear()

app = FastAPI(title="Ostrovok E5 scores", lifespan=lifespan)

class Query(BaseModel):
    query: str = Field(min_length=2, max_length=4000)

@app.get("/api/health")
def health():
    if not state:
        raise HTTPException(503, "E5 not ready")
    return {"status":"ok", "engine":"e5", "model":MODEL, "count":len(state["ids"]), "dimension":384,
            "textSha256":state["metadata"]["text_file_sha256"], "compatibilityCosines":state["compatibility"]}

@app.post("/api/semantic-scores")
def scores(body: Query):
    if not state:
        raise HTTPException(503, "E5 not ready")
    with inference_lock:
        vector = state["model"].encode(["query: " + body.query.strip()], normalize_embeddings=True, convert_to_numpy=True)[0]
    scores = state["matrix"] @ vector
    if not np.isfinite(scores).all():
        raise HTTPException(503, "Non-finite E5 score")
    return {"engine":"e5", "model":MODEL, "dimension":384, "count":len(state["ids"]),
            "textSha256":state["metadata"]["text_file_sha256"],
            "scores":[{"hotel_id":hotel_id,"score":float(score)} for hotel_id,score in zip(state["ids"],scores)]}
