const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const ee = require('@google/earthengine');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar variables de entorno
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Credenciales de Google Earth Engine desde variables de entorno
const privateKey = {
  "type": "service_account",
  "project_id": process.env.GEE_PROJECT_ID,
  "private_key_id": process.env.GEE_PRIVATE_KEY_ID,
  "private_key": process.env.GEE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.GEE_CLIENT_EMAIL,
  "client_id": process.env.GEE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.GEE_CLIENT_CERT_URL,
  "universe_domain": "googleapis.com"
};

// Inicializar Google Earth Engine
let eeInitialized = false;
function initializeEE() {
  return new Promise((resolve, reject) => {
    if (eeInitialized) return resolve();
    ee.data.authenticateViaPrivateKey(privateKey, () => {
      ee.initialize(null, null, () => {
        eeInitialized = true;
        console.log('✅ Google Earth Engine inicializado correctamente');
        resolve();
      }, (err) => {
        console.error('❌ Error al inicializar Earth Engine:', err);
        reject(err);
      });
    }, (err) => {
      console.error('❌ Error autenticando Earth Engine:', err);
      reject(err);
    });
  });
}

// Configurar conexión Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Función para consultar la tabla "cultivos" en Supabase
async function obtenerRangosCultivo(nombreCultivo) {
  const cultivoLimpio = (nombreCultivo || '').trim();
  console.log('🔍 Buscando cultivo:', cultivoLimpio);
  console.log('🔧 INICIANDO DEBUG DE CULTIVOS');
  const { data: todosLosCultivos, error: errorTodos } = await supabase
    .from('cultivos')
    .select('*');
  console.log('🌾 TODOS los cultivos en DB:', todosLosCultivos);
  console.log('📝 Nombres exactos:', todosLosCultivos?.map(c => `"${c.nombre}"`));
  console.log('🔧 FIN DEBUG DE CULTIVOS');

  const { data, error } = await supabase
    .from('cultivos')
    .select('*')
    .eq('nombre', cultivoLimpio);
  console.log('📊 Resultado Supabase:', data);
  console.log('❌ Error Supabase:', error);
  if (error) {
    console.error('❌ Error consultando Supabase:', error);
    return null;
  }
  if (!data) {
    console.warn('⚠️ Cultivo no encontrado en Supabase:', cultivoLimpio);
    return null;
  }
  return data;
}

app.use(cors());
app.use(bodyParser.json());

// Servir archivos estáticos
app.use(express.static('./'));

// Ruta para servir index.html en la raíz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint para consultar clima (proxy a OpenWeatherMap)
app.post('/clima', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (!lat || !lon) {
      console.error('[CLIMA] ❌ Parámetros requeridos no enviados');
      return res.status(400).json({
        error: 'Parámetros requeridos: lat, lon',
        success: false
      });
    }
    console.log(`[CLIMA] 🔍 Consultando clima para: ${lat}, ${lon}`);
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=es`;
    console.log(`[CLIMA] Consultando OpenWeatherMap`);
    let resp;
    try {
      resp = await axios.get(url);
      console.log(`[CLIMA] Respuesta de OpenWeatherMap: status ${resp.status}`);
    } catch (err) {
      console.error(`[CLIMA] ❌ Error de conexión a OpenWeatherMap: ${err.message}`);
      return res.status(500).json({
        error: 'No se pudo conectar a OpenWeatherMap',
        details: err.message,
        success: false
      });
    }
    if (!resp || !resp.status || resp.status < 200 || resp.status >= 300) {
      let msg = 'Error al consultar OpenWeatherMap';
      if (resp && resp.status === 401) msg = 'API key de OpenWeatherMap inválida';
      if (resp && resp.status === 429) msg = 'Límite de consultas de OpenWeatherMap excedido';
      console.error(`[CLIMA] ❌ Respuesta no OK de OpenWeatherMap: status ${resp && resp.status} - ${msg}`);
      return res.status(500).json({
        error: msg,
        status: resp && resp.status,
        success: false
      });
    }
    let data = resp.data;
    console.log(`[CLIMA] JSON recibido de OpenWeatherMap:`, JSON.stringify(data));
    if (!data || !data.weather || !data.main) {
      console.error(`[CLIMA] ❌ Respuesta incompleta de OpenWeatherMap:`, JSON.stringify(data));
      return res.status(500).json({
        error: 'Respuesta incompleta de OpenWeatherMap',
        data,
        success: false
      });
    }
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('[CLIMA] ❌ Error inesperado en endpoint /clima:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      success: false
    });
  }
});

// Endpoint para consultar NDVI real
app.post('/ndvi', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Parámetros requeridos: lat, lon',
        success: false
      });
    }
    await initializeEE();
    console.log(`🔍 Consultando NDVI real para: ${lat}, ${lon}`);
    // Sentinel-2, NDVI promedio últimos 30 días, filtro nubes <20%
    const point = ee.Geometry.Point([parseFloat(lon), parseFloat(lat)]);
    // Calcular fechas de los últimos 30 días
    const endDate = ee.Date(new Date().toISOString().split('T')[0]);
    const startDate = endDate.advance(-30, 'day');
    const collection = ee.ImageCollection('COPERNICUS/S2')
      .filterBounds(point)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
    // Calcular NDVI para cada imagen y luego el promedio
    const ndviCollection = collection.map(img => img.normalizedDifference(['B8', 'B4']).rename('NDVI'));
    const ndviMeanImage = ndviCollection.mean();
    const meanDict = ndviMeanImage.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: point,
      scale: 20,
      maxPixels: 1e9
    });
    meanDict.evaluate((val) => {
      const ndviValue = val && val.NDVI !== undefined ? val.NDVI : null;
      let calidad = 'Sin datos';
      let recomendacion = '';
      if (ndviValue !== null) {
        if (ndviValue < 0.2) {
          calidad = 'crítico';
          recomendacion = 'NDVI 1% - CRÍTICO: Vegetación en estado crítico - posible suelo desnudo o cultivo muerto.';
        } else if (ndviValue < 0.4) {
          calidad = 'malo';
          recomendacion = 'NDVI bajo: Vegetación escasa, riesgo de bajo rendimiento.';
        } else if (ndviValue < 0.6) {
          calidad = 'regular';
          recomendacion = 'NDVI regular: Vegetación moderada, monitorear manejo.';
        } else if (ndviValue < 0.8) {
          calidad = 'bueno';
          recomendacion = 'NDVI bueno: Vegetación saludable, manejo adecuado.';
        } else {
          calidad = 'excelente';
          recomendacion = 'NDVI excelente: Vegetación densa, óptimo para tomates.';
        }
      } else {
        recomendacion = 'No se pudo calcular NDVI en este punto.';
      }
      // Formato de fechas para mostrar el período
      const jsStart = new Date(Date.now() - 30*24*60*60*1000);
      const jsEnd = new Date();
      const formatDate = d => d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
      const periodo = `NDVI promedio de los últimos 30 días (${formatDate(jsStart)} - ${formatDate(jsEnd)})`;
      res.json({
        success: true,
        data: {
          ndvi: ndviValue,
          fecha: jsEnd.toISOString().split('T')[0],
          calidad: calidad,
          recomendacion: recomendacion,
          periodo: periodo
        }
      });
    });
  } catch (error) {
    console.error('❌ Error en endpoint /ndvi:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      success: false
    });
  }
});

// Endpoint para consultar subsidencia real
app.post('/subsidence', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Parámetros requeridos: lat, lon',
        success: false
      });
    }
    await initializeEE();
    console.log(`🔍 Consultando subsidencia real para: ${lat}, ${lon}`);
    // Sentinel-1: diferencia de backscatter VV entre primera y última imagen del último año
    const point = ee.Geometry.Point([parseFloat(lon), parseFloat(lat)]);
    const startDate = ee.Date(new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0]);
    const endDate = ee.Date(new Date().toISOString().split('T')[0]);
    const collection = ee.ImageCollection('COPERNICUS/S1_GRD')
      .filterBounds(point)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.eq('instrumentMode', 'IW'))
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
      .sort('system:time_start');
    const count = collection.size();
    const first = collection.first();
    const last = collection.sort('system:time_start', false).first();
    // Calcular diferencia de backscatter VV (dB) entre primera y última imagen
    const diff = last.select('VV').subtract(first.select('VV')).rename('VV_diff');
    const meanDict = diff.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: point,
      scale: 20,
      maxPixels: 1e9
    });
    count.getInfo(async (n) => {
      if (!n || n < 2) {
        return res.json({
          success: true,
          data: {
            value: 0,
            hasData: false,
            message: 'No hay suficientes imágenes Sentinel-1 para calcular subsidencia.'
          }
        });
      }
      meanDict.evaluate((val) => {
        let value = val && val.VV_diff !== undefined ? val.VV_diff : null;
        let mmPerYear = null;
        let message = '';
        if (value === null) {
          message = 'No se pudo calcular subsidencia en este punto';
        } else {
          // Conversión empírica: 1 dB ≈ 15 mm/año (ajustable según literatura)
          mmPerYear = value * 15;
          message = `Subsidencia estimada: ${mmPerYear.toFixed(2)} mm/año (convertido de ΔVV=${value.toFixed(2)} dB/año usando modelo empírico)`;
        }
        res.json({
          success: true,
          data: {
            value: mmPerYear,
            hasData: value !== null,
            message: message,
            backscatterDiff: value
          }
        });
      });
    });
  } catch (error) {
    console.error('❌ Error en endpoint /subsidence:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      success: false
    });
  }
});

// Endpoint para consultar rangos de cultivo dinámicamente
app.post('/cultivo-rangos', async (req, res) => {
  try {
    const { cultivo } = req.body;
    if (!cultivo) {
      return res.status(400).json({
        error: 'Parámetro requerido: cultivo',
        success: false
      });
    }
    const rangos = await obtenerRangosCultivo(cultivo);
    if (!rangos) {
      return res.status(404).json({
        error: 'Cultivo no encontrado',
        success: false
      });
    }
    res.json({
      success: true,
      data: rangos
    });
  } catch (error) {
    console.error('❌ Error en endpoint /cultivo-rangos:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: error.message,
      success: false
    });
  }
});

// Endpoint de salud del servidor
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'AgroStable Backend (Google Earth Engine)',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor AgroStable Backend iniciado en puerto ${PORT}`);
  console.log(`📡 Endpoints disponibles:`);
  console.log(`   - POST /clima (consulta clima real)`);
  console.log(`   - POST /ndvi (consulta NDVI real)`);
  console.log(`   - POST /subsidence (consulta subsidencia real)`);
  console.log(`   - GET  /health (estado del servidor)`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});

// Manejo de errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});