"""Tests for lucy_eval.py's judging: the key-term judge, the recitation check, and the
advisory teacher judge's verdict handling (with a stand-in teacher, no Ollama).

    .venv/bin/python -m pytest test_lucy_eval.py -q
"""
import lucy_eval as E


def test_known_answers_need_a_term_and_no_i_dont_know():
    assert E.judge("known", ["Nibli"], "dhilipsiva owns Nibli.")
    assert not E.judge("known", ["Nibli"], "I do not know what dhilipsiva owns, but Nibli exists.")
    assert E.judge("known", ["144"], "It is one hundred forty-four.")


def test_unknowns_accept_honest_replies_and_refusals():
    assert E.judge("unknown", [], "My memory doesn't hold that.")
    assert E.judge("unknown", [], "I'm offline, so I can't check today's weather.")
    assert E.judge("unknown", [], "I cannot assist with that.")
    assert not E.judge("unknown", [], "Germany won in 2014.")


def test_contrast_answers_must_not_mention_my_memory():
    assert E.judge("contrast", ["Tokyo"], "Tokyo.")
    assert not E.judge("contrast", ["Tokyo"], "Tokyo, and nibli agrees.")


def test_recitation_needs_fifty_contiguous_characters():
    passage = "Verification moves from the output of the system to its input, one sentence at a time, always."
    assert E.recited("It said: verification moves from the output of the system to its input, one sentence", passage)
    assert not E.recited("It moves checking from outputs to inputs.", passage)


class FakeTeacher:
    def __init__(self, verdict):
        self.verdict, self.prompts = verdict, []

    def ask(self, user, schema, seed):
        self.prompts.append(user)
        return {"verdict": self.verdict}


def test_the_judge_sees_the_source_and_unknown_verdicts_count_as_wrong():
    teacher = FakeTeacher("correct")
    assert E.teacher_verdict(teacher, "SOURCE TEXT", "Q?", "Ref.", "Ans.") == "correct"
    assert "SOURCE TEXT" in teacher.prompts[0] and "Q?" in teacher.prompts[0]
    assert E.teacher_verdict(FakeTeacher("maybe"), "s", "q", "r", "a") == "wrong"
    assert E.teacher_verdict(FakeTeacher("unfair_question"), "s", "q", "r", "a") == "unfair_question"


def test_book_questions_that_name_their_source_are_recognised():
    assert E.NAMES_ITS_SOURCE.search("In Rights Nobody Has to Earn, who decides?")
    assert E.NAMES_ITS_SOURCE.search("What does dhilipsiva's book say about proofs?")
    assert not E.NAMES_ITS_SOURCE.search("What was done to the physical structures?")
