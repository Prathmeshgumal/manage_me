import pytest

_DETAIL_KEYS = {
    "id", "name", "description", "category", "icon", "color",
    "itemCount", "createdAt", "updatedAt", "items",
}
_ITEM_KEYS = {
    "id", "wishlistId", "title", "description", "price", "currency",
    "status", "priority", "targetDate", "sortOrder", "createdAt", "updatedAt",
}


@pytest.mark.asyncio
async def test_wishlist_and_item_lifecycle(auth_client):
    client, _ = auth_client

    r = await client.post("/wishlists", json={"name": "Gear", "category": "Items", "color": "#4FA3D1"})
    assert r.status_code == 201
    wl = r.json()
    assert set(wl) == _DETAIL_KEYS
    assert wl["name"] == "Gear" and wl["category"] == "Items" and wl["itemCount"] == 0
    wid = wl["id"]

    listed = (await client.get("/wishlists")).json()
    assert len(listed) == 1 and listed[0]["id"] == wid and listed[0]["itemCount"] == 0

    r = await client.post(
        f"/wishlists/{wid}/items",
        json={"title": "Camera", "price": 999.5, "currency": "EUR", "priority": "MUST_HAVE"},
    )
    assert r.status_code == 201
    item = r.json()
    assert set(item) == _ITEM_KEYS
    assert item["price"] == 999.5 and item["currency"] == "EUR" and item["priority"] == "MUST_HAVE"
    iid = item["id"]

    detail = (await client.get(f"/wishlists/{wid}")).json()
    assert detail["itemCount"] == 1 and len(detail["items"]) == 1 and detail["items"][0]["id"] == iid

    up = await client.patch(f"/items/{iid}", json={"status": "PURCHASED", "price": 850})
    assert up.status_code == 200
    assert up.json()["status"] == "PURCHASED" and up.json()["price"] == 850

    assert (await client.delete(f"/items/{iid}")).status_code == 204
    assert (await client.get(f"/wishlists/{wid}")).json()["itemCount"] == 0


@pytest.mark.asyncio
async def test_delete_wishlist_cascades_items(auth_client):
    client, _ = auth_client
    wid = (await client.post("/wishlists", json={"name": "Trip"})).json()["id"]
    flights = (await client.post(f"/wishlists/{wid}/items", json={"title": "Flights"})).json()
    assert flights["currency"] == "INR"  # default currency is rupees
    iid = flights["id"]

    assert (await client.delete(f"/wishlists/{wid}")).status_code == 204
    assert (await client.get(f"/wishlists/{wid}")).status_code == 404
    assert (await client.get(f"/items/{iid}")).status_code == 404


@pytest.mark.asyncio
async def test_wishlist_patch_and_validation(auth_client):
    client, _ = auth_client
    wid = (await client.post("/wishlists", json={"name": "Home"})).json()["id"]

    up = await client.patch(f"/wishlists/{wid}", json={"name": "House", "category": "Goals"})
    assert up.status_code == 200 and up.json()["name"] == "House" and up.json()["category"] == "Goals"

    # negative price is rejected
    bad = await client.post(f"/wishlists/{wid}/items", json={"title": "x", "price": -5})
    assert bad.status_code == 400


@pytest.mark.asyncio
async def test_wishlist_workspace_isolation(client):
    # user A creates a wishlist
    await client.post("/auth/signup", json={"email": "owner@x.com", "password": "password1"})
    wid = (await client.post("/wishlists", json={"name": "Private"})).json()["id"]
    await client.post("/auth/logout")
    # user B cannot see or touch it
    await client.post("/auth/signup", json={"email": "intruder@x.com", "password": "password1"})
    assert (await client.get("/wishlists")).json() == []
    assert (await client.get(f"/wishlists/{wid}")).status_code == 404
    assert (await client.delete(f"/wishlists/{wid}")).status_code == 404
