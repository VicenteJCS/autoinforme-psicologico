#!/usr/bin/env python3
import json
import os
import urllib.request

POST_IDS = [
    "6aa96a9f4504a31ecca9f6bd",
    "6aa96aa072d79adab5479434",
    "6aa96aa072d79adab547945c",
    "6aa96aa1c0d537fb925a47ec",
    "6aa96aa1a5c53a80d71b494c",
    "6aa96aa2a5c53a80d71b497d",
    "6aa96aa272d79adab547949a",
    "6aa96aa25166b5f9bfd6add4",
    "6aa96aa3c0d537fb925a4849",
    "6aa96aa3c0d537fb925a4871",
]

key = os.environ["BUFFER_API_KEY"]
for post_id in POST_IDS:
    query = f'''mutation {{
      deletePost(input: {{ id: "{post_id}" }}) {{
        ... on DeletePostSuccess {{ id }}
        ... on VoidMutationError {{ message }}
      }}
    }}'''
    req = urllib.request.Request(
        "https://api.buffer.com",
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
    payload = (data.get("data") or {}).get("deletePost") or {}
    if payload.get("id"):
        print("Deleted", payload["id"])
    else:
        print("Delete response", post_id, json.dumps(data))
