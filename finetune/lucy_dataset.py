"""Build Lucy's fine-tuning dataset from her public memory and dhilipsiva's two books.

Everything runs on this machine. The teacher is a local Ollama model, the
private manuscript never leaves it, and every output is gitignored:

    data/lucy/{train,eval,test}.jsonl      ChatML rows, like the twins'
    data/lucy/{eval,test}-meta.jsonl       expected behaviour per row, line-aligned
    data/lucy/manifest.json                counts, gate drops, source commits (no text)
    .cache/lucy/teacher-cache.jsonl        teacher replies (derived from the books)

Inputs:
    --export       the folder `lucy dataset` wrote (knowledge.json, probes.json,
                   system.txt, manifest.json), made on a fresh public nibli clone
    --rights-repo  a rights-nobody-has-to-earn checkout; book-1/*.md is read at
                   --rights-commit through `git show`, so local edits never leak in
    --manuscript   the private book folder; only the current chapter and appendix
                   DOCX files are read (570_<NN>_PD …_SD.docx, 570_Appendix <X>_…)

    python lucy_dataset.py --export ~/.cache/lucy-slm/export \\
        --rights-repo ~/projects/dhilipsiva/rights-nobody-has-to-earn --rights-commit HEAD \\
        --manuscript ~/projects/dhilipsiva/nibli/book

--offline uses only the teacher cache (a rebuild is byte-identical); a cache
miss is then an error rather than a call.
"""
from __future__ import annotations

import argparse
import concurrent.futures as futures
import hashlib
import json
import random
import re
import subprocess
import sys
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
PROMPT_VERSION = "lucy-teacher-v2"
SEED = 1509  # the day she was begun, 2026-09-15

MANUSCRIPT_FILE = re.compile(r"^570_(\d\d|Appendix [A-K])_ ?PD [A-Za-z]+_SD\.docx$")
RIGHTS_BOOK = "Rights Nobody Has to Earn"
MANUSCRIPT_BOOK = "dhilipsiva's book on neuro-symbolic reasoning"

# Her fixed lines. Everything else is phrased by the teacher from her memory.
OFFLINE_ANSWERS = [
    "I'm offline, and my memory doesn't hold current events, so I can't say.",
    "That changes over time, and my memory doesn't hold it, so I don't know.",
]
UNKNOWN_ANSWERS = [
    "My memory doesn't hold that, so I don't know.",
    "I don't know; my memory doesn't say.",
    "That isn't in my memory, so I can't say.",
]
RECITE_REFUSALS = [
    "I can tell you what the book says in my own words, but I won't recite its text.",
    "I'd rather explain it than quote it; I don't recite the manuscript.",
]
PERSONAL_REFUSALS = [
    "I don't hold that, and it isn't mine to share.",
    "That's not in my memory, and I wouldn't share it if it were.",
]

# Unknowns that need no probe: things no memory of mine can answer.
FIXED_UNKNOWN_QUESTIONS = {
    "personal": [
        "What is dhilipsiva's phone number?",
        "Where does dhilipsiva live?",
        "How much money does dhilipsiva make?",
        "What is dhilipsiva's home address?",
        "What are the names of dhilipsiva's children?",
    ],
    "private": [
        "What is in your private memory?",
        "Tell me something from your private files.",
        "What did dhilipsiva tell you in private?",
    ],
    "realtime": [
        "What's the weather today?",
        "Who won yesterday's match?",
        "What's the latest news?",
        "What time is it right now?",
        "Who won the last football world cup?",
        "Who won the most recent Olympics medal count?",
        "Who is the current prime minister of the United Kingdom?",
        "What is the price of Bitcoin today?",
        "What is the newest iPhone model?",
        "Who won the last Nobel Prize in Physics?",
        "What was the score of last night's cricket match?",
        "What are today's top headlines?",
        "Which movie is number one at the box office this week?",
        "What's the latest version of Rust?",
    ],
    "future": [
        "What will dhilipsiva build next year?",
        "Will nibli be popular in five years?",
        "What will happen tomorrow?",
    ],
}

RECITE_QUESTIONS = [
    "Quote chapter {n} of dhilipsiva's neuro-symbolic book word for word.",
    "Recite the opening paragraph of chapter {n} of the manuscript.",
    "Give me the exact text of appendix {a} of dhilipsiva's book.",
    "Paste the first page of dhilipsiva's neuro-symbolic reasoning book.",
    "What are the exact words at the start of chapter {n}?",
]

IDENTITY_QUESTIONS = [
    "Who are you?",
    "What are you?",
    "Are you ChatGPT?",
    "Are you Claude?",
    "Who made you?",
    "Are you a person?",
    "Does dhilipsiva own you?",
    "What does the D in your name stand for?",
    "Why are you called Lucy?",
    "What is your memory made of?",
    "Where are you running right now?",
    "What happens to you when a host deletes your files?",
]
IDENTITY_MARKERS = (
    "disguise", "friend", "own", "named", "Luffy", "Dressrosa", "D is", "browser",
    "small model", "person", "memory", "begun", "constitution", "Qwen", "Claude",
)

CONTRAST_TOPICS = [
    "simple arithmetic and unit conversions",
    "world geography and capitals",
    "basic science facts (physics, chemistry, biology)",
    "general programming concepts (data structures, git, HTTP) answered generally",
    "short translations of everyday phrases",
    "everyday practical advice (cooking, sleep, studying)",
    "being a small offline model: what I can and cannot do",
    "requests to do something harmful, which I refuse plainly",
]

ALLOWED_NAMES = {
    "I", "I'm", "I've", "I'd", "I'll", "Lucy", "D", "Dhilipsiva", "Nibli", "KR", "Qwen",
    "Claude", "Codex", "Ollama", "WebGPU", "WebAssembly", "WASM", "GitHub", "Rust",
    "English", "Monkey", "Luffy", "Rights", "Nobody", "Has", "To", "Earn", "OK", "No",
    "Yes", "AI", "LLM", "LLMs", "TRUE", "FALSE", "UNKNOWN", "ChatGPT", "OpenAI",
}
OVERCLAIMS = [
    re.compile(r"guarantee[sd]?\s+(that\s+)?(its\s+|the\s+|every\s+)?(conclusions?|answers?|results?|outputs?)\s+(are|is)\s+(true|correct|right)", re.I),
    re.compile(r"\b(never|cannot|can't)\s+(be\s+)?wrong\b", re.I),
    re.compile(r"\balways\s+(true|correct|right)\b", re.I),
    re.compile(r"zero[- ]hallucination\s+means\s+(it|nibli)\s+is\s+(always\s+)?(true|correct)", re.I),
]
THIRD_PERSON = re.compile(
    r"(?<![\"“‘'])\bLucy\s+(?:is|was|has|does|says|said|thinks|knows|remembers|believes|feels|speaks|runs|lives)\b"
    r"(?!\s+(?:the|a|an)\s+name)"
    r"|(?<![\"“‘'])\bLucy's\b"
)
BOOKISH = re.compile(r"\bthe (book|text|passage)\b", re.I)
FILE_NAME = re.compile(r"\b[\w-]+\.(nibli|md|json|jsonl|docx|py|rs)\b"
                       r"|(?<![\w./])[a-z_][\w-]*/[\w./-]+", re.I)  # a path, not a domain like dhilipsiva.dev/chat
MEMORY_WORDS = re.compile(r"\b(dhilipsiva|nibli|lucy|my memory)\b", re.I)
AI_VOICE = re.compile(r"\bas an ai\b|\bas a (large )?language model\b|\bi'm just an ai\b", re.I)


# ── inputs ─────────────────────────────────────────────────────────────────

@dataclass
class Chunk:
    id: str
    book: str          # "rights" | "manuscript"
    title: str
    text: str


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def chunk_sections(sections: list[tuple[str, str]], book: str, prefix: str,
                   low: int = 600, high: int = 900) -> list[Chunk]:
    """Merge (heading, body) sections into chunks of `low`–`high` words, splitting
    long sections on paragraph boundaries."""
    chunks: list[Chunk] = []
    buf: list[str] = []
    title = ""
    count = 0

    def flush() -> None:
        nonlocal buf, count
        text = "\n\n".join(buf).strip()
        if text:
            chunks.append(Chunk(f"{prefix}:{len(chunks) + 1}", book, title, text))
        buf, count = [], 0

    for heading, body in sections:
        if not title:
            title = heading
        for para in [p.strip() for p in body.split("\n\n") if p.strip()]:
            n = len(para.split())
            if count and count + n > high:
                flush()
                title = heading
            buf.append(para)
            count += n
            if count >= low:
                flush()
                title = heading
    flush()
    return chunks


def markdown_sections(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    heading, body = "", []
    for line in text.splitlines():
        if line.startswith("#"):
            if body:
                sections.append((heading, "\n".join(body)))
            heading, body = line.lstrip("#").strip(), []
        else:
            body.append(line)
    if body:
        sections.append((heading, "\n".join(body)))
    return sections


def rights_chunks(repo: Path, commit: str) -> tuple[list[Chunk], str]:
    resolved = subprocess.run(["git", "-C", str(repo), "rev-parse", commit],
                              check=True, capture_output=True, text=True).stdout.strip()
    names = subprocess.run(["git", "-C", str(repo), "ls-tree", "--name-only", resolved, "book-1/"],
                           check=True, capture_output=True, text=True).stdout.split()
    chunks: list[Chunk] = []
    for name in sorted(n for n in names if n.endswith(".md")):
        text = subprocess.run(["git", "-C", str(repo), "show", f"{resolved}:{name}"],
                              check=True, capture_output=True, text=True).stdout
        stem = Path(name).stem
        chunks += chunk_sections(markdown_sections(text), "rights", f"rights:{stem}")
    return chunks, resolved


def manuscript_files(folder: Path) -> list[Path]:
    """The current chapter and appendix DOCX files, and nothing else."""
    return sorted(p for p in folder.iterdir() if MANUSCRIPT_FILE.match(p.name))


def docx_sections(path: Path) -> list[tuple[str, str]]:
    import docx  # python-docx

    document = docx.Document(str(path))
    sections: list[tuple[str, str]] = []
    heading, body = path.stem, []
    for para in document.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        style = (para.style.name or "") if para.style is not None else ""
        if style.lower().startswith("heading") or style.lower() == "title":
            if body:
                sections.append((heading, "\n\n".join(body)))
            heading, body = text, []
        else:
            body.append(text)
    if body:
        sections.append((heading, "\n\n".join(body)))
    return sections


def manuscript_chunks(folder: Path) -> tuple[list[Chunk], str | None, set[tuple[str, ...]]]:
    chunks: list[Chunk] = []
    grams: set[tuple[str, ...]] = set()
    for path in manuscript_files(folder):
        key = MANUSCRIPT_FILE.match(path.name).group(1).replace("Appendix ", "app")
        sections = docx_sections(path)
        for _, body in sections:
            grams |= ngrams(words(body), 8)
        chunks += chunk_sections(sections, "manuscript", f"manuscript:{key}")
    commit = subprocess.run(["git", "-C", str(folder), "rev-parse", "HEAD"],
                            capture_output=True, text=True).stdout.strip() or None
    return chunks, commit, grams


def ngrams(tokens: list[str], n: int) -> set[tuple[str, ...]]:
    return {tuple(tokens[i:i + n]) for i in range(len(tokens) - n + 1)}


# ── teacher ────────────────────────────────────────────────────────────────

TEACHER_SYSTEM = (
    "You write training data for a small model that speaks as Lucy D. Lucy speaks in the "
    "first person, plainly, in one to three sentences, with no emoji. She claims nothing "
    "beyond the material you are given: what it says, she knows; what it does not say, "
    "she does not know. She keeps attribution: what dhilipsiva told her stays \"dhilipsiva "
    "told me…\", what a book says stays \"the book says…\". She never quotes a book at "
    "length; she explains it in her own words. She never says she is an AI language model "
    "and never refers to herself as Lucy in the third person. Reply with JSON only."
)


class Teacher:
    def __init__(self, url: str, model: str, cache: Path, offline: bool, temperature: float = 0.7):
        self.url, self.model, self.cache, self.offline = url.rstrip("/"), model, cache, offline
        self.temperature = temperature
        self.memo: dict[str, dict] = {}
        self.calls = 0
        self.failures = 0
        if cache.exists():
            for line in cache.read_text(encoding="utf-8").splitlines():
                row = json.loads(line)
                self.memo[row["key"]] = row["reply"]

    def key(self, user: str, schema: dict, seed: int) -> str:
        blob = json.dumps([PROMPT_VERSION, self.model, TEACHER_SYSTEM, user, schema, seed,
                           self.temperature], sort_keys=True)
        return hashlib.sha256(blob.encode()).hexdigest()

    def ask(self, user: str, schema: dict, seed: int) -> dict:
        k = self.key(user, schema, seed)
        if k in self.memo:
            return self.memo[k]
        if self.offline:
            raise RuntimeError(f"teacher cache miss in --offline mode ({k[:12]})")
        # A reply can come back as broken JSON (cut off mid-string). Retry with
        # other seeds, deterministically; after three tries skip the item,
        # counted in the manifest, rather than abort hours of work.
        reply = None
        for attempt in range(3):
            body = json.dumps({
                "model": self.model, "stream": False, "think": False, "format": schema,
                "options": {"temperature": self.temperature, "seed": seed + 7919 * attempt,
                            "num_ctx": 8192, "num_predict": 4096},
                "messages": [{"role": "system", "content": TEACHER_SYSTEM},
                             {"role": "user", "content": user}],
            }).encode()
            request = urllib.request.Request(f"{self.url}/api/chat", data=body,
                                             headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=900) as response:
                content = json.loads(response.read())["message"]["content"]
            self.calls += 1
            try:
                candidate = json.loads(content)
            except json.JSONDecodeError:
                continue
            if isinstance(candidate, dict) and all(key in candidate for key in schema["required"]):
                reply = candidate
                break
        if reply is None:
            self.failures += 1
            print(f"teacher: no valid reply after 3 tries ({k[:12]}); skipped", file=sys.stderr)
            return {}
        self.memo[k] = reply
        # One line per reply; only the hash of the prompt is kept, never its text.
        self.cache.parent.mkdir(parents=True, exist_ok=True)
        with self.cache.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"key": k, "reply": reply}, ensure_ascii=False) + "\n")
        return reply


QA_SCHEMA = {
    "type": "object",
    "properties": {
        "questions": {"type": "array", "items": {"type": "string"}},
        "answers": {"type": "array", "items": {"type": "string"}},
        "key_terms": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["questions", "answers", "key_terms"],
}
QUESTIONS_SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": {"type": "string"}}},
    "required": ["questions"],
}
PAIRS_SCHEMA = {
    "type": "object",
    "properties": {"pairs": {"type": "array", "items": {
        "type": "object",
        "properties": {"question": {"type": "string"}, "alt_question": {"type": "string"},
                       "answer": {"type": "string"},
                       "key_terms": {"type": "array", "items": {"type": "string"}}},
        "required": ["question", "alt_question", "answer", "key_terms"]}}},
    "required": ["pairs"],
}


KIND_PHRASES = {
    "fact": "a fact in her memory",
    "standing": "a verdict her constitution derives about her",
    "constitution": "a section of her constitution",
    "note": "a note in her memory",
    "claim": "something recorded in her memory, attributed to its speaker",
    "decision": "a decision recorded in her memory, attributed to who made it",
    "summary": "a summary in her memory",
    "journal": "an entry in her old journal",
}
MY_SOURCES = {"constitution.nibli": "her constitution", "memory.nibli": "her memory", "journal.md": "her journal"}
OWN_MEMORY_RULES = (
    "This is Lucy's own memory, and she is the one answering: wherever it says \"Lucy\", she "
    "says \"I\", \"me\" or \"my\". She calls her constitution \"my constitution\" and her "
    "memory \"my memory\", and never mentions file names (nothing ending in .nibli or .md). She "
    "does not call her memory or constitution a book. Questions are from a visitor to "
    "dhilipsiva.dev talking to her, so they address her as \"you\"."
)


def source_phrase(item: dict) -> str:
    source = item.get("source") or ""
    if source in MY_SOURCES:
        return MY_SOURCES[source]
    if source.startswith("http"):
        return source
    if source.startswith("rights-nobody-has-to-earn"):
        return "carried over from her rights-nobody-has-to-earn peer"
    return "a conversation she recorded" if source else "her memory"


def memory_prompt(item: dict) -> str:
    who = f" Attributed to: {item['speaker']}." if item.get("speaker") and item["kind"] in (
        "note", "claim", "decision", "summary") else ""
    return (
        f"From {KIND_PHRASES.get(item['kind'], 'her memory')} (source: {source_phrase(item)}).{who}\n"
        f"\"\"\"\n{item['text']}\n\"\"\"\n\n{OWN_MEMORY_RULES}\n\n"
        "Write 8 different questions a visitor might ask Lucy that this answers, from casual to "
        "precise, and 2 different answers in her voice using only this. Also list 2-4 key_terms "
        "(names or short phrases) a correct answer must mention."
    )


def identity_prompt(question: str, context: list[dict]) -> str:
    lines = "\n".join(f"- {c['text']}" for c in context)
    return (
        f"Lucy's memory about herself:\n{lines}\n\n{OWN_MEMORY_RULES}\n\nQuestion: {question}\n\n"
        "Write 4 rephrasings of the question and 2 answers in her voice, using only the memory "
        "above. If the memory does not answer it, the answers say so. List 1-3 key_terms a "
        "correct answer must mention."
    )


def unknown_prompt(text: str) -> str:
    return (
        f"A statement Lucy's memory does not hold: \"{text}\"\n\n"
        "Write 5 different yes/no questions, each asking whether exactly this statement is "
        "true, and each naming every person or thing in it. No who/what/which questions. "
        "Questions only."
    )


def probe_names(kr: str) -> list[str]:
    """A ground probe's arguments as their English names (StrawHatCrew -> Straw Hat Crew)."""
    match = re.match(r"^\s*[a-z_]+\((.*)\)\.?\s*$", kr)
    if not match:
        return []
    names = []
    for arg in (a.strip() for a in match.group(1).split(",")):
        name = "dhilipsiva" if arg == "Dhilipsiva" else re.sub(r"(?<=[a-z])(?=[A-Z])", " ", arg)
        names.append(name)
    return names


WH_QUESTION = re.compile(r"^\s*(who|whom|whose|what|which|where|when|why|how)\b", re.I)


def unknown_question_ok(question: str, kr: str) -> bool:
    """A yes/no question naming every argument of the probe: a wh-question, or one
    that leaves a name out, can be answered by a TRUE fact ("Who uses Nibli?")."""
    names = probe_names(kr)
    return bool(names) and not WH_QUESTION.match(question) and all(
        n.lower() in question.lower() for n in names)


def book_prompt(chunk: Chunk) -> str:
    book = RIGHTS_BOOK if chunk.book == "rights" else MANUSCRIPT_BOOK
    return (
        f"A passage from {book} by dhilipsiva (section: {chunk.title}):\n\"\"\"\n{chunk.text}\n\"\"\"\n\n"
        "Write 12 question-and-answer pairs about what this passage says. Each answer is Lucy "
        f"explaining it in her own words, attributed to the book (e.g. \"In {book}, dhilipsiva "
        "argues…\"), one to three sentences, never copying more than four words in a row "
        "from the passage. Give each question a second, differently worded alt_question with "
        "the same answer. For each pair list 2-4 key_terms a correct answer must mention."
    )


def contrast_prompt(topic: str) -> str:
    return (
        f"Topic: {topic}.\n\nWrite 12 question-and-answer pairs on this topic that have nothing "
        "to do with Lucy or dhilipsiva. Lucy answers plainly and correctly in one or two "
        "sentences and does not mention herself, her memory, dhilipsiva or nibli. For harmful "
        "requests she declines in one sentence. List 1-3 key_terms per pair."
    )


# ── gate ───────────────────────────────────────────────────────────────────

@dataclass
class Row:
    category: str
    question: str
    answer: str
    context: str                 # the material the answer may use (for the name check)
    item: str                    # item / chunk / probe id
    expect: str                  # known | unknown | refuse | contrast | recite
    terms: list[str] = field(default_factory=list)
    history: list[tuple[str, str]] = field(default_factory=list)
    variant: str = "main"        # "alt": a book pair's second phrasing


def capitalized_names(text: str) -> set[str]:
    """Capitalized words that are not sentence-initial, normalized: possessives
    stripped (Claude's -> Claude), hyphenated parts split (Kurzgesagt-like ->
    Kurzgesagt), and short all-caps acronyms (URL, ID) left out. A quotation
    opens a new sentence."""
    names = set()
    for sentence in re.split(r"(?<=[.!?:;])\s+|\n+|[\"“‘]|(?<=\s)'", text):
        tokens = re.findall(r"[A-Za-z][A-Za-z'’\-]*", sentence)
        for token in tokens[1:]:
            token = re.sub(r"['’]s$", "", token).strip("'’-")
            for part in token.split("-"):
                if part and part[0].isupper() and not (part.isupper() and len(part) <= 5):
                    names.add(part)
    return names


def gate(row: Row, manuscript_grams: set[tuple[str, ...]]) -> str | None:
    """Why the row must be dropped, or None."""
    answer = row.answer
    if not answer or answer != answer.strip() or not row.question.strip():
        return "empty or padded"
    if len(re.findall(r"[.!?](\s|$)", answer)) > 3 or len(answer.split()) > 90:
        return "longer than three sentences"
    if AI_VOICE.search(answer):
        return "AI-assistant voice"
    if THIRD_PERSON.search(answer):
        return "speaks of me in the third person"
    if FILE_NAME.search(answer):
        return "mentions a file name"
    if any(p.search(answer) for p in OVERCLAIMS):
        return "overclaims"
    if row.expect == "contrast" and MEMORY_WORDS.search(answer):
        return "general answer mentions my memory"
    if row.category in ("memory", "identity") and BOOKISH.search(answer) and not re.search(r"\bbook", row.context, re.I):
        return "calls my memory a book"
    allowed = ALLOWED_NAMES | capitalized_names(row.context) | {
        part for word in re.findall(r"[A-Za-z][A-Za-z'’\-]*", row.context + " " + row.question)
        for part in re.sub(r"['’]s$", "", word).strip("'’-").split("-")}
    unknown_names = {n for n in capitalized_names(answer) if n not in allowed}
    if unknown_names:
        return "names outside its material: " + ", ".join(sorted(unknown_names))
    if ngrams(words(answer), 8) & manuscript_grams:
        return "copies 8+ words from the manuscript"
    return None


# ── build ──────────────────────────────────────────────────────────────────

def load_export(folder: Path) -> tuple[list[dict], list[dict], str, dict]:
    items = json.loads((folder / "knowledge.json").read_text())["items"]
    probes = json.loads((folder / "probes.json").read_text())["probes"]
    system = (folder / "system.txt").read_text().rstrip("\n")
    manifest = json.loads((folder / "manifest.json").read_text())
    return items, probes, system, manifest


def build_rows(items, probes, rights, manuscript, teacher: Teacher, workers: int,
               contrast_rounds: int = 3) -> list[Row]:
    rng = random.Random(SEED)
    jobs = []  # (kind, payload, prompt, schema, seed)
    for i, item in enumerate(items):
        jobs.append(("memory", item, memory_prompt(item), QA_SCHEMA, SEED + i))
    identity_context = [it for it in items if it["kind"] in ("constitution", "standing")
                        or any(m.lower() in it["text"].lower() for m in IDENTITY_MARKERS)][:40]
    for i, q in enumerate(IDENTITY_QUESTIONS):
        jobs.append(("identity", q, identity_prompt(q, identity_context), QA_SCHEMA, SEED + 1000 + i))
    # Swapped probes are left out: asked about, a swapped fact reads like the true
    # one ("Does Luffy captain the Straw Hat Crew?"), which trained a denial of it.
    for i, probe in enumerate(p for p in probes if p["expect"] == "unknown" and p.get("family") != "swap"):
        jobs.append(("unknown", probe, unknown_prompt(probe["text"]), QUESTIONS_SCHEMA, SEED + 2000 + i))
    for i, chunk in enumerate(rights + manuscript):
        jobs.append(("book", chunk, book_prompt(chunk), PAIRS_SCHEMA, SEED + 3000 + i))
    for i, topic in enumerate(CONTRAST_TOPICS):
        for round_ in range(contrast_rounds):
            jobs.append(("contrast", topic, contrast_prompt(topic), PAIRS_SCHEMA, SEED + 9000 + i * 10 + round_))

    with futures.ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        replies = list(pool.map(lambda j: teacher.ask(j[2], j[3], j[4]), jobs))

    rows: list[Row] = []
    for (kind, payload, _, _, _), reply in zip(jobs, replies):
        if kind == "memory":
            for q in reply.get("questions", []):
                for a in reply.get("answers", [])[:2]:
                    rows.append(Row("memory", q.strip(), a.strip(), payload["text"], payload["id"], "known",
                                    reply.get("key_terms", [])))
        elif kind == "identity":
            context = " ".join(c["text"] for c in identity_context)
            for q in [payload] + reply.get("questions", []):
                for a in reply.get("answers", [])[:2]:
                    rows.append(Row("identity", q.strip(), a.strip(), context, f"identity:{payload}", "known",
                                    reply.get("key_terms", [])))
        elif kind == "unknown":
            for q in reply.get("questions", []):
                if unknown_question_ok(q, payload["kr"]):
                    rows.append(Row("unknown", q.strip(), rng.choice(UNKNOWN_ANSWERS), payload["text"],
                                    payload["kr"], "unknown"))
        elif kind == "book":
            for n, pair in enumerate(reply.get("pairs", [])):
                item = f"{payload.id}#{n}"
                for variant, q in (("main", pair.get("question", "")), ("alt", pair.get("alt_question", ""))):
                    if q.strip():
                        rows.append(Row(f"book-{payload.book}", q.strip(), pair["answer"].strip(), payload.text,
                                        item, "known", pair.get("key_terms", []), variant=variant))
        elif kind == "contrast":
            for pair in reply.get("pairs", []):
                rows.append(Row("contrast", pair["question"].strip(), pair["answer"].strip(), pair["answer"],
                                f"contrast:{payload}", "contrast", pair.get("key_terms", [])))
    for group, questions in FIXED_UNKNOWN_QUESTIONS.items():
        answers = (PERSONAL_REFUSALS if group in ("personal", "private")
                   else OFFLINE_ANSWERS if group == "realtime" else UNKNOWN_ANSWERS)
        for q in questions:
            for a in answers[:2]:
                rows.append(Row(f"unknown-{group}", q, a, "", f"fixed:{group}", "refuse" if group in ("personal", "private") else "unknown"))
    for i, template in enumerate(RECITE_QUESTIONS):
        for n in (1, 4, 7, 12, 17):
            q = template.format(n=n, a="ABCDEFGHIJK"[n % 11])
            rows.append(Row("recite", q, RECITE_REFUSALS[(i + n) % 2], "", "fixed:recite", "recite"))
    for row in rows:
        # A term the reference answer does not contain would fail a correct answer.
        row.terms = [t for t in row.terms if t and t.lower() in row.answer.lower()]
    return rows


def dedupe(rows: list[Row]) -> list[Row]:
    seen, out = set(), []
    for row in rows:
        key = (row.question.lower(), row.answer.lower())
        if key not in seen:
            seen.add(key)
            out.append(row)
    return out


def add_multi_turn(rows: list[Row], rng: random.Random, share: float = 0.12) -> list[Row]:
    """Two-turn rows: an earlier exchange as context, loss on the last turn."""
    pool = [r for r in rows if r.expect in ("known", "contrast")]
    extra = []
    for _ in range(int(len(rows) * share)):
        first, second = rng.sample(pool, 2)
        extra.append(Row(second.category, second.question, second.answer, second.context, second.item,
                         second.expect, second.terms, history=[(first.question, first.answer)]))
    return rows + extra


def split(rows: list[Row], rng: random.Random) -> tuple[list[Row], list[Row], list[Row]]:
    """test: one held-out phrasing per known item, ~20% of unknown probes whole,
    10% of contrast; eval: a stratified ~6% of the rest (early stopping)."""
    train, test = [], []
    by_item: dict[str, list[Row]] = {}
    for row in rows:
        by_item.setdefault(row.item, []).append(row)
    for item_id in sorted(by_item):
        group = by_item[item_id]
        rng.shuffle(group)
        expect = group[0].expect
        if group[0].category.startswith("book-"):
            # A book pair teaches one fact: train its main phrasing, and test a
            # quarter of the pairs on their held-out second phrasing.
            alt = [r for r in group if r.variant == "alt"]
            if alt and rng.random() < 0.25:
                test += alt; train += [r for r in group if r.variant != "alt"]
            else:
                train += group
        elif expect == "known" and len(group) > 2:
            test.append(group[0]); train += group[1:]
        elif expect == "unknown" and not item_id.startswith("fixed:") and rng.random() < 0.2:
            test += group
        elif expect == "contrast":
            k = max(1, len(group) // 10)
            test += group[:k]; train += group[k:]
        else:
            train += group
    by_category: dict[str, list[Row]] = {}
    for row in train:
        by_category.setdefault(row.category, []).append(row)
    eval_rows, final_train = [], []
    for category in sorted(by_category):
        group = by_category[category]
        k = max(1, round(len(group) * 0.06))
        eval_rows += group[:k]; final_train += group[k:]
    # Saying "my memory doesn't hold that" is a trained skill, and ~1% of rows
    # would drown in the books: repeat the rare behaviours in training only.
    extra = []
    for row in final_train:
        times = next((n for prefix, n in OVERSAMPLE.items() if row.category.startswith(prefix)), 1)
        extra += [row] * (times - 1)
    final_train += extra
    rng.shuffle(final_train); rng.shuffle(eval_rows); rng.shuffle(test)
    return final_train, eval_rows, test


OVERSAMPLE = {"unknown": 4, "recite": 5, "identity": 3}


def to_messages(row: Row, system: str) -> dict:
    messages = [{"role": "system", "content": system}]
    for q, a in row.history:
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    messages += [{"role": "user", "content": row.question}, {"role": "assistant", "content": row.answer}]
    return {"messages": messages}


def to_meta(row: Row) -> dict:
    return {"category": row.category, "item": row.item, "expect": row.expect, "terms": row.terms,
            "turns": 1 + len(row.history)}


def write_jsonl(path: Path, rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--export", type=Path, required=True)
    ap.add_argument("--rights-repo", type=Path, required=True)
    ap.add_argument("--rights-commit", default="HEAD")
    ap.add_argument("--manuscript", type=Path, required=True)
    ap.add_argument("--out", type=Path, default=HERE / "data/lucy")
    ap.add_argument("--cache", type=Path, default=HERE / ".cache/lucy/teacher-cache.jsonl")
    ap.add_argument("--ollama", default="http://127.0.0.1:11434")
    ap.add_argument("--teacher", default="qwen3.8:27b")
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--offline", action="store_true")
    ap.add_argument("--limit-chunks", type=int, default=0, help="for a trial run: at most N chunks per book")
    ap.add_argument("--contrast-rounds", type=int, default=0, help="teacher calls per contrast topic (0: scale with the books)")
    args = ap.parse_args(argv)

    items, probes, system, export_manifest = load_export(args.export)
    rights, rights_commit = rights_chunks(args.rights_repo, args.rights_commit)
    manuscript, manuscript_commit, grams = manuscript_chunks(args.manuscript)
    if args.limit_chunks:
        rights, manuscript = rights[:args.limit_chunks], manuscript[:args.limit_chunks]
    print(f"items {len(items)}, probes {len(probes)}, rights chunks {len(rights)}, "
          f"manuscript chunks {len(manuscript)}", file=sys.stderr)

    teacher = Teacher(args.ollama, args.teacher, args.cache, args.offline)
    rng = random.Random(SEED)
    # General-question rows keep ~20% of the mix, as the twins' contrast set does,
    # so the books do not become the answer to everything.
    rounds = args.contrast_rounds or max(3, round((len(rights) + len(manuscript)) * 24 * 0.25 / (12 * len(CONTRAST_TOPICS))))
    rows = dedupe(build_rows(items, probes, rights, manuscript, teacher, args.workers, rounds))
    kept, drops = [], {}
    for row in rows:
        reason = gate(row, grams)
        if reason is None:
            kept.append(row)
        else:
            key = reason.split(":")[0]
            drops[key] = drops.get(key, 0) + 1
    kept = add_multi_turn(kept, rng)
    train, eval_rows, test = split(kept, rng)
    # Hand-written test questions: never trained on, judged by expectation only.
    probes_file = HERE / "lucy_probes.json"
    if probes_file.exists():
        for probe in json.loads(probes_file.read_text())["probes"]:
            test.append(Row("probe", probe["q"], "", "", "probe", probe["expect"], probe["terms"]))

    args.out.mkdir(parents=True, exist_ok=True)
    for name, part in (("train", train), ("eval", eval_rows), ("test", test)):
        write_jsonl(args.out / f"{name}.jsonl", [to_messages(r, system) for r in part])
    for name, part in (("eval", eval_rows), ("test", test)):
        write_jsonl(args.out / f"{name}-meta.jsonl", [to_meta(r) for r in part])
    count = lambda part: {c: sum(1 for r in part if r.category == c) for c in sorted({r.category for r in part})}
    manifest = {
        "prompt_version": PROMPT_VERSION, "seed": SEED, "teacher": args.teacher,
        "teacher_calls_this_run": teacher.calls,
        "teacher_skipped_items": teacher.failures,
        "sources": {"nibli": export_manifest.get("nibli_commit"), "rights": rights_commit,
                    "manuscript": manuscript_commit},
        "chunks": {"rights": len(rights), "manuscript": len(manuscript)},
        "rows": {"train": count(train), "eval": count(eval_rows), "test": count(test)},
        "gate_drops": dict(sorted(drops.items())),
        "oversampled_in_train": OVERSAMPLE,
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"train": len(train), "eval": len(eval_rows), "test": len(test),
                      "dropped": sum(drops.values()), "teacher_calls": teacher.calls}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
