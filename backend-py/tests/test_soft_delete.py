import pytest


@pytest.mark.asyncio
async def test_task_soft_delete_then_restore(auth_client):
    client, _ = auth_client
    tid = (await client.post("/tasks", json={"title": "T"})).json()["id"]

    assert (await client.delete(f"/tasks/{tid}")).status_code == 204
    assert (await client.get(f"/tasks/{tid}")).status_code == 404
    assert (await client.get("/tasks")).json() == []

    trash = (await client.get("/trash")).json()
    assert [t["id"] for t in trash["tasks"]] == [tid]

    assert (await client.post(f"/trash/task/{tid}/restore")).status_code == 204
    assert (await client.get(f"/tasks/{tid}")).status_code == 200
    assert (await client.get("/trash")).json()["tasks"] == []


@pytest.mark.asyncio
async def test_delete_project_hides_its_tasks_and_restores_them(auth_client):
    client, _ = auth_client
    pid = (await client.post("/projects", json={"name": "P"})).json()["id"]
    t1 = (await client.post("/tasks", json={"title": "in-project", "projectId": pid})).json()["id"]
    t2 = (await client.post("/tasks", json={"title": "loose"})).json()["id"]

    assert (await client.delete(f"/projects/{pid}")).status_code == 204
    # Project gone; its task gone; the loose task remains.
    assert [p["id"] for p in (await client.get("/projects")).json()] == []
    task_ids = {t["id"] for t in (await client.get("/tasks")).json()}
    assert task_ids == {t2}

    # The project is in trash; its task is NOT listed individually.
    trash = (await client.get("/trash")).json()
    assert [p["id"] for p in trash["projects"]] == [pid]
    assert t1 not in {t["id"] for t in trash["tasks"]}

    # Restoring the project brings back exactly its task.
    assert (await client.post(f"/trash/project/{pid}/restore")).status_code == 204
    assert [p["id"] for p in (await client.get("/projects")).json()] == [pid]
    assert {t["id"] for t in (await client.get("/tasks")).json()} == {t1, t2}


@pytest.mark.asyncio
async def test_deleted_project_shelf_becomes_orphan_tile(auth_client):
    client, _ = auth_client
    pid = (await client.post("/projects", json={"name": "Proj"})).json()["id"]
    shelf = (await client.get(f"/projects/{pid}/shelf")).json()
    book = (await client.post(f"/shelves/{shelf['id']}/books", json={"name": "Specs"})).json()

    assert (await client.delete(f"/projects/{pid}")).status_code == 204

    orphans = (await client.get("/shelves/orphaned")).json()
    assert len(orphans) == 1
    assert orphans[0]["name"] == "Proj" and orphans[0]["bookCount"] == 1

    # The shelf and its book are still reachable directly.
    fetched = (await client.get(f"/shelves/{shelf['id']}")).json()
    assert [b["id"] for b in fetched["books"]] == [book["id"]]

    # General shelf is never listed as an orphan.
    gen = (await client.get("/shelf")).json()
    assert gen["id"] not in {o["id"] for o in orphans}


@pytest.mark.asyncio
async def test_permanent_project_delete_keeps_library(auth_client):
    client, _ = auth_client
    pid = (await client.post("/projects", json={"name": "Proj"})).json()["id"]
    shelf = (await client.get(f"/projects/{pid}/shelf")).json()
    await client.post(f"/shelves/{shelf['id']}/books", json={"name": "Keep me"})

    await client.delete(f"/projects/{pid}")
    assert (await client.delete(f"/trash/project/{pid}")).status_code == 204

    # Project is gone from trash, but the shelf survives as an orphan tile.
    assert (await client.get("/trash")).json()["projects"] == []
    orphans = (await client.get("/shelves/orphaned")).json()
    assert [o["id"] for o in orphans] == [shelf["id"]]
    assert (await client.get(f"/shelves/{shelf['id']}")).json()["books"][0]["name"] == "Keep me"


@pytest.mark.asyncio
async def test_book_and_page_soft_delete(auth_client):
    client, _ = auth_client
    shelf = (await client.get("/shelf")).json()
    book = (await client.post(f"/shelves/{shelf['id']}/books", json={"name": "B"})).json()
    page = (await client.post(f"/books/{book['id']}/pages", json={"title": "Pg"})).json()

    assert (await client.delete(f"/pages/{page['id']}")).status_code == 204
    assert (await client.get(f"/pages/{page['id']}")).status_code == 404
    assert (await client.get(f"/books/{book['id']}")).json()["pages"] == []

    assert (await client.delete(f"/books/{book['id']}")).status_code == 204
    assert (await client.get(f"/books/{book['id']}")).status_code == 404
    assert (await client.get("/shelf")).json()["books"] == []

    trash = (await client.get("/trash")).json()
    assert [b["id"] for b in trash["books"]] == [book["id"]]
    assert [p["id"] for p in trash["pages"]] == [page["id"]]

    assert (await client.post(f"/trash/book/{book['id']}/restore")).status_code == 204
    assert (await client.get(f"/books/{book['id']}")).status_code == 200
