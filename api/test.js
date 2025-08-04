const { createClient } = require('@supabase/supabase-js')

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
    
    if (!latitude || !longitude || !cropType) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' })
    }

    // 1. CONSULTAR CULTIVO EN SUPABASE
    const { data: cropData, error: cropError } = await supabase
      .from('cultivos')
      .select('*')
      .eq('nombre', cropType)
      .single()

    let cropRanges = cropData || {
      temp_minima: 18, temp_maxima: 26, temp_optima: 22,
      humedad_minima: 60, humedad_maxima: 80, humedad_optima: 70,
      ndvi_critico_min: 0.0, ndvi_critico_max: 0.2,
      ndvi_malo_min: 0.2, ndvi_malo_max: 0.4,
      ndvi_regular_min: 0.4, ndvi_regular_max: 0.6,
      ndvi_bueno_min: 0.6, ndvi_bueno_max: 0.8,
      ndvi_excelente_min: 0.8, ndvi_excelente_max: 1.0
    }

    // 2. CLIMA REAL (OpenWeatherMap)
    let climateData = null
    try {
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=f119193413f32381c7cb204e959d7fc1&units=metric&lang=es`
      )
      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json()
        climateData = {
          temperature: Math.round(weatherData.main?.temp || 0),
          humidity: Math.round(weatherData.main?.humidity || 0),
          description: weatherData.weather?.[0]?.description || 'N/A'
        }
      }
    } catch (error) {
      console.error('Error consultando clima:', error)
    }

    // 3. NDVI Y SUBSIDENCIA (usando valores determinísticos basados en coordenadas)
    const latFactor = Math.abs(latitude) / 90
    const lonFactor = Math.abs(longitude) / 180
    const ndviValue = Math.max(0.1, Math.min(0.9, 0.6 + (latFactor * 0.3) - (lonFactor * 0.2)))
    
    const subsidenceFactor = Math.sin(latitude * Math.PI / 180) * Math.cos(longitude * Math.PI / 180)
    const subsidenceValue = parseFloat((subsidenceFactor * 5).toFixed(1))

    // 4. ANÁLISIS INTELIGENTE
    const analysis = analyzeCropConditions(ndviValue, subsidenceValue, climateData, cropType, cropRanges)

    res.status(200).json({
      ndvi: ndviValue,
      climate: climateData,
      subsidence: subsidenceValue,
      recommendations: analysis.recommendations,
      score: analysis.score,
      analysis: analysis.details
    })
    
  } catch (error) {
    console.error('Error en análisis:', error)
    res.status(500).json({ error: 'Error interno del servidor' })
  }
}

function analyzeCropConditions(ndvi, subsidence, climate, cropType, ranges) {
  let score = 100
  let recommendations = []
  let details = {}

  // ANÁLISIS NDVI ESPECÍFICO POR CULTIVO
  if (ndvi !== null) {
    let ndviStatus = ''
    let ndviPenalty = 0
    
    if (ndvi >= ranges.ndvi_excelente_min) {
      ndviStatus = 'EXCELENTE'
      ndviPenalty = 0
    } else if (ndvi >= ranges.ndvi_bueno_min) {
      ndviStatus = 'BUENO'
      ndviPenalty = 5
    } else if (ndvi >= ranges.ndvi_regular_min) {
      ndviStatus = 'REGULAR'
      ndviPenalty = 15
    } else if (ndvi >= ranges.ndvi_malo_min) {
      ndviStatus = 'MALO'
      ndviPenalty = 25
    } else {
      ndviStatus = 'CRÍTICO'
      ndviPenalty = 35
    }
    
    score -= ndviPenalty
    details.ndvi = { value: ndvi, status: ndviStatus, penalty: ndviPenalty }
    
    if (ndviStatus === 'CRÍTICO') {
      recommendations.push(`🚨 URGENTE: NDVI crítico (${Math.round(ndvi * 100)}%) en ${cropType}. Implementar riego de emergencia y revisar sistema de irrigación inmediatamente.`)
    } else if (ndviStatus === 'REGULAR') {
      recommendations.push(`🌱 NDVI regular (${Math.round(ndvi * 100)}%) para ${cropType}. Aumentar frecuencia de riego y considerar fertilización de mantenimiento.`)
    } else {
      recommendations.push(`✅ NDVI ${ndviStatus.toLowerCase()} (${Math.round(ndvi * 100)}%) para ${cropType}. Mantener prácticas actuales de cultivo.`)
    }
  }

  // ANÁLISIS SUBSIDENCIA
  if (subsidence !== null) {
    const absSubsidence = Math.abs(subsidence)
    let subsidenceStatus = ''
    let subsidencePenalty = 0
    
    if (absSubsidence <= 1) {
      subsidenceStatus = 'ESTABLE'
      subsidencePenalty = 0
    } else if (absSubsidence <= 3) {
      subsidenceStatus = 'LIGERAMENTE INESTABLE'
      subsidencePenalty = 10
    } else if (absSubsidence <= 6) {
      subsidenceStatus = 'INESTABLE'
      subsidencePenalty = 25
    } else {
      subsidenceStatus = 'CRÍTICO'
      subsidencePenalty = 40
    }
    
    score -= subsidencePenalty
    details.subsidence = { value: subsidence, status: subsidenceStatus, penalty: subsidencePenalty }
    
    if (subsidenceStatus === 'CRÍTICO') {
      recommendations.push(`⚠️ SUBSIDENCIA CRÍTICA: ${subsidence} mm/año. Revisar inmediatamente sistemas de riego por posibles rupturas.`)
    } else if (subsidenceStatus === 'ESTABLE') {
      recommendations.push(`✅ TERRENO ESTABLE: ${subsidence} mm/año. Excelente estabilidad para ${cropType}.`)
    }
  }

  // ANÁLISIS CLIMA
  if (climate && climate.temperature !== null) {
    let tempPenalty = 0
    
    if (climate.temperature < ranges.temp_minima) {
      tempPenalty = Math.min(20, (ranges.temp_minima - climate.temperature) * 2)
      recommendations.push(`🌡️ TEMPERATURA BAJA: ${climate.temperature}°C está por debajo del rango óptimo para ${cropType}.`)
    } else if (climate.temperature > ranges.temp_maxima) {
      tempPenalty = Math.min(20, (climate.temperature - ranges.temp_maxima) * 2)
      recommendations.push(`🔥 TEMPERATURA ALTA: ${climate.temperature}°C supera el rango óptimo para ${cropType}.`)
    } else {
      recommendations.push(`🌡️ TEMPERATURA ÓPTIMA: ${climate.temperature}°C es ideal para ${cropType}.`)
    }
    
    score -= tempPenalty
    details.temperature = { value: climate.temperature, penalty: tempPenalty }
  }

  score = Math.max(15, Math.min(100, score))
  
  return {
    score: score,
    recommendations: recommendations.slice(0, 5),
    details: details
  }
}
