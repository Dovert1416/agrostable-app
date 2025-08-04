export default function handler(req, res) {
  res.json({
    ndvi: 0.75,
    climate: { temperature: 28, humidity: 65 },
    subsidence: 2.1,
    recommendations: ["Funciona correctamente", "API conectada"]
  });
}
