#!/usr/bin/env node
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const { URLSearchParams } = require('url');

// JavaScript's % operator is weird...
function mod(n, m) {
  return ((n % m) + m) % m;
}

// async error handling helper
function aw(fn) {
  return function (req, res, next) {
    fn(req, res, next).catch(next);
  };
}

const WEATHER_BASEURL = 'https://api.openweathermap.org/data/2.5';
const THRESHOLD_FREEZING = -10;
const THRESHOLD_COLD = 10;
const THRESHOLD_HOT = 20;

const PORT = process.env.PORT ?? 3000;
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('API key must be provided');
  process.exit(1);
}

async function lookupWeather(city, country) {
  let params = new URLSearchParams({
    q: country ? `${city},${country}` : city,
    units: 'metric',
    appid: API_KEY,
  });

  const res = await fetch(`${WEATHER_BASEURL}/forecast?${params.toString()}`);
  if (!res.ok) {
    throw await res.json();
  }

  const d = await res.json();
  let data = {
    city: {
      name: d.city.name,
      country: d.city.country,
      location: d.city.coord,
      timezone: d.city.timezone,
      sunrise: d.city.sunrise,
      sunset: d.city.sunset,
    },
    forecasts: [],
    pack: {
      umbrella: false,
      freezing: false,
      cold: false,
      warm: false,
      hot: false,
    },
  };

  const today = new Date().getUTCDay();
  d.list.forEach(forecast => {
    if (forecast.weather.length != 1) {
      throw { message: 'Missing weather description from OpenWeather' };
    }

    // Figure out which day this forecast is for (relative to today)
    const date = new Date(forecast.dt * 1000);
    const day = mod(date.getUTCDay() - today, 7);
    if (day > 4) {
      // Only return (up to) 5 days of forecasts
      return;
    }
    if (!data.forecasts[day]) {
      data.forecasts[day] = {
        // Main should be the first on the current day (now) or 4 (12.00 - 15.00) for other days
        main: day == 0 ? 0 : 4,
        data: [],
      };
    }

    const f = {
      temperature: {
        // All Celsius since we chose `metric` units
        main: forecast.main.temp,
        feelsLike: forecast.main.feels_like,
        min: forecast.main.temp_min,
        max: forecast.main.temp_max,
      },
      humidity: forecast.main.humidity,
      description: {
        name: forecast.weather[0].main,
        text: forecast.weather[0].description,
        icon: `https://openweathermap.org/img/wn/${forecast.weather[0].icon}@4x.png`,
      },
      wind: {
        // Metres/second with `metric` units
        speed: forecast.wind.speed,
        // Degrees
        direction: forecast.wind.deg,
      },
      // Millimetres
      rain: forecast.rain?.['3h'] ?? 0,
      hour: date.getUTCHours(),
    }

    data.pack.umbrella = data.pack.umbrella || f.rain > 0;
    data.pack.freezing = data.pack.freezing || f.temperature.main < THRESHOLD_FREEZING;
    data.pack.cold = data.pack.cold || (f.temperature.main >= THRESHOLD_FREEZING && f.temperature.main < THRESHOLD_COLD);
    data.pack.warm = data.pack.warm || (f.temperature.main >= THRESHOLD_COLD && f.temperature.main < THRESHOLD_HOT);
    data.pack.hot = data.pack.hot || f.temperature.main >= THRESHOLD_HOT;
    data.forecasts[day].data.push(f);
  });

  return data;
}

const app = express();
// Fix CORS errors when using development server to serve frontend
app.use(cors());

app.get('/forecast/:country/:city', aw(async (req, res) => {
  const forecast = await lookupWeather(req.params.city, req.params.country);
  res.json(forecast);
}));
app.get('/forecast/:city', aw(async (req, res) => res.json(await lookupWeather(req.params.city))));

app.use((err, req, res, next) => {
  res.status(500).json(err);
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
