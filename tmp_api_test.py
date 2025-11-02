from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)

payload = {
    "exam_id": 1,
    "candidate_first_name": "a",
    "candidate_last_name": "b",
    "candidate_code": "c",
}

start = client.post("/exam/session/start", json=payload)
print("start", start.status_code, start.json())

session = start.json()
headers = {"Authorization": "Bearer " + session["token"]}

for block_id in (1, 2):
    resp = client.get(
        f"/exam/{session['session_id']}/questions",
        params={"block_id": block_id},
        headers=headers,
    )
    payload = resp.json()
    encoded = repr(payload).encode("unicode_escape").decode("ascii")
    print("block", block_id, resp.status_code, encoded)

