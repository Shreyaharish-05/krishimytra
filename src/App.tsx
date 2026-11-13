import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Database,
  Globe2,
  Leaf,
  LoaderCircle,
  LogOut,
  MapPin,
  Send,
  ShieldCheck,
  Sprout,
  UserRound,
  Wheat,
} from "lucide-react";

const API = `${import.meta.env.VITE_API_URL ?? ""}/api`;
const tokenKey = "terraqml.session";

type Language = "en" | "hi" | "kn";
type Copy = Record<string, string>;
type User = { name: string; email: string };
type Dataset = { filename: string; rows: number; crop_count: number; crops: string[]; source: string };
type CropRecommendation = { crop: string; score: number };
type ChatMessage = { role: "farmer" | "assistant"; content: string };
type FarmContext = {
  country: string;
  region: string;
  place: string;
  plotArea: string;
  plotUnit: "acre" | "hectare";
};

const copy: Record<Language, Copy> = {
  en: {
    language: "Language", signIn: "Sign in", signUp: "Create account", welcome: "Good growing starts with a good decision.",
    authIntro: "Get crop suggestions shaped by your soil, local conditions, and your farm's past records.", name: "Your name", email: "Email address", password: "Password", passwordHint: "At least 8 characters", continue: "Continue to your farm", create: "Create your account", haveAccount: "Already have an account?", needAccount: "New to KrishiMytra?", login: "Sign in", signup: "Sign up", secure: "Your farm data is private to your account.",
    greeting: "Your farm, in focus", subtitle: "Enter today's field readings to see which crops best match your conditions.", records: "records", cropTypes: "crop types",
    readings: "Today's field readings", nitrogen: "Nitrogen", phosphorus: "Phosphorus", potassium: "Potassium", temperature: "Temperature", humidity: "Humidity", ph: "Soil pH", phUnit: "pH", rainfall: "Rainfall", kgHa: "kg/ha", celsius: "°C", percent: "%", mm: "mm", getRecommendations: "Find suitable crops", update: "Update suggestions", finding: "Checking your field…", modelNote: "These are data-based suggestions, not a guarantee of yield. Consider local advice, seed availability, season, and water access before planting.", confidence: "match score", apiError: "Could not reach the farm service. Check that the backend is running.", signOut: "Sign out", myFarm: "MY FARM", workspace: "CROP ADVISOR", fieldLabel: "FIELD CONDITIONS", profile: "Farm profile", loginError: "We couldn't sign you in with those details.", signupError: "We couldn't create your account.", accountExists: "That email already has an account. Sign in instead.", invalidCredentials: "Email or password is incorrect.", footer: "Built to support decisions, not replace local farming knowledge.", featureList: "Seven field measurements", signUpPitch: "A calmer way to plan the next planting", signInPitch: "Welcome back to your farm", loading: "Loading your farm…", cropNumber: "Crop",
  },
  hi: {
    language: "भाषा", signIn: "लॉग इन", signUp: "खाता बनाएं", welcome: "अच्छी खेती की शुरुआत सही फैसले से होती है।",
    authIntro: "मिट्टी, स्थानीय परिस्थितियों और आपके खेत के पिछले रिकॉर्ड के आधार पर फसल सुझाव पाएं।", name: "आपका नाम", email: "ईमेल पता", password: "पासवर्ड", passwordHint: "कम से कम 8 अक्षर", continue: "अपने खेत पर जाएं", create: "खाता बनाएं", haveAccount: "पहले से खाता है?", needAccount: "KrishiMytra पर नए हैं?", login: "लॉग इन", signup: "साइन अप", secure: "आपके खेत का डेटा केवल आपके खाते के लिए निजी है।",
    greeting: "आपका खेत, आपकी जानकारी", subtitle: "आज की खेत की माप दर्ज करें और परिस्थितियों के अनुकूल फसलें देखें।", records: "रिकॉर्ड", cropTypes: "फसल प्रकार",
    readings: "आज के खेत की माप", nitrogen: "नाइट्रोजन", phosphorus: "फॉस्फोरस", potassium: "पोटैशियम", temperature: "तापमान", humidity: "नमी", ph: "मिट्टी का pH", phUnit: "pH", rainfall: "वर्षा", kgHa: "किग्रा/हेक्टेयर", celsius: "°C", percent: "%", mm: "मिमी", getRecommendations: "उपयुक्त फसलें देखें", update: "सुझाव अपडेट करें", finding: "आपके खेत की जांच हो रही है…", modelNote: "ये डेटा-आधारित सुझाव हैं, उपज की गारंटी नहीं। बुवाई से पहले स्थानीय सलाह, बीज उपलब्धता, मौसम और पानी पर विचार करें।", confidence: "मेल स्कोर", apiError: "खेत सेवा से संपर्क नहीं हो पाया। जांचें कि बैकएंड चल रहा है।", signOut: "लॉग आउट", myFarm: "मेरा खेत", workspace: "फसल सलाहकार", fieldLabel: "खेत की परिस्थितियां", profile: "खेत प्रोफाइल", loginError: "इन विवरणों से लॉग इन नहीं हो पाया।", signupError: "खाता नहीं बन पाया।", accountExists: "इस ईमेल का खाता पहले से है। लॉग इन करें।", invalidCredentials: "ईमेल या पासवर्ड गलत है।", footer: "फैसलों में मदद के लिए, स्थानीय खेती के ज्ञान की जगह लेने के लिए नहीं।", featureList: "खेत की सात मापें", signUpPitch: "अगली बुवाई की योजना बनाने का सरल तरीका", signInPitch: "आपका अपने खेत में फिर स्वागत है", loading: "खेत की जानकारी लोड हो रही है…", cropNumber: "फसल",
  },
  kn: {
    language: "ಭಾಷೆ", signIn: "ಲಾಗಿನ್", signUp: "ಖಾತೆ ರಚಿಸಿ", welcome: "ಉತ್ತಮ ಕೃಷಿ ಸರಿಯಾದ ನಿರ್ಧಾರದಿಂದ ಆರಂಭವಾಗುತ್ತದೆ.",
    authIntro: "ನಿಮ್ಮ ಮಣ್ಣು ಮತ್ತು ಸ್ಥಳೀಯ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಹೊಂದುವ ಬೆಳೆ ಸಲಹೆಗಳನ್ನು ಪಡೆಯಿರಿ.", name: "ನಿಮ್ಮ ಹೆಸರು", email: "ಇಮೇಲ್ ವಿಳಾಸ", password: "ಪಾಸ್‌ವರ್ಡ್", passwordHint: "ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು", continue: "ನಿಮ್ಮ ಹೊಲಕ್ಕೆ ಮುಂದುವರಿಯಿರಿ", create: "ನಿಮ್ಮ ಖಾತೆ ರಚಿಸಿ", haveAccount: "ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?", needAccount: "KrishiMytra ಗೆ ಹೊಸಬರೇ?", login: "ಲಾಗಿನ್", signup: "ಸೈನ್ ಅಪ್", secure: "ನಿಮ್ಮ ಕೃಷಿ ಡೇಟಾ ನಿಮ್ಮ ಖಾತೆಗೆ ಮಾತ್ರ ಖಾಸಗಿ.",
    greeting: "ನಿಮ್ಮ ಹೊಲ, ನಿಮ್ಮ ಗಮನದಲ್ಲಿ", subtitle: "ಇಂದಿನ ಹೊಲದ ಅಳತೆಗಳನ್ನು ನಮೂದಿಸಿ; ಪರಿಸ್ಥಿತಿಗೆ ಹೊಂದುವ ಬೆಳೆಗಳನ್ನು ನೋಡಿ.", records: "ದಾಖಲೆಗಳು", cropTypes: "ಬೆಳೆ ವಿಧಗಳು",
    readings: "ಇಂದಿನ ಹೊಲದ ಅಳತೆಗಳು", nitrogen: "ಸಾರಜನಕ", phosphorus: "ರಂಜಕ", potassium: "ಪೊಟ್ಯಾಸಿಯಂ", temperature: "ತಾಪಮಾನ", humidity: "ಆರ್ದ್ರತೆ", ph: "ಮಣ್ಣಿನ pH", phUnit: "pH", rainfall: "ಮಳೆ", kgHa: "ಡೇಟಾ ಮಾಪಕ", celsius: "°C", percent: "%", mm: "ಮಿಮೀ", getRecommendations: "ಸೂಕ್ತ ಬೆಳೆಗಳನ್ನು ನೋಡಿ", update: "ಸಲಹೆಗಳನ್ನು ನವೀಕರಿಸಿ", finding: "ನಿಮ್ಮ ಹೊಲವನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…", modelNote: "ಇವು ಡೇಟಾ ಆಧಾರಿತ ಸಲಹೆಗಳು; ಇಳುವರಿಯ ಭರವಸೆ ಅಲ್ಲ. ಬಿತ್ತುವ ಮೊದಲು ಸ್ಥಳೀಯ ಸಲಹೆ, ಬೀಜ ಲಭ್ಯತೆ, ಋತು ಮತ್ತು ನೀರಿನ ಲಭ್ಯತೆಯನ್ನು ಪರಿಗಣಿಸಿ.", confidence: "ಹೊಂದಾಣಿಕೆ ಅಂಕ", apiError: "ಕೃಷಿ ಸೇವೆಯನ್ನು ಸಂಪರ್ಕಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಬ್ಯಾಕೆಂಡ್ ಚಾಲನೆಯಲ್ಲಿದೆಯೇ ಪರಿಶೀಲಿಸಿ.", signOut: "ಲಾಗ್ ಔಟ್", myFarm: "ನನ್ನ ಹೊಲ", workspace: "ಬೆಳೆ ಸಲಹೆಗಾರ", fieldLabel: "ಹೊಲದ ಪರಿಸ್ಥಿತಿಗಳು", profile: "ಹೊಲದ ವಿವರ", loginError: "ಈ ವಿವರಗಳಿಂದ ಲಾಗಿನ್ ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", signupError: "ಖಾತೆ ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.", accountExists: "ಈ ಇಮೇಲ್‌ಗೆ ಈಗಾಗಲೇ ಖಾತೆ ಇದೆ. ಲಾಗಿನ್ ಮಾಡಿ.", invalidCredentials: "ಇಮೇಲ್ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್ ತಪ್ಪಾಗಿದೆ.", footer: "ಸ್ಥಳೀಯ ಕೃಷಿ ಜ್ಞಾನಕ್ಕೆ ಬದಲಾಗಿ ಅಲ್ಲ, ನಿರ್ಧಾರಕ್ಕೆ ಬೆಂಬಲವಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ.", featureList: "ಏಳು ಹೊಲದ ಅಳತೆಗಳು", signUpPitch: "ಮುಂದಿನ ಬಿತ್ತನೆ ಯೋಜಿಸಲು ಸರಳ ವಿಧಾನ", signInPitch: "ನಿಮ್ಮ ಹೊಲಕ್ಕೆ ಮರಳಿ ಸ್ವಾಗತ", loading: "ನಿಮ್ಮ ಹೊಲದ ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…", cropNumber: "ಬೆಳೆ",
  },
};

const farmerCopy: Record<Language, Copy> = {
  en: {
    authIntro: "Get crop suggestions from your soil and weather readings using the crop data already included with KrishiMytra.",
    basedOn: "Suggestions from the project dataset",
    kgHa: "dataset scale",
    readingsBody: "Use recent soil-test results and local weather measurements. N, P, and K should use the same scale as the included dataset.",
    setupTitle: "Crop data included",
    setupBody: "KrishiMytra comes with a trained crop recommender. No file upload or personal crop-history dataset is needed.",
    datasetLoading: "Bundled reference dataset · loading details",
    sourceLabel: "Dataset source:",
    sourceLoading: "bundled crop recommendation data",
    measurementsNote: "All farmers use the same project-provided crop dataset. Your country, place, and plot size are recorded as context; location does not change this dataset's crop ranking.",
    datasetNote: "Suggestions use the bundled dataset and seven readings. The model is not locally calibrated to your country or town.",
    locationHeading: "Where is your field?",
    country: "Country",
    region: "State / province",
    place: "City / town",
    plotSize: "Plot size",
    acre: "acre",
    hectare: "hectare",
    chatbotTitle: "Ask the crop assistant",
    chatbotSubtitle: "Ask about crop matches, dataset NPK references, or an illustrative ROI estimate.",
    chatbotWelcome: "Hello. I can explain crop suggestions, show the dataset's NPK reference values, or estimate ROI from your own assumptions.",
    chatbotPlaceholder: "Ask a crop question…",
    chatbotSend: "Send question",
    chatbotBusy: "Checking the crop data…",
    chatbotCrop: "Crop for question",
    roiInputs: "Optional ROI assumptions",
    expectedYield: "Expected yield (kg per plot unit)",
    sellingPrice: "Selling price per kg",
    productionCost: "Production cost per plot unit",
    currency: "Currency code",
    roiNote: "ROI is illustrative only and uses these assumptions; no yield, price, or cost is guaranteed.",
    quickNpk: "NPK dataset reference",
    quickRoi: "Estimate ROI",
    chatScope: "Answers use the bundled dataset, not live local weather or agronomic expertise.",
    countryRequired: "Add your country and place for context.",
  },
  hi: {
    authIntro: "KrishiMytra में शामिल फसल डेटा से मिट्टी और मौसम की माप के आधार पर फसल सुझाव पाएं।",
    basedOn: "प्रोजेक्ट के फसल डेटा से सुझाव",
    kgHa: "डेटा पैमाना",
    readingsBody: "हाल की मिट्टी जांच और स्थानीय मौसम की माप का उपयोग करें। N, P और K के लिए शामिल डेटा वाला ही पैमाना रखें।",
    setupTitle: "फसल डेटा पहले से शामिल है",
    setupBody: "KrishiMytra में फसल सुझाव मॉडल पहले से तैयार है। फ़ाइल अपलोड या आपके निजी फसल रिकॉर्ड की जरूरत नहीं है।",
    datasetLoading: "शामिल संदर्भ डेटा · जानकारी लोड हो रही है",
    sourceLabel: "डेटा स्रोत:",
    sourceLoading: "शामिल फसल सुझाव डेटा",
    measurementsNote: "सभी किसान प्रोजेक्ट में शामिल एक ही फसल डेटा का उपयोग करते हैं। देश, स्थान और खेत का आकार संदर्भ के लिए हैं; स्थान से फसल रैंकिंग नहीं बदलती।",
    datasetNote: "सुझाव शामिल डेटा और सात मापों पर आधारित हैं। मॉडल आपके देश या शहर के लिए स्थानीय रूप से कैलिब्रेटेड नहीं है।",
    locationHeading: "आपका खेत कहां है?",
    country: "देश",
    region: "राज्य / प्रांत",
    place: "शहर / कस्बा",
    plotSize: "खेत का क्षेत्रफल",
    acre: "एकड़",
    hectare: "हेक्टेयर",
    chatbotTitle: "फसल सहायक से पूछें",
    chatbotSubtitle: "फसल सुझाव, डेटा के NPK संदर्भ या अनुमानित ROI के बारे में पूछें।",
    chatbotWelcome: "नमस्ते। मैं फसल सुझाव समझा सकता हूं, डेटा के NPK संदर्भ दिखा सकता हूं या आपकी धारणाओं से ROI का अनुमान लगा सकता हूं।",
    chatbotPlaceholder: "फसल से जुड़ा सवाल पूछें…",
    chatbotSend: "सवाल भेजें",
    chatbotBusy: "फसल डेटा जांच रहा है…",
    chatbotCrop: "सवाल की फसल",
    roiInputs: "वैकल्पिक ROI धारणाएं",
    expectedYield: "अनुमानित उपज (किग्रा प्रति क्षेत्र इकाई)",
    sellingPrice: "प्रति किग्रा बिक्री मूल्य",
    productionCost: "प्रति क्षेत्र इकाई उत्पादन लागत",
    currency: "मुद्रा कोड",
    roiNote: "ROI केवल आपकी धारणाओं पर आधारित उदाहरण है; उपज, कीमत या लागत की गारंटी नहीं।",
    quickNpk: "डेटा का NPK संदर्भ",
    quickRoi: "ROI का अनुमान",
    chatScope: "जवाब शामिल डेटा पर आधारित हैं, लाइव स्थानीय मौसम या कृषि विशेषज्ञता पर नहीं।",
    countryRequired: "संदर्भ के लिए देश और स्थान दर्ज करें।",
  },
  kn: {
    authIntro: "KrishiMytraದಲ್ಲಿರುವ ಬೆಳೆ ಡೇಟಾವನ್ನು ಬಳಸಿ ಮಣ್ಣು ಮತ್ತು ಹವಾಮಾನ ಅಳತೆಗಳಿಗೆ ತಕ್ಕ ಬೆಳೆ ಸಲಹೆಗಳನ್ನು ಪಡೆಯಿರಿ.",
    basedOn: "ಯೋಜನೆಯ ಬೆಳೆ ಡೇಟಾದಿಂದ ಸಲಹೆಗಳು",
    kgHa: "ಡೇಟಾ ಮಾಪಕ",
    readingsBody: "ಇತ್ತೀಚಿನ ಮಣ್ಣು ಪರೀಕ್ಷೆ ಮತ್ತು ಸ್ಥಳೀಯ ಹವಾಮಾನ ಅಳತೆಗಳನ್ನು ಬಳಸಿ. N, P, K ಗೆ ಸೇರಿಸಲಾದ ಡೇಟಾದ ಅದೇ ಮಾಪಕವನ್ನು ಬಳಸಿ.",
    setupTitle: "ಬೆಳೆ ಡೇಟಾ ಈಗಾಗಲೇ ಸೇರಿಸಲಾಗಿದೆ",
    setupBody: "KrishiMytraದಲ್ಲಿ ಬೆಳೆ ಸಲಹೆ ಮಾದರಿ ಸಿದ್ಧವಾಗಿದೆ. ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಅಥವಾ ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಬೆಳೆ ದಾಖಲೆಗಳ ಅಗತ್ಯವಿಲ್ಲ.",
    datasetLoading: "ಸೇರಿಸಿದ ಉಲ್ಲೇಖ ಡೇಟಾ · ವಿವರಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ",
    sourceLabel: "ಡೇಟಾ ಮೂಲ:",
    sourceLoading: "ಸೇರಿಸಿದ ಬೆಳೆ ಸಲಹೆ ಡೇಟಾ",
    measurementsNote: "ಎಲ್ಲ ರೈತರೂ ಯೋಜನೆಯಲ್ಲಿ ಸೇರಿಸಿದ ಒಂದೇ ಬೆಳೆ ಡೇಟಾವನ್ನು ಬಳಸುತ್ತಾರೆ. ದೇಶ, ಸ್ಥಳ ಮತ್ತು ಜಮೀನಿನ ಗಾತ್ರ ಮಾಹಿತಿ ಮಾತ್ರ; ಸ್ಥಳದಿಂದ ಬೆಳೆ ಕ್ರಮ ಬದಲಾಗುವುದಿಲ್ಲ.",
    datasetNote: "ಸಲಹೆಗಳು ಸೇರಿಸಿದ ಡೇಟಾ ಮತ್ತು ನೀವು ನಮೂದಿಸಿದ ಏಳು ಅಳತೆಗಳನ್ನು ಬಳಸುತ್ತವೆ. ಮಾದರಿ ನಿಮ್ಮ ಊರು ಅಥವಾ ದೇಶಕ್ಕೆ ಸ್ಥಳೀಯವಾಗಿ ಹೊಂದಿಸಲ್ಪಟ್ಟಿಲ್ಲ.",
    locationHeading: "ನಿಮ್ಮ ಹೊಲ ಎಲ್ಲಿದೆ?",
    country: "ದೇಶ",
    region: "ರಾಜ್ಯ / ಪ್ರಾಂತ್ಯ",
    place: "ನಗರ / ಪಟ್ಟಣ",
    plotSize: "ಜಮೀನಿನ ಗಾತ್ರ",
    acre: "ಎಕರೆ",
    hectare: "ಹೆಕ್ಟೇರ್",
    chatbotTitle: "ಬೆಳೆ ಸಹಾಯಕರನ್ನು ಕೇಳಿ",
    chatbotSubtitle: "ಬೆಳೆ ಹೊಂದಾಣಿಕೆ, ಡೇಟಾದ NPK ಉಲ್ಲೇಖ ಅಥವಾ ಅಂದಾಜು ROI ಬಗ್ಗೆ ಕೇಳಿ.",
    chatbotWelcome: "ನಮಸ್ಕಾರ. ಬೆಳೆ ಸಲಹೆಗಳನ್ನು ವಿವರಿಸಬಹುದು, ಡೇಟಾದ NPK ಉಲ್ಲೇಖ ಮೌಲ್ಯಗಳನ್ನು ತೋರಿಸಬಹುದು ಅಥವಾ ನಿಮ್ಮ ಅಂದಾಜುಗಳಿಂದ ROI ಲೆಕ್ಕ ಹಾಕಬಹುದು.",
    chatbotPlaceholder: "ಬೆಳೆ ಕುರಿತು ಪ್ರಶ್ನೆ ಕೇಳಿ…",
    chatbotSend: "ಪ್ರಶ್ನೆ ಕಳುಹಿಸಿ",
    chatbotBusy: "ಬೆಳೆ ಡೇಟಾವನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…",
    chatbotCrop: "ಪ್ರಶ್ನೆಯಲ್ಲಿನ ಬೆಳೆ",
    roiInputs: "ಐಚ್ಛಿಕ ROI ಅಂದಾಜುಗಳು",
    expectedYield: "ಅಂದಾಜು ಇಳುವರಿ (ಪ್ರತಿ ಜಮೀನು ಘಟಕಕ್ಕೆ kg)",
    sellingPrice: "ಪ್ರತಿ kg ಮಾರಾಟ ಬೆಲೆ",
    productionCost: "ಪ್ರತಿ ಜಮೀನು ಘಟಕದ ಉತ್ಪಾದನಾ ವೆಚ್ಚ",
    currency: "ಕರೆನ್ಸಿ ಕೋಡ್",
    roiNote: "ROI ನಿಮ್ಮ ಅಂದಾಜುಗಳ ಆಧಾರದ ಉದಾಹರಣೆ ಮಾತ್ರ; ಇಳುವರಿ, ಬೆಲೆ ಅಥವಾ ವೆಚ್ಚಕ್ಕೆ ಖಾತರಿ ಇಲ್ಲ.",
    quickNpk: "ಡೇಟಾ NPK ಉಲ್ಲೇಖ",
    quickRoi: "ROI ಅಂದಾಜಿಸಿ",
    chatScope: "ಉತ್ತರಗಳು ಸೇರಿಸಿದ ಡೇಟಾವನ್ನು ಬಳಸುತ್ತವೆ; ನೇರ ಸ್ಥಳೀಯ ಹವಾಮಾನ ಅಥವಾ ಕೃಷಿ ತಜ್ಞರ ಸಲಹೆಯಲ್ಲ.",
    countryRequired: "ಸಂದರ್ಭಕ್ಕಾಗಿ ದೇಶ ಮತ್ತು ಸ್ಥಳವನ್ನು ನಮೂದಿಸಿ.",
  },
};

const languages: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
];

const fields = [
  { key: "N", label: "nitrogen", unit: "kgHa", min: 0, max: 200, step: 1, initial: "" },
  { key: "P", label: "phosphorus", unit: "kgHa", min: 0, max: 200, step: 1, initial: "" },
  { key: "K", label: "potassium", unit: "kgHa", min: 0, max: 250, step: 1, initial: "" },
  { key: "temperature", label: "temperature", unit: "celsius", min: -10, max: 60, step: 0.1, initial: "" },
  { key: "humidity", label: "humidity", unit: "percent", min: 0, max: 100, step: 0.1, initial: "" },
  { key: "ph", label: "ph", unit: "phUnit", min: 0, max: 14, step: 0.1, initial: "" },
  { key: "rainfall", label: "rainfall", unit: "mm", min: 0, max: 1000, step: 1, initial: "" },
] as const;

const initialReading = Object.fromEntries(fields.map((field) => [field.key, field.initial]));

function formatApiError(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") return [item.msg];
      return [];
    });
    if (messages.length) return messages.join(" ");
  }
  if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
    return detail.message;
  }
  return fallback;
}

function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("krishimytra.language") ?? localStorage.getItem("terraqml.language");
    if (saved === "ta") return "kn";
    return languages.some((item) => item.code === saved) ? saved as Language : "en";
  });
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState<"auth" | "recommend" | "load" | null>("load");
  const [message, setMessage] = useState("");
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [reading, setReading] = useState<Record<string, string>>(initialReading);
  const [recommendations, setRecommendations] = useState<CropRecommendation[]>([]);
  const [farm, setFarm] = useState<FarmContext>({ country: "", region: "", place: "", plotArea: "", plotUnit: "acre" });
  const [selectedCrop, setSelectedCrop] = useState("");
  const [yieldEstimate, setYieldEstimate] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [productionCost, setProductionCost] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const t = { ...copy[language], ...farmerCopy[language] };

  useEffect(() => {
    localStorage.setItem("krishimytra.language", language);
  }, [language]);

  useEffect(() => {
    if (!token) {
      setBusy(null);
      return;
    }
    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("expired session");
        const account = await response.json();
        setUser(account);
        return fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } });
      })
      .then(async (response) => {
        if (!response?.ok) return;
        const profile = await response.json();
        if (profile.dataset) setDataset(profile.dataset);
      })
      .catch(() => {
        sessionStorage.removeItem(tokenKey);
        setToken("");
        setUser(null);
      })
      .finally(() => setBusy(null));
  }, [token]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("auth");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
    };
    if (authMode === "signup") payload.name = String(data.get("name") ?? "").trim();
    try {
      const response = await fetch(`${API}/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) throw new Error(t.accountExists);
        if (response.status === 401) throw new Error(t.invalidCredentials);
        throw new Error(formatApiError(result.detail, authMode === "login" ? t.loginError : t.signupError));
      }
      sessionStorage.setItem(tokenKey, result.access_token);
      setToken(result.access_token);
      setUser(result.user);
      setDataset(null);
      setRecommendations([]);
      setChatMessages([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.apiError);
    } finally {
      setBusy(null);
    }
  }

  async function submitReadings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("recommend");
    setMessage("");
    try {
      const response = await fetch(`${API}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...Object.fromEntries(Object.entries(reading).map(([key, value]) => [key, Number(value)])),
          country: farm.country,
          region: farm.region,
          place: farm.place,
          plot_area: Number(farm.plotArea),
          plot_unit: farm.plotUnit,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(formatApiError(result.detail, t.apiError));
      setRecommendations(result.recommendations);
      setSelectedCrop((current) => current || result.recommendations[0]?.crop || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.apiError);
    } finally {
      setBusy(null);
    }
  }

  async function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) return;
    setChatInput("");
    setChatMessages((current) => [...current, { role: "farmer", content: message }]);
    setChatBusy(true);
    try {
      const response = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message,
          language,
          crop: selectedCrop,
          top_crops: recommendations.map((item) => item.crop),
          country: farm.country,
          region: farm.region,
          place: farm.place,
          plot_area: farm.plotArea === "" ? null : Number(farm.plotArea),
          plot_unit: farm.plotUnit,
          expected_yield_per_area: yieldEstimate === "" ? null : Number(yieldEstimate),
          selling_price_per_kg: sellingPrice === "" ? null : Number(sellingPrice),
          production_cost_per_area: productionCost === "" ? null : Number(productionCost),
          currency,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(formatApiError(result.detail, t.apiError));
      const answer = typeof result.answer === "string" ? result.answer : formatApiError(result.answer, t.apiError);
      setChatMessages((current) => [...current, { role: "assistant", content: answer }]);
    } catch (error) {
      setChatMessages((current) => [...current, { role: "assistant", content: error instanceof Error ? error.message : t.apiError }]);
    } finally {
      setChatBusy(false);
    }
  }

  function signOut() {
    sessionStorage.removeItem(tokenKey);
    setToken("");
    setUser(null);
    setDataset(null);
    setRecommendations([]);
    setChatMessages([]);
    setMessage("");
    setAuthMode("login");
  }

  const languagePicker = (
    <label className="language-select">
      <Globe2 size={15} aria-hidden="true" />
      <span className="sr-only">{t.language}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t.language}>
        {languages.map((item) => <option value={item.code} key={item.code}>{item.native}</option>)}
      </select>
      <ChevronDown size={13} aria-hidden="true" />
    </label>
  );

  if (busy === "load") {
    return <main className="loading-screen"><span className="brand-mark"><Sprout size={20} /></span><LoaderCircle className="spin" size={18} /><p>{t.loading}</p></main>;
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="auth-aside">
          <div className="auth-brand"><span className="brand-mark"><Sprout size={20} /></span><span>Krishi<strong>Mytra</strong></span></div>
          <div className="auth-story">
            <span className="kicker">{t.myFarm} <i>/</i> {t.workspace}</span>
            <h1>{t.welcome}</h1>
            <p>{t.authIntro}</p>
            <div className="story-stats"><span><Leaf size={17} /> {t.featureList}</span><span><ShieldCheck size={17} /> {t.secure}</span></div>
          </div>
          <span className="auth-aside-footer">KRISHIMYTRA <i>·</i> FARM DECISION SUPPORT</span>
          <div className="field-etching" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
        </section>
        <section className="auth-main">
          <header className="auth-top">{languagePicker}<span className="auth-top-caption">{t.myFarm}</span></header>
          <div className="auth-card-wrap">
            <div className="auth-mobile-brand"><span className="brand-mark"><Sprout size={19} /></span><span>Krishi<strong>Mytra</strong></span></div>
            <div className="auth-card">
              <span className="auth-welcome-label">{authMode === "login" ? t.signInPitch : t.signUpPitch}</span>
              <h2>{authMode === "login" ? t.signIn : t.signUp}</h2>
              <p>{authMode === "login" ? t.authIntro : t.secure}</p>
              <div className="auth-tabs" role="tablist" aria-label={`${t.signIn} / ${t.signUp}`}>
                <button type="button" className={authMode === "login" ? "selected" : ""} onClick={() => { setAuthMode("login"); setMessage(""); }}>{t.login}</button>
                <button type="button" className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setMessage(""); }}>{t.signup}</button>
              </div>
              <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
                {authMode === "signup" && <label className="input-label">{t.name}<span className="input-wrap"><UserRound size={16} /><input name="name" autoComplete="name" minLength={2} maxLength={80} required placeholder={t.name} /></span></label>}
                <label className="input-label">{t.email}<span className="input-wrap"><UserRound size={16} /><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></span></label>
                <label className="input-label">{t.password}<span className="input-wrap"><ShieldCheck size={16} /><input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={authMode === "signup" ? 8 : 1} maxLength={128} required placeholder={authMode === "signup" ? t.passwordHint : "••••••••"} /></span></label>
                {message && <div className="auth-error" role="alert">{message}</div>}
                <button className="auth-submit" type="submit" disabled={busy === "auth"}>{busy === "auth" ? <LoaderCircle className="spin" size={17} /> : <>{authMode === "login" ? t.continue : t.create}<ArrowRight size={17} /></>}</button>
              </form>
              <div className="auth-switch">{authMode === "login" ? t.needAccount : t.haveAccount}<button type="button" onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setMessage(""); }}>{authMode === "login" ? t.signup : t.login}</button></div>
              <div className="privacy-note"><ShieldCheck size={14} /> {t.secure}</div>
            </div>
          </div>
          <footer className="auth-footer">{t.footer}</footer>
        </section>
      </main>
    );
  }

  return (
    <div className="farmer-app">
      <header className="app-header">
        <a className="app-brand" href="#home" aria-label="KrishiMytra home"><span className="brand-mark"><Sprout size={19} /></span><span>Krishi<strong>Mytra</strong></span></a>
        <div className="header-right">{languagePicker}<span className="header-divider" /><div className="user-chip"><span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.name}</span></div><button className="logout-button" onClick={signOut} title={t.signOut} aria-label={t.signOut}><LogOut size={17} /></button></div>
      </header>

      <main className="farmer-content" id="home">
        <section className="farmer-heading">
          <div className="farmer-heading-copy"><span className="kicker"><MapPin size={13} /> {t.myFarm} <i>/</i> {t.fieldLabel}</span><h1>{t.greeting}</h1><p>{t.subtitle}</p></div>
          <div className="weather-stamp"><CloudSun size={20} /><span>{t.fieldLabel}</span><strong>7 <small>{t.featureList}</small></strong></div>
        </section>

        {message && <div className="notice" role="status"><span>{message}</span><button aria-label="Dismiss" onClick={() => setMessage("")}>×</button></div>}

        <section className="farmer-grid">
          <div className="left-column">
            <section className="setup-panel setup-complete" aria-labelledby="setup-title">
              <div className="step-heading"><span className="step-number">01</span><div><span className="step-label">{t.profile}</span><h2 id="setup-title">{t.setupTitle}</h2></div><span className="ready-icon"><Check size={15} /></span></div>
              <p className="setup-description">{t.setupBody}</p>
              <div className="dataset-summary"><div className="dataset-file"><Database size={19} /><div><strong>{dataset?.filename ?? "Crop_recommendation.csv"}</strong><span>{dataset ? `${dataset.rows.toLocaleString()} ${t.records} · ${dataset.crop_count} ${t.cropTypes}` : t.datasetLoading}</span></div></div><p className="dataset-source"><strong>{t.sourceLabel}</strong> {dataset?.source ?? t.sourceLoading}</p></div>
            </section>

            <div className="local-data-note"><ShieldCheck size={16} /><span>{t.measurementsNote}</span></div>
          </div>

          <section className="measure-panel" aria-labelledby="readings-title">
            <div className="step-heading measure-heading"><span className="step-number">02</span><div><span className="step-label">{t.fieldLabel}</span><h2 id="readings-title">{t.readings}</h2></div><CloudSun className="measure-cloud" size={22} /></div>
            <p className="measure-description">{t.readingsBody}</p>
            <form onSubmit={(event) => void submitReadings(event)}>
              <div className="location-fields">
                <div className="location-fields-heading"><MapPin size={14} /><span>{t.locationHeading}</span></div>
                <div className="location-grid">
                  <label className="measure-field"><span className="measure-label">{t.country}</span><input type="text" required maxLength={80} autoComplete="country-name" value={farm.country} onChange={(event) => setFarm({ ...farm, country: event.target.value })} /></label>
                  <label className="measure-field"><span className="measure-label">{t.region}</span><input type="text" maxLength={100} autoComplete="address-level1" value={farm.region} onChange={(event) => setFarm({ ...farm, region: event.target.value })} /></label>
                  <label className="measure-field"><span className="measure-label">{t.place}</span><input type="text" required maxLength={100} autoComplete="address-level2" value={farm.place} onChange={(event) => setFarm({ ...farm, place: event.target.value })} /></label>
                  <div className="measure-field"><span className="measure-label">{t.plotSize}</span><div className="plot-size-control"><input type="number" required min="0.01" max="1000000" step="0.01" value={farm.plotArea} onChange={(event) => setFarm({ ...farm, plotArea: event.target.value })} aria-label={t.plotSize} /><select value={farm.plotUnit} onChange={(event) => setFarm({ ...farm, plotUnit: event.target.value as FarmContext["plotUnit"] })} aria-label={t.plotUnit}><option value="acre">{t.acre}</option><option value="hectare">{t.hectare}</option></select></div></div>
                </div>
              </div>
              <div className="measure-grid">
                {fields.map((field, index) => (
                  <label className="measure-field" key={field.key}>
                    <span className="measure-label"><i>{String(index + 1).padStart(2, "0")}</i>{t[field.label]}<small>{t[field.unit]}</small></span>
                    <input type="number" required min={field.min} max={field.max} step={field.step} value={reading[field.key]} onChange={(event) => { setReading({ ...reading, [field.key]: event.target.value }); setRecommendations([]); }} aria-label={`${t[field.label]} (${t[field.unit]})`} />
                  </label>
                ))}
              </div>
              <div className="recommend-actions"><span>{t.datasetNote}</span><button className="recommend-button" disabled={busy !== null} type="submit">{busy === "recommend" ? <><LoaderCircle className="spin" size={17} /> {t.finding}</> : <>{recommendations.length ? t.update : t.getRecommendations}<ArrowRight size={17} /></>}</button></div>
            </form>
          </section>
        </section>

        {recommendations.length > 0 && <section className="results-section" aria-live="polite">
          <div className="results-heading"><span className="step-number result-number"><Wheat size={17} /></span><div><span className="step-label">{t.basedOn}</span><h2>{t.getRecommendations}</h2></div></div>
          <div className="crop-results">{recommendations.map((item, index) => <article className={`crop-result crop-result-${index + 1}`} key={item.crop}><span className="crop-rank">0{index + 1}</span><span className="crop-icon"><Wheat size={20} /></span><div className="crop-info"><span>{t.cropNumber} {index + 1}</span><h3>{item.crop}</h3></div><div className="match-score"><strong>{Math.round(item.score * 100)}%</strong><span>{t.confidence}</span><i><b style={{ width: `${Math.min(item.score * 100, 100)}%` }} /></i></div></article>)}</div>
          <p className="result-disclaimer"><CircleHelp size={15} /> {t.modelNote}</p>
        </section>}

        <section className="assistant-panel" aria-labelledby="assistant-title">
          <div className="assistant-intro">
            <span className="step-number assistant-icon"><Bot size={17} /></span>
            <div><span className="step-label">KRISHIMYTRA</span><h2 id="assistant-title">{t.chatbotTitle}</h2></div>
            <p>{t.chatbotSubtitle}</p>
            <span className="assistant-scope"><CircleHelp size={14} />{t.chatScope}</span>
          </div>
          <div className="assistant-workspace">
            <div className="chat-transcript" aria-live="polite">
              {chatMessages.length === 0 && <div className="chat-message assistant-message"><span className="chat-avatar"><Bot size={15} /></span><p>{t.chatbotWelcome}</p></div>}
              {chatMessages.map((chatMessage, index) => <div className={`chat-message ${chatMessage.role === "farmer" ? "farmer-message" : "assistant-message"}`} key={`${chatMessage.role}-${index}`}><span className="chat-avatar">{chatMessage.role === "farmer" ? user.name.slice(0, 1).toUpperCase() : <Bot size={15} />}</span><p>{chatMessage.content}</p></div>)}
              {chatBusy && <div className="chat-message assistant-message"><span className="chat-avatar"><Bot size={15} /></span><p className="chat-loading"><LoaderCircle className="spin" size={14} />{t.chatbotBusy}</p></div>}
            </div>
            <div className="chat-tools">
              <label className="chat-context-field"><span>{t.chatbotCrop}</span><input list="crop-options" value={selectedCrop} onChange={(event) => setSelectedCrop(event.target.value)} placeholder={recommendations[0]?.crop ?? "rice"} /><datalist id="crop-options">{dataset?.crops?.map((crop) => <option value={crop} key={crop} />)}</datalist></label>
              <details className="roi-details"><summary>{t.roiInputs}</summary><div className="roi-grid">
                <label><span>{t.expectedYield}<small>kg/{farm.plotUnit}</small></span><input type="number" min="0" step="any" value={yieldEstimate} onChange={(event) => setYieldEstimate(event.target.value)} /></label>
                <label><span>{t.sellingPrice}<small>{currency}/kg</small></span><input type="number" min="0" step="any" value={sellingPrice} onChange={(event) => setSellingPrice(event.target.value)} /></label>
                <label><span>{t.productionCost}<small>{currency}/{farm.plotUnit}</small></span><input type="number" min="0" step="any" value={productionCost} onChange={(event) => setProductionCost(event.target.value)} /></label>
                <label><span>{t.currency}</span><input type="text" maxLength={12} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
              </div><p className="roi-note">{t.roiNote}</p></details>
              <div className="chat-quick-prompts"><button type="button" onClick={() => setChatInput(`What NPK reference values are shown for ${selectedCrop || recommendations[0]?.crop || "rice"}?`)}>{t.quickNpk}</button><button type="button" onClick={() => setChatInput(`Estimate ROI for ${selectedCrop || recommendations[0]?.crop || "rice"}`)}>{t.quickRoi}</button></div>
              <form className="chat-form" onSubmit={(event) => void submitChat(event)}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={1200} placeholder={t.chatbotPlaceholder} aria-label={t.chatbotPlaceholder} /><button type="submit" disabled={chatBusy || !chatInput.trim()} aria-label={t.chatbotSend} title={t.chatbotSend}><Send size={16} /></button></form>
            </div>
          </div>
        </section>

        <footer className="farmer-footer"><span>Krishi<strong>Mytra</strong> <i>·</i> {t.workspace}</span><span>{t.footer}</span></footer>
      </main>
    </div>
  );
}

export default App;