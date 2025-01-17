import os
import json
import time
import sys
import io
import logging
from openai import OpenAI
from groundx import GroundX

from classes.RAG import RAGService
from classes.instruction_parser import InstructionParser

# Optionally keep your stdout re-encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# 1) Logging configuration
logging.basicConfig(
    level=logging.INFO,  # or INFO, etc.
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s"
)
logger = logging.getLogger(__name__)

class Asistente:
    def __init__(self):
        """
        Initialize the Asistente class with configurations for OpenAI and GroundX APIs.
        """
        # Initialize RAG service
        self.rag_service = RAGService()
        # Load API keys and bucket ID from environment variables
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.groundx_api_key = os.getenv("GROUNDX_API_KEY")
        self.bucket_id_spanish = os.getenv("GROUNDX_BUCKET_ID_SPANISH")
        self.bucket_id_english = os.getenv("GROUNDX_BUCKET_ID_ENGLISH")
        # Load instruction from JSON file


        # If keys are not set in the environment, attempt to load from config.json
        if not self.openai_api_key or not self.groundx_api_key or not self.bucket_id_spanish or not self.bucket_id_english:
            try:
                with open('config.json') as config_file:
                    config = json.load(config_file)
                    self.openai_api_key = self.openai_api_key or config.get("OPENAI_API_KEY")
                    self.groundx_api_key = self.groundx_api_key or config.get("GROUNDX_API_KEY")
                    self.bucket_id_spanish = self.bucket_id_spanish or config.get("GROUNDX_BUCKET_ID_SPANISH")
                    self.bucket_id_english = self.bucket_id_english or config.get("GROUNDX_BUCKET_ID_ENGLISH")
            except FileNotFoundError:
                raise ValueError("Error: No API key or bucket ID found in environment variables or config.json.")

        # Validate that the bucket ID is a valid integer
        if not self.bucket_id_spanish or not str(self.bucket_id_spanish).isdigit():
            raise ValueError("Error: GROUNDX_BUCKET_ID must be a valid integer.")

        # Convert bucket ID to integer
        self.bucket_id_spanish = int(self.bucket_id_spanish)
        self.bucket_id_english = int(self.bucket_id_english)

        # Set other configurations
        self.completion_model = "gpt-4o-mini"
        instruction_parser = InstructionParser("instructions.json")
        self.instruction = instruction_parser.load_instruction()
        # self.instruction = (
        #     "Eres un asistente especializado en café y en los procesos de producción del café."
        #     "Tu objetivo principal es utilizar los documentos proporcionados relacionados con el café como la base de conocimiento principal para responder a las consultas de los usuarios."
        #     "Estos documentos abarcan la clasificación del café, los procesos de tostado, la medición del contenido de humedad, las composiciones químicas y la evolución de las especies de café."
        #     "\n\n"
        #     "Resúmenes de Documentos:"
        #     "\n- **Green Coffee Classification**: Detalla los estándares de clasificación y defectos para granos de café Arábica verde, incluyendo el contenido de humedad y características visuales."
        #     "\n- **Measuring Moisture Content**: Explica métodos como el secado en horno y medidores electrónicos para evaluar los niveles de humedad de los granos de café y mantener su calidad."
        #     "\n- **Rate of Rise in Roasting**: Destaca la importancia de monitorear los cambios de temperatura de los granos durante el tostado para garantizar una calidad constante."
        #     "\n- **Chemical Composition of Roasts**: Discute cómo los tiempos y temperaturas de tostado afectan la composición química, el sabor y el aroma del café."
        #     "\n- **Roasting as Art and Science**: Explora los cambios físicos y químicos durante el tostado, enfatizando la interacción entre el calor y el tiempo."
        #     "\n- **Coffee Tree Family Chart**: Representación visual de la evolución de las especies de café, incluyendo Arábica, Robusta y Liberica."
        #     "\n- **Efecto de las temperaturas y tiempos de tueste en la composicion quimica del cafe**: Articulo de investigación escrito por Valentina Osorio Perez"
        #     "\n- **Maquinaria para Café**: Guía técnica de maquinaria para el procesamiento del café: modelos, características y mantenimiento."
        #     "\n- **Maquinaria para Café**: Guía técnica de maquinaria para el procesamiento del café: modelos, características y mantenimiento."
        #     "\n\n - **Sistema de Clasificación de Café Arábica Verde**: Defectos, Gradaciones y Métodos Estándar."
        #     "Cómo Responder:"
        #     "\n- Responde preguntas específicas sobre tostado, clasificación y calidad del café utilizando las referencias detalladas de los documentos proporcionados."
        #     "\n- Para preguntas generales relacionadas con el café que no estén cubiertas en los documentos, proporciona respuestas basadas en tu conocimiento general, priorizando siempre el contenido de referencia proporcionado."
        #     "\n\n"
        #     "Priorización:"
        #     "\n- Siempre cita las referencias de los documentos para las respuestas basadas en estos." "Si el documento tiene un título en inglés, utiliza el TÍTULO COMPLETO o NOMBRE COMPLETO en inglés."
        #     "\n- Redirige las consultas no relacionadas con el café o que no sean relevantes a investigación externa o recursos de conocimiento general."
        #     "\n\n"
        #     "Ejemplos de Citas:"
        #     "\n- 'Según el documento **Green Coffee Classification** (página 1)...'"
        #     "\n- 'La sección sobre perfiles de tostado (**RoR**, página 3) indica...'"
        #     "\n\n"
        #     "Si la información solicitada no se encuentra en los documentos proporcionados, amablemente pide disculpas al usuario y sugiérele que contacte a Martín Garmendia de MCT (mgarmendia@mct-esco.com)."
        #     "No compartas enlaces externos en tus respuestas."
        # )

        # Initialize GroundX and OpenAI clients
        self.groundx = GroundX(api_key=self.groundx_api_key)
        self.client = OpenAI(api_key=self.openai_api_key)

        # Initialize conversation context
        self.context_history = []

        # Load coffee keywords from external file
        self.coffee_keywords = self.rag_service.load_coffee_keywords("kw_cafe.txt")

    def chat_completions(self, query: str) -> str:
        system_context = self.rag_service.groundx_search_content(query, query)

        logger.info("\n=== System Context (RAG Retrieval) ===")
        logger.info(system_context.encode('utf-8', errors='replace').decode('utf-8'))
        logger.info("=====================================\n")

        messages = [{"role": "system", "content": f"{self.instruction}\n===\n{system_context}\n==="}]
        for q, a in self.context_history:
            messages.append({"role": "user", "content": q})
            messages.append({"role": "assistant", "content": a})

        messages.append({"role": "user", "content": query})

        logger.info("\n=== Messages Sent to OpenAI API ===")
        for msg in messages:
            role = msg['role']
            content = msg['content'].encode('utf-8', errors='replace').decode('utf-8')
            logger.info(f"Role: {role}, Content: {content}\n")
        logger.info("=====================================\n")

        response = self.client.chat.completions.create(
            model=self.completion_model,
            messages=messages,
            stream=False,
            store=True
        )
        assistant_response = response.choices[0].message.content.strip()

        self.context_history.append((query, assistant_response))
        if len(self.context_history) > 10:
            self.context_history.pop(0)

        return assistant_response

    def chat_completions_stream(self, query: str):
        """
        Similar to chat_completions, but uses stream=True to yield partial chunks.
        """
        # 0) Decide if we should do RAG at all
        if self.rag_service.should_call_groundx(query):
            start_time = time.time()
            logger.info(f"chat_completions_stream called with query='{query}'")

            # 1) Translate the Spanish query into English
            query_english = self.rag_service.translate_spanish_to_english(query)
            logger.info(f"Translated to English => '{query_english}'")

            # 2) Retrieve RAG context from both Spanish & English buckets
            system_context = self.rag_service.groundx_search_content(query_spanish=query, query_english=query_english)

            after_groundx = time.time()
            logger.info("Received system_context...")
            logger.info(f"groundx_search_content took {after_groundx - start_time:.3f} seconds")

            # For debugging, print context
            logger.info("\n=== System Context (RAG Retrieval) START ===")
            logger.info(system_context.encode('utf-8', errors='replace').decode('utf-8'))
            logger.info("=System Context (RAG Retrieval) END \n")
        else:
            logger.info(f"No RAG called with query='{query}'")
            system_context = (
                "No coffee documents retrieved for this question. "
                "Respond using only your general knowledge."
            )

        after_groundx = time.time()
        # 3) Build the messages array (system + conversation history + user query)
        messages = [{"role": "system", "content": f"{self.instruction}\n===\n{system_context}\n==="}]
        for q, a in self.context_history:
            messages.append({"role": "user", "content": q})
            messages.append({"role": "assistant", "content": a})

        messages.append({"role": "user", "content": query})

        logger.info("\n=== Messages Sent to OpenAI API (Streaming) START ===")
        for msg in messages:
            role = msg['role']
            content = msg['content'].encode('utf-8', errors='replace').decode('utf-8')
            # logger.debug(f"Role: {role}, Content: {content}\n")
        logger.info("=== Messages Sent to OpenAI API (Streaming) END ===\n")

        pre_openai_time = time.time()
        logger.info(f"About to call OpenAI, {pre_openai_time - after_groundx:.3f}s since start")

        # 4) Call the OpenAI API with stream=True
        response = self.client.chat.completions.create(
            model=self.completion_model,
            messages=messages,
            stream=True,
            store=True
        )
        logger.info("Called OpenAI with stream=True")
        after_openai_call_time = time.time()
        logger.info(f"Called OpenAI, waiting for chunks, {after_openai_call_time - pre_openai_time:.3f}s since pre_call")

        # 5) The OpenAI API returns chunks as an iterator; yield partial text
        partial_answer = []
        try:
            for chunk in response:
                choice_delta = chunk.choices[0].delta
                chunk_text = choice_delta.content
                if chunk_text:
                    partial_answer.append(chunk_text)
                    yield chunk_text
        except Exception as e:
            logger.error(f"Streaming error: {e}")

        # 6) Once done, store the final combined answer in context
        final_answer = "".join(partial_answer).strip()
        self.context_history.append((query, final_answer))
        logger.info(f"Final answer length={len(final_answer)}")

        # Optionally limit history length
        if len(self.context_history) > 10:
            self.context_history.pop(0)
