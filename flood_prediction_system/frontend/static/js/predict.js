/**
 * predict.js
 * Drives the prediction form on predict.html:
 *  - client-side validation
 *  - calls POST /api/predict/classify and /api/predict/regress (built in
 *    the backend module)
 *  - if the API is unreachable (e.g. backend not running yet), falls back
 *    to a transparent client-side demo heuristic so the form still works
 *    end-to-end, and clearly labels the result as demo/offline data
 *  - stores the result in sessionStorage and redirects to result.html
 */

(function () {
  "use strict";

  const FIELD_RULES = {
    subdivision: (v) => !window.FormValidation.isEmpty(v),
    year: (v) => window.FormValidation.inRange(v, 1980, 2035),
    month: (v) => window.FormValidation.inRange(v, 1, 12),
    annual_rainfall: (v) => window.FormValidation.inRange(v, 0, 6000),
    monsoon_rainfall: (v) => window.FormValidation.inRange(v, 0, 4000),
  };

  const ERROR_MESSAGES = {
    subdivision: "Select the region this reading is for.",
    year: "Enter a year between 1980 and 2035.",
    month: "Enter a month between 1 and 12.",
    annual_rainfall: "Enter annual rainfall between 0 and 6000 mm.",
    monsoon_rainfall: "Enter monsoon-season rainfall between 0 and 4000 mm.",
  };

  function validateForm(form) {
    let isValid = true;
    Object.keys(FIELD_RULES).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      const valid = FIELD_RULES[name](input.value);
      if (!valid) {
        window.FormValidation.showError(input, ERROR_MESSAGES[name]);
        isValid = false;
      } else {
        window.FormValidation.clearError(input);
      }
    });

    // Cross-field sanity check: monsoon rainfall shouldn't exceed annual rainfall
    const annualInput = form.elements["annual_rainfall"];
    const monsoonInput = form.elements["monsoon_rainfall"];
    if (annualInput && monsoonInput) {
      const annual = parseFloat(annualInput.value);
      const monsoon = parseFloat(monsoonInput.value);
      if (!Number.isNaN(annual) && !Number.isNaN(monsoon) && monsoon > annual) {
        window.FormValidation.showError(monsoonInput, "Monsoon rainfall can't exceed annual rainfall.");
        isValid = false;
      }
    }

    return isValid;
  }

  /* ---------------------------------------------------------------------
   * OFFLINE DEMO FALLBACK
   * Mirrors the logic of the dataset's water-level formula so demo
   * results feel consistent with the trained model's behavior even
   * when the backend API isn't reachable.
   * ------------------------------------------------------------------- */
  const SUBDIVISION_THRESHOLDS = {
    "KERALA": 4.2, "COASTAL ANDHRA PRADESH": 3.8, "ASSAM & MEGHALAYA": 4.5,
    "WEST BENGAL": 4.0, "BIHAR": 3.6, "TAMIL NADU": 3.2, "GUJARAT REGION": 3.0,
    "MADHYA MAHARASHTRA": 2.9, "EAST UTTAR PRADESH": 3.4, "ODISHA": 3.9,
  };

  function runOfflineDemo(payload) {
    const threshold = SUBDIVISION_THRESHOLDS[payload.subdivision] || 3.6;
    const expectedMonsoon = payload.annual_rainfall * 0.65;
    const ratio = expectedMonsoon > 0 ? payload.monsoon_rainfall / expectedMonsoon : 1;
    const waterLevel = threshold * 0.3 + (ratio - 1) * threshold * 0.9 + threshold * 0.45;
    const clampedLevel = Math.max(waterLevel, 0.1);
    const exceedance = clampedLevel - threshold;
    const probability = 1 / (1 + Math.exp(-6 * exceedance));

    let risk = "LOW";
    if (probability >= 0.75) risk = "SEVERE";
    else if (probability >= 0.5) risk = "HIGH";
    else if (probability >= 0.25) risk = "MODERATE";

    return {
      subdivision: payload.subdivision,
      flood_risk: risk,
      flood_probability: Math.min(Math.max(probability, 0), 1),
      predicted_water_level_m: Math.round(clampedLevel * 100) / 100,
      flood_threshold_m: threshold,
      is_demo: true,
    };
  }

  function riskRecommendations(risk) {
    const map = {
      LOW: [
        "No immediate action needed — conditions are within normal seasonal range.",
        "Continue routine monitoring of rainfall and river gauges.",
      ],
      MODERATE: [
        "Monitor river levels every 6–12 hours as rainfall continues.",
        "Review local drainage and clear blocked channels where possible.",
        "Share this reading with community flood coordinators.",
      ],
      HIGH: [
        "Alert residents in low-lying areas near the river.",
        "Pre-position sandbags, pumps, and emergency supplies.",
        "Coordinate with local disaster management authorities.",
      ],
      SEVERE: [
        "Issue an evacuation advisory for high-risk zones immediately.",
        "Activate emergency shelters and rescue teams.",
        "Escalate to regional/national disaster response agencies.",
      ],
    };
    return map[risk] || map.LOW;
  }

  /* ---------------------------------------------------------------------
   * SUBMIT HANDLER
   * ------------------------------------------------------------------- */
  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('[type="submit"]');

    if (!validateForm(form)) {
      window.showToast("Please fix the highlighted fields before continuing.", "error");
      return;
    }

    const payload = {
      subdivision: form.elements["subdivision"].value,
      year: parseInt(form.elements["year"].value, 10),
      month: parseInt(form.elements["month"].value, 10),
      annual_rainfall: parseFloat(form.elements["annual_rainfall"].value),
      monsoon_rainfall: parseFloat(form.elements["monsoon_rainfall"].value),
    };

    const originalLabel = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-custom" style="margin-right:8px;vertical-align:-3px;"></span> Analyzing…';

    let result;
    const response = await window.FloodAPI.post("/predict", payload);

    if (response.ok) {
      result = { ...response.data, is_demo: false };
      window.showToast("Prediction received from the model API.", "success");
    } else {
      result = runOfflineDemo(payload);
      window.showToast("Backend API unreachable — showing an offline demo estimate.", "info", 5200);
    }

    result.recommendations = riskRecommendations(result.flood_risk);
    result.input = payload;
    result.generated_at = new Date().toISOString();

    sessionStorage.setItem("floodPredictionResult", JSON.stringify(result));

    submitBtn.disabled = false;
    submitBtn.innerHTML = originalLabel;

    window.location.href = "/result";
  }

  /* ---------------------------------------------------------------------
   * LIVE FIELD FEEDBACK + RANGE SLIDER SYNC
   * ------------------------------------------------------------------- */
  function initLiveValidation(form) {
    Object.keys(FIELD_RULES).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      input.addEventListener("blur", () => {
        if (FIELD_RULES[name](input.value)) {
          window.FormValidation.clearError(input);
        } else {
          window.FormValidation.showError(input, ERROR_MESSAGES[name]);
        }
      });
    });
  }

  function initRangeSync(form) {
    const rainfallInput = form.elements["monsoon_rainfall"];
    const rainfallSlider = document.getElementById("monsoonRainfallSlider");
    const rainfallDisplay = document.getElementById("monsoonRainfallDisplay");

    if (rainfallInput && rainfallSlider && rainfallDisplay) {
      const sync = (source) => {
        if (source === "slider") {
          rainfallInput.value = rainfallSlider.value;
        } else {
          rainfallSlider.value = rainfallInput.value || 0;
        }
        rainfallDisplay.textContent = `${parseFloat(rainfallSlider.value).toFixed(0)} mm`;
      };
      rainfallSlider.addEventListener("input", () => sync("slider"));
      rainfallInput.addEventListener("input", () => sync("input"));
      sync("input");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("predictForm");
    if (!form) return;
    initLiveValidation(form);
    initRangeSync(form);
    form.addEventListener("submit", handleSubmit);
  });
})();
