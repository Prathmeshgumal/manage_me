import pytest


@pytest.mark.asyncio
async def test_general_shelf_autocreates(auth_client):
    client, _ = auth_client
    r = await client.get("/shelf")
    assert r.status_code == 200
    s = r.json()
    assert s["projectId"] is None and s["books"] == []
    assert set(s) == {"id", "projectId", "name", "description", "books"}


@pytest.mark.asyncio
async def test_book_and_page_lifecycle(auth_client):
    client, _ = auth_client
    shelf = (await client.get("/shelf")).json()
    b = await client.post(f"/shelves/{shelf['id']}/books", json={"name": "Notes"})
    assert b.status_code == 201
    book = b.json()
    assert set(book) == {"id", "name", "description", "color", "sortOrder", "createdAt", "updatedAt"}
    bid = book["id"]

    shelf2 = (await client.get("/shelf")).json()
    assert len(shelf2["books"]) == 1 and shelf2["books"][0]["pageCount"] == 0

    p = await client.post(f"/books/{bid}/pages", json={"title": "Page 1"})
    assert p.status_code == 201
    page = p.json()
    assert set(page) == {"id", "bookId", "title", "content", "sortOrder", "createdAt", "updatedAt"}
    pid = page["id"]

    got_book = (await client.get(f"/books/{bid}")).json()
    assert len(got_book["pages"]) == 1 and got_book["pages"][0]["id"] == pid

    up = await client.patch(f"/pages/{pid}", json={"content": "hello"})
    assert up.status_code == 200 and up.json()["content"] == "hello"

    assert (await client.delete(f"/books/{bid}")).status_code == 204
    assert (await client.get(f"/books/{bid}")).status_code == 404


@pytest.mark.asyncio
async def test_unknown_shelf_404(auth_client):
    client, _ = auth_client
    r = await client.post("/shelves/does-not-exist/books", json={"name": "x"})
    assert r.status_code == 404 and r.json()["error"]["message"] == "Shelf not found"
