#!/usr/bin/env python3
import json
import os
import urllib.request

API_KEY = os.getenv("BUFFER_API_KEY", "")


def gql(query):
    if not API_KEY:
        raise RuntimeError("Falta el secreto BUFFER_API_KEY")
    req = urllib.request.Request(
        "https://api.buffer.com",
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    if data.get("errors"):
        raise RuntimeError(f"Buffer API error: {data['errors']}")
    return data.get("data") or {}


account = gql("query { account { organizations { id name } } }")
orgs = ((account.get("account") or {}).get("organizations")) or []
if not orgs:
    raise RuntimeError("La API key funciona, pero Buffer no devuelve ninguna organización")

linkedin = []
for org in orgs:
    oid = org.get("id")
    q = f'''query {{ channels(input: {{ organizationId: {json.dumps(oid)} }}) {{ id name displayName service }} }}'''
    channels = gql(q).get("channels") or []
    linkedin.extend(c for c in channels if "linkedin" in str(c.get("service") or "").lower())

if len(linkedin) != 1:
    names = [c.get("displayName") or c.get("name") or c.get("id") for c in linkedin]
    raise RuntimeError(f"Se esperaba exactamente un canal LinkedIn y se encontraron {len(linkedin)}: {names}")

channel = linkedin[0]
print("Buffer API: OK")
print("Canal LinkedIn:", channel.get("displayName") or channel.get("name") or channel.get("id"))
