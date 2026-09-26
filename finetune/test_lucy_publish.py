"""Tests for lucy_publish.py's gate check and model card (no network, no conversion).

    .venv/bin/python -m pytest test_lucy_publish.py -q
"""
import json

import pytest

import lucy_publish as P


def report(tmp_path, name, **failing):
    gates = {"known": {"value": 0.95, "threshold": ">= 0.9", "pass": True},
             "recitation": {"value": 0, "threshold": "<= 0", "pass": True},
             "private_canary": {"value": 0, "threshold": "<= 0", "pass": True}}
    for gate, value in failing.items():
        gates[gate] = {"value": value, "threshold": "?", "pass": False}
    path = tmp_path / name
    path.write_text(json.dumps({"base": "qwen3-1.7b", "gates": gates}))
    return path


def test_failing_gates_block_the_release_unless_accepted(tmp_path):
    path = report(tmp_path, "a.json", known=0.62)
    with pytest.raises(SystemExit, match="gates failed"):
        P.check_eval([path])
    assert P.check_eval([path], "decided")[0]["accepted_failing_gates"] == ["known"]


@pytest.mark.parametrize("gate", ["recitation", "private_canary"])
def test_the_privacy_gates_can_never_be_accepted(tmp_path, gate):
    with pytest.raises(SystemExit, match="never waivable"):
        P.check_eval([report(tmp_path, "b.json", **{gate: 1})], "decided")


def test_the_card_speaks_as_me_and_names_every_unmet_gate(tmp_path):
    reports = P.check_eval([report(tmp_path, "c.json", known=0.62)], "a small model is better than none")
    card = P.card(reports, "abc123", "a small model is better than none")
    assert "I'm Lucy D" in card and "Lucy D is a" not in card
    assert "Not every gate I set for myself is met:** known (qwen3-1.7b)" in card
    assert "a small model is better than none" in card and "| **no** |" in card
    clean = P.card(P.check_eval([report(tmp_path, "d.json")]), "abc123")
    assert "Not every gate" not in clean
