import pytest


@pytest.mark.asyncio
async def test_task_crud_and_filters(auth_client):
    client, _ = auth_client
    created = await client.post("/tasks", json={"title": "First", "priority": "HIGH"})
    assert created.status_code == 201
    body = created.json()
    assert body["title"] == "First" and body["priority"] == "HIGH"
    assert body["status"] == "BACKLOG" and body["labels"] == []
    assert body["dueDate"] is None and "createdAt" in body
    tid = body["id"]

    lst = await client.get("/tasks")
    assert lst.status_code == 200 and len(lst.json()) == 1

    filt = await client.get("/tasks", params={"priority": "LOW"})
    assert filt.status_code == 200 and filt.json() == []

    got = await client.get(f"/tasks/{tid}")
    assert got.status_code == 200 and got.json()["id"] == tid

    patched = await client.patch(f"/tasks/{tid}", json={"status": "DONE", "sortOrder": 5})
    assert patched.status_code == 200 and patched.json()["status"] == "DONE"

    deleted = await client.delete(f"/tasks/{tid}")
    assert deleted.status_code == 204
    assert (await client.get(f"/tasks/{tid}")).status_code == 404


@pytest.mark.asyncio
async def test_requires_auth(client):
    assert (await client.get("/tasks")).status_code == 401


@pytest.mark.asyncio
async def test_task_with_labels(auth_client):
    client, _ = auth_client
    label = (await client.post("/labels", json={"name": "bug"})).json()
    t = await client.post("/tasks", json={"title": "x", "labelIds": [label["id"]]})
    assert t.status_code == 201
    assert t.json()["labels"] == [{"id": label["id"], "name": "bug", "color": label["color"]}]
