"""Values copied from frontend/src/features/wedding/sampleWedding.ts (fictional data)."""

from typing import Any


def _img(file: str) -> str:
    return f"/sample-wedding/{file}"


SAMPLE_WEDDING: dict[str, Any] = {
    "schemaVersion": 1,
    "locale": "en",
    "opening": {
        "weddingTitle": "The Wedding of Alex & Sarah",
        "coupleNames": "Alex & Sarah",
        "headline": "Two hearts, one beginning",
        "introduction": (
            "With grateful hearts and the blessing of our families, we joyfully invite you to "
            "celebrate the day we begin our life together."
        ),
        "coverImage": {
            "src": _img("cover-photo.jpg"),
            "alt": "A couple sharing a quiet moment in a sunlit garden",
            "focalPoint": {"x": 42, "y": 70},
        },
        "weddingDate": "2027-06-12",
    },
    "couple": {
        "groom": {
            "name": "Alex Wijaya",
            "image": {
                "src": _img("couple-portrait.jpg"),
                "alt": "Alex smiling with Sarah beneath a garden canopy",
                "focalPoint": {"x": 32, "y": 42},
            },
            "description": (
                "Eldest son of Mr. Hendra Wijaya and Mrs. Lina Wijaya. An architect who sketches "
                "on every napkin and makes the best Sunday pancakes."
            ),
        },
        "bride": {
            "name": "Sarah Putri",
            "image": {
                "src": _img("couple-portrait.jpg"),
                "alt": "Sarah smiling with Alex beneath a garden canopy",
                "focalPoint": {"x": 70, "y": 42},
            },
            "description": (
                "Youngest daughter of Mr. Budi Santoso and Mrs. Ratna Dewi. A paediatric nurse, "
                "avid reader, and keeper of an ever-growing plant collection."
            ),
        },
    },
    "story": {
        "enabled": True,
        "title": "Our Story",
        "introduction": (
            "Every love story is beautiful, but ours is our favourite. Here are a few chapters so far."
        ),
        "timeline": [
            {
                "id": "met",
                "title": "The First Hello",
                "date": "March 2018",
                "description": (
                    "A shared table in a crowded campus library in Bandung, one borrowed pen, and a "
                    "conversation that lasted until closing time."
                ),
                "image": {
                    "src": _img("story-library.jpg"),
                    "alt": "Alex and Sarah sharing a conversation at a university library table in Bandung",
                },
            },
            {
                "id": "trip",
                "title": "Our First Journey",
                "date": "August 2022",
                "description": (
                    "Our first trip together to Lombok — missed ferries, sunburnt noses, and the "
                    "quiet realisation that home could be a person."
                ),
                "image": {
                    "src": _img("story-coast.jpg"),
                    "alt": "Alex and Sarah walking along a quiet Lombok beach",
                },
            },
            {
                "id": "proposal",
                "title": "The Question",
                "date": "December 2026",
                "description": (
                    "On a windy cliff at sunset, with a ring hidden in a sketchbook, Alex asked "
                    "— and Sarah said yes before he finished."
                ),
                "image": {
                    "src": _img("story-proposal.jpg"),
                    "alt": "Alex proposing to Sarah at a garden lookout at sunset",
                },
            },
        ],
    },
    "events": [
        {
            "id": "akad",
            "type": "akad",
            "title": "Akad Nikah",
            "date": "2027-06-12",
            "startTime": "08:00",
            "endTime": "10:00",
            "venueName": "Kediaman Keluarga Santoso",
            "address": "Jl. Melati Indah No. 12, Kebayoran Baru, Jakarta Selatan",
            "description": "An intimate ceremony with close family. Kindly arrive 15 minutes early.",
        },
        {
            "id": "reception",
            "type": "reception",
            "title": "Wedding Reception",
            "date": "2027-06-12",
            "startTime": "18:30",
            "endTime": "21:30",
            "venueName": "Kencana Grand Ballroom",
            "address": "Jl. Taman Kencana No. 88, Menteng, Jakarta Pusat",
            "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Menteng%2C%20Jakarta%20Pusat",
            "description": "Dinner, music and dancing. Dress code: formal, in soft neutral tones.",
        },
    ],
    "gallery": {
        "enabled": True,
        "title": "Moments",
        "description": "A few of our favourite moments together.",
        "images": [
            {"id": "g1", "src": _img("gallery-venue.jpg"),
             "alt": "Garden reception tables under warm evening lights", "caption": "Where it all begins"},
            {"id": "g2", "src": _img("gallery-details.jpg"),
             "alt": "Ivory roses, wedding stationery and gold rings on a limestone table",
             "caption": "Something blooming"},
            {"id": "g3", "src": _img("story-coast.jpg"),
             "alt": "Alex and Sarah walking along the shoreline at golden hour", "caption": "Early mornings"},
            {"id": "g4", "src": _img("story-proposal.jpg"),
             "alt": "The couple sharing a joyful moment at sunset", "caption": "Golden evenings"},
            {"id": "g5", "src": _img("cover-photo.jpg"),
             "alt": "The couple walking together through a sunlit garden", "caption": "Long walks"},
            {"id": "g6", "src": _img("couple-portrait.jpg"),
             "alt": "Alex and Sarah smiling beneath the garden canopy", "caption": "Just us"},
        ],
    },
    "rsvp": {
        "title": "Will You Join Us?",
        "introduction": (
            "Your presence would mean the world to us. Please let us know if you can celebrate with us."
        ),
        "enabled": True,
        "deadline": "2027-05-25",
    },
    "closing": {
        "message": (
            "It would be an honour and a joy to have you with us as we begin this new chapter. "
            "Thank you for your love, prayers and blessings."
        ),
        "thankYou": "With love, Alex & Sarah",
        "image": {
            "src": _img("couple-portrait.jpg"),
            "alt": "Alex and Sarah sharing a quiet moment beneath a garden canopy",
            "focalPoint": {"x": 52, "y": 48},
        },
    },
}

#: Universal sections every NEW wedding starts with (CMS v2.0; existing weddings are not backfilled).
NEW_WEDDING_DEFAULTS: dict[str, Any] = {"countdown": {"enabled": True, "addToCalendar": True}}

EMPTY_DRAFT: dict[str, Any] = {
    **NEW_WEDDING_DEFAULTS,
    "schemaVersion": 1,
    "locale": "en",
    "opening": {},
    "couple": {"groom": {}, "bride": {}},
    "story": {"enabled": False, "timeline": []},
    "events": [],
    "gallery": {"enabled": False, "images": []},
    "rsvp": {"enabled": False},
    "closing": {},
}


#: SAMPLE_WEDDING saved (legacy merge semantics) into a freshly created wedding.
SAVED_SAMPLE: dict[str, Any] = {**NEW_WEDDING_DEFAULTS, **SAMPLE_WEDDING}
