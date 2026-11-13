from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.main import app


def test_signup_login_and_crop_recommendation():
    client = TestClient(app)
    email = f"farmer-{uuid4()}@example.com"
    signup = client.post(
        "/api/auth/signup",
        json={"name": "Test Farmer", "email": email, "password": "fieldpass123"},
    )
    assert signup.status_code == 200
    token = signup.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    login = client.post(
        "/api/auth/login", json={"email": email, "password": "fieldpass123"}
    )
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email
    assert client.get("/api/profile").status_code == 401

    profile = client.get("/api/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json()["dataset"]["filename"] == "Crop_recommendation.csv"
    assert profile.json()["dataset"]["rows"] == 2200
    assert profile.json()["dataset"]["crop_count"] == 22

    response = client.post(
        "/api/recommend",
        headers=headers,
        json={
            "N": 90,
            "P": 42,
            "K": 43,
            "temperature": 20.87974371,
            "humidity": 82.00274423,
            "ph": 6.502985292,
            "rainfall": 202.9355362,
            "country": "India",
            "region": "Maharashtra",
            "place": "Pune",
            "plot_area": 2,
            "plot_unit": "acre",
        },
    )
    assert response.status_code == 200
    recommendations = response.json()["recommendations"]
    assert len(recommendations) == 3
    assert recommendations[0]["crop"] == "rice"
    assert all(0 <= item["score"] <= 1 for item in recommendations)
    assert response.json()["farm"]["plot_area"] == 2
    assert response.json()["farm"]["place"] == "Pune"

    missing_assumptions = client.post(
        "/api/chat",
        headers=headers,
        json={"message": "Estimate ROI for rice", "language": "en", "crop": "rice", "plot_area": 2},
    )
    assert missing_assumptions.status_code == 200
    assert "expected yield" in missing_assumptions.json()["answer"]

    roi = client.post(
        "/api/chat",
        headers=headers,
        json={
            "message": "Estimate ROI for rice",
            "language": "en",
            "crop": "rice",
            "plot_area": 2,
            "plot_unit": "acre",
            "expected_yield_per_area": 1000,
            "selling_price_per_kg": 10,
            "production_cost_per_area": 3000,
            "currency": "INR",
        },
    )
    assert roi.status_code == 200
    assert "20,000.00 INR" in roi.json()["answer"]
    assert "14,000.00 INR" in roi.json()["answer"]

    npk = client.post(
        "/api/chat",
        headers=headers,
        json={"message": "What fertilizer does rice need?", "language": "en", "crop": "rice"},
    )
    assert npk.status_code == 200
    assert "not fertilizer application rates" in npk.json()["answer"]

    npk_kn = client.post(
        "/api/chat",
        headers=headers,
        json={"message": "ಅಕ್ಕಿಗೆ ಯಾವ ರಸಗೊಬ್ಬರ ಬೇಕು?", "language": "kn", "crop": "rice"},
    )
    assert npk_kn.status_code == 200
    assert "ರಸಗೊಬ್ಬರದ ಪ್ರಮಾಣ" in npk_kn.json()["answer"]

    rice_question = client.post(
        "/api/chat",
        headers=headers,
        json={"message": "what all fertilizers required to grow rice", "language": "en"},
    )
    assert rice_question.status_code == 200
    assert "For rice" in rice_question.json()["answer"]
    assert "not fertilizer application rates" in rice_question.json()["answer"]


def test_profile_and_recommendation_require_sign_in():
    client = TestClient(app)
    response = client.post(
        "/api/recommend",
        json={"N": 1, "P": 1, "K": 1, "temperature": 20, "humidity": 50, "ph": 6, "rainfall": 100},
    )
    assert response.status_code == 401
    assert client.get("/api/profile").status_code == 401
    assert client.post("/api/chat", json={"message": "What fertilizer for rice?"}).status_code == 401