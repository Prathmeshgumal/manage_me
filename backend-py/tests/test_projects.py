import pytest


@pytest.mark.asyncio
async def test_project_crud(auth_client):
    client, _ = auth_client
    c = await client.post("/projects", json={"name": "Site"})
    assert c.status_code == 201
    p = c.json()
    assert p["name"] == "Site" and p["color"] == "#8A8A86"
    assert set(p) == {"id", "name", "color", "githubRepoId", "githubRepoFullName", "githubInstallationId", "createdAt", "updatedAt"}
    pid = p["id"]

    assert len((await client.get("/projects")).json()) == 1

    u = await client.patch(f"/projects/{pid}", json={"name": "Site2"})
    assert u.status_code == 200 and u.json()["name"] == "Site2"

    assert (await client.delete(f"/projects/{pid}")).status_code == 204
    assert (await client.patch(f"/projects/{pid}", json={"name": "x"})).status_code == 404


@pytest.mark.asyncio
async def test_bad_color_400(auth_client):
    client, _ = auth_client
    r = await client.post("/projects", json={"name": "x", "color": "red"})
    assert r.status_code == 400 and r.json()["error"]["message"] == "Validation failed"
