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
STATE_PATH = Path(__file__).with_name("state.json")
TZ = ZoneInfo("Europe/Madrid")
USER_AGENT = f"VicenteJCS-linkedin-paper-bot/2.0 (mailto:{MAILTO})"


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
    data = http_json(url)
    return data["message"]["items"]


def normalize_crossref(item):
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
        "source": "Crossref",
    }


def reconstruct_openalex_abstract(inv):
    if not inv:
        return ""
    positions = []
    for word, idxs in inv.items():
        for idx in idxs:
            positions.append((idx, word))
    positions.sort()
    return clean_text(" ".join(word for _, word in positions))


def fetch_openalex_author_id():
    params = {"filter": f"orcid:{ORCID}", "per-page": "1", "mailto": MAILTO}
    url = "https://api.openalex.org/authors?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
        results = data.get("results") or []
        if not results:
            return ""
        return (results[0].get("id") or "").rsplit("/", 1)[-1]
    except Exception as exc:
        print(f"Aviso: OpenAlex author lookup falló: {exc}", file=sys.stderr)
        return ""


def fetch_openalex_works():
    author_id = fetch_openalex_author_id()
    if not author_id:
        return []
    params = {
        "filter": f"author.id:{author_id},has_doi:true,type:article",
        "sort": "publication_date:desc",
        "per-page": "100",
        "mailto": MAILTO,
    }
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
    except Exception as exc:
        print(f"Aviso: OpenAlex works falló: {exc}", file=sys.stderr)
        return []
    out = []
    for item in data.get("results") or []:
        doi_raw = item.get("doi") or ""
        doi = doi_raw.replace("https://doi.org/", "").lower().strip()
        if not doi:
            continue
        loc = item.get("primary_location") or {}
        source = loc.get("source") or {}
        journal = clean_text(source.get("display_name"))
        authors = []
        for a in item.get("authorships") or []:
            name = clean_text((a.get("author") or {}).get("display_name"))
            if name:
                authors.append(name)
        out.append({
            "doi": doi,
            "title": clean_text(item.get("title")),
            "journal": journal,
            "abstract": reconstruct_openalex_abstract(item.get("abstract_inverted_index")),
            "publication_date": clean_text(item.get("publication_date")),
            "authors": authors,
            "author_has_orcid": True,
            "url": f"https://doi.org/{doi}",
            "source": "OpenAlex",
        })
    return out


def enrich_from_openalex(paper):
    if not paper.get("doi"):
        return paper
    params = {"filter": f"doi:{paper['doi']}", "per-page": "1", "mailto": MAILTO}
    url = "https://api.openalex.org/works?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
        results = data.get("results") or []
        if not results:
            return paper
        item = results[0]
    except Exception:
        return paper
    abstract = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))
    loc = item.get("primary_location") or {}
    source = loc.get("source") or {}
    if abstract and not paper.get("abstract"):
        paper["abstract"] = abstract
    if not paper.get("journal"):
        paper["journal"] = clean_text(source.get("display_name"))
    if not paper.get("title"):
        paper["title"] = clean_text(item.get("title"))
    if not paper.get("publication_date"):
        paper["publication_date"] = clean_text(item.get("publication_date"))
    return paper


def enrich_from_europe_pmc(paper):
    if paper.get("abstract") or not paper.get("doi"):
        return paper
    params = {
        "query": f'DOI:"{paper["doi"]}"',
        "format": "json",
        "resultType": "core",
        "pageSize": "1",
    }
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode(params)
    try:
        data = http_json(url)
        results = (((data.get("resultList") or {}).get("result")) or [])
        if results:
            abstract = clean_text(results[0].get("abstractText"))
            if abstract:
                paper["abstract"] = abstract
    except Exception as exc:
        print(f"Aviso: Europe PMC no pudo enriquecer {paper['doi']}: {exc}", file=sys.stderr)
    return paper


def merge_works(crossref, openalex):
    merged = {}
    for p in openalex + crossref:
        doi = p.get("doi")
        if not doi:
            continue
        if doi not in merged:
            merged[doi] = p.copy()
            continue
        cur = merged[doi]
        for key in ("title", "journal", "abstract", "publication_date", "url"):
            if p.get(key) and (not cur.get(key) or len(str(p[key])) > len(str(cur[key]))):
                cur[key] = p[key]
        if p.get("authors") and len(p["authors"]) > len(cur.get("authors") or []):
            cur["authors"] = p["authors"]
        cur["author_has_orcid"] = bool(cur.get("author_has_orcid") or p.get("author_has_orcid"))
    return list(merged.values())


def load_state():
    if not STATE_PATH.exists():
        return {"initialized": False, "known_dois": [], "posted": []}
    with STATE_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_state(state):
    with STATE_PATH.open("w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def split_sentences(text):
    text = clean_text(text)
    if not text:
        return []
    text = re.sub(r"\b(BACKGROUND|OBJECTIVE|OBJECTIVES|AIM|AIMS|METHODS|RESULTS|CONCLUSION|CONCLUSIONS)\s*:\s*", r"\1: ", text, flags=re.I)
    chunks = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9(])", text)
    return [c.strip() for c in chunks if len(c.strip()) >= 25]


def score_sentence(sentence, role):
    s = sentence.lower()
    patterns = {
        "objective": ["aim", "objective", "purpose", "investigat", "examin", "assess", "evaluat", "determin", "explor"],
        "result": ["results", "found", "associated", "significant", "increased", "decreased", "higher", "lower", "improved", "reduced", "correlat", "odds ratio", "confidence interval", " p ", "p<", "p ="],
        "conclusion": ["conclusion", "conclude", "suggest", "indicat", "support", "highlight", "may be", "these findings"],
    }
    score = sum(2 for p in patterns[role] if p in s)
    if role == "result" and re.search(r"\b\d+(?:\.\d+)?%|\bp\s*[<=>]|\b(?:or|rr|hr)\s*[=:]", s):
        score += 3
    if len(sentence) > 500:
        score -= 2
    return score


def select_fact_sentences(abstract):
    sentences = split_sentences(abstract)
    if not sentences:
        return {"objective": "", "results": [], "conclusion": ""}
    ranked_obj = sorted(sentences, key=lambda x: score_sentence(x, "objective"), reverse=True)
    objective = ranked_obj[0] if score_sentence(ranked_obj[0], "objective") > 0 else sentences[0]
    result_candidates = sorted(sentences, key=lambda x: score_sentence(x, "result"), reverse=True)
    results = []
    for s in result_candidates:
        if s == objective or score_sentence(s, "result") <= 0:
            continue
        if s not in results:
            results.append(s)
        if len(results) == 2:
            break
    ranked_conc = sorted(sentences, key=lambda x: score_sentence(x, "conclusion"), reverse=True)
    conclusion = ranked_conc[0] if score_sentence(ranked_conc[0], "conclusion") > 0 else ""
    if conclusion in results:
        conclusion = ""
    return {"objective": objective, "results": results, "conclusion": conclusion}


_ARGOS_READY = False


def looks_spanish(text):
    t = " " + text.lower() + " "
    es = sum(t.count(w) for w in [" el ", " la ", " los ", " las ", " de ", " que ", " para ", " con ", " resultados ", " estudio "])
    en = sum(t.count(w) for w in [" the ", " of ", " and ", " to ", " with ", " results ", " study ", " were ", " was "])
    return es > en


def ensure_argos_en_es():
    global _ARGOS_READY
    if _ARGOS_READY:
        return True
    try:
        import argostranslate.package
        import argostranslate.translate
        installed = argostranslate.translate.get_installed_languages()
        has_pair = any(lang.code == "en" and any(t.code == "es" for t in lang.translations_to) for lang in installed)
        if not has_pair:
            argostranslate.package.update_package_index()
            packages = argostranslate.package.get_available_packages()
            pkg = next((p for p in packages if p.from_code == "en" and p.to_code == "es"), None)
            if not pkg:
                return False
            path = pkg.download()
            argostranslate.package.install_from_path(path)
        _ARGOS_READY = True
        return True
    except Exception as exc:
        print(f"Aviso: no se pudo preparar Argos Translate: {exc}", file=sys.stderr)
        return False


def translate_to_spanish(text):
    text = clean_text(text)
    if not text or looks_spanish(text):
        return text
    if not ensure_argos_en_es():
        return text
    try:
        import argostranslate.translate
        translated = clean_text(argostranslate.translate.translate(text, "en", "es"))
        return translated or text
    except Exception as exc:
        print(f"Aviso: traducción falló: {exc}", file=sys.stderr)
        return text


def numerical_tokens(text):
    return re.findall(r"(?<![A-Za-z])[-+]?\d+(?:[.,]\d+)?%?", text or "")


def safe_translate(text, source):
    translated = translate_to_spanish(text)
    src_nums = set(numerical_tokens(source))
    out_nums = set(numerical_tokens(translated))
    if out_nums - src_nums:
        print("Aviso: traducción introdujo cifras no presentes; se conserva el original.", file=sys.stderr)
        return text
    return translated


def topic_hashtags(title):
    t = title.lower()
    mapping = [
        (("stress", "anxiety", "burnout"), "#StressResearch"),
        (("sleep", "insomnia", "fatigue"), "#SleepResearch"),
        (("military", "soldier", "paratrooper", "combat"), "#MilitaryMedicine"),
        (("sport", "exercise", "training", "athlete", "performance"), "#SportsScience"),
        (("nutrition", "diet", "gluten", "obesity", "metabolic"), "#NutritionResearch"),
        (("psycholog", "mental health", "depression"), "#Psychology"),
        (("heart rate variability", "hrv", "autonomic"), "#HRV"),
        (("thermal", "thermography", "temperature"), "#Thermography"),
        (("education", "student", "academic"), "#HigherEducation"),
        (("firefighter", "wildfire", "fire"), "#OccupationalHealth"),
    ]
    tags = ["#Research"]
    for needles, tag in mapping:
        if any(n in t for n in needles) and tag not in tags:
            tags.append(tag)
        if len(tags) >= 4:
            break
    if len(tags) < 3:
        tags.extend(tag for tag in ["#Science", "#AcademicResearch"] if tag not in tags)
    return " ".join(tags[:5])


def build_post(paper):
    paper = enrich_from_openalex(paper)
    paper = enrich_from_europe_pmc(paper)
    title = paper.get("title") or "Nuevo artículo científico"
    journal = paper.get("journal") or "revista científica"
    abstract = paper.get("abstract") or ""
    facts = select_fact_sentences(abstract)

    lines = [f"Nuevo artículo publicado en {journal}", "", title]

    if abstract:
        objective = safe_translate(facts["objective"], facts["objective"])
        if objective:
            lines += ["", objective]
        translated_results = [safe_translate(x, x) for x in facts["results"]]
        if translated_results:
            lines += ["", "Resultados principales:"]
            for result in translated_results:
                lines.append(f"• {result}")
        conclusion = safe_translate(facts["conclusion"], facts["conclusion"])
        if conclusion:
            lines += ["", conclusion]
    else:
        lines += ["", "El registro bibliográfico aún no incorpora un resumen verificable, por lo que no añado resultados que no puedan comprobarse."]

    lines += ["", f"Artículo: {paper['url']}", "", topic_hashtags(title)]
    text = "\n".join(lines).strip()
    if len(text) > 2800:
        text = text[:2750].rsplit(" ", 1)[0] + f"\n\nArtículo: {paper['url']}\n\n{topic_hashtags(title)}"
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
            if "linkedin" in str(ch.get("service") or "").lower():
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
    crossref = [normalize_crossref(x) for x in fetch_crossref_works()]
    crossref = [x for x in crossref if x["doi"] and x["author_has_orcid"]]
    openalex = fetch_openalex_works()
    works = merge_works(crossref, openalex)

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
        print(f"No hay artículos nuevos. DOI vigilados en esta consulta: {len(current)}")
        return 0

    channel_id = resolve_linkedin_channel()
    posted = state.setdefault("posted", [])
    new_papers.sort(key=lambda x: x.get("publication_date") or "")

    for paper in new_papers:
        text = build_post(paper)
        post_id, due_at = schedule_buffer_post(text, channel_id)
        known.add(paper["doi"])
        posted.append({
            "doi": paper["doi"],
            "title": paper["title"],
            "buffer_post_id": post_id,
            "scheduled_at": due_at,
            "detected_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "source": paper.get("source", "merged"),
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
