import pytest


@pytest.mark.asyncio
async def test_label_crud(auth_client):
    client, _ = auth_client
    c = await client.post("/labels", json={"name": "bug"})
    assert c.status_code == 201
    lb = c.json()
    assert set(lb) == {"id", "name", "color", "createdAt"}
    assert lb["name"] == "bug" and lb["color"] == "#8A8A86"
    lid = lb["id"]

    assert len((await client.get("/labels")).json()) == 1
    u = await client.patch(f"/labels/{lid}", json={"color": "#112233"})
    assert u.status_code == 200 and u.json()["color"] == "#112233"
    assert (await client.delete(f"/labels/{lid}")).status_code == 204
    assert (await client.patch(f"/labels/{lid}", json={"name": "x"})).status_code == 404
