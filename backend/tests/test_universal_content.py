"""v1.1 additive persistence, validation and owner-only draft boundary."""
from copy import deepcopy

import pytest
from pydantic import ValidationError

from app.schemas.invitation import AmplopDigitalSection, HolyReciteSection
from tests.wedding_helpers import API, create_wedding
from tests.wedding_samples import SAMPLE_WEDDING

LEGACY_SAMPLE = deepcopy(SAMPLE_WEDDING)
LEGACY_SAMPLE["story"].pop("enabled", None)
LEGACY_SAMPLE["gallery"].pop("enabled", None)


def test_strict_accounts_and_safe_qris():
    with pytest.raises(ValidationError):
        AmplopDigitalSection.model_validate({"bankAccounts": [{"bankName": "B", "accountHolder": "A", "accountNumber": 123}]})
    with pytest.raises(ValidationError):
        AmplopDigitalSection.model_validate({"qrisImage": {"src": "javascript:alert(1)", "alt": "QRIS"}})
    with pytest.raises(ValidationError):
        HolyReciteSection.model_validate({"enabled": "false"})


def test_universal_round_trip_and_legacy_put(auth_client, client):
    wedding = create_wedding(auth_client)
    path = f"{API}/{wedding['id']}/content"
    draft = deepcopy(SAMPLE_WEDDING)
    draft.update({
        "contentVersion": "1.1",
        "holyRecite1": {"enabled": True, "originalScript": "بِسْمِ الله", "translation": "Kasih", "reference": "Reference 1"},
        "holyRecite2": {"enabled": False, "passage": "Preserved second passage"},
        "greeting": {"enabled": False, "message": "Keep this greeting"},
        "wishes": {"enabled": False, "introduction": "Keep wishes"},
        "countdown": {"enabled": False},
        "amplopDigital": {"enabled": True, "bankAccountsEnabled": True,
            "bankAccounts": [{"bankName": "Bank", "accountHolder": "Alex", "accountNumber": "001234"}],
            "qrisEnabled": True, "qrisImage": {"src": "https://example.com/uploaded-qris.png", "alt": "Wedding QRIS"},
            "physicalGifts": {"enabled": False, "address": "Retained address", "phone": "00123"}},
    })
    draft["story"]["enabled"] = False
    draft["gallery"]["enabled"] = False
    response = auth_client.put(path, json=draft)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["holyRecite1"]["originalScript"] == "بِسْمِ الله"
    assert body["holyRecite2"]["passage"] == "Preserved second passage"
    assert body["amplopDigital"]["bankAccounts"][0]["accountNumber"] == "001234"
    assert body["amplopDigital"]["physicalGifts"]["address"] == "Retained address"
    # Old editors cannot silently discard extensions or independent visibility.
    response = auth_client.put(path, json=LEGACY_SAMPLE)
    assert response.status_code == 200, response.text
    assert response.json()["holyRecite2"] == body["holyRecite2"]
    assert response.json()["story"]["enabled"] is False
    assert response.json()["gallery"]["enabled"] is False
    preview = auth_client.get(f"{API}/{wedding['id']}/preview")
    assert preview.json()["content"]["holyRecite1"] == body["holyRecite1"]
    # No public publishing route is introduced; all invitation content stays owner-only.
    assert auth_client.get(f"{API}/me").json()["status"] == "draft"
    client.cookies.clear()
    assert client.get(path).status_code == 401
    assert client.get(f"{API}/{wedding['id']}/preview").status_code == 401


def test_toggle_only_updates_retain_nested_content_and_explicit_reset(auth_client):
    wedding = create_wedding(auth_client)
    path = f"{API}/{wedding['id']}/content"
    draft = deepcopy(SAMPLE_WEDDING)
    draft.update({
        "holyRecite1": {"enabled": True, "passage": "Retain scripture", "reference": "Ref"},
        "amplopDigital": {"enabled": True, "bankAccountsEnabled": True,
            "bankAccounts": [{"bankName": "Bank", "accountHolder": "Alex", "accountNumber": "001234"}],
            "qrisEnabled": True, "qrisImage": {"src": "https://example.com/qris.png", "alt": "QRIS"},
            "physicalGifts": {"enabled": True, "address": "Retained address"}},
    })
    assert auth_client.put(path, json=draft).status_code == 200
    toggle = deepcopy(SAMPLE_WEDDING)
    toggle.update({"holyRecite1": {"enabled": False}, "amplopDigital": {
        "enabled": False, "qrisEnabled": False, "physicalGifts": {"enabled": False}}})
    response = auth_client.put(path, json=toggle)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["holyRecite1"]["passage"] == "Retain scripture"
    assert body["amplopDigital"]["bankAccounts"][0]["accountNumber"] == "001234"
    assert body["amplopDigital"]["qrisImage"]["src"] == "https://example.com/qris.png"
    assert body["amplopDigital"]["physicalGifts"]["address"] == "Retained address"
    toggle["holyRecite1"]["passage"] = None
    toggle["amplopDigital"]["qrisImage"] = None
    toggle["amplopDigital"]["bankAccounts"] = []
    response = auth_client.put(path, json=toggle)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["holyRecite1"]["passage"] is None
    assert body["amplopDigital"]["qrisImage"] is None
    assert body["amplopDigital"]["bankAccounts"] == []


def test_legacy_save_refreshes_stale_orm_state_before_merge(auth_client, db):
    import uuid
    from sqlalchemy import update
    from sqlalchemy.orm import Session
    from app.models import Invitation
    from app.schemas.invitation import InvitationDraftIn
    from app.services.invitation_content_service import replace_content

    wedding_id = uuid.UUID(create_wedding(auth_client)["id"])
    stale = db.get(Invitation, wedding_id)
    assert stale.universal_content == {"countdown": {"enabled": True, "addToCalendar": True}}
    with Session(bind=db.get_bind()) as concurrent:
        concurrent.execute(update(Invitation).where(Invitation.id == wedding_id).values(
            universal_content={"holyRecite2": {"enabled": False, "passage": "Concurrent update"}},
            story_meta={"enabled": False},
        ))
        concurrent.commit()
    body = replace_content(db, stale, InvitationDraftIn.model_validate(LEGACY_SAMPLE))
    assert body["holyRecite2"]["passage"] == "Concurrent update"
    assert body["story"]["enabled"] is False
