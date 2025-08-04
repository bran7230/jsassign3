
const UNSPLASH_ACCESS_KEY = "J_0J7VT2_Xl1uGHA7SbtLYWRyuE_aIGronoJdUp46W8"; // Couldnt figure out how to securely load from pages...

// === DOM ELEMENTS ===
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const geoBtn = document.getElementById("geo-btn");
const weatherCard = document.getElementById("weather-card");
const errorDiv = document.getElementById("error");

const locationEl = document.getElementById("location");
const descEl = document.getElementById("desc");
const tempEl = document.getElementById("temp");
const feelsEl = document.getElementById("feels"); // Open-Meteo doesn't give feels-like; will show "N/A"
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");
const mainCondEl = document.getElementById("mainCond");

// === WEATHER CODE MAPPING (from Open-Meteo) ===
const weatherCodeMap = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

// === UTILS ===
function showError(msg) {
  if (errorDiv) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove("hidden");
  }
}

function clearError() {
  if (errorDiv) {
    errorDiv.textContent = "";
    errorDiv.classList.add("hidden");
  }
}

function isoToLocalTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function updateURLParam(city) {
  const url = new URL(window.location);
  if (city) url.searchParams.set("city", city);
  else url.searchParams.delete("city");
  window.history.replaceState({}, "", url.toString());
}

// === FETCH FUNCTIONS ===

// Geocode city name to lat/lon using Open-Meteo geocoding
async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Geocoding failed");
  const data = await resp.json();
  if (!data.results || data.results.length === 0) throw new Error("City not found");
  const place = data.results[0];
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    name: `${place.name}${place.country ? ", " + place.country : ""}`,
  };
}

// Fetch current weather + sunrise/sunset + humidity
async function fetchWeatherOpenMeteo(lat, lon) {
  // Request current weather, daily sunrise/sunset, and hourly humidity
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("current_weather", "true");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("hourly", "relativehumidity_2m");

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error("Weather fetch failed");
  const data = await resp.json();
  if (!data.current_weather) throw new Error("Malformed weather response");

  // Extract current weather
  const cw = data.current_weather; // includes temperature, windspeed, weathercode, time

  // Get today's sunrise/sunset (first element)
  const sunrise = (data.daily?.sunrise || [])[0] || "";
  const sunset = (data.daily?.sunset || [])[0] || "";

  // Determine humidity: match current time in hourly.time array
  let humidity = "N/A";
  if (data.hourly && data.hourly.time && data.hourly.relativehumidity_2m) {
    const timeIndex = data.hourly.time.findIndex((t) => t === cw.time);
    if (timeIndex !== -1) {
      humidity = data.hourly.relativehumidity_2m[timeIndex];
    } else {
      // fallback: find closest earlier hour
      const times = data.hourly.time.map((t) => new Date(t));
      const curr = new Date(cw.time);
      let closestIdx = -1;
      for (let i = 0; i < times.length; i++) {
        if (times[i] <= curr) closestIdx = i;
        else break;
      }
      if (closestIdx !== -1) {
        humidity = data.hourly.relativehumidity_2m[closestIdx];
      }
    }
  }

  return {
    temperature: cw.temperature,
    windspeed: cw.windspeed,
    weathercode: cw.weathercode,
    time: cw.time,
    humidity,
    sunrise,
    sunset,
  };
}

// Unsplash random photo for background
async function fetchUnsplashBackground(query) {
  if (!UNSPLASH_ACCESS_KEY) return null;
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
    query
  )}&orientation=landscape&content_filter=high`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
    },
  });
  if (!resp.ok) {
    console.warn("Unsplash failed:", resp.status, await resp.text());
    return null;
  }
  return resp.json();
}

// === MAIN RENDERING ===
async function showWeather(input) {
  try {
    clearError();
    if (weatherCard) weatherCard.classList.add("hidden");
    tempEl && (tempEl.textContent = "Loading...");

    let locationName = "";
    let weatherData;

    if (typeof input === "string") {
      // city name
      const geo = await geocodeCity(input);
      locationName = geo.name;
      weatherData = await fetchWeatherOpenMeteo(geo.latitude, geo.longitude);
      updateURLParam(input);
    } else if (input && input.latitude != null && input.longitude != null) {
      // coords
      locationName = "Your Location";
      weatherData = await fetchWeatherOpenMeteo(input.latitude, input.longitude);
      updateURLParam("");
    } else {
      throw new Error("Invalid input for fetching weather");
    }

    // Populate fields
    const { temperature, windspeed, weathercode, humidity, sunrise, sunset } = weatherData;
    const mainCondition = weatherCodeMap[weathercode] || "Unknown";

    locationEl && (locationEl.textContent = locationName);
    descEl && (descEl.textContent = mainCondition.toLowerCase());
    tempEl && (tempEl.textContent = `${Math.round(temperature)}°C`);
    feelsEl && (feelsEl.textContent = "N/A"); // Open-Meteo doesn't provide feels-like
    humidityEl && (humidityEl.textContent = humidity !== "N/A" ? `${humidity}%` : "N/A");
    windEl && (windEl.textContent = `${Math.round(windspeed)} km/h`);
    sunriseEl && (sunriseEl.textContent = isoToLocalTime(sunrise));
    sunsetEl && (sunsetEl.textContent = isoToLocalTime(sunset));
    mainCondEl && (mainCondEl.textContent = mainCondition);

    weatherCard && weatherCard.classList.remove("hidden");

    // Persist last city if string
    if (typeof input === "string") {
      try {
        localStorage.setItem("lastCity", input);
      } catch {}
    }

    // Fetch and set background
    const bgQuery = mainCondition.split(" ")[0] || "weather";
    const bg = await fetchUnsplashBackground(bgQuery);
    if (bg && (bg.urls?.regular || bg.urls?.full)) {
      document.body.style.backgroundImage = `url(${bg.urls.regular || bg.urls.full})`;
    }
  } catch (err) {
    console.error(err);
    showError(err.message || "Failed to load weather.");
  }
}

// === EVENT LISTENERS ===
form &&
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const city = cityInput.value.trim();
    if (city) {
      showWeather(city);
    }
  });

geoBtn &&
  geoBtn.addEventListener("click", function () {
    if (!navigator.geolocation) {
      showError("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        showWeather({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        showError("Geolocation failed: " + err.message);
      }
    );
  });

// === INITIAL LOAD ===
window.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const cityParam = params.get("city");
  const lastCity = localStorage.getItem("lastCity");

  if (cityParam) {
    cityInput.value = cityParam;
    showWeather(cityParam);
  } else if (lastCity) {
    cityInput.value = lastCity;
    showWeather(lastCity);
  }
});
