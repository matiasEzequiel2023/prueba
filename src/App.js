import React, { useRef, useEffect, useState } from 'react';
import { Holistic, POSE_CONNECTIONS } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import styled from 'styled-components';

// Estilos generales
const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  font-family: 'Helvetica Neue', sans-serif;
  background: #f2f2f2;
  min-height: 100vh;
`;

const Header = styled.h1`
  color: #333;
  margin-bottom: 20px;
`;

const VideoContainer = styled.div`
  position: relative;
  width: 90%;
  max-width: 500px;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 20px;
`;

const VideoStyled = styled.video`
  width: 100%;
  height: auto;
  position: relative;
`;

const CanvasStyled = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
`;

const FeedbackContainer = styled.div`
  width: 90%;
  max-width: 500px;
  background: #fff;
  border-radius: 10px;
  padding: 15px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  text-align: center;
  font-size: 18px;
  color: #555;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: center;
  gap: 15px;
  flex-wrap: wrap;
`;

const ExerciseButton = styled.button`
  background: ${(props) => (props.active ? '#4CAF50' : '#fff')};
  color: ${(props) => (props.active ? '#fff' : '#4CAF50')};
  border: 2px solid #4CAF50;
  border-radius: 20px;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  &:hover {
    background: #4CAF50;
    color: #fff;
  }
`;

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Estado para feedback y selección de ejercicio
  const [feedback, setFeedback] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('squat'); // 'squat' o 'biceps'

  // Función para calcular el ángulo entre 3 puntos (en grados)
  const computeAngle = (A, B, C) => {
    const radians =
      Math.atan2(C.y - B.y, C.x - B.x) -
      Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs(radians * (180.0 / Math.PI));
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  // Lógica para analizar la postura según el ejercicio seleccionado
  const analyzeExercise = (landmarks) => {
    if (!landmarks) return;

    if (selectedExercise === 'squat') {
      // Utilizamos la pierna izquierda: hip (23), knee (25) y ankle (27)
      const hip = landmarks[23];
      const knee = landmarks[25];
      const ankle = landmarks[27];

      // Calculamos el ángulo de la rodilla
      const kneeAngle = computeAngle(hip, knee, ankle);

      if (kneeAngle > 160) {
        setFeedback('¡Estás de pie! Inicia la sentadilla bajando lentamente.');
      } else if (kneeAngle <= 160 && kneeAngle > 90) {
        setFeedback('¡Bajando! Asegúrate de mantener la espalda recta.');
      } else if (kneeAngle <= 90) {
        setFeedback('¡Sentadilla completa! Vuelve a subir con control.');
      }
    } else if (selectedExercise === 'biceps') {
      // Utilizamos el brazo derecho: shoulder (12), elbow (14) y wrist (16)
      const shoulder = landmarks[12];
      const elbow = landmarks[14];
      const wrist = landmarks[16];

      // Calculamos el ángulo del codo
      const elbowAngle = computeAngle(shoulder, elbow, wrist);

      if (elbowAngle > 160) {
        setFeedback('Brazo extendido. Inicia el curl flexionando el codo.');
      } else if (elbowAngle <= 160 && elbowAngle > 40) {
        setFeedback('En movimiento... sigue con el curl.');
      } else if (elbowAngle <= 40) {
        setFeedback('¡Curl completo! Regresa a la posición inicial.');
      }
    } else {
      setFeedback('');
    }
  };

  useEffect(() => {
    const holistic = new Holistic({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults((results) => {
      // Verificar que el canvas esté disponible
      const canvas = canvasRef.current;
      if (!canvas) return; // Si el canvas no existe, no continuamos

      const ctx = canvas.getContext('2d');
      // Asegurarse de que el canvas tenga dimensiones definidas
      canvas.width = canvas.width || 640;
      canvas.height = canvas.height || 480;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      if (results.poseLandmarks) {
        // Dibuja las conexiones y landmarks
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2 });
        analyzeExercise(results.poseLandmarks);
      }
    });

    let camera = null;
    if (videoRef.current) {
      camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await holistic.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    return () => {
      if (camera) camera.stop();
    };
  }, [selectedExercise]); // Se vuelve a configurar si se cambia el ejercicio

  return (
    <Container>
      <Header>Reconocimiento y Corrección de Ejercicios</Header>

      {/* Contenedor del video */}
      <VideoContainer>
        <VideoStyled ref={videoRef} autoPlay playsInline muted />
        <CanvasStyled ref={canvasRef} width={640} height={480} />
      </VideoContainer>

      {/* Feedback de corrección */}
      <FeedbackContainer>
        <strong>Feedback:</strong>
        <p>{feedback}</p>
      </FeedbackContainer>

      {/* Botones para seleccionar ejercicio */}
      <ButtonGroup>
        <ExerciseButton
          active={selectedExercise === 'squat'}
          onClick={() => setSelectedExercise('squat')}
        >
          Sentadillas
        </ExerciseButton>
        <ExerciseButton
          active={selectedExercise === 'biceps'}
          onClick={() => setSelectedExercise('biceps')}
        >
          Bíceps Curl
        </ExerciseButton>
      </ButtonGroup>
    </Container>
  );
}

export default App;
