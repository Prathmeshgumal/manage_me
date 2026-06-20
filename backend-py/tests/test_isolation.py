import pytest


@pytest.mark.asyncio
async def test_cross_workspace_task_is_404(client):
    # user A creates a task
    await client.post("/auth/signup", json={"email": "owner@x.com", "password": "password1"})
    t = await client.post("/tasks", json={"title": "secret"})
    tid = t.json()["id"]
    await client.post("/auth/logout")
    # user B cannot see it
    await client.post("/auth/signup", json={"email": "intruder@x.com", "password": "password1"})
    assert (await client.get(f"/tasks/{tid}")).status_code == 404
    assert (await client.delete(f"/tasks/{tid}")).status_code == 404


@pytest.mark.asyncio
async def test_unknown_route_authenticated_404(auth_client):
    client, _ = auth_client
    r = await client.get("/nope/nope")
    assert r.status_code == 404
