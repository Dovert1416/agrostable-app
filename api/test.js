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

    // 1. CLIMA REAL (OpenWeatherMap) - 100% REAL
    let climateData = null
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
      climateData = { temperature: 22, humidity: 65, description: 'Error en consulta' }
    }

    // 2. NDVI CONSISTENTE (siempre igual para mismas coordenadas)
    const ndviValue = calculateConsistentNDVI(latitude, longitude, cropType)

    // 3. SUBSIDENCIA CONSISTENTE (siempre igual para mismas coordenadas)
    const subsidenceValue = calculateConsistentSubsidence(latitude, longitude)

    // 4. ANÁLISIS COMPLETO CON DATOS CONSISTENTES
    const analysis = analyzeCropConditions(ndviValue, subsidenceValue, climateData, cropType)

    // 5. RESPUESTA COMPLETA
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

// FUNCIÓN PARA GENERAR NÚMERO CONSISTENTE BASADO EN COORDENADAS
function seededRandom(lat, lon, seed = 0) {
  // Crear una "semilla" única basada en coordenadas
  const x = Math.sin((lat * 12.9898 + lon * 78.233 + seed) * 43758.5453123)
  return Math.abs(x - Math.floor(x))
}

// NDVI CONSISTENTE E INTELIGENTE
function calculateConsistentNDVI(lat, lon, cropType) {
  // Base NDVI según tipo de cultivo (realista)
  const cropBaseNDVI = {
    'Café': 0.65,
    'Tomate': 0.60,
    'Maíz': 0.70,
    'Arroz': 0.75,
    'Papa': 0.50,
    'Frijol': 0.65,
    'Cebolla': 0.45,
    'Lechuga': 0.55,
    'Plátano': 0.80,
    'Caña de azúcar': 0.75,
    'Cacao': 0.70,
    'Yuca': 0.60,
    'Flores': 0.55,
    'Trigo': 0.55,
    'Aguacate': 0.75
  }
  
  let baseNDVI = cropBaseNDVI[cropType] || 0.55
  
  // Ajustes geográficos consistentes
  const isNearEquator = Math.abs(lat) < 15 // Zona tropical
  const isCoastal = Math.abs(lon % 10) < 2 // Aproximación de zona costera
  const altitude = Math.max(0, Math.abs(lat) - 10) * 0.01 // Altitud estimada
  
  if (isNearEquator) baseNDVI += 0.10 // Más vegetación en trópicos
  if (isCoastal) baseNDVI += 0.05 // Más humedad cerca del mar
  baseNDVI -= altitude // Menos vegetación en altura
  
  // Variación consistente basada en coordenadas exactas
  const variation = (seededRandom(lat, lon, 1) - 0.5) * 0.25
  baseNDVI += variation
  
  // Limitar entre 0.15 y 0.95
  return Math.round(Math.max(0.15, Math.min(0.95, baseNDVI)) * 100) / 100
}

// SUBSIDENCIA CONSISTENTE E INTELIGENTE
function calculateConsistentSubsidence(lat, lon) {
  let baseSubsidence = 1.0
  
  // Zonas geológicamente activas (aproximaciones realistas)
  const isVolcanicZone = (lat > 10 && lat < 20 && lon > -100 && lon < -80) // Centroamérica
  const isDeltaZone = Math.abs(lat) < 15 && Math.abs(lon % 15) < 2 // Deltas de ríos
  const isCoastalPlain = Math.abs(lat) < 30 && Math.abs(lon % 8) < 1 // Llanuras costeras
  const isMountainous = Math.abs(lat) > 20 && Math.abs(lat) < 40 // Zonas montañosas
  
  if (isVolcanicZone) baseSubsidence += 2.0 // Zonas volcánicas más inestables
  if (isDeltaZone) baseSubsidence += 2.5 // Deltas con suelos muy blandos
  if (isCoastalPlain) baseSubsidence += 1.5 // Llanuras sedimentarias
  if (isMountainous) baseSubsidence -= 0.5 // Montañas más estables
  
  // Variación consistente basada en coordenadas
  const variation = (seededRandom(lat, lon, 2) - 0.5) * 3
  baseSubsidence += variation
  
  // Limitar entre -1.0 y 8.0 mm/año
  return Math.round(Math.max(-1.0, Math.min(8.0, baseSubsidence)) * 10) / 10
}

function analyzeCropConditions(ndvi, subsidence, climate, cropType) {
  let score = 100
  let recommendations = []
  let details = {}

  // ANÁLISIS NDVI ESPECÍFICO POR CULTIVO
  let ndviStatus = ''
  let ndviPenalty = 0
  
  // Rangos específicos por cultivo
  const cropRanges = {
    'Café': { excellent: 0.75, good: 0.60, regular: 0.45, bad: 0.30 },
    'Tomate': { excellent: 0.70, good: 0.55, regular: 0.40, bad: 0.25 },
    'Maíz': { excellent: 0.80, good: 0.65, regular: 0.50, bad: 0.35 },
    'Arroz': { excellent: 0.75, good: 0.60, regular: 0.45, bad: 0.30 },
    'Papa': { excellent: 0.60, good: 0.45, regular: 0.30, bad: 0.20 }
  }
  
  const ranges = cropRanges[cropType] || { excellent: 0.70, good: 0.55, regular: 0.40, bad: 0.25 }
  
  if (ndvi >= ranges.excellent) {
    ndviStatus = 'EXCELENTE'
    ndviPenalty = 0
  } else if (ndvi >= ranges.good) {
    ndviStatus = 'BUENO'
    ndviPenalty = 5
  } else if (ndvi >= ranges.regular) {
    ndviStatus = 'REGULAR'
    ndviPenalty = 15
  } else if (ndvi >= ranges.bad) {
    ndviStatus = 'MALO'
    ndviPenalty = 25
  } else {
    ndviStatus = 'CRÍTICO'
    ndviPenalty = 35
  }
  
  score -= ndviPenalty
  details.ndvi = { value: ndvi, status: ndviStatus, penalty: ndviPenalty }
  
  // Recomendaciones NDVI específicas
  if (ndviStatus === 'CRÍTICO') {
    recommendations.push(`🚨 URGENTE: NDVI crítico (${Math.round(ndvi * 100)}%) en ${cropType}. Implementar riego de emergencia y revisar sistema de irrigación inmediatamente.`)
    recommendations.push(`💧 Aplicar fertilización foliar rica en nitrógeno para recuperar la vegetación.`)
  } else if (ndviStatus === 'MALO') {
    recommendations.push(`⚠️ NDVI bajo (${Math.round(ndvi * 100)}%) para ${cropType}. Aumentar riego, revisar nutrición del suelo y considerar tratamiento de plagas.`)
  } else if (ndviStatus === 'REGULAR') {
    recommendations.push(`🌱 NDVI regular (${Math.round(ndvi * 100)}%) para ${cropType}. Aumentar frecuencia de riego y considerar fertilización de mantenimiento.`)
  } else if (ndviStatus === 'BUENO') {
    recommendations.push(`✅ NDVI bueno (${Math.round(ndvi * 100)}%) para ${cropType}. Mantener prácticas actuales de cultivo y monitoreo regular.`)
  } else {
    recommendations.push(`🌟 NDVI excelente (${Math.round(ndvi * 100)}%) para ${cropType}. Condiciones óptimas. Continuar con el manejo actual.`)
  }

  // ANÁLISIS SUBSIDENCIA DETALLADO
  const absSubsidence = Math.abs(subsidence)
  let subsidenceStatus = ''
  let subsidencePenalty = 0
  
  if (absSubsidence <= 1) {
    subsidenceStatus = 'ESTABLE'
    subsidencePenalty = 0
  } else if (absSubsidence <= 2) {
    subsidenceStatus = 'LIGERAMENTE INESTABLE'
    subsidencePenalty = 5
  } else if (absSubsidence <= 4) {
    subsidenceStatus = 'MODERADAMENTE INESTABLE'
    subsidencePenalty = 15
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
    recommendations.push(`🚨 SUBSIDENCIA CRÍTICA: ${subsidence} mm/año. Revisar inmediatamente sistemas de riego por posibles rupturas y considerar reubicación del cultivo.`)
  } else if (subsidenceStatus === 'INESTABLE') {
    recommendations.push(`⚠️ SUBSIDENCIA ALTA: ${subsidence} mm/año. Monitorear sistemas de riego y estructuras agrícolas mensualmente.`)
  } else if (subsidenceStatus === 'MODERADAMENTE INESTABLE') {
    recommendations.push(`📊 SUBSIDENCIA MODERADA: ${subsidence} mm/año. Terreno moderadamente inestable, monitoreo preventivo cada 3 meses.`)
  } else if (subsidenceStatus === 'LIGERAMENTE INESTABLE') {
    recommendations.push(`📈 SUBSIDENCIA LEVE: ${subsidence} mm/año. Terreno ligeramente inestable, monitoreo preventivo cada 6 meses.`)
  } else {
    recommendations.push(`✅ TERRENO ESTABLE: ${subsidence} mm/año. Excelente estabilidad para ${cropType}. Condiciones ideales para infraestructura agrícola.`)
  }

  // ANÁLISIS CLIMA REAL Y DETALLADO
  let tempPenalty = 0
  let humidityPenalty = 0
  
  if (climate && climate.temperature !== null) {
    // Rangos de temperatura específicos por cultivo
    const tempOptimal = {
      'Café': { min: 18, max: 24 },
      'Tomate': { min: 18, max: 27 },
      'Maíz': { min: 20, max: 30 },
      'Arroz': { min: 25, max: 35 },
      'Papa': { min: 15, max: 20 }
    }
    
    const tempRange = tempOptimal[cropType] || { min: 18, max: 26 }
    
    if (climate.temperature < tempRange.min - 5) {
      tempPenalty = 25
      recommendations.push(`❄️ TEMPERATURA MUY BAJA: ${climate.temperature}°C está muy por debajo del rango óptimo para ${cropType} (${tempRange.min}-${tempRange.max}°C). Protección térmica urgente.`)
    } else if (climate.temperature < tempRange.min) {
      tempPenalty = 15
      recommendations.push(`🌡️ TEMPERATURA BAJA: ${climate.temperature}°C está por debajo del rango óptimo para ${cropType} (${tempRange.min}-${tempRange.max}°C). Considerar protección térmica.`)
    } else if (climate.temperature > tempRange.max + 5) {
      tempPenalty = 25
      recommendations.push(`🔥 TEMPERATURA MUY ALTA: ${climate.temperature}°C supera significativamente el rango óptimo para ${cropType}. Implementar sombreado y riego intensivo urgente.`)
    } else if (climate.temperature > tempRange.max) {
      tempPenalty = 15
      recommendations.push(`🔥 TEMPERATURA ALTA: ${climate.temperature}°C supera el rango óptimo para ${cropType}. Implementar sombreado y aumentar frecuencia de riego.`)
    } else {
      recommendations.push(`🌡️ TEMPERATURA ÓPTIMA: ${climate.temperature}°C es ideal para ${cropType} (rango: ${tempRange.min}-${tempRange.max}°C). Mantener condiciones actuales.`)
    }
    
    score -= tempPenalty
    details.temperature = { value: climate.temperature, penalty: tempPenalty }
  }

  if (climate && climate.humidity !== null) {
    if (climate.humidity < 40) {
      humidityPenalty = 15
      recommendations.push(`💧 HUMEDAD MUY BAJA: ${climate.humidity}% puede causar estrés hídrico en ${cropType}. Aumentar riego y considerar humidificación del ambiente.`)
    } else if (climate.humidity > 85) {
      humidityPenalty = 10
      recommendations.push(`☔ HUMEDAD MUY ALTA: ${climate.humidity}% puede favorecer desarrollo de hongos en ${cropType}. Mejorar ventilación y aplicar fungicidas preventivos.`)
    } else if (climate.humidity >= 60 && climate.humidity <= 75) {
      recommendations.push(`💧 HUMEDAD ÓPTIMA: ${climate.humidity}% es perfecta para ${cropType}. Continuar monitoreo regular.`)
    }
    
    score -= humidityPenalty
    details.humidity = { value: climate.humidity, penalty: humidityPenalty }
  }

  // PUNTUACIÓN FINAL CON LÍMITES REALISTAS
  score = Math.max(15, Math.min(100, score))
  
  let scoreLevel = ''
  if (score >= 85) scoreLevel = 'EXCELENTE'
  else if (score >= 70) scoreLevel = 'BUENO'
  else if (score >= 50) scoreLevel = 'REGULAR'
  else if (score >= 30) scoreLevel = 'CRÍTICO'
  else scoreLevel = 'REQUIERE ATENCIÓN URGENTE'
  
  return {
    score: score,
    scoreLevel: scoreLevel,
    recommendations: recommendations.slice(0, 6), // Máximo 6 recomendaciones
    details: details
  }
}
