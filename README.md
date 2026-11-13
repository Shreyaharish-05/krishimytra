# KrishiMytra Farmer Crop Advisor

KrishiMytra is a multilingual crop suggestion app for farmers. It includes a crop dataset and trains one shared Random Forest recommender from it when the backend starts, so farmers only need to sign in and enter field measurements. No farmer CSV upload or model evaluation step is required.

## Run locally

Start the backend in one terminal:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

Start the frontend in another terminal:

```bash
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173`, create an account or sign in, enter country, state/province, city/town, plot size, and the seven soil/weather values, then choose **Find suitable crops**. The app supports English, Hindi, and Kannada.

The crop assistant can explain the current model matches and show each crop's observed N/P/K dataset range. These N/P/K values describe training-data features, not fertilizer product or application doses. For an illustrative ROI calculation, enter expected yield per plot unit, selling price per kilogram, production cost per plot unit, and a currency code; the assistant calculates only from those assumptions and does not forecast yield or market prices.

Run the backend tests and frontend build:

```bash
python -m pytest backend/tests -q
npm run build
```

## Bundled crop data

The project includes `backend/data/Crop_recommendation.csv`, a 2,200-record dataset covering 22 crop labels and the seven input features. The backend loads it and trains one shared model on startup. Every signed-in farmer receives suggestions from this same project-provided model. The dataset source is Atharva Ingle's [Crop Recommendation Dataset](https://www.kaggle.com/datasets/atharvaingle/crop-recommendation-dataset); the dataset page identifies it as Apache License 2.0. The license text is included at `backend/data/LICENSE-2.0.txt`.

The model returns the three most likely crop labels and their classifier probability scores. Those scores are model rankings, not measured probabilities of yield or success. This popular teaching dataset is augmented from rainfall, climate, and fertilizer data and should not be treated as locally calibrated agronomic advice. Country, region, city/town, and plot size are collected as farmer context; they do not currently alter model rankings. The prototype does not fetch live weather or location-specific conditions. Consider season, seed access, irrigation, pests, and local expert guidance before planting.

## Accounts and data

Accounts are stored in `backend/app/terraqml.sqlite3`; passwords are salted and hashed with PBKDF2-HMAC-SHA256. The frontend keeps the signed bearer token in session storage. The signing key defaults to a development-only value; set `TERRA_TOKEN_SECRET` to a long random secret before exposing the API beyond a trusted local machine. Set `TERRA_DATABASE_PATH` to choose another SQLite file.

The bundled dataset and trained model are shared by all users. Field inputs are sent to the backend for prediction and are not written to a database. Account authentication remains required for profile and recommendation endpoints. Add production security, transport encryption, and operational controls before using the app with real farm data.

## API

- `GET /api/health`
- `POST /api/auth/signup` and `POST /api/auth/login`
- `GET /api/auth/me` and `GET /api/profile` (bearer authentication)
- `POST /api/recommend` accepts the seven numeric readings and optional farm location/plot metadata
- `POST /api/chat` accepts a crop question plus optional location and ROI assumptions

## Project structure

```text
backend/
  app/main.py                      FastAPI auth and bundled-model recommendations
  data/Crop_recommendation.csv     Bundled crop examples
  data/LICENSE-2.0.txt             Dataset license
  tests/test_api.py                Authenticated bundled-data workflow tests
src/
  App.tsx                          Multilingual farmer interface
  styles.css                       Responsive auth and recommendation screens
```