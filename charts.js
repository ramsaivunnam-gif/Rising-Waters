/**
 * charts.js
 * Chart.js chart builders used across home.html, history.html,
 * performance.html and result.html, plus the reusable CSS gauge-fill
 * renderer (the site's signature "water level tube" element).
 *
 * Every chart function tries the real API first and transparently falls
 * back to representative demo data if the backend isn't reachable, so
 * every page renders something meaningful on its own.
 */

(function () {
  "use strict";

  const CHART_COLORS = {
    primary: "#21C7C0",
    primaryFill: "rgba(33, 199, 192, 0.18)",
    low: "#34D399",
    moderate: "#F5B942",
    high: "#FF7A59",
    severe: "#E8425A",
    grid: "rgba(255,255,255,0.07)",
    text: "#8DA0B3",
  };

  function isLightTheme() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }

  function themedColors() {
    return isLightTheme()
      ? { grid: "rgba(15,28,52,0.08)", text: "#4A5D70" }
      : { grid: CHART_COLORS.grid, text: CHART_COLORS.text };
  }

  function baseGridOptions() {
    const t = themedColors();
    return {
      scales: {
        x: {
          grid: { color: t.grid, drawBorder: false },
          ticks: { color: t.text, font: { family: "IBM Plex Mono", size: 11 } },
        },
        y: {
          grid: { color: t.grid, drawBorder: false },
          ticks: { color: t.text, font: { family: "IBM Plex Mono", size: 11 } },
        },
      },
      plugins: {
        legend: {
          labels: { color: t.text, font: { family: "Inter", size: 12 } },
        },
      },
    };
  }

  /* ---------------------------------------------------------------------
   * DEMO DATA GENERATORS (used only when the API is unreachable)
   * ------------------------------------------------------------------- */
  function demoRainfallTrend() {
    const years = [];
    const rainfall = [];
    const waterLevel = [];
    const baseYear = 2013;
    for (let i = 0; i <= 10; i++) {
      years.push(baseYear + i);
      const seasonal = 1100 + Math.sin(i / 1.8) * 220 + (Math.random() - 0.5) * 160;
      rainfall.push(Math.round(seasonal));
      waterLevel.push(Math.round((2.6 + Math.sin(i / 1.8) * 0.7 + (Math.random() - 0.5) * 0.4) * 100) / 100);
    }
    return { years, rainfall, waterLevel };
  }

  function demoFloodFrequency() {
    return {
      labels: ["Kerala", "Assam", "W. Bengal", "Odisha", "Bihar", "Coastal AP", "E. UP", "Tamil Nadu", "Maharashtra", "Gujarat"],
      values: [9.1, 6.8, 18.2, 11.4, 13.6, 13.6, 18.2, 4.5, 15.9, 18.2],
    };
  }

  function demoModelPerformance() {
    return {
      classification: { accuracy: 0.891, precision: 0.834, recall: 0.779, f1: 0.806 },
      regression: { r2: 0.87, mae: 0.28, rmse: 0.37 },
      confusion: { tp: 42, fp: 8, fn: 12, tn: 378 },
      featureImportance: [
        { feature: "Monsoon Rainfall", value: 0.38 },
        { feature: "Annual Rainfall", value: 0.24 },
        { feature: "Subdivision Baseline", value: 0.17 },
        { feature: "Month", value: 0.12 },
        { feature: "Prior Year Level", value: 0.09 },
      ],
    };
  }

  /* ---------------------------------------------------------------------
   * CHART BUILDERS
   * ------------------------------------------------------------------- */
  const FloodCharts = {};
  window.FloodCharts = FloodCharts;

  FloodCharts.renderGauge = function (containerEl, valueMeters, thresholdMeters, maxMeters) {
    if (!containerEl) return;
    const max = maxMeters || Math.max(thresholdMeters * 1.6, valueMeters * 1.3, 1);
    const fillPercent = Math.min(Math.max((valueMeters / max) * 100, 3), 100);
    const thresholdPercent = Math.min(Math.max((thresholdMeters / max) * 100, 0), 100);

    let risk = "low";
    const ratio = valueMeters / thresholdMeters;
    if (ratio >= 1) risk = "severe";
    else if (ratio >= 0.85) risk = "high";
    else if (ratio >= 0.65) risk = "moderate";

    const fillColor = {
      low: "linear-gradient(180deg, #34D399, #17948F)",
      moderate: "linear-gradient(180deg, #F5B942, #C98A1E)",
      high: "linear-gradient(180deg, #FF7A59, #C9502F)",
      severe: "linear-gradient(180deg, #E8425A, #A32340)",
    }[risk];

    containerEl.innerHTML = `
      <div class="gauge-tube">
        <div class="gauge-threshold" style="bottom:${thresholdPercent}%;"></div>
        <div class="gauge-threshold-label" style="bottom:${thresholdPercent}%;">THRESHOLD ${thresholdMeters.toFixed(1)}m</div>
        <div class="gauge-fill" style="height:0%; background:${fillColor};"></div>
      </div>
    `;
    // Animate after paint so the CSS transition triggers
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fillEl = containerEl.querySelector(".gauge-fill");
        if (fillEl) fillEl.style.height = `${fillPercent}%`;
      });
    });

    return risk;
  };

  FloodCharts.initRainfallTrendChart = async function (canvasId, subdivision) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    let years, rainfall, waterLevel;
    const query = subdivision ? `?subdivision=${encodeURIComponent(subdivision)}` : "";
    const response = await window.FloodAPI.get(`/history/trend${query}`);

    if (response.ok && response.data && response.data.years) {
      years = response.data.years;
      rainfall = response.data.rainfall;
      waterLevel = response.data.water_level;
    } else {
      const demo = demoRainfallTrend();
      years = demo.years;
      rainfall = demo.rainfall;
      waterLevel = demo.waterLevel;
    }

    const opts = baseGridOptions();
    new Chart(canvas, {
      type: "line",
      data: {
        labels: years,
        datasets: [
          {
            label: "Annual Rainfall (mm)",
            data: rainfall,
            borderColor: CHART_COLORS.primary,
            backgroundColor: CHART_COLORS.primaryFill,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: CHART_COLORS.primary,
            yAxisID: "y",
          },
          {
            label: "River Water Level (m)",
            data: waterLevel,
            borderColor: CHART_COLORS.severe,
            backgroundColor: "transparent",
            borderDash: [6, 4],
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: CHART_COLORS.severe,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        ...opts,
        interaction: { mode: "index", intersect: false },
        scales: {
          ...opts.scales,
          y: { ...opts.scales.y, position: "left", title: { display: true, text: "mm", color: themedColors().text } },
          y1: {
            position: "right",
            grid: { display: false },
            ticks: { color: themedColors().text, font: { family: "IBM Plex Mono", size: 11 } },
            title: { display: true, text: "meters", color: themedColors().text },
          },
        },
      },
    });
  };

  FloodCharts.initFloodFrequencyChart = async function (canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    const response = await window.FloodAPI.get("/history/flood-frequency");
    const data = response.ok && response.data ? response.data : demoFloodFrequency();

    const opts = baseGridOptions();
    new Chart(canvas, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Flood Frequency (%)",
            data: data.values,
            backgroundColor: data.values.map((v) =>
              v >= 15 ? CHART_COLORS.severe : v >= 10 ? CHART_COLORS.high : v >= 6 ? CHART_COLORS.moderate : CHART_COLORS.low
            ),
            borderRadius: 8,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        ...opts,
        plugins: { ...opts.plugins, legend: { display: false } },
      },
    });
  };

  FloodCharts.initPerformanceCharts = async function (ids) {
    const response = await window.FloodAPI.get("/dashboard/model-performance");
    const data = response.ok && response.data ? response.data : demoModelPerformance();
    const opts = baseGridOptions();

    // Classification metrics bar
    const metricsCanvas = document.getElementById(ids.metrics);
    if (metricsCanvas && typeof Chart !== "undefined") {
      const m = data.classification;
      new Chart(metricsCanvas, {
        type: "bar",
        data: {
          labels: ["Accuracy", "Precision", "Recall", "F1 Score"],
          datasets: [{
            label: "Classifier Performance",
            data: [m.accuracy, m.precision, m.recall, m.f1].map((v) => Math.round(v * 1000) / 10),
            backgroundColor: [CHART_COLORS.primary, "#56E5DE", CHART_COLORS.moderate, "#8DA0B3"],
            borderRadius: 8,
          }],
        },
        options: {
          ...opts,
          plugins: { ...opts.plugins, legend: { display: false } },
          scales: { ...opts.scales, y: { ...opts.scales.y, min: 0, max: 100, title: { display: true, text: "%", color: themedColors().text } } },
        },
      });
    }

    // Feature importance horizontal bar
    const featureCanvas = document.getElementById(ids.features);
    if (featureCanvas && typeof Chart !== "undefined") {
      new Chart(featureCanvas, {
        type: "bar",
        data: {
          labels: data.featureImportance.map((f) => f.feature),
          datasets: [{
            label: "Relative Importance",
            data: data.featureImportance.map((f) => f.value),
            backgroundColor: CHART_COLORS.primary,
            borderRadius: 8,
          }],
        },
        options: {
          ...opts,
          indexAxis: "y",
          plugins: { ...opts.plugins, legend: { display: false } },
        },
      });
    }

    return data;
  };

  document.addEventListener("DOMContentLoaded", () => {
    // Auto-init charts declared via data attributes, so templates don't
    // need page-specific inline <script> blocks for the common cases.
    document.querySelectorAll("[data-chart='rainfall-trend']").forEach((el) => {
      FloodCharts.initRainfallTrendChart(el.id, el.getAttribute("data-subdivision"));
    });
    document.querySelectorAll("[data-chart='flood-frequency']").forEach((el) => {
      FloodCharts.initFloodFrequencyChart(el.id);
    });
  });
})();
