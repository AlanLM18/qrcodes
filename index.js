import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import { supabase } from './supabaseClient.js'
import userRoutes from './routes/userRoutes.js'
import dotenv from 'dotenv'
import open from 'open'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// Configurar CORS (agregar ANTES de las rutas)
app.use(cors())

// Middlewares
app.use(bodyParser.json())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))

// Usar las rutas de usuario
app.use(userRoutes)

// Endpoint para probar conexión con la tabla "users"
app.get('/test-supabase', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, nombre, correo, matricula, grupo, activo')

    if (error) throw error

    res.json({
      mensaje: 'Conexión exitosa a Supabase',
      usuarios: data
    })
  } catch (err) {
    console.error('Error de conexión:', err)
    res.status(500).json({
      error: 'No se pudo conectar a Supabase',
      detalles: err.message
    })
  }
})

app.get('/qrcodes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qrcodes')
      .select('*')

    if (error) throw error

    res.json({
      mensaje: 'Consulta exitosa a qrcodes',
      qrcodes: data
    })
  } catch (err) {
    console.error('Error al consultar qrcodes:', err)
    res.status(500).json({
      error: 'No se pudo obtener qrcodes',
      detalles: err.message
    })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
  try {
    // abre directamente la página qrscan.html
    await open(`http://localhost:${PORT}/qrscan.html`)
  } catch (err) {
    console.error('No se pudo abrir el navegador:', err)
  }
})