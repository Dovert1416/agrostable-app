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
    
    // Datos de prueba en el formato correcto
    res.status(200).json({
      ndvi: 0.75,
      climate: { 
        temperature: 28, 
        humidity: 65 
      },
      subsidence: 2.1,
      recommendations: [
        "🌱 Mantener riego constante - NDVI bueno (75%)",
        "💧 Monitorear humedad del suelo regularmente", 
        "🏔️ Terreno estable - continuar prácticas actuales",
        "📊 Repetir análisis en 15 días para seguimiento"
      ]
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
