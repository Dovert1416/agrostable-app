import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ahcwnifxpmrzqpykagxa.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoY3duaWZ4cG1yenFweWthZ3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTcwMDEsImV4cCI6MjA2ODI3MzAwMX0.m6MGKUb6FU5LKHhWDLrI8h9wKn9nOtxMo5EVnkr7ycs'
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const { latitude, longitude, cropType } = req.body
    
    // 1. CLIMA REAL (OpenWeatherMap)
    let climateData = { temperature: 22, humidity: 65, description: 'N/A' }
    try {
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=f119193413f32381c7cb204e959d7fc1&units=metric&lang=es`
      )
      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json()
        climateData = {
          temperature: Math.round(weatherData.main?.temp || 22),
          humidity: Math.round(weatherData.main?.humidity || 65),
          description: weatherData.weather?.[0]?.description || 'N/A'
        }
      }
    } catch (error) {
      console.error('Error clima:', error)
    }

    // 2. NDVI SIMULADO MEJORADO (basado en coordenadas)
    const ndviValue = Math.max(0.2, Math.min(0.9, 
      0.5 + (Math.abs(latitude) / 90 * 0.3) + (Math.random() * 0.2 - 0.1)
    ))

    // 3. SUBSIDENCIA SIMULADA MEJORADA  
    const subsidenceValue = Math.round(
      (Math.sin(latitude * Math.PI / 180) * Math.cos(longitude * Math.PI / 180) * 3 + 
       Math.random() * 2) * 10
    ) / 10

    // 4. ANÁLISIS
    const analysis = analyzeCropConditions(ndviValue, subsidenceValue, climateData, cropType)

    res.status(200).json({
      ndvi: ndviValue,
      climate: climateData,
      subsidence: subsidenceValue,
      recommendations: analysis.recommendations,
      score: analysis.score,
      analysis: analysis.details
    })
    
  } catch (error) {
    console.error('Error:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

function analyzeCropConditions(ndvi, subsidence, climate, cropType) {
  let score = 100
  let recommendations = []
  let details = {}

  // ANÁLISIS NDVI
  let ndviStatus = ''
  let ndviPenalty = 0
  
  if (ndvi >= 0.8) {
    ndviStatus = 'EXCELENTE'
    ndviPenalty = 0
  } else if (ndvi >= 0.6) {
    ndviStatus = 'BUENO'
    ndviPenalty = 5
  } else if (ndvi >= 0.4) {
    ndviStatus = 'REGULAR'
    ndviPenalty = 15
  } else {
    ndviStatus = 'CRÍTICO'
    ndviPenalty = 35
  }
  
  score -= ndviPenalty
  details.ndvi = { value: ndvi, status: ndviStatus, penalty: ndviPenalty }
  
  recommendations.push(`🌱 NDVI ${ndviStatus.toLowerCase()} (${Math.round(ndvi * 100)}%) para ${cropType}.`)

  // ANÁLISIS SUBSIDENCIA
  const absSubsidence = Math.abs(subsidence)
  let subsidenceStatus = ''
  let subsidencePenalty = 0
  
  if (absSubsidence <= 1) {
    subsidenceStatus = 'ESTABLE'
    subsidencePenalty = 0
  } else if (absSubsidence <= 3) {
    subsidenceStatus = 'LIGERAMENTE INESTABLE'
    subsidencePenalty = 10
  } else {
    subsidenceStatus = 'INESTABLE'
    subsidencePenalty = 25
  }
  
  score -= subsidencePenalty
  details.subsidence = { value: subsidence, status: subsidenceStatus, penalty: subsidencePenalty }
  
  recommendations.push(`🏔️ Terreno ${subsidenceStatus.toLowerCase()}: ${subsidence} mm/año.`)

  // ANÁLISIS CLIMA
  recommendations.push(`🌡️ Temperatura: ${climate.temperature}°C - ${climate.description}`)

  score = Math.max(15, Math.min(100, score))
  
  return {
    score: score,
    recommendations: recommendations.slice(0, 4),
    details: details
  }
}
