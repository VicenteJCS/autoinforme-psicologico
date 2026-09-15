#!/usr/bin/env python3
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ORCID = os.getenv("AUTHOR_ORCID", "0000-0002-2397-2801")
MAILTO = os.getenv("CROSSREF_MAILTO", "vctxente@yahoo.es")
BUFFER_API_KEY = os.getenv("BUFFER_API_KEY", "")
BUFFER_CHANNEL_ID = os.getenv("BUFFER_CHANNEL_ID", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
STATE_PATH = Path(__file__).with_name("state.json")
TZ = ZoneInfo("Europe/Madrid")


def http_json(url, method="GET", headers=None, payload=None, timeout=45):
    headers = dict(headers or {})
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def clean_text(value):
    if not value:
        return ""
    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def date_parts(item):
    for key in ("published-online", "published-print", "published"):
        parts = (((item.get(key) or {}).get("date-parts") or [[]])[0])
        if parts:
            return parts
    return []


def fetch_crossref_works():
    params = {
        "filter": f"orcid:{ORCID},type:journal-article",
        "rows": "100",
        "sort": "published",
        "order": "desc",
        "mailto": MAILTO,
    }
    url = "https://api.crossref.org/works?" + urllib.parse.urlencode(params)
    data = http_json(url, headers={"User-Agent": f"VicenteJCS-linkedin-paper-bot/1.0 (mailto:{MAILTO})"})
    return data["message"]["items"]


def normalize_item(item):
    doi = (item.get("DOI") or "").lower().strip()
    title = clean_text((item.get("title") or [""])[0])
    journal = clean_text((item.get("container-title") or [""])[0])
    abstract = clean_text(item.get("abstract"))
    parts = date_parts(item)
    pub_date = "-".join(str(x).zfill(2) if i else str(x) for i, x in enumerate(parts)) if parts else ""
    authors = []
    author_has_orcid = False
    for a in item.get("author") or []:
        given = clean_text(a.get("given"))
        family = clean_text(a.get("family"))
        name = " ".join(x for x in (given, family) if x)
        if name:
            authors.append(name)
        a_orcid = (a.get("ORCID") or "").split("/")[-1]
        if a_orcid == ORCID:
            author_has_orcid = True
    return {
        "doi": doi,
        "title": title,
        "journal": journal,
        "abstract": abstract,
        "publication_date": pub_date,
        "authors": authors,
        "author_has_orcid": author_has_orcid,
        "url": f"https://doi.org/{doi}" if doi else (item.get("URL") or ""),
    }


def load_state():
    if not STATE_PATH.exists():
        return {"initialized": False, "known_dois": [], "posted": []}
    with STATE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state):
    with STATE_PATH.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def fallback_post(paper):
    text = [
        f"Nuevo artículo publicado: {paper['title']}",
        "",
        f"Publicado en {paper['journal']}." if paper["journal"] else "Nuevo trabajo disponible online.",
    ]
    if paper["abstract"]:
        first = re.split(r"(?<=[.!?])\s+", paper["abstract"])[0]
        if first:
            text += ["", f"El trabajo analiza {first[0].lower() + first[1:] if len(first) > 1 else first.lower()}"]
    text += ["", f"Artículo: {paper['url']}", "", "#Research #Science #AcademicResearch"]
    return "\n".join(x for x in text if x is not None).strip()


def generate_post(paper):
    if not GEMINI_API_KEY:
        return fallback_post(paper)

    prompt = f"""
Redacta una publicación de LinkedIn en español para el autor de un artículo científico recién publicado.

REGLAS OBLIGATORIAS:
- Usa exclusivamente la información incluida abajo. No inventes datos, resultados, muestra, mecanismos, implicaciones ni causalidad.
- Tono académico, humano, sobrio y directo. Evita grandilocuencia, frases de marketing y clichés.
- No uses emojis.
- Entre 900 y 1.500 caracteres si el material lo permite; si el abstract es insuficiente, escribe menos.
- Incluye el título exacto, la revista y el DOI/enlace.
- Explica brevemente la pregunta científica y los principales hallazgos solo cuando estén explícitos en el abstract.
- Distingue asociación de causalidad. No conviertas resultados observacionales en efectos causales.
- No digas que algo es 'revolucionario', 'innovador' o 'demuestra' salvo que los datos lo justifiquen de forma inequívoca.
- Termina con 3 a 5 hashtags específicos y razonables.
- Devuelve únicamente el texto final de la publicación, sin encabezados ni comentarios sobre tu proceso.

TÍTULO: {paper['title']}
REVISTA: {paper['journal']}
FECHA: {paper['publication_date']}
AUTORES: {', '.join(paper['authors'])}
DOI/URL: {paper['url']}
ABSTRACT: {paper['abstract'] or '[No disponible en Crossref]'}
""".strip()

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(GEMINI_MODEL)}:generateContent?key={urllib.parse.quote(GEMINI_API_KEY)}"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.25, "maxOutputTokens": 900},
    }
    data = http_json(url, method="POST", payload=body)
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError):
        raise RuntimeError(f"Gemini no devolvió texto utilizable: {data}")
    if not text:
        raise RuntimeError("Gemini devolvió un texto vacío")
    return text


def buffer_graphql(query):
    if not BUFFER_API_KEY:
        raise RuntimeError("Falta BUFFER_API_KEY")
    data = http_json(
        "https://api.buffer.com",
        method="POST",
        headers={"Authorization": f"Bearer {BUFFER_API_KEY}"},
        payload={"query": query},
    )
    if data.get("errors"):
        raise RuntimeError(f"Buffer GraphQL error: {data['errors']}")
    return data.get("data") or {}


def resolve_linkedin_channel():
    if BUFFER_CHANNEL_ID:
        return BUFFER_CHANNEL_ID
    org_data = buffer_graphql("query { account { organizations { id } } }")
    orgs = (((org_data.get("account") or {}).get("organizations")) or [])
    matches = []
    for org in orgs:
        oid = org.get("id")
        if not oid:
            continue
        q = f'''query {{ channels(input: {{ organizationId: {json.dumps(oid)} }}) {{ id name displayName service }} }}'''
        ch_data = buffer_graphql(q)
        for ch in ch_data.get("channels") or []:
            service = str(ch.get("service") or "").lower()
            if "linkedin" in service:
                matches.append(ch)
    if len(matches) != 1:
        names = [f"{c.get('displayName') or c.get('name')} [{c.get('id')}]" for c in matches]
        raise RuntimeError(f"No puedo elegir de forma inequívoca el canal de LinkedIn. Detectados: {names}")
    return matches[0]["id"]


def next_publish_time():
    now = dt.datetime.now(TZ)
    if 8 <= now.hour < 18:
        target = now + dt.timedelta(minutes=30)
    else:
        target = (now + dt.timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    return target.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def schedule_buffer_post(text, channel_id):
    due_at = next_publish_time()
    q = f'''mutation {{
      createPost(input: {{
        text: {json.dumps(text, ensure_ascii=False)},
        channelId: {json.dumps(channel_id)},
        schedulingType: automatic,
        mode: customScheduled,
        dueAt: {json.dumps(due_at)}
      }}) {{
        ... on PostActionSuccess {{ post {{ id text }} }}
        ... on MutationError {{ message }}
      }}
    }}'''
    data = buffer_graphql(q)
    result = data.get("createPost") or {}
    if result.get("message") and not result.get("post"):
        raise RuntimeError(f"Buffer rechazó la publicación: {result['message']}")
    post = result.get("post") or {}
    if not post.get("id"):
        raise RuntimeError(f"Buffer no devolvió un post creado: {result}")
    return post["id"], due_at


def main():
    works = [normalize_item(x) for x in fetch_crossref_works()]
    works = [x for x in works if x["doi"] and x["author_has_orcid"]]
    state = load_state()
    known = set(state.get("known_dois") or [])
    current = {x["doi"] for x in works}

    if not state.get("initialized"):
        state["initialized"] = True
        state["known_dois"] = sorted(current)
        save_state(state)
        print(f"Inicialización completada: {len(current)} DOI existentes registrados. No se publica histórico.")
        return 0

    new_papers = [x for x in works if x["doi"] not in known]
    if not new_papers:
        print("No hay artículos nuevos.")
        return 0

    channel_id = resolve_linkedin_channel()
    posted = state.setdefault("posted", [])

    for paper in reversed(new_papers):
        text = generate_post(paper)
        post_id, due_at = schedule_buffer_post(text, channel_id)
        known.add(paper["doi"])
        posted.append({
            "doi": paper["doi"],
            "title": paper["title"],
            "buffer_post_id": post_id,
            "scheduled_at": due_at,
            "detected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        })
        print(f"Programado en LinkedIn: {paper['doi']} -> {post_id} ({due_at})")

    state["known_dois"] = sorted(known)
    save_state(state)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
