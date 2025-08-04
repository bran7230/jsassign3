
const OPENWEATHER_KEY = "de7027250bf7787a8a267d91d2619295";

const UNSPLASH_KEY = "J_0J7VT2_Xl1uGHA7SbtLYWRyuE_aIGronoJdUp46W8";

// === DOM ELEMENTS ===
const form = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const geoBtn = document.getElementById("geo-btn");
const weatherCard = document.getElementById("weather-card");
const errorDiv = document.getElementById("error");
const locationEl = document.getElementById("location");
const descEl = document.getElementById("desc");
const tempEl = document.getElementById("temp");
const feelsEl = document.getElementById("feels");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");
const mainCondEl = document.getElementById("mainCond");

// === HELPERS ===
function unixToLocal(u) {
  const d = new Date(u * 1000);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.classList.remove("hidden");
}

function clearError() {
  errorDiv.textContent = "";
  errorDiv.classList.add("hidden");
}

// === FETCH FUNCTIONS ===
async function fetchWeatherByCity(city) {
  if (!OPENWEATHER_KEY || OPENWEATHER_KEY.startsWith("REPLACE")) {
    throw new Error("OpenWeatherMap key is missing or placeholder.");
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    city
  )}&units=metric&appid=${encodeURIComponent(OPENWEATHER_KEY)}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message || "Failed to fetch weather.");
  }
  return r.json();
}

async function fetchWeatherByCoords(lat, lon) {
  if (!OPENWEATHER_KEY || OPENWEATHER_KEY.startsWith("REPLACE")) {
    throw new Error("OpenWeatherMap key is missing or placeholder.");
  }
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${encodeURIComponent(
    OPENWEATHER_KEY
  )}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message || "Failed to fetch weather.");
  }
  return r.json();
}

async function fetchBackground(query) {
  if (!UNSPLASH_KEY || UNSPLASH_KEY.startsWith("REPLACE")) {
    console.warn("Unsplash key missing or placeholder.");
    return null;
  }
  const url = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(
    query
  )}&orientation=landscape&content_filter=high`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_KEY}`,
    },
  });
  if (!r.ok) {
    console.warn("Unsplash failed:", r.status, await r.text());
    return null;
  }
  return r.json();
}

// === MAIN RENDER ===
async function showWeather(input) {
  try {
    clearError();
    weatherCard.classList.add("hidden");
    tempEl.textContent = "Loading...";

    let data;
    if (typeof input === "string") {
      data = await fetchWeatherByCity(input);
    } else if (input && input.latitude != null && input.longitude != null) {
      data = await fetchWeatherByCoords(input.latitude, input.longitude);
    } else {
      throw new Error("Invalid input for weather.");
    }

    const cityName = `${data.name}, ${data.sys?.country || ""}`.trim();
    const temp = Math.round(data.main.temp);
    const feels = Math.round(data.main.feels_like);
    const description = data.weather?.[0]?.description || "N/A";
    const mainCond = data.weather?.[0]?.main || "";
    const humidity = data.main.humidity;
    const windKmh = (data.wind.speed * 3.6).toFixed(1);
    const sunrise = unixToLocal(data.sys.sunrise);
    const sunset = unixToLocal(data.sys.sunset);

    locationEl.textContent = cityName;
    descEl.textContent = description;
    tempEl.textContent = `${temp}°C`;
    feelsEl.textContent = `${feels}°C`;
    humidityEl.textContent = humidity;
    windEl.textContent = windKmh;
    sunriseEl.textContent = sunrise;
    sunsetEl.textContent = sunset;
    mainCondEl.textContent = mainCond;

    weatherCard.classList.remove("hidden");

    try {
      localStorage.setItem("lastCity", typeof input === "string" ? input : cityName);
    } catch {}

    const bg = await fetchBackground(mainCond || "nature");
    if (bg && (bg.urls?.regular || bg.urls?.full)) {
      document.body.style.backgroundImage = `url(${
        bg.urls.regular || bg.urls.full
      })`;
    }
  } catch (err) {
    console.error(err);
    showError(err.message || "Something went wrong.");
  }
}

// === EVENTS ===
form.addEventListener("submit", function (e) {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (city) {
    showWeather(city);
    // update query string for shareable link
    const url = new URL(window.location);
    url.searchParams.set("city", city);
    window.history.replaceState({}, "", url.toString());
  }
});

geoBtn.addEventListener("click", function () {
  if (!navigator.geolocation) {
    showError("Geolocation not supported.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      showWeather({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const url = new URL(window.location);
      url.searchParams.delete("city");
      window.history.replaceState({}, "", url.toString());
    },
    (err) => showError("Geolocation error: " + err.message)
  );
});

// === ON LOAD ===
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
