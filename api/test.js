export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { latitude, longitude, cropType } = req.body;
    
    if (!latitude || !longitude || !cropType) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    // 1. CONSULTAR CLIMA (OpenWeatherMap)
    let climateData = null;
    try {
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric`
      );
      if (weatherResponse.ok) {
        const weatherData = await weatherResponse.json();
        climateData = {
          temperature: Math.round(weatherData.main?.temp || 0),
          humidity: Math.round(weatherData.main?.humidity || 0),
          description: weatherData.weather?.[0]?.description || 'N/A'
        };
      }
    } catch (error) {
      console.error('Error consultando clima:', error);
    }

    // 2. CONSULTAR NDVI (Simulado - Google Earth Engine requiere configuración compleja)
    let ndviValue = null;
    try {
      // Simulación de NDVI basada en coordenadas (en producción usar Google Earth Engine)
      const latFactor = Math.abs(latitude) / 90;
      const lonFactor = Math.abs(longitude) / 180;
      ndviValue = Math.max(0.1, Math.min(0.9, 0.6 + (latFactor * 0.3) - (lonFactor * 0.2) + (Math.random() * 0.2 - 0.1)));
    } catch (error) {
      console.error('Error simulando NDVI:', error);
    }

    // 3. CONSULTAR SUBSIDENCIA (Simulado - ASF Alaska requiere procesamiento complejo)
    let subsidenceValue = null;
    try {
      // Simulación de subsidencia basada en ubicación
      const subsidenceFactor = Math.sin(latitude * Math.PI / 180) * Math.cos(longitude * Math.PI / 180);
      subsidenceValue = parseFloat((subsidenceFactor * 5 + (Math.random() * 4 - 2)).toFixed(1));
    } catch (error) {
      console.error('Error simulando subsidencia:', error);
    }

    // 4. OBTENER RANGOS DE CULTIVO (Simulado - Supabase requiere configuración)
    const cropRanges = getCropRanges(cropType);

    // 5. ANÁLISIS INTELIGENTE
    const analysis = analyzeCropConditions(ndviValue, subsidenceValue, climateData, cropType, cropRanges);

    // 6. RESPUESTA COMPLETA
    res.status(200).json({
      ndvi: ndviValue,
      climate: climateData,
      subsidence: subsidenceValue,
      recommendations: analysis.recommendations,
      score: analysis.score,
      analysis: analysis.details
    });
    
  } catch (error) {
    console.error('Error en análisis:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// FUNCIÓN: Obtener rangos específicos por cultivo
function getCropRanges(cropType) {
  const ranges = {
    'Café': {
      ndvi: { excellent: [0.7, 1.0], good: [0.5, 0.69], regular: [0.3, 0.49], bad: [0.1, 0.29] },
      temp: { min: 18, max: 24, optimal: 21 },
      humidity: { min: 60, max: 70, optimal: 65 }
    },
    'Tomate': {
      ndvi: { excellent: [0.75, 1.0], good: [0.55, 0.74], regular: [0.35, 0.54], bad: [0.1, 0.34] },
      temp: { min: 18, max: 27, optimal: 22 },
      humidity: { min: 50, max: 70, optimal: 60 }
    },
    'Maíz': {
      ndvi: { excellent: [0.8, 1.0], good: [0.6, 0.79], regular: [0.4, 0.59], bad: [0.1, 0.39] },
      temp: { min: 20, max: 30, optimal: 25 },
      humidity: { min: 50, max: 80, optimal: 65 }
    },
    'Arroz': {
      ndvi: { excellent: [0.7, 1.0], good: [0.5, 0.69], regular: [0.3, 0.49], bad: [0.1, 0.29] },
      temp: { min: 25, max: 35, optimal: 30 },
      humidity: { min: 70, max: 90, optimal: 80 }
    }
  };
  
  return ranges[cropType] || ranges['Café']; // Default a café si no encuentra el cultivo
}

// FUNCIÓN: Análisis inteligente de condiciones
function analyzeCropConditions(ndvi, subsidence, climate, cropType, ranges) {
  let score = 100;
  let recommendations = [];
  let details = {};

  // ANÁLISIS NDVI
  if (ndvi !== null) {
    let ndviStatus = '';
    let ndviPenalty = 0;
    
    if (ndvi >= ranges.ndvi.excellent[0]) {
      ndviStatus = 'EXCELENTE';
      ndviPenalty = 0;
    } else if (ndvi >= ranges.ndvi.good[0]) {
      ndviStatus = 'BUENO';
      ndviPenalty = 5;
    } else if (ndvi >= ranges.ndvi.regular[0]) {
      ndviStatus = 'REGULAR';
      ndviPenalty = 15;
    } else {
      ndviStatus = 'CRÍTICO';
      ndviPenalty = 30;
    }
    
    score -= ndviPenalty;
    details.ndvi = { value: ndvi, status: ndviStatus, penalty: ndviPenalty };
    
    // Recomendaciones NDVI
    if (ndviStatus === 'CRÍTICO') {
      recommendations.push(`🚨 URGENTE: NDVI crítico (${Math.round(ndvi * 100)}%) en ${cropType}. Implementar riego de emergencia y revisar sistema de irrigación inmediatamente.`);
      recommendations.push(`💧 Aplicar fertilización foliar rica en nitrógeno PORQUE el NDVI crítico indica deficiencia nutricional severa.`);
    } else if (ndviStatus === 'REGULAR') {
      recommendations.push(`🌱 NDVI regular (${Math.round(ndvi * 100)}%) para ${cropType}. Aumentar frecuencia de riego y considerar fertilización de mantenimiento.`);
    } else if (ndviStatus === 'BUENO' || ndviStatus === 'EXCELENTE') {
      recommendations.push(`✅ NDVI ${ndviStatus.toLowerCase()} (${Math.round(ndvi * 100)}%) para ${cropType}. Mantener prácticas actuales de cultivo.`);
    }
  } else {
    recommendations.push(`📡 No hay datos NDVI disponibles. Repetir análisis en unos días cuando haya imágenes satelitales sin nubes.`);
  }

  // ANÁLISIS SUBSIDENCIA
  if (subsidence !== null) {
    const absSubsidence = Math.abs(subsidence);
    let subsidenceStatus = '';
    let subsidencePenalty = 0;
    
    if (absSubsidence <= 1) {
      subsidenceStatus = 'ESTABLE';
      subsidencePenalty = 0;
    } else if (absSubsidence <= 3) {
      subsidenceStatus = 'LIGERAMENTE INESTABLE';
      subsidencePenalty = 10;
    } else if (absSubsidence <= 6) {
      subsidenceStatus = 'INESTABLE';
      subsidencePenalty = 25;
    } else {
      subsidenceStatus = 'CRÍTICO';
      subsidencePenalty = 40;
    }
    
    score -= subsidencePenalty;
    details.subsidence = { value: subsidence, status: subsidenceStatus, penalty: subsidencePenalty };
    
    // Recomendaciones SUBSIDENCIA
    if (subsidenceStatus === 'CRÍTICO') {
      recommendations.push(`⚠️ SUBSIDENCIA CRÍTICA: ${subsidence} mm/año. Revisar inmediatamente sistemas de riego por posibles rupturas y considerar reubicación del cultivo.`);
    } else if (subsidenceStatus === 'INESTABLE') {
      recommendations.push(`🏔️ SUBSIDENCIA MODERADA: ${subsidence} mm/año. Monitorear sistemas de riego y estructuras agrícolas mensualmente.`);
    } else if (subsidenceStatus === 'LIGERAMENTE INESTABLE') {
      recommendations.push(`📊 SUBSIDENCIA LEVE: ${subsidence} mm/año. Terreno ligeramente inestable, monitoreo preventivo cada 3 meses.`);
    } else {
      recommendations.push(`✅ TERRENO ESTABLE: ${subsidence} mm/año. Excelente estabilidad para ${cropType}.`);
    }
  }

  // ANÁLISIS CLIMA
  if (climate && climate.temperature !== null) {
    let tempPenalty = 0;
    
    if (climate.temperature < ranges.temp.min) {
      tempPenalty = Math.min(20, (ranges.temp.min - climate.temperature) * 2);
      recommendations.push(`🌡️ TEMPERATURA BAJA: ${climate.temperature}°C está por debajo del rango óptimo para ${cropType} (${ranges.temp.min}-${ranges.temp.max}°C). Considerar protección térmica.`);
    } else if (climate.temperature > ranges.temp.max) {
      tempPenalty = Math.min(20, (climate.temperature - ranges.temp.max) * 2);
      recommendations.push(`🔥 TEMPERATURA ALTA: ${climate.temperature}°C supera el rango óptimo para ${cropType}. Implementar sombreado y riego frecuente.`);
    } else {
      recommendations.push(`🌡️ TEMPERATURA ÓPTIMA: ${climate.temperature}°C es ideal para ${cropType}. Mantener condiciones actuales.`);
    }
    
    score -= tempPenalty;
    details.temperature = { value: climate.temperature, penalty: tempPenalty };
  }

  if (climate && climate.humidity !== null) {
    let humidityPenalty = 0;
    
    if (climate.humidity < ranges.humidity.min) {
      humidityPenalty = Math.min(15, (ranges.humidity.min - climate.humidity) * 0.5);
      recommendations.push(`💧 HUMEDAD BAJA: ${climate.humidity}% está por debajo del ideal para ${cropType}. Aumentar riego y considerar humidificación.`);
    } else if (climate.humidity > ranges.humidity.max) {
      humidityPenalty = Math.min(15, (climate.humidity - ranges.humidity.max) * 0.5);
      recommendations.push(`☔ HUMEDAD ALTA: ${climate.humidity}% puede favorecer hongos en ${cropType}. Mejorar ventilación y aplicar fungicidas preventivos.`);
    } else {
      recommendations.push(`💧 HUMEDAD ADECUADA: ${climate.humidity}% es perfecto para ${cropType}. Continuar monitoreo regular.`);
    }
    
    score -= humidityPenalty;
    details.humidity = { value: climate.humidity, penalty: humidityPenalty };
  }

  // RECOMENDACIÓN GENERAL
  score = Math.max(5, Math.min(100, score)); // Entre 5 y 100
  
  if (score >= 80) {
    recommendations.push(`📈 PUNTUACIÓN EXCELENTE (${score}/100): Tu cultivo de ${cropType} está en condiciones óptimas. Mantener prácticas actuales.`);
  } else if (score >= 60) {
    recommendations.push(`📊 PUNTUACIÓN BUENA (${score}/100): Tu cultivo de ${cropType} está bien. Considerar mejoras menores según recomendaciones.`);
  } else if (score >= 40) {
    recommendations.push(`⚠️ PUNTUACIÓN REGULAR (${score}/100): Tu cultivo de ${cropType} necesita atención. Implementar recomendaciones urgentes.`);
  } else {
    recommendations.push(`🚨 PUNTUACIÓN CRÍTICA (${score}/100): Tu cultivo de ${cropType} está en riesgo. Actuar inmediatamente según todas las recomendaciones.`);
  }

  return {
    score: score,
    recommendations: recommendations.slice(0, 6), // Máximo 6 recomendaciones
    details: details
  };
}
