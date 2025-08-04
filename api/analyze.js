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
    
    // Aquí van las consultas a las APIs reales
    // Por ahora, datos de prueba para verificar que funciona
    
    res.status(200).json({
      ndvi: 0.75,
      climate: { temperature: 28, humidity: 65 },
      subsidence: 2.1,
      recommendations: ["Riego óptimo", "Monitorear plagas"]
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
