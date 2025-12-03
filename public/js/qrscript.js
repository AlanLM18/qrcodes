const input = document.getElementById('qr-input');
const btnBuscar = document.getElementById('btnBuscar');
const estado = document.getElementById('estado');
const credencialContainer = document.getElementById('credencial-container');

// Botones de tipo de acceso
const btnEntrada = document.getElementById('btnEntrada');
const btnSalida = document.getElementById('btnSalida');
const btnClase1 = document.getElementById('btnClase1');
const btnClase2 = document.getElementById('btnClase2');

const botones = [btnEntrada, btnSalida, btnClase1, btnClase2];

// Estado inicial
estado.textContent = 'Modo: Entrada Principal - Escanee un código QR';
estado.className = 'alert-custom info';

// Variables globales para el tipo de acceso seleccionado
let tipoAccesoActual = 'entrada';
let zoneIdActual = 'b8f5178d-6864-4865-ab43-295fe5dca7c6';
let nombreModoActual = 'Entrada Principal';
let claseIdActual = null;
let modoClase = false;

// Variables para control de tiempo de clase
let horaInicioClase = null;
let tiempoTranscurrido = 0; // en segundos
let intervaloTemporizador = null;

// Variable para evitar escaneos duplicados
let procesando = false;

// Configuración de horarios de clase
const configClases = {
  'd9a94c99-aa9e-45d1-a30f-7f17483639e0': { // Aula 1
    horaInicio: 18, // 6:00 PM
    minutoInicio: 0,
    grupo: 'IDGS15',
    diaSemana: 1, // Lunes
    nombre: 'Aula 1 - Lunes 6:00 pm'
  },
  'd10a5999-f41c-4178-923c-6e9e683508fa': { // Aula 2
    horaInicio: 19, // 7:00 PM
    minutoInicio: 0,
    grupo: null,
    diaSemana: 2, // Martes
    nombre: 'Aula 2 - Martes 7:00 pm'
  }
};

// Función para iniciar el temporizador de clase
function iniciarTemporizadorClase(claseId) {
  const config = configClases[claseId];
  if (!config) return;

  const ahora = new Date();
  const diaActual = ahora.getDay();
  
  if (diaActual !== config.diaSemana) {
    console.log(` Hoy no es el día de esta clase (esperado: ${config.diaSemana}, actual: ${diaActual})`);
  }

  horaInicioClase = new Date();
  horaInicioClase.setHours(config.horaInicio, config.minutoInicio, 0, 0);
  
  tiempoTranscurrido = 0;
  
  if (intervaloTemporizador) {
    clearInterval(intervaloTemporizador);
  }
  
  intervaloTemporizador = setInterval(() => {
    tiempoTranscurrido++;
    actualizarEstadoTemporizador();
  }, 1000);
  
  console.log(`Temporizador iniciado para ${config.nombre}`);
  actualizarEstadoTemporizador();
}

// Función para detener el temporizador
function detenerTemporizador() {
  if (intervaloTemporizador) {
    clearInterval(intervaloTemporizador);
    intervaloTemporizador = null;
  }
  tiempoTranscurrido = 0;
  horaInicioClase = null;
}

// Función para actualizar el estado con el tiempo transcurrido
function actualizarEstadoTemporizador() {
  if (!modoClase || !horaInicioClase) return;
  
  const minutos = Math.floor(tiempoTranscurrido / 60);
  const segundos = tiempoTranscurrido % 60;
  
  let estadoTiempo = '';
  if (tiempoTranscurrido <= 120) { // 0-2 minutos
    estadoTiempo = 'PRIMERA PASADA (Media Asistencia)';
  } else if (tiempoTranscurrido <= 180) { // 2-3 minutos
    estadoTiempo = 'RETARDO (Última oportunidad)';
  } else if (tiempoTranscurrido < 600) { // 3-10 minutos
    estadoTiempo = 'FUERA DE TIEMPO (No se aceptan códigos)';
  } else { // +10 minutos
    estadoTiempo = ' SEGUNDA PASADA (Solo para quien pasó primera vez)';
  }
  
  estado.textContent = `Modo: ${nombreModoActual} | Tiempo: ${minutos}:${segundos.toString().padStart(2, '0')} | ${estadoTiempo}`;
  estado.className = 'alert-custom info';
}

// Función para calcular el estado de asistencia basado en el tiempo
function calcularEstadoAsistencia() {
  if (!modoClase || !horaInicioClase) {
    return 'presente';
  }
  
  const segundos = tiempoTranscurrido;
  
  if (segundos <= 120) { // 0-2 minutos
    return 'primera_pasada_presente';
  } else if (segundos <= 180) { // 2-3 minutos
    return 'retardo_directo';
  } else if (segundos < 600) { // 3-10 minutos
    return 'fuera_de_tiempo';
  } else { // +10 minutos
    return 'segunda_pasada';
  }
}

// Función para cambiar el modo de acceso
function cambiarModo(boton) {
  botones.forEach(btn => btn.classList.remove('active'));
  boton.classList.add('active');
  
  tipoAccesoActual = boton.dataset.tipo;
  zoneIdActual = boton.dataset.zone;
  claseIdActual = boton.dataset.clase || null;
  nombreModoActual = boton.textContent.trim();
  modoClase = claseIdActual !== null;
  
  detenerTemporizador();
  
  if (modoClase && claseIdActual) {
    iniciarTemporizadorClase(claseIdActual);
  } else {
    estado.textContent = `Modo: ${nombreModoActual} - Escanee un código QR`;
    estado.className = 'alert-custom info';
  }
  
  input.value = '';
  input.focus();
  
  console.log('Modo cambiado:', { 
    tipo: tipoAccesoActual, 
    zone: zoneIdActual, 
    nombre: nombreModoActual,
    claseId: claseIdActual,
    modoClase: modoClase
  });
}

// Event listeners para los botones
btnEntrada.addEventListener('click', () => cambiarModo(btnEntrada));
btnSalida.addEventListener('click', () => cambiarModo(btnSalida));
btnClase1.addEventListener('click', () => cambiarModo(btnClase1));
btnClase2.addEventListener('click', () => cambiarModo(btnClase2));

// Consultar usuario por código QR
async function consultarUsuario(codigoQR) {
  if (!codigoQR || !codigoQR.trim()) {
    estado.textContent = 'Ingrese un código QR válido';
    estado.className = 'alert-custom danger';
    return;
  }

  if (procesando) {
    console.log('Ya hay un proceso en curso...');
    return;
  }

  procesando = true;
  estado.textContent = 'Validando código QR...';
  estado.className = 'alert-custom warning';

  try {
    const resp = await fetch(`/buscar-qr/${encodeURIComponent(codigoQR)}`);
    const data = await resp.json();

    if (data.existe) {
      const usuario = data.usuario;

      if (usuario.activo !== 1) {
        estado.textContent = 'Acceso denegado: el usuario no está activo.';
        estado.className = 'alert-custom danger';
        credencialContainer.innerHTML = '';
        resetearEscaner();
        return;
      }

      if (modoClase) {
        const estadoAsistencia = calcularEstadoAsistencia();
        
        // Validar si está fuera de tiempo
        if (estadoAsistencia === 'fuera_de_tiempo') {
          estado.textContent = ' Fuera de tiempo: No se aceptan códigos entre 3-10 minutos';
          estado.className = 'alert-custom danger';
          credencialContainer.innerHTML = '';
          resetearEscaner();
          return;
        }
        
        const asistenciaRegistrada = await registrarAsistencia(
          usuario.id, 
          usuario.grupo, 
          claseIdActual, 
          codigoQR,
          estadoAsistencia
        );
        
        if (asistenciaRegistrada.success) {
          let icono = '';
          let mensaje = '';
          
          switch(asistenciaRegistrada.estado) {
            case 'primera_pasada':
              icono = '';
              mensaje = `Primera pasada (Media asistencia): ${usuario.nombre} - Debe pasar segunda vez después de 10 min`;
              break;
            case 'retardo':
              icono = '';
              mensaje = `Retardo registrado: ${usuario.nombre}`;
              break;
            case 'presente':
              icono = '';
              mensaje = `Asistencia COMPLETA (Presente): ${usuario.nombre}`;
              break;
            default:
              icono = '';
              mensaje = `Asistencia registrada: ${usuario.nombre}`;
          }
          
          estado.textContent = `${icono} ${mensaje}`;
          estado.className = 'alert-custom success';
          await mostrarCredencial(usuario);
          
          setTimeout(() => {
            resetearEscaner();
          }, 4000);
        } else {
          estado.textContent = asistenciaRegistrada.mensaje || 'Error al registrar asistencia';
          estado.className = 'alert-custom danger';
          resetearEscaner();
        }
      } else {
        // Modo entrada/salida normal
        const accesoRegistrado = await registrarAcceso(usuario.id, tipoAccesoActual, zoneIdActual, codigoQR);
        
        if (accesoRegistrado) {
          const icono = tipoAccesoActual === 'entrada' ? '🔓' : '🔒';
          estado.textContent = `${icono} ${tipoAccesoActual.toUpperCase()} registrada: ${usuario.nombre}`;
          estado.className = 'alert-custom success';
          await mostrarCredencial(usuario);
          
          setTimeout(() => {
            resetearEscaner();
          }, 3000);
        } else {
          estado.textContent = 'Error al registrar el acceso';
          estado.className = 'alert-custom danger';
          resetearEscaner();
        }
      }
    } else {
      if (data.usado) {
        estado.textContent = 'Este código QR ya fue utilizado';
      } else if (data.expirado) {
        estado.textContent = 'Este código QR ha expirado';
      } else {
        estado.textContent = 'Código QR no válido';
      }
      estado.className = 'alert-custom danger';
      credencialContainer.innerHTML = '';
      resetearEscaner();
    }
  } catch (err) {
    console.error(err);
    estado.textContent = 'Error al consultar el servidor';
    estado.className = 'alert-custom danger';
    credencialContainer.innerHTML = '';
    resetearEscaner();
  }
}

// Registrar acceso (entrada/salida)
async function registrarAcceso(userId, tipoAcceso, zoneId, codigoQR) {
  try {
    const response = await fetch('/registrar-acceso', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        zone_id: zoneId,
        tipo_acceso: tipoAcceso
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Acceso registrado correctamente:', result.data);
      await marcarQRUsado(codigoQR);
      return true;
    } else {
      console.error('Error al registrar acceso:', result.error);
      return false;
    }
  } catch (err) {
    console.error('Error al registrar acceso:', err);
    return false;
  }
}

// Registrar asistencia a clase con control de tiempos
async function registrarAsistencia(userId, grupoUsuario, claseId, codigoQR, estadoAsistencia) {
  try {
    const response = await fetch('/registrar-asistencia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        grupo: grupoUsuario,
        clase_id: claseId,
        estado_asistencia: estadoAsistencia,
        tiempo_transcurrido: tiempoTranscurrido
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('Asistencia registrada:', result.data);
      
      // Marcar QR como usado solo en ciertos casos
      if (result.data.marcar_usado) {
        await marcarQRUsado(codigoQR);
      }
      
      return { 
        success: true, 
        estado: result.data.estado_final,
        mensaje: result.mensaje
      };
    } else {
      console.error(' Error al registrar asistencia:', result.error);
      return { success: false, mensaje: result.error };
    }
  } catch (err) {
    console.error('Error al registrar asistencia:', err);
    return { success: false, mensaje: 'Error de conexión' };
  }
}

// Marcar QR como usado
async function marcarQRUsado(codigoQR) {
  try {
    const response = await fetch('/marcar-qr-usado', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        codigo: codigoQR
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log(' QR marcado como usado:', result.data);
    } else {
      console.error('Error al marcar QR como usado:', result.error);
    }
  } catch (err) {
    console.error('Error al marcar QR como usado:', err);
  }
}

// Función para resetear el escáner
function resetearEscaner() {
  procesando = false;
  input.value = '';
  input.focus();
  
  setTimeout(() => {
    credencialContainer.innerHTML = '';
    if (modoClase) {
      actualizarEstadoTemporizador();
    } else {
      estado.textContent = `Modo: ${nombreModoActual} - Escanee un código QR`;
      estado.className = 'alert-custom info';
    }
  }, 5000);
}

// Carga plantilla credencial.html
async function mostrarCredencial(usuario) {
  try {
    const tplResp = await fetch('/credencial.html');
    const template = await tplResp.text();
    credencialContainer.innerHTML = template;

    const cssHref = '/css/credencial.css';
    if (!document.querySelector(`link[href="${cssHref}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      document.head.appendChild(link);
    }

    const logo = credencialContainer.querySelector('.logo-uteq');
    if (logo) logo.src = '/images/logo_uteq.png';

    const foto = document.getElementById('fotoAlumno');
    
    if (foto) {
      if (usuario.imagen && usuario.imagen.trim() !== '') {
        if (usuario.imagen.startsWith('http')) {
          foto.src = usuario.imagen;
        } 
        else if (usuario.imagen.startsWith('/')) {
          foto.src = usuario.imagen;
        }
        else {
          foto.src = `/storage/${usuario.imagen}`;
        }
        
        foto.alt = usuario.nombre ? `Foto de ${usuario.nombre}` : 'Foto del alumno';
        
        foto.onerror = () => {
          foto.src = '/images/default_foto.png';
          foto.alt = 'Imagen no disponible';
        };
      } else {
        foto.src = '/images/default_foto.png';
        foto.alt = 'Sin foto';
      }
    }

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value ?? '---';
    };
    setText('nombreAlumno', usuario.nombre ?? '---');
    setText('matriculaAlumno', usuario.matricula ?? '---');
    setText('carreraAlumno', usuario.carrera ?? '---');
    setText('correoAlumno', usuario.correo ?? '---');
    setText('grupoAlumno', usuario.grupo ?? '---');
    setText('activoAlumno', usuario.activo ? 'Sí' : 'No');

  } catch (err) {
    console.error('Error cargando credencial:', err);
    credencialContainer.innerHTML = '<p class="text-danger">No se pudo cargar la credencial</p>';
  }
}

// Eventos
btnBuscar.addEventListener('click', () => {
  const codigo = input.value.trim();
  if (codigo) consultarUsuario(codigo);
});

input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const codigo = input.value.trim();
    if (codigo) consultarUsuario(codigo);
  }
});

// Auto-enfoque al cargar la página
window.addEventListener('load', () => {
  input.focus();
});

// Limpiar temporizador al cerrar la página
window.addEventListener('beforeunload', () => {
  detenerTemporizador();
});