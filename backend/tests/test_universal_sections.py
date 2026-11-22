"""CMS v2.0: per-section endpoints for the universal (v1.1+) sections and new fields."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Invitation
from tests.wedding_helpers import API, create_wedding

ARABIC = "مرحبا بكم"  # neutral sample text (not a scripture quotation)


def etag(response: Any) -> int:
    assert response.status_code < 300, response.text
    return int(response.headers["etag"].strip('"'))


@pytest.fixture
def base(auth_client: TestClient) -> str:
    return f"{API}/{create_wedding(auth_client)['id']}"


@pytest.mark.parametrize(
    ("section", "body"),
    [
        ("holyRecite1", {"enabled": True, "title": "Ayat", "tradition": "Islam", "book": "Al-Qur'an",
                         "reference": "QS 30:21", "originalScript": f"{ARABIC}\nbaris kedua", "originalLanguage": "ar",
                         "translation": "Terjemahan", "translationLanguage": "id", "attribution": "Kemenag"}),
        ("holyRecite2", {"enabled": True, "passage": "Kasih itu sabar", "reference": "1 Kor 13:4"}),
        ("greeting", {"enabled": True, "title": "Assalamu'alaikum", "message": "Dengan memohon rahmat", "prayer": "Doa"}),
        ("countdown", {"enabled": True, "addToCalendar": True}),
        ("wishes", {"enabled": False, "title": "Ucapan", "introduction": "Kirim doa"}),
        ("amplopDigital", {"enabled": True, "bankAccountsEnabled": True, "qrisEnabled": False,
                           "bankAccounts": [{"id": "a1", "bankName": "BCA", "accountHolder": "Ayu",
                                             "accountNumber": "0012345678"}],
                           "physicalGifts": {"enabled": True, "recipient": "Ayu", "address": "Jl. Melati 1",
                                             "phone": "+62 812-3456"}}),
    ],
)
def test_universal_section_round_trip(auth_client: TestClient, base: str, section: str, body: dict[str, Any]) -> None:
    put = auth_client.put(f"{base}/sections/{section}", json=body)
    assert put.json() == body
    assert etag(put) == 1
    assert auth_client.get(f"{base}/sections/{section}").json() == body
    assert auth_client.get(f"{base}/content").json()[section] == body


def test_put_replaces_so_cleared_fields_are_really_cleared(auth_client: TestClient, base: str) -> None:
    auth_client.put(f"{base}/sections/greeting", json={"enabled": True, "title": "A", "message": "Old"})
    cleared = auth_client.put(f"{base}/sections/greeting", json={"enabled": True, "title": "A"})
    assert cleared.json() == {"enabled": True, "title": "A"}
    assert "message" not in auth_client.get(f"{base}/content").json()["greeting"]


def test_disabling_keeps_the_content(auth_client: TestClient, base: str) -> None:
    body = {"enabled": True, "passage": "Teks", "reference": "Ref"}
    auth_client.put(f"{base}/sections/holyRecite1", json=body)
    off = auth_client.put(f"{base}/sections/holyRecite1", json={**body, "enabled": False})
    assert off.json() == {**body, "enabled": False}
    # The other recite is independent.
    assert auth_client.get(f"{base}/sections/holyRecite2").json() == {}


def test_universal_writes_use_the_revision_precondition(auth_client: TestClient, base: str) -> None:
    first = auth_client.put(f"{base}/sections/wishes", json={"enabled": True}, headers={"If-Match": '"0"'})
    assert etag(first) == 1
    stale = auth_client.put(f"{base}/sections/wishes", json={"enabled": False}, headers={"If-Match": '"0"'})
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "edit_conflict"
    assert auth_client.get(f"{base}/sections/wishes").json() == {"enabled": True}


def test_other_users_get_404_on_universal_sections(auth_client: TestClient, other_client: TestClient, base: str) -> None:
    for section in ("holyRecite1", "holyRecite2", "greeting", "countdown", "wishes", "amplopDigital"):
        assert other_client.get(f"{base}/sections/{section}").status_code == 404
        assert other_client.put(f"{base}/sections/{section}", json={"enabled": True}).status_code == 404


def test_unknown_section_is_404(auth_client: TestClient, base: str) -> None:
    assert auth_client.put(f"{base}/sections/music", json={"enabled": True}).status_code == 404


@pytest.mark.parametrize(
    "number",
    [
        "0012-3456 789",  # leading zeros and separators are kept exactly
        "000000",
    ],
)
def test_account_numbers_are_strings_and_keep_leading_zeros(auth_client: TestClient, base: str, number: str) -> None:
    body = {"enabled": True, "bankAccountsEnabled": True,
            "bankAccounts": [{"bankName": "BRI", "accountHolder": "Rizky", "accountNumber": number}]}
    saved = auth_client.put(f"{base}/sections/amplopDigital", json=body).json()
    assert saved["bankAccounts"][0]["accountNumber"] == number
    assert saved["bankAccounts"][0]["id"].startswith("acc-")  # assigned when missing


@pytest.mark.parametrize(
    "number",
    [12345, "12A45", "123‮456", "12  34", " 1234", "1234-", "", "1" * 41],
)
def test_invalid_account_numbers_are_rejected(auth_client: TestClient, base: str, number: Any) -> None:
    body = {"enabled": True, "bankAccounts": [{"bankName": "BRI", "accountHolder": "R", "accountNumber": number}]}
    response = auth_client.put(f"{base}/sections/amplopDigital", json=body)
    assert response.status_code == 422, response.text


def test_bank_account_ids_must_be_unique_and_safe(auth_client: TestClient, base: str) -> None:
    account = {"id": "x", "bankName": "BRI", "accountHolder": "R", "accountNumber": "1"}
    dup = auth_client.put(f"{base}/sections/amplopDigital", json={"bankAccounts": [account, account]})
    assert dup.status_code == 422
    bad = auth_client.put(f"{base}/sections/amplopDigital",
                          json={"bankAccounts": [{**account, "id": "../x"}]})
    assert bad.status_code == 422


@pytest.mark.parametrize("phone", ["0812‮999", "call me", "++62 1"])
def test_invalid_phone_is_rejected(auth_client: TestClient, base: str, phone: str) -> None:
    body = {"physicalGifts": {"enabled": True, "phone": phone}}
    assert auth_client.put(f"{base}/sections/amplopDigital", json=body).status_code == 422


def test_section_writes_keep_other_universal_sections(auth_client: TestClient, base: str) -> None:
    auth_client.put(f"{base}/sections/holyRecite1", json={"enabled": True, "passage": "A"})
    auth_client.put(f"{base}/sections/amplopDigital", json={"enabled": False})
    content = auth_client.get(f"{base}/content").json()
    assert content["holyRecite1"] == {"enabled": True, "passage": "A"}
    assert content["amplopDigital"] == {
        "enabled": False, "bankAccountsEnabled": False, "bankAccounts": [], "qrisEnabled": False,
    }
    assert content["contentVersion"] == "2.0"


def test_stored_keys_unknown_to_the_schema_do_not_break_reads(
    auth_client: TestClient, base: str, db: Session
) -> None:
    wedding = db.query(Invitation).one()
    wedding.universal_content = {"greeting": {"enabled": True, "title": "Hi", "futureField": 1}, "mystery": {}}
    db.commit()
    assert auth_client.get(f"{base}/content").status_code == 200
    assert auth_client.get(f"{base}/sections/greeting").json() == {"enabled": True, "title": "Hi"}


def test_event_dress_code_and_livestream(auth_client: TestClient, base: str) -> None:
    event = {"title": "Resepsi", "type": "reception", "date": "2027-06-12", "startTime": "18:00",
             "dressCode": {"enabled": True, "text": "Batik"},
             "livestream": {"enabled": False, "url": "https://youtube.com/live/x", "label": "YouTube"}}
    created = auth_client.post(f"{base}/events", json=event)
    assert created.status_code == 201, created.text
    out = created.json()
    assert out["dressCode"] == {"enabled": True, "text": "Batik"}
    assert out["livestream"] == {"enabled": False, "url": "https://youtube.com/live/x", "label": "YouTube"}
    assert auth_client.get(f"{base}/content").json()["events"][0]["livestream"]["enabled"] is False
    insecure = auth_client.post(f"{base}/events", json={**event, "livestream": {"enabled": True, "url": "http://x.example"}})
    assert insecure.status_code == 422


def test_opening_guest_greeting_and_closing_acknowledgments(auth_client: TestClient, base: str) -> None:
    opening = auth_client.put(f"{base}/sections/opening",
                              json={"weddingTitle": "T", "guestGreeting": {"enabled": True, "label": "Kepada Yth."}})
    assert opening.json()["guestGreeting"] == {"enabled": True, "label": "Kepada Yth."}
    closing = auth_client.put(f"{base}/sections/closing",
                              json={"message": "Terima kasih", "familyAcknowledgments": "Keluarga A\nKeluarga B"})
    assert closing.json()["familyAcknowledgments"] == "Keluarga A\nKeluarga B"


@pytest.mark.parametrize("field", ["originalLanguage", "translationLanguage"])
@pytest.mark.parametrize("value", ["Indonesian", "a", "ar_SA", "ar-", "x" * 40])
def test_scripture_language_fields_must_be_language_codes(
    auth_client: TestClient, base: str, field: str, value: str
) -> None:
    response = auth_client.put(f"{base}/sections/holyRecite1", json={"enabled": True, field: value})
    assert response.status_code == 422, response.text


def test_published_snapshot_keeps_the_original_language(auth_client: TestClient, base: str) -> None:
    body = {"enabled": True, "originalScript": ARABIC, "originalLanguage": "ar", "translationLanguage": "id"}
    saved = auth_client.put(f"{base}/sections/holyRecite1", json=body).json()
    assert saved["originalLanguage"] == "ar" and saved["translationLanguage"] == "id"
