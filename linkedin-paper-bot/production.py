#!/usr/bin/env python3
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ORCID = os.getenv("AUTHOR_ORCID", "0000-0002-2397-2801")
MAILTO = os.getenv("CROSSREF_MAILTO", "vctxente@yahoo.es")
BUFFER_API_KEY = os.getenv("BUFFER_API_KEY", "")
BUFFER_CHANNEL_ID = os.getenv("BUFFER_CHANNEL_ID", "")
WATCH_START = os.getenv("WATCH_START", "2026-09-15")
STATE_PATH = Path(__file__).with_name("state.json")
TZ = ZoneInfo("Europe/Madrid")
USER_AGENT = f"VicenteJCS-linkedin-paper-bot/3.0 (mailto:{MAILTO})"


def http_json(url, method="GET", headers=None, payload=None, timeout=45):
    headers = dict(headers or {})
    headers.setdefault("User-Agent", USER_AGENT)
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
    value = html.unescape(str(value))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def crossref_date(item, key):
    parts = (((item.get(key) or {}).get("date-parts") or [[]])[0])
    if not parts:
        return ""
    return "-".join(str(x).zfill(2) if i else str(x) for i, x in enumerate(parts))


def crossref_timestamp(item, key):
    obj = item.get(key) or {}
    raw = obj.get("date-time") or obj.get("timestamp")
    if not raw:
        return ""
    if isinstance(raw, (int, float)):
        return dt.datetime.fromtimestamp(raw / 1000, tz=dt.timezone.utc).date().isoformat()
    return str(raw)[:10]


def fetch_crossref_works():
    params = {
        "filter": f"orcid:{ORCID},type:journal-article",
        "rows": "100",
        "sort": "created",
        "order": "desc",
        "mailto": MAILTO,
    }
    url = "https://api.crossref.org/works?" + urllib.parse.urlencode(params)
    return http_json(url)["message"]["items"]


def normalize(item):
    doi = (item.get("DOI") or "").lower().strip()
    authors = []
    has_orcid = False
    for author in item.get("author") or []:
        given = clean_text(author.get("given"))
        family = clean_text(author.get("family"))
        name = " ".join(x for x in (given, family) if x)
        if name:
            authors.append(name)
        if (author.get("ORCID") or "").split("/")[-1] == ORCID:
            has_orcid = True
    published = ""
    for key in ("published-online", "published-print", "published"):
        published = crossref_date(item, key)
        if published:
            break
    return {
        "doi": doi,
        "title": clean_text((item.get("title") or [""])[0]),
        "journal": clean_text((item.get("container-title") or [""])[0]),
        "abstract": clean_text(item.get("abstract")),
        "authors": authors,
        "published": published,
        "created": crossref_timestamp(item, "created"),
        "url": f"https://doi.org/{doi}" if doi else "",
        "has_orcid": has_orcid,
    }


def load_state():
    if not STATE_PATH.exists():
        return {"initialized": True, "known_dois": [], "posted": [], "watch_started_on": WATCH_START}
    with STATE_PATH.open("r", encoding="utf-8") as f:
        state = json.load(f)
    state.setdefault("known_dois", [])
    state.setdefault("posted", [])
    state.setdefault("watch_started_on", WATCH_START)
    state["initialized"] = True
    return state


def save_state(state):
    with STATE_PATH.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def is_after_watch_start(paper, watch_start):
    dates = [paper.get("created") or "", paper.get("published") or ""]
    valid = [x[:10] for x in dates if re.match(r"^\d{4}-\d{2}-\d{2}", x)]
    return any(x >= watch_start for x in valid)


def reconstruct_openalex_abstract(inv):
    if not inv:
        return ""
    pairs = []
    for word, positions in inv.items():
        for pos in positions:
            pairs.append((pos, word))
    return clean_text(" ".join(word for _, word in sorted(pairs)))


def enrich(paper):
    doi = paper["doi"]
    params = {"filter": f"doi:{doi}", "per-page": "1", "mailto": MAILTO}
    try:
        data = http_json("https://api.openalex.org/works?" + urllib.parse.urlencode(params))
        results = data.get("results") or []
        if results:
            item = results[0]
            if not paper["abstract"]:
                paper["abstract"] = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))
            if not paper["journal"]:
                source = ((item.get("primary_location") or {}).get("source") or {})
                paper["journal"] = clean_text(source.get("display_name"))
    except Exception as exc:
        print(f"Aviso OpenAlex {doi}: {exc}", file=sys.stderr)

    if not paper["abstract"]:
        params = {"query": f'DOI:"{doi}"', "format": "json", "resultType": "core", "pageSize": "1"}
        try:
            data = http_json("https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode(params))
            results = (((data.get("resultList") or {}).get("result")) or [])
            if results:
                paper["abstract"] = clean_text(results[0].get("abstractText"))
        except Exception as exc:
            print(f"Aviso Europe PMC {doi}: {exc}", file=sys.stderr)
    return paper


def sentences(text):
    text = clean_text(text)
    if not text:
        return []
    text = re.sub(r"\b(BACKGROUND|OBJECTIVE|OBJECTIVES|AIM|AIMS|METHODS|RESULTS|CONCLUSION|CONCLUSIONS)\s*:\s*", r"\1: ", text, flags=re.I)
    return [x.strip() for x in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(])", text) if len(x.strip()) >= 25]


def score(sentence, kind):
    s = sentence.lower()
    keys = {
        "objective": ["aim", "objective", "purpose", "investigat", "examin", "assess", "evaluat", "determin", "explor"],
        "result": ["results", "found", "associated", "significant", "increased", "decreased", "higher", "lower", "improved", "reduced", "correlat", "odds ratio", "confidence interval", "p<", "p ="],
        "conclusion": ["conclusion", "conclude", "suggest", "indicat", "support", "these findings"],
    }[kind]
    value = sum(2 for k in keys if k in s)
    if kind == "result" and re.search(r"\b\d+(?:[.,]\d+)?%|\bp\s*[<=>]|\b(?:or|rr|hr)\s*[=:]", s):
        value += 3
    return value


def select_facts(abstract):
    ss = sentences(abstract)
    if not ss:
        return "", [], ""
    objective = max(ss, key=lambda x: score(x, "objective"))
    if score(objective, "objective") == 0:
        objective = ss[0]
    ranked = sorted(ss, key=lambda x: score(x, "result"), reverse=True)
    results = [x for x in ranked if x != objective and score(x, "result") > 0][:2]
    conclusion = max(ss, key=lambda x: score(x, "conclusion"))
    if score(conclusion, "conclusion") == 0 or conclusion in results:
        conclusion = ""
    return objective, results, conclusion


def looks_spanish(text):
    t = " " + text.lower() + " "
    es = sum(t.count(w) for w in [" el ", " la ", " los ", " las ", " de ", " que ", " para ", " con ", " estudio "])
    en = sum(t.count(w) for w in [" the ", " of ", " and ", " to ", " with ", " study ", " were ", " was "])
    return es > en


def ensure_argos():
    try:
        import argostranslate.package as package
        import argostranslate.translate as translate
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "argostranslate==1.11.0"])
        import argostranslate.package as package
        import argostranslate.translate as translate

    langs = translate.get_installed_languages()
    en = next((x for x in langs if x.code == "en"), None)
    es = next((x for x in langs if x.code == "es"), None)
    if en and es:
        try:
            en.get_translation(es)
            return translate
        except Exception:
            pass

    package.update_package_index()
    pkg = next((p for p in package.get_available_packages() if p.from_code == "en" and p.to_code == "es"), None)
    if not pkg:
        raise RuntimeError("No existe paquete Argos en→es disponible")
    package.install_from_path(pkg.download())
    import argostranslate.translate as translate2
    return translate2


def translate(text):
    text = clean_text(text)
    if not text or looks_spanish(text):
        return text
    engine = ensure_argos()
    out = clean_text(engine.translate(text, "en", "es"))
    if not out:
        raise RuntimeError("La traducción en→es devolvió texto vacío")
    src_nums = set(re.findall(r"(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?", text))
    out_nums = set(re.findall(r"(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?", out))
    if out_nums - src_nums:
        raise RuntimeError("La traducción introdujo cifras no presentes en el original")
    return out


def hashtags(title):
    t = title.lower()
    tags = ["#Research"]
    mapping = [
        (("stress", "anxiety", "burnout"), "#StressResearch"),
        (("sleep", "insomnia", "fatigue"), "#SleepResearch"),
        (("military", "soldier", "paratrooper", "combat"), "#MilitaryMedicine"),
        (("sport", "exercise", "training", "athlete", "performance"), "#SportsScience"),
        (("nutrition", "diet", "gluten", "obesity", "metabolic"), "#NutritionResearch"),
        (("psycholog", "mental health", "depression"), "#Psychology"),
        (("heart rate variability", "hrv", "autonomic"), "#HRV"),
    ]
    for needles, tag in mapping:
        if any(x in t for x in needles) and tag not in tags:
            tags.append(tag)
        if len(tags) == 4:
            break
    for tag in ("#Science", "#AcademicResearch"):
        if len(tags) >= 3:
            break
        tags.append(tag)
    return " ".join(tags)


def build_post(paper):
    paper = enrich(paper)
    title = paper["title"]
    journal = paper["journal"] or "una revista científica"
    abstract = paper["abstract"]
    lines = [f"Nuevo artículo publicado en {journal}", "", title]
    if abstract:
        objective, results, conclusion = select_facts(abstract)
        if objective:
            lines += ["", translate(objective)]
        if results:
            lines += ["", "Resultados principales:"]
            lines += [f"• {translate(x)}" for x in results]
        if conclusion:
            lines += ["", translate(conclusion)]
    else:
        lines += ["", "El registro bibliográfico todavía no incorpora un resumen verificable; prefiero no atribuir resultados que no puedan comprobarse."]
    lines += ["", f"Artículo: {paper['url']}", "", hashtags(title)]
    text = "\n".join(lines).strip()
    if len(text) > 2800:
        text = text[:2680].rsplit(" ", 1)[0] + f"\n\nArtículo: {paper['url']}\n\n{hashtags(title)}"
    return text


def gql(query):
    if not BUFFER_API_KEY:
        raise RuntimeError("Falta BUFFER_API_KEY")
    data = http_json("https://api.buffer.com", method="POST", headers={"Authorization": f"Bearer {BUFFER_API_KEY}"}, payload={"query": query})
    if data.get("errors"):
        raise RuntimeError(f"Buffer API: {data['errors']}")
    return data.get("data") or {}


def linkedin_channel():
    if BUFFER_CHANNEL_ID:
        return BUFFER_CHANNEL_ID
    account = gql("query { account { organizations { id } } }")
    matches = []
    for org in ((account.get("account") or {}).get("organizations") or []):
        oid = org.get("id")
        data = gql(f'''query {{ channels(input: {{ organizationId: {json.dumps(oid)} }}) {{ id name displayName service }} }}''')
        matches.extend(x for x in (data.get("channels") or []) if "linkedin" in str(x.get("service") or "").lower())
    if len(matches) != 1:
        raise RuntimeError(f"Se esperaba un único canal LinkedIn y se encontraron {len(matches)}")
    return matches[0]["id"]


def schedule(text, channel):
    now = dt.datetime.now(TZ)
    target = now + dt.timedelta(minutes=30) if 8 <= now.hour < 18 else (now + dt.timedelta(days=1)).replace(hour=10, minute=0, second=0, microsecond=0)
    due = target.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    query = f'''mutation {{ createPost(input: {{ text: {json.dumps(text, ensure_ascii=False)}, channelId: {json.dumps(channel)}, schedulingType: automatic, mode: customScheduled, dueAt: {json.dumps(due)} }}) {{ ... on PostActionSuccess {{ post {{ id text }} }} ... on MutationError {{ message }} }} }}'''
    result = (gql(query).get("createPost") or {})
    if result.get("message") and not result.get("post"):
        raise RuntimeError(f"Buffer rechazó la publicación: {result['message']}")
    post = result.get("post") or {}
    if not post.get("id"):
        raise RuntimeError(f"Buffer no devolvió un post creado: {result}")
    return post["id"], due


def main():
    state = load_state()
    watch_start = state.get("watch_started_on") or WATCH_START
    known = set(state.get("known_dois") or [])

    papers = [normalize(x) for x in fetch_crossref_works()]
    papers = [x for x in papers if x["doi"] and x["has_orcid"]]
    unknown = [x for x in papers if x["doi"] not in known]

    historical = [x for x in unknown if not is_after_watch_start(x, watch_start)]
    for paper in historical:
        known.add(paper["doi"])
    if historical:
        print(f"Baselined {len(historical)} DOI históricos sin publicar.")

    eligible = [x for x in unknown if is_after_watch_start(x, watch_start)]
    eligible.sort(key=lambda x: (x.get("created") or x.get("published") or "", x["doi"]))

    state["watch_started_on"] = watch_start
    state["known_dois"] = sorted(known)
    save_state(state)

    if not eligible:
        print("No hay artículos nuevos posteriores al inicio de la vigilancia.")
        return 0

    paper = eligible[0]
    text = build_post(paper)
    post_id, due = schedule(text, linkedin_channel())
    known.add(paper["doi"])
    state["known_dois"] = sorted(known)
    state.setdefault("posted", []).append({
        "doi": paper["doi"],
        "title": paper["title"],
        "buffer_post_id": post_id,
        "scheduled_at": due,
        "detected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    })
    save_state(state)
    print(f"Programado: {paper['doi']} -> {post_id} ({due})")
    if len(eligible) > 1:
        print(f"Quedan {len(eligible)-1} artículos nuevos pendientes para ejecuciones posteriores.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
