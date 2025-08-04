export default function handler(req, res) {
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
    
    // Datos de prueba SIMPLES que funcionan
    res.status(200).json({
      ndvi: 0.57,
      climate: { 
        temperature: 22, 
        humidity: 71,
        description: "broken clouds"
      },
      subsidence: 1.8,
      recommendations: [
        "🌱 NDVI regular (57%) para Café. Aumentar frecuencia de riego y considerar fertilización de mantenimiento.",
        "📊 SUBSIDENCIA LEVE: 1.8 mm/año. Terreno ligeramente inestable, monitoreo preventivo cada 3 meses.",
        "🌡️ TEMPERATURA ÓPTIMA: 22°C es ideal para Café. Mantener condiciones actuales.",
        "☔ HUMEDAD ALTA: 71% puede favorecer hongos en Café. Mejorar ventilación y aplicar fungicidas preventivos."
      ],
      score: 85,
      scoreLevel: "EXCELENTE",
      analysis: {
        ndvi: { status: "REGULAR", penalty: 15 },
        subsidence: { status: "LIGERAMENTE INESTABLE", penalty: 10 },
        temperature: { penalty: 0 },
        humidity: { penalty: 0.5 }
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
