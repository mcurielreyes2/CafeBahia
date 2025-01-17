# test_osma.py
from classes.asistente_osma import AsistenteOSMA

osma = AsistenteOSMA()
print("Pregunta inicial:", osma.iniciar_dialogo())

# Simula respuestas válidas (usa datos que existan en el JSON)
print("Siguiente:", osma.procesar_respuesta("ServicioX"))
print("Siguiente:", osma.procesar_respuesta("MonitoreableY"))
print("Siguiente:", osma.procesar_respuesta("Variable1, Variable2"))
print("Siguiente:", osma.procesar_respuesta("2025-01-15 08:00, 2025-01-15 17:00"))
print("Siguiente:", osma.procesar_respuesta("Hora"))