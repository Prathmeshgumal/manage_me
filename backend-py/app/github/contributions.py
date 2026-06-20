from . import http

QUERY = """query {
  viewer { contributionsCollection { contributionCalendar {
    totalContributions
    weeks { contributionDays { date contributionCount } }
  } } }
}"""


def level_for_count(count: int) -> int:
    if count <= 0:
        return 0
    if count <= 3:
        return 1
    if count <= 6:
        return 2
    if count <= 9:
        return 3
    return 4


def map_calendar(raw: dict) -> dict:
    cal = raw["user"]["contributionsCollection"]["contributionCalendar"]
    return {
        "totalContributions": cal["totalContributions"],
        "weeks": [
            {"days": [
                {"date": d["date"], "count": d["contributionCount"], "level": level_for_count(d["contributionCount"])}
                for d in w["contributionDays"]
            ]}
            for w in cal["weeks"]
        ],
    }


async def fetch_contributions(user_token: str) -> dict:
    data = await http.request_json(
        "POST", f"{http.GITHUB_API}/graphql",
        headers={"Authorization": f"token {user_token}"},
        json={"query": QUERY},
    )
    return map_calendar({"user": data["data"]["viewer"]})
