const API = "https://api.open-meteo.com/v1/forecast";
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";
const state = { unit: "C", location: null, weather: null };

const $ = (id) => document.getElementById(id);
const elements = {
  form: $("search-form"), input: $("city-input"), status: $("status-message"),
  location: $("location-name"), date: $("current-date"), temp: $("current-temp"),
  degree: $("degree-symbol"), condition: $("current-condition"), feels: $("feels-like"),
  emoji: $("weather-emoji"), wind: $("wind-speed"), humidity: $("humidity"),
  uv: $("uv-index"), forecast: $("forecast-grid"), sunrise: $("sunrise"),
  sunset: $("sunset"), daylight: $("daylight"), daylightProgress: $("daylight-progress"),
  tip: $("weather-tip"), unitToggle: $("unit-toggle")
};

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("error", isError);
}

function weatherInfo(code) {
  if (code === 0) return ["Clear sky", "☀️"];
  if ([1, 2].includes(code)) return ["Mostly clear", "🌤️"];
  if (code === 3) return ["Overcast", "☁️"];
  if ([45, 48].includes(code)) return ["Foggy", "🌫️"];
  if ([51, 53, 55, 56, 57].includes(code)) return ["Drizzle", "🌦️"];
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ["Rain showers", "🌧️"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["Snow", "❄️"];
  if ([95, 96, 99].includes(code)) return ["Thunderstorm", "⛈️"];
  return ["Mixed conditions", "🌥️"];
}

function convertTemp(celsius) {
  return state.unit === "C" ? Math.round(celsius) : Math.round((celsius * 9 / 5) + 32);
}
function tempLabel(celsius) { return `${convertTemp(celsius)}°`; }
function formatTime(value) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(value));
}
function weekday(value, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
function friendlyDate() {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
}
function localName(place) {
  return [place.name, place.admin1, place.country].filter((v, i, a) => v && a.indexOf(v) === i).join(", ");
}
function weatherTip(code, max, min, wind) {
  if ([61,63,65,80,81,82,95,96,99].includes(code)) return "Rain may be around today. If you're heading out, carrying an umbrella is a smart move.";
  if (max >= 35) return "It's looking hot today. Keep water handy and take breaks in the shade when you can.";
  if (min <= 5) return "A chilly start is expected. A light extra layer may make your morning more comfortable.";
  if (wind >= 30) return "It's breezy out there. Be mindful of gusts if you're cycling or spending time outdoors.";
  if (code === 0 || code === 1) return "A bright-looking day. It could be a lovely time to get outside and enjoy a little fresh air.";
  return "Conditions can change through the day, so check back before making outdoor plans.";
}

async function searchCity(city) {
  const url = `${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("City search is unavailable right now. Please try again.");
  const data = await response.json();
  if (!data.results || !data.results.length) throw new Error("We couldn't find that city. Check the spelling and try again.");
  return data.results[0];
}

async function getWeather(place) {
  const params = new URLSearchParams({
    latitude: place.latitude, longitude: place.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
    timezone: "auto", forecast_days: "7"
  });
  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error("Weather data couldn't be loaded. Please try again in a moment.");
  return response.json();
}

function renderForecast(data) {
  const daily = data.daily;
  elements.forecast.innerHTML = daily.time.map((day, i) => {
    const [condition, icon] = weatherInfo(daily.weather_code[i]);
    return `<article class="forecast-card">
      <div class="forecast-day">${weekday(day, i)}</div>
      <div class="forecast-icon" aria-hidden="true">${icon}</div>
      <div class="forecast-condition">${condition}</div>
      <div class="forecast-temps"><span>${tempLabel(daily.temperature_2m_max[i])}</span><span>${tempLabel(daily.temperature_2m_min[i])}</span></div>
    </article>`;
  }).join("");
}

function render(data, place) {
  state.weather = data;
  state.location = place;
  const current = data.current;
  const [condition, icon] = weatherInfo(current.weather_code);
  elements.location.textContent = localName(place);
  elements.date.textContent = friendlyDate();
  elements.temp.textContent = convertTemp(current.temperature_2m);
  elements.degree.textContent = "°";
  elements.condition.textContent = condition;
  elements.feels.textContent = tempLabel(current.apparent_temperature);
  elements.emoji.textContent = icon;
  elements.wind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  elements.humidity.textContent = `${current.relative_humidity_2m}%`;
  elements.uv.textContent = data.daily.uv_index_max?.[0] != null ? data.daily.uv_index_max[0].toFixed(1) : "—";
  elements.sunrise.textContent = formatTime(data.daily.sunrise?.[0]);
  elements.sunset.textContent = formatTime(data.daily.sunset?.[0]);
  const sunrise = new Date(data.daily.sunrise[0]);
  const sunset = new Date(data.daily.sunset[0]);
  const daylightMinutes = Math.max(0, Math.round((sunset - sunrise) / 60000));
  elements.daylight.textContent = `${Math.floor(daylightMinutes / 60)}h ${daylightMinutes % 60}m`;
  elements.daylightProgress.style.width = `${Math.min(100, (daylightMinutes / 900) * 100)}%`;
  elements.tip.textContent = weatherTip(current.weather_code, data.daily.temperature_2m_max[0], data.daily.temperature_2m_min[0], current.wind_speed_10m);
  renderForecast(data);
  setStatus(`Updated just now · Local time zone for ${place.name}`);
  elements.unitToggle.innerHTML = state.unit === "C" ? "°C <span>/</span> °F" : "°F <span>/</span> °C";
}

async function loadCity(city) {
  const query = city.trim();
  if (!query) { setStatus("Enter a city name to search.", true); return; }
  setStatus(`Looking up ${query}…`);
  elements.status.classList.remove("error");
  try {
    const place = await searchCity(query);
    setStatus(`Loading current conditions for ${place.name}…`);
    const data = await getWeather(place);
    render(data, place);
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", true);
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadCity(elements.input.value);
});
elements.unitToggle.addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  if (state.weather && state.location) render(state.weather, state.location);
  else elements.unitToggle.innerHTML = state.unit === "C" ? "°C <span>/</span> °F" : "°F <span>/</span> °C";
});
loadCity("New Delhi");
