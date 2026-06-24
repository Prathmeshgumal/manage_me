import pytest

_LIST_KEYS = {
    "id", "name", "color", "sortOrder", "itemCount",
    "createdAt", "updatedAt", "items",
}
_ITEM_KEYS = {
    "id", "listId", "title", "notes", "completed", "completedAt",
    "dueDate", "starred", "sortOrder", "createdAt", "updatedAt",
}


@pytest.mark.asyncio
async def test_list_and_item_lifecycle(auth_client):
    client, _ = auth_client

    r = await client.post("/lists", json={"name": "Daily Essentials", "color": "#4FA3D1"})
    assert r.status_code == 201
    lst = r.json()
    assert set(lst) == _LIST_KEYS
    assert lst["name"] == "Daily Essentials" and lst["itemCount"] == 0 and lst["items"] == []
    lid = lst["id"]

    listed = (await client.get("/lists")).json()
    assert len(listed) == 1 and listed[0]["id"] == lid

    r = await client.post(f"/lists/{lid}/todos", json={"title": "Soap Stand"})
    assert r.status_code == 201
    item = r.json()
    assert set(item) == _ITEM_KEYS
    assert item["title"] == "Soap Stand" and item["completed"] is False and item["completedAt"] is None
    iid = item["id"]

    detail = (await client.get("/lists")).json()[0]
    assert detail["itemCount"] == 1 and detail["items"][0]["id"] == iid

    # Completing the item stamps completedAt server-side.
    done = (await client.patch(f"/todos/{iid}", json={"completed": True})).json()
    assert done["completed"] is True and done["completedAt"] is not None

    # Un-completing clears it.
    undone = (await client.patch(f"/todos/{iid}", json={"completed": False})).json()
    assert undone["completed"] is False and undone["completedAt"] is None

    assert (await client.delete(f"/todos/{iid}")).status_code == 204
    assert (await client.get("/lists")).json()[0]["itemCount"] == 0


@pytest.mark.asyncio
async def test_move_item_between_lists(auth_client):
    client, _ = auth_client
    a = (await client.post("/lists", json={"name": "A"})).json()["id"]
    b = (await client.post("/lists", json={"name": "B"})).json()["id"]
    iid = (await client.post(f"/lists/{a}/todos", json={"title": "x"})).json()["id"]

    moved = (await client.patch(f"/todos/{iid}", json={"listId": b, "sortOrder": 5})).json()
    assert moved["listId"] == b and moved["sortOrder"] == 5


@pytest.mark.asyncio
async def test_delete_list_cascades_items(auth_client):
    client, _ = auth_client
    lid = (await client.post("/lists", json={"name": "Trip"})).json()["id"]
    iid = (await client.post(f"/lists/{lid}/todos", json={"title": "Pack"})).json()["id"]

    assert (await client.delete(f"/lists/{lid}")).status_code == 204
    assert (await client.patch(f"/todos/{iid}", json={"title": "y"})).status_code == 404


@pytest.mark.asyncio
async def test_lists_are_workspace_isolated(auth_client, client):
    owner, _ = auth_client
    lid = (await owner.post("/lists", json={"name": "Mine"})).json()["id"]

    other = await client.post("/auth/signup", json={"email": "other-todo@test.com", "password": "password1"})
    assert other.status_code == 201
    # Same client now authenticated as the second user.
    assert (await client.get("/lists")).json() == []
    assert (await client.patch(f"/lists/{lid}", json={"name": "Hijack"})).status_code == 404
