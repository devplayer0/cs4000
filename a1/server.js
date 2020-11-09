#!/usr/bin/env node
const fetch = require('node-fetch');
const express = require('express');
const cors = require('cors');
const { URLSearchParams } = require('url');

const WEATHER_BASEURL = 'https://api.openweathermap.org/data/2.5';

const PORT = process.env.PORT ?? 3000;
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error('API key must be provided');
  process.exit(1);
}

const app = express();
// Fix CORS errors when using development server to serve frontend
app.use(cors());

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
  };

  d.list.forEach((forecast, i) => {
    // There are 8 3-hour forecasts in a day
    const day = Math.floor(i / 8);
    if (!data.forecasts[day]) {
      data.forecasts[day] = [];
    }

    if (forecast.weather.length != 1) {
      throw 'Missing weather description from OpenWeather';
    }
    data.forecasts[day].push({
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
        icon: `http://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png`,
      },
      wind: {
        // Metres/second with `metric` units
        speed: forecast.wind.speed,
        // Degrees
        direction: forecast.wind.deg,
      },
      // Millimetres
      rain: forecast.rain?.['3h'] ?? 0,
    });
  });

  return data;
}

app.get('/forecast/:country/:city', async (req, res) => {
  const forecast = await lookupWeather(req.params.city, req.params.country);
  res.json(forecast);
});
app.get('/forecast/:city', async (req, res) => res.json(await lookupWeather(req.params.city)));

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
