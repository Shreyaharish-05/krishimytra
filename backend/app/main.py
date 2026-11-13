from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import sqlite3
import time
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sklearn.ensemble import RandomForestClassifier

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
DATABASE_PATH = Path(os.getenv("TERRA_DATABASE_PATH", Path(__file__).with_name("terraqml.sqlite3")))
DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "Crop_recommendation.csv"
DATASET_SOURCE = "Crop Recommendation Dataset by Atharva Ingle on Kaggle (Apache 2.0)"
TOKEN_SECRET = os.getenv("TERRA_TOKEN_SECRET", "local-development-secret-change-before-deploy").encode()
TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 7

app = FastAPI(title="KrishiMytra Farmer API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class SoilReading(BaseModel):
    N: float = Field(ge=0, le=200)
    P: float = Field(ge=0, le=200)
    K: float = Field(ge=0, le=250)
    temperature: float = Field(ge=-10, le=60)
    humidity: float = Field(ge=0, le=100)
    ph: float = Field(ge=0, le=14)
    rainfall: float = Field(ge=0, le=1000)


class FarmerReading(SoilReading):
    country: str = Field(default="", max_length=80)
    region: str = Field(default="", max_length=100)
    place: str = Field(default="", max_length=100)
    plot_area: float | None = Field(default=None, gt=0, le=1_000_000)
    plot_unit: str = Field(default="acre", pattern="^(acre|hectare)$")


class CropQuestion(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    language: str = Field(default="en", pattern="^(en|hi|kn)$")
    crop: str = Field(default="", max_length=80)
    top_crops: list[str] = Field(default_factory=list, max_length=3)
    country: str = Field(default="", max_length=80)
    region: str = Field(default="", max_length=100)
    place: str = Field(default="", max_length=100)
    plot_area: float | None = Field(default=None, gt=0, le=1_000_000)
    plot_unit: str = Field(default="acre", pattern="^(acre|hectare)$")
    expected_yield_per_area: float | None = Field(default=None, ge=0, le=100_000)
    selling_price_per_kg: float | None = Field(default=None, ge=0, le=1_000_000)
    production_cost_per_area: float | None = Field(default=None, ge=0, le=1_000_000_000)
    currency: str = Field(default="", max_length=12)


def connect_database() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect_database() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )"""
        )


initialize_database()


def load_crop_recommender() -> tuple[RandomForestClassifier, dict[str, Any]]:
    if not DATASET_PATH.is_file():
        raise RuntimeError(f"Bundled crop dataset not found: {DATASET_PATH}")
    frame = pd.read_csv(DATASET_PATH)
    required_columns = {*FEATURES, "label"}
    if not required_columns.issubset(frame.columns):
        raise RuntimeError("Bundled crop dataset is missing required feature or label columns.")
    frame = frame.dropna(subset=[*FEATURES, "label"])
    model = RandomForestClassifier(
        n_estimators=300,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(frame[FEATURES], frame["label"].astype(str))
    dataset_info = {
        "filename": DATASET_PATH.name,
        "rows": len(frame),
        "crop_count": int(frame["label"].nunique()),
        "crops": sorted(frame["label"].astype(str).unique().tolist()),
        "source": DATASET_SOURCE,
    }
    return model, dataset_info


crop_model, project_dataset_info = load_crop_recommender()


def normalize_email(email: str) -> str:
    normalized = email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    return normalized


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310_000)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, digest_hex = stored_hash.split("$", maxsplit=1)
        expected = bytes.fromhex(digest_hex)
    except ValueError:
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 310_000)
    return hmac.compare_digest(actual, expected)


def create_token(user_id: int) -> str:
    payload = f"{user_id}:{int(time.time()) + TOKEN_LIFETIME_SECONDS}".encode()
    encoded = base64.urlsafe_b64encode(payload).decode().rstrip("=")
    signature = hmac.new(TOKEN_SECRET, encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    unauthorized = HTTPException(status_code=401, detail="Sign in to continue.")
    if credentials is None:
        raise unauthorized
    try:
        encoded, signature = credentials.credentials.split(".", maxsplit=1)
        expected = hmac.new(TOKEN_SECRET, encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise unauthorized
        payload = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode()
        user_id_text, expires_text = payload.split(":", maxsplit=1)
        if int(expires_text) < int(time.time()):
            raise unauthorized
        user_id = int(user_id_text)
    except (ValueError, UnicodeDecodeError):
        raise unauthorized from None
    with connect_database() as connection:
        user = connection.execute(
            "SELECT id, name, email FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    if user is None:
        raise unauthorized
    return dict(user)


def issue_auth_response(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "access_token": create_token(int(user["id"])),
        "token_type": "bearer",
        "user": {"name": user["name"], "email": user["email"]},
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "KrishiMytra Farmer API"}


@app.post("/api/auth/signup")
def signup(request: SignupRequest) -> dict[str, Any]:
    email = normalize_email(request.email)
    name = request.name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Enter your name.")
    with connect_database() as connection:
        try:
            cursor = connection.execute(
                "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (name, email, hash_password(request.password), int(time.time())),
            )
        except sqlite3.IntegrityError as error:
            raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
        user = {"id": cursor.lastrowid, "name": name, "email": email}
    return issue_auth_response(user)


@app.post("/api/auth/login")
def login(request: LoginRequest) -> dict[str, Any]:
    email = normalize_email(request.email)
    with connect_database() as connection:
        row = connection.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?", (email,)
        ).fetchone()
    if row is None or not verify_password(request.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    return issue_auth_response(dict(row))


@app.get("/api/auth/me")
def current_account(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"name": user["name"], "email": user["email"]}


@app.get("/api/profile")
def profile(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {"trained": True, "dataset": project_dataset_info}


@app.post("/api/recommend")
def recommend(
    reading: FarmerReading, user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, Any]:
    row = pd.DataFrame([reading.model_dump()], columns=FEATURES)
    probabilities = crop_model.predict_proba(row)[0]
    ranked_indices = probabilities.argsort()[::-1][:3]
    recommendations = [
        {"crop": str(crop_model.classes_[index]), "score": float(probabilities[index])}
        for index in ranked_indices
    ]
    return {
        "recommendations": recommendations,
        "note": "These are model rankings based on the bundled reference dataset, not a guarantee of yield.",
        "farm": {
            "country": reading.country,
            "region": reading.region,
            "place": reading.place,
            "plot_area": reading.plot_area,
            "plot_unit": reading.plot_unit,
        },
    }


@app.post("/api/chat")
def crop_chat(
    question: CropQuestion, user: dict[str, Any] = Depends(get_current_user)
) -> dict[str, str]:
    message = question.message.casefold()
    lang = question.language
    requested_crop = question.crop.strip().casefold()
    available_crops = {str(crop).casefold(): str(crop) for crop in crop_model.classes_}
    crop = available_crops.get(requested_crop)
    if crop is None and question.top_crops:
        crop = available_crops.get(question.top_crops[0].casefold())
    if crop is None:
        crop = next(
            (
                candidate
                for normalized, candidate in available_crops.items()
                if re.search(rf"(?<!\w){re.escape(normalized)}(?!\w)", message)
            ),
            None,
        )

    roi_terms = ("roi", "profit", "revenue", "cost", "return", "लाभ", "कमाई", "खर्च", "ಆದಾಯ", "ಲಾಭ", "ವೆಚ್ಚ", "வருமானம்", "செலவு")
    fertilizer_terms = ("fertil", "manure", "npk", "nitrogen", "phosph", "potash", "उर्वरक", "खाद", "नाइट्रोजन", "ರಸಗೊಬ್ಬರ", "ಗೊಬ್ಬರ", "ಸಾರಜನಕ", "ರಂಜಕ", "ಪೊಟ್ಯಾಸಿಯಂ", "உரம்", "சத்து", "நைட்ரஜன்")
    location_terms = ("season", "weather", "region", "location", "when to plant", "ಮಳೆ", "ಹವಾಮಾನ", "ಋತು", "ಬಿತ್ತನೆ", "ಮೌಸಮ್", "इलाके", "कब बोएं", "வானிலை", "பருவம்", "எப்போது நடவு")

    if any(term in message for term in roi_terms):
        missing = []
        if not crop:
            missing.append("a crop from the recommendations")
        if question.plot_area is None:
            missing.append("plot size")
        if question.expected_yield_per_area is None:
            missing.append(f"expected yield per {question.plot_unit}")
        if question.selling_price_per_kg is None:
            missing.append("selling price per kg")
        if question.production_cost_per_area is None:
            missing.append(f"production cost per {question.plot_unit}")
        if missing:
            if lang == "hi":
                answer = "ROI का अनुमान लगाने के लिए यह जानकारी भरें: " + ", ".join(missing) + ". ये आपकी धारणाएं होंगी, उपज की गारंटी नहीं।"
            elif lang == "kn":
                answer = "ROI ಅಂದಾಜಿಸಲು ಈ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ: " + ", ".join(missing) + ". ಇವು ನಿಮ್ಮ ಅಂದಾಜುಗಳು ಮಾತ್ರ; ಇಳುವರಿಯ ಖಾತರಿ ಅಲ್ಲ."
            else:
                answer = "To estimate ROI, provide: " + ", ".join(missing) + ". These are your assumptions, not a yield guarantee."
        else:
            assert crop is not None
            assert question.plot_area is not None
            assert question.expected_yield_per_area is not None
            assert question.selling_price_per_kg is not None
            assert question.production_cost_per_area is not None
            gross = question.plot_area * question.expected_yield_per_area * question.selling_price_per_kg
            cost = question.plot_area * question.production_cost_per_area
            net = gross - cost
            roi_percent = net / cost * 100 if cost > 0 else None
            currency = f" {question.currency.strip()}" if question.currency.strip() else ""
            roi_text = "ROI is not defined when entered production cost is zero." if roi_percent is None else f"Estimated ROI: {roi_percent:.1f}% of entered production cost."
            if lang == "hi":
                roi_text = "दर्ज लागत शून्य होने पर ROI परिभाषित नहीं है।" if roi_percent is None else f"अनुमानित ROI: दर्ज उत्पादन लागत का {roi_percent:.1f}%。"
                answer = (
                    f"{question.plot_area:g} {question.plot_unit} पर {crop} का उदाहरण: कुल बिक्री {gross:,.2f}{currency}, "
                    f"उत्पादन लागत {cost:,.2f}{currency}, अन्य शुल्कों से पहले शुद्ध राशि {net:,.2f}{currency}। {roi_text} "
                    "यह केवल आपकी उपज, कीमत और लागत की धारणाओं पर आधारित है; कर, वित्त, कीमत में बदलाव और नुकसान शामिल नहीं हैं।"
                )
            elif lang == "kn":
                roi_text = "ನಮೂದಿಸಿದ ಉತ್ಪಾದನಾ ವೆಚ್ಚ ಶೂನ್ಯವಾಗಿದ್ದರೆ ROI ಲೆಕ್ಕಿಸಲಾಗುವುದಿಲ್ಲ." if roi_percent is None else f"ಅಂದಾಜು ROI: ನಮೂದಿಸಿದ ಉತ್ಪಾದನಾ ವೆಚ್ಚದ ಮೇಲೆ {roi_percent:.1f}%."
                answer = (
                    f"{question.plot_area:g} {question.plot_unit} ಜಮೀನಿನಲ್ಲಿ {crop}ಗೆ ಉದಾಹರಣೆ: ಒಟ್ಟು ಆದಾಯ {gross:,.2f}{currency}, "
                    f"ಉತ್ಪಾದನಾ ವೆಚ್ಚ {cost:,.2f}{currency}, ಇತರೆ ಶುಲ್ಕಗಳ ಮೊದಲು ನಿವ್ವಳ ಮೊತ್ತ {net:,.2f}{currency}. {roi_text} "
                    "ಇದು ನಿಮ್ಮ ಇಳುವರಿ, ಬೆಲೆ ಮತ್ತು ವೆಚ್ಚದ ಅಂದಾಜುಗಳನ್ನು ಮಾತ್ರ ಬಳಸುತ್ತದೆ; ತೆರಿಗೆ, ಹಣಕಾಸು ವೆಚ್ಚ, ಬೆಲೆ ಬದಲಾವಣೆ ಅಥವಾ ನಷ್ಟಗಳನ್ನು ಒಳಗೊಂಡಿಲ್ಲ."
                )
            else:
                answer = (
                    f"Illustrative estimate for {crop} on {question.plot_area:g} {question.plot_unit}: "
                    f"gross revenue {gross:,.2f}{currency}, production cost {cost:,.2f}{currency}, "
                    f"net before other charges {net:,.2f}{currency}. {roi_text} "
                    "This uses only your yield, price, and cost assumptions; it excludes taxes, financing, price changes, and losses."
                )
    elif any(term in message for term in fertilizer_terms):
        if not crop:
            if lang == "hi":
                answer = "किस फसल के लिए NPK संदर्भ चाहिए? पहले सुझावों में से फसल चुनें। यह डेटा उर्वरक की मात्रा या उत्पाद नहीं बताता।"
            elif lang == "kn":
                answer = "ಯಾವ ಬೆಳೆಗೆ NPK ಉಲ್ಲೇಖ ಬೇಕು? ಸಲಹೆಗಳಲ್ಲಿ ಒಂದು ಬೆಳೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಈ ಡೇಟಾ ರಸಗೊಬ್ಬರದ ಉತ್ಪನ್ನ ಅಥವಾ ಬಳಕೆಯ ಪ್ರಮಾಣವನ್ನು ಸೂಚಿಸುವುದಿಲ್ಲ."
            else:
                answer = "Which crop should I look up? Choose one of your suggested crops. This dataset does not specify fertilizer products or application doses."
        else:
            crop_rows = pd.read_csv(DATASET_PATH)
            crop_rows = crop_rows[crop_rows["label"].astype(str).str.casefold() == crop.casefold()]
            ranges = {
                nutrient: (
                    float(crop_rows[nutrient].quantile(0.25)),
                    float(crop_rows[nutrient].median()),
                    float(crop_rows[nutrient].quantile(0.75)),
                )
                for nutrient in ("N", "P", "K")
            }
            range_text = "; ".join(
                f"{name} observed middle 50% {low:.0f}-{high:.0f} (median {median:.0f})"
                for name, (low, median, high) in ranges.items()
            )
            if lang == "hi":
                answer = (
                    f"{crop} के लिए शामिल डेटा का मिट्टी N/P/K संदर्भ: {range_text}। "
                    "ये डेटा फीचर मान हैं, उर्वरक की मात्रा या खेत के लिए निर्देश नहीं। उत्पाद और मात्रा चुनने के लिए मिट्टी जांच तथा स्थानीय कृषि विशेषज्ञ की सलाह लें।"
                )
            elif lang == "kn":
                answer = (
                    f"{crop} ಬೆಳೆಗಾಗಿ ಸೇರಿಸಿದ ಡೇಟಾದ ಮಣ್ಣಿನ N/P/K ಉಲ್ಲೇಖ: {range_text}. "
                    "ಇವು ಡೇಟಾದ ಮಣ್ಣಿನ ಅಂಶ ಮೌಲ್ಯಗಳು ಮಾತ್ರ; ರಸಗೊಬ್ಬರದ ಪ್ರಮಾಣ ಅಥವಾ ಹೊಲಕ್ಕೆ ನೀಡುವ ಸೂಚನೆಗಳಲ್ಲ. ಉತ್ಪನ್ನ ಮತ್ತು ಪ್ರಮಾಣ ನಿರ್ಧರಿಸಲು ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮಾಡಿ ಸ್ಥಳೀಯ ಕೃಷಿ ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಿ."
                )
            else:
                answer = (
                    f"For {crop}, the bundled dataset's soil N/P/K reference is: {range_text}. "
                    "These are dataset feature values, not fertilizer application rates or a field prescription. "
                    "Use a local soil test and agricultural professional to choose products and doses."
                )
    elif any(term in message for term in location_terms):
        if lang == "hi":
            answer = "देश और स्थान आपकी खेत जानकारी में दर्ज हैं, लेकिन संदर्भ डेटासेट स्थान या मौसम के अनुसार नहीं है। यह सलाह स्थानीय मौसम, मौसम/सीजन या बोआई तारीख के लिए कैलिब्रेटेड नहीं है। स्थानीय कृषि विशेषज्ञ से पुष्टि करें।"
        elif lang == "kn":
            answer = "ದೇಶ ಮತ್ತು ಸ್ಥಳವನ್ನು ನಿಮ್ಮ ಹೊಲದ ವಿವರದಲ್ಲಿ ದಾಖಲಿಸಲಾಗಿದೆ. ಆದರೆ ಉಲ್ಲೇಖ ಡೇಟಾ ಸ್ಥಳ ಅಥವಾ ಹವಾಮಾನ ಆಧಾರಿತವಲ್ಲ. ಸ್ಥಳೀಯ ಹವಾಮಾನ, ಋತು ಅಥವಾ ಬಿತ್ತನೆ ದಿನಾಂಕಕ್ಕೆ ಇದು ಹೊಂದಿಸಲ್ಪಟ್ಟಿಲ್ಲ; ಸ್ಥಳೀಯ ಕೃಷಿ ತಜ್ಞರೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ."
        else:
            location = ", ".join(part for part in (question.place, question.region, question.country) if part)
            answer = f"{location + ': ' if location else ''}Your location is recorded, but the bundled dataset is not location- or season-specific. Suggestions are not calibrated for local weather or planting dates; confirm with local agricultural guidance."
    elif any(term in message for term in ("crop", "suitable", "recommend", "grow", "ಫಸಲು", "ಬೆಳೆ", "ಸೂಕ್ತ", "ಶಿಫಾರಸು", "फसल", "பயிர்")):
        crops = question.top_crops or ([crop] if crop else [])
        if crops:
            answer = "Your current top model matches are " + ", ".join(crops[:3]) + ". They reflect the bundled dataset, not guaranteed yield."
        else:
            answer = "Enter all seven field measurements and request crop suggestions first. I can then explain the returned crop matches."
    else:
        if lang == "hi":
            answer = "मैं शामिल फसल डेटा के आधार पर फसल सुझाव, NPK डेटा संदर्भ और आपकी उपज/कीमत/लागत धारणाओं से ROI अनुमान में मदद कर सकता हूं। उर्वरक मात्रा, स्थानीय मौसम या उपज की गारंटी नहीं देता।"
        elif lang == "kn":
            answer = "ಸೇರಿಸಿದ ಬೆಳೆ ಡೇಟಾದ ಆಧಾರದಲ್ಲಿ ಬೆಳೆ ಹೊಂದಾಣಿಕೆ, NPK ಉಲ್ಲೇಖ ಮೌಲ್ಯಗಳು ಮತ್ತು ನಿಮ್ಮ ಇಳುವರಿ/ಬೆಲೆ/ವೆಚ್ಚದ ಅಂದಾಜುಗಳಿಂದ ROI ಲೆಕ್ಕಿಸಲು ಸಹಾಯ ಮಾಡಬಹುದು. ರಸಗೊಬ್ಬರದ ಪ್ರಮಾಣ, ಸ್ಥಳೀಯ ಹವಾಮಾನ ಅಥವಾ ಇಳುವರಿಯ ಖಾತರಿ ನೀಡಲು ಸಾಧ್ಯವಿಲ್ಲ."
        else:
            answer = "I can explain crop matches, show dataset NPK references, or estimate ROI from your yield, price, and cost assumptions. I cannot prescribe fertilizer doses or guarantee yield."
    return {"answer": answer}