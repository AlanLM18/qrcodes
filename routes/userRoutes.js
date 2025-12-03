import express from 'express'
import { supabase } from '../supabaseClient.js'

const router = express.Router()
const BUCKET = process.env.SUPABASE_BUCKET || 'public'

// helper para obtener URL pública o signed URL
async function resolveImageUrl(path) {
  if (!path) return null
  const { data: publicData, error: publicErr } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (publicErr) {
    console.error('Error getPublicUrl:', publicErr)
  }
  if (publicData && publicData.publicUrl) return publicData.publicUrl

  try {
    const { data: signedData, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
    if (signedErr) {
      console.error('Error createSignedUrl:', signedErr)
      return null
    }
    return signedData?.signedUrl ?? null
  } catch (err) {
    console.error('Error resolviendo imagen:', err)
    return null
  }
}

// Buscar QR por código y validar si está usado
router.get('/buscar-qr/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params
    
    console.log('Buscando código QR:', codigo)

    const { data: qrData, error: qrError } = await supabase
      .from('qrusers')
      .select('*')
      .eq('codigo', codigo)
      .single()

    if (qrError && qrError.code !== 'PGRST116') throw qrError

    if (!qrData) {
      console.log('Código QR no encontrado')
      return res.json({ 
        existe: false, 
        mensaje: 'Código QR no encontrado' 
      })
    }

    console.log('QR encontrado:', qrData)

    if (qrData.usado === true) {
      console.log('QR ya fue usado')
      return res.json({ 
        existe: false, 
        usado: true,
        mensaje: 'Este código QR ya fue utilizado y no es válido' 
      })
    }

    console.log('QR válido y disponible')

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', qrData.user_id)
      .single()

    if (userError) throw userError

    console.log('Usuario encontrado:', userData.nombre)

    const imagePath = userData.imagen ?? userData.foto ?? userData.imagen_path ?? null
    if (imagePath) {
      const url = await resolveImageUrl(imagePath)
      if (url) userData.imagen_url = url
    }

    res.json({ 
      existe: true, 
      qr: qrData,
      usuario: userData 
    })
  } catch (err) {
    console.error('Error al buscar QR:', err)
    res.status(500).json({
      error: 'Error al consultar Supabase',
      detalles: err.message
    })
  }
})

// Marcar QR como usado después de registrar acceso/asistencia
router.post('/marcar-qr-usado', async (req, res) => {
  try {
    const { codigo } = req.body

    console.log('Marcando QR como usado:', codigo)

    const ahora = new Date()
    const año = ahora.getFullYear()
    const mes = String(ahora.getMonth() + 1).padStart(2, '0')
    const dia = String(ahora.getDate()).padStart(2, '0')
    const hora = String(ahora.getHours()).padStart(2, '0')
    const minuto = String(ahora.getMinutes()).padStart(2, '0')
    const segundo = String(ahora.getSeconds()).padStart(2, '0')
    
    const fechaLocal = `${año}-${mes}-${dia} ${hora}:${minuto}:${segundo}`

    const { data, error } = await supabase
      .from('qrusers')
      .update({ 
        usado: true,
        usado_at: fechaLocal
      })
      .eq('codigo', codigo)
      .select()

    if (error) throw error

    console.log('✅ QR marcado como usado:', data[0])

    res.json({ 
      success: true, 
      data: data[0] 
    })
  } catch (err) {
    console.error('Error al marcar QR como usado:', err)
    res.status(500).json({
      success: false,
      error: 'Error al actualizar QR',
      detalles: err.message
    })
  }
})

// Buscar usuario por ID
router.get('/buscar-usuario/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      return res.json({ existe: false })
    }

    const imagePath = data.imagen ?? data.foto ?? data.imagen_path ?? null
    if (imagePath) {
      const url = await resolveImageUrl(imagePath)
      if (url) data.imagen_url = url
    }

    res.json({ existe: true, usuario: data })
  } catch (err) {
    console.error('Error al buscar usuario por ID:', err)
    res.status(500).json({
      error: 'Error al consultar Supabase',
      detalles: err.message
    })
  }
})

// Buscar usuario por matrícula
router.get('/buscar-usuario-matricula/:matricula', async (req, res) => {
  try {
    const { matricula } = req.params
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('matricula', matricula)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    if (!data) {
      return res.json({ existe: false })
    }

    const imagePath = data.imagen ?? data.foto ?? data.imagen_path ?? null
    if (imagePath) {
      const url = await resolveImageUrl(imagePath)
      if (url) data.imagen_url = url
    }

    res.json({ existe: true, usuario: data })
  } catch (err) {
    console.error('Error al buscar usuario por matrícula:', err)
    res.status(500).json({
      error: 'Error al consultar Supabase',
      detalles: err.message
    })
  }
})

// Obtener todos los usuarios
router.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')

    if (error) throw error

    res.json({
      mensaje: '✅ Consulta exitosa',
      usuarios: data
    })
  } catch (err) {
    console.error('Error al obtener usuarios:', err)
    res.status(500).json({
      error: 'No se pudo obtener usuarios',
      detalles: err.message
    })
  }
})

// Registrar acceso con tipo dinámico (entrada/salida)
router.post('/registrar-acceso', async (req, res) => {
  try {
    const { user_id, zone_id, tipo_acceso } = req.body;

    if (!['entrada', 'salida'].includes(tipo_acceso)) {
      return res.status(400).json({
        success: false,
        error: 'Tipo de acceso inválido. Debe ser "entrada" o "salida"'
      });
    }

    const { data: zonaData, error: zonaError } = await supabase
      .from('zones')
      .select('nombre')
      .eq('id', zone_id)
      .single();

    if (zonaError) {
      console.error('Error obteniendo zona:', zonaError);
      return res.status(400).json({ 
        success: false, 
        error: 'No se pudo obtener información de la zona' 
      });
    }

    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const hora = String(ahora.getHours()).padStart(2, '0');
    const minuto = String(ahora.getMinutes()).padStart(2, '0');
    const segundo = String(ahora.getSeconds()).padStart(2, '0');
    
    const fechaLocal = `${año}-${mes}-${dia} ${hora}:${minuto}:${segundo}`;

    console.log('Fecha:', fechaLocal);
    console.log('Zona:', zonaData.nombre);
    console.log('Tipo de acceso:', tipo_acceso);

    const { data, error } = await supabase
      .from('access')
      .insert({
        user_id: user_id,
        zone_id: zone_id,
        fecha: fechaLocal,
        tipo: tipo_acceso,
        zone_nombre: zonaData.nombre
      })
      .select();

    if (error) {
      console.error('Error registrando acceso:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Error al registrar el acceso',
        detalles: error.message
      });
    }

    console.log('✅ Acceso registrado:', data[0]);

    res.json({ 
      success: true, 
      data: data[0] 
    });

  } catch (err) {
    console.error('Error en /registrar-acceso:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor',
      detalles: err.message
    });
  }
});

// LÓGICA DE ASISTENCIA CORREGIDA - Estado temporal en primera pasada
router.post('/registrar-asistencia', async (req, res) => {
  try {
    const { user_id, grupo, clase_id, estado_asistencia, tiempo_transcurrido } = req.body;

    console.log('📝 Registrando asistencia:', { 
      user_id, 
      grupo, 
      clase_id, 
      estado_asistencia,
      tiempo_transcurrido 
    });

    const ahora = new Date();
    const año = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const fechaHoy = `${año}-${mes}-${dia}`;
    const horaActual = `${ahora.getHours().toString().padStart(2, '0')}:${ahora.getMinutes().toString().padStart(2, '0')}:${ahora.getSeconds().toString().padStart(2, '0')}`;

    // Verificar si ya existe un registro de asistencia para esta clase hoy
    const { data: registroExistente, error: errorBusqueda } = await supabase
      .from('attendance')
      .select('*')
      .eq('clase_id', clase_id)
      .gte('fecha', `${fechaHoy} 00:00:00`)
      .lte('fecha', `${fechaHoy} 23:59:59`)
      .limit(1);

    if (errorBusqueda) {
      console.error('Error buscando registro:', errorBusqueda);
    }

    // Si NO existe ningún registro para esta clase hoy, crear registros para todo el grupo
    if (!registroExistente || registroExistente.length === 0) {
      console.log('🆕 Primera asistencia del día, creando registros para el grupo:', grupo);

      const { data: usuariosGrupo, error: errorGrupo } = await supabase
        .from('users')
        .select('id')
        .eq('grupo', grupo)
        .eq('activo', 1);

      if (errorGrupo) {
        console.error('Error obteniendo usuarios del grupo:', errorGrupo);
        return res.status(500).json({
          success: false,
          error: 'Error al obtener usuarios del grupo'
        });
      }

      console.log(`📋 Usuarios encontrados en el grupo ${grupo}:`, usuariosGrupo.length);

      // Crear registros de "falta" para todos
      const registrosIniciales = usuariosGrupo.map(u => ({
        user_id: u.id,
        clase_id: clase_id,
        fecha: `${fechaHoy} ${horaActual}`,
        estado: 'falta',
        qr_id: null,
        primera_pasada: false,
        primera_pasada_at: null,
        segunda_pasada: false,
        segunda_pasada_at: null
      }));

      const { error: errorInsert } = await supabase
        .from('attendance')
        .insert(registrosIniciales);

      if (errorInsert) {
        console.error('Error insertando registros iniciales:', errorInsert);
        return res.status(500).json({
          success: false,
          error: 'Error al crear registros de asistencia',
          detalles: errorInsert.message
        });
      }

      console.log('✅ Registros iniciales creados con "falta"');
    }

    // Obtener el registro actual del usuario
    const { data: registroActual, error: errorRegistroActual } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user_id)
      .eq('clase_id', clase_id)
      .gte('fecha', `${fechaHoy} 00:00:00`)
      .lte('fecha', `${fechaHoy} 23:59:59`)
      .single();

    if (errorRegistroActual && errorRegistroActual.code !== 'PGRST116') {
      console.error('Error obteniendo registro actual:', errorRegistroActual);
    }

    // LÓGICA CORREGIDA - Estado temporal en primera pasada
    let estadoFinal = 'falta';
    let marcarUsado = false;
    let updateData = {};

    if (estado_asistencia === 'primera_pasada_presente') {
      // 0-2 minutos: Primera pasada (media asistencia)
      // ESTADO TEMPORAL: "media_asistencia" en lugar de "presente"
      console.log('✅ Primera pasada dentro de tiempo (0-2 min) - Estado TEMPORAL');
      
      updateData = {
        estado: 'media_asistencia',  // ⭐ CAMBIO PRINCIPAL: Estado temporal
        primera_pasada: true,
        primera_pasada_at: `${fechaHoy} ${horaActual}`
      };
      
      estadoFinal = 'primera_pasada';
      marcarUsado = false; // NO marcar como usado, necesita segunda pasada

    } else if (estado_asistencia === 'retardo_directo') {
      // 2-3 minutos: Retardo directo y final
      console.log('⚠️ Retardo directo (2-3 min)');
      
      updateData = {
        estado: 'retardo',  // Estado final de retardo
        primera_pasada: true,
        primera_pasada_at: `${fechaHoy} ${horaActual}`,
        segunda_pasada: false,
        segunda_pasada_at: null
      };
      
      estadoFinal = 'retardo';
      marcarUsado = true; // Marcar como usado, es final

    } else if (estado_asistencia === 'segunda_pasada') {
      // +10 minutos: Confirmar segunda pasada
      console.log('🔄 Procesando segunda pasada');
      
      if (!registroActual || !registroActual.primera_pasada) {
        return res.status(400).json({
          success: false,
          error: 'No se encontró primera pasada. Debe haber escaneado dentro de los primeros 3 minutos.'
        });
      }

      // Verificar si ya tiene segunda pasada
      if (registroActual.segunda_pasada) {
        return res.status(400).json({
          success: false,
          error: 'Ya completó la segunda pasada anteriormente.'
        });
      }

      // ⭐ AHORA AQUÍ SÍ SE CAMBIA A PRESENTE O RETARDO FINAL
      if (registroActual.estado === 'media_asistencia') {
        // Si tenía media_asistencia (llegó a tiempo), ahora es PRESENTE
        estadoFinal = 'presente';
        updateData = {
          estado: 'presente',  // ⭐ AHORA SÍ SE PONE PRESENTE
          segunda_pasada: true,
          segunda_pasada_at: `${fechaHoy} ${horaActual}`
        };
      } else if (registroActual.estado === 'retardo') {
        // Si ya era retardo, se mantiene
        estadoFinal = 'retardo';
        updateData = {
          segunda_pasada: true,
          segunda_pasada_at: `${fechaHoy} ${horaActual}`
          // No cambiamos el estado, ya es retardo
        };
      } else {
        return res.status(400).json({
          success: false,
          error: 'Estado inválido para segunda pasada'
        });
      }
      
      marcarUsado = true; // Ahora sí marcar como usado

    } else {
      return res.status(400).json({
        success: false,
        error: 'Estado de asistencia no válido'
      });
    }

    // Actualizar el registro
    const { data: actualizado, error: errorUpdate } = await supabase
      .from('attendance')
      .update(updateData)
      .eq('user_id', user_id)
      .eq('clase_id', clase_id)
      .gte('fecha', `${fechaHoy} 00:00:00`)
      .lte('fecha', `${fechaHoy} 23:59:59`)
      .select();

    if (errorUpdate) {
      console.error('❌ Error actualizando asistencia:', errorUpdate);
      return res.status(500).json({
        success: false,
        error: 'Error al actualizar asistencia',
        detalles: errorUpdate.message
      });
    }

    if (!actualizado || actualizado.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No se encontró registro de asistencia para actualizar'
      });
    }

    console.log('✅ Asistencia actualizada:', actualizado[0]);

    res.json({
      success: true,
      data: {
        ...actualizado[0],
        estado_final: estadoFinal,
        marcar_usado: marcarUsado
      },
      mensaje: 'Asistencia registrada correctamente'
    });

  } catch (err) {
    console.error('❌ Error en /registrar-asistencia:', err);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      detalles: err.message
    });
  }
});

export default router